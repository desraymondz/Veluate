"""Cross-reference agent — links exam gaps to teaching moments with video evidence."""

import logging

from pydantic import BaseModel, Field

from app.graph.state import AgentState
from app.services.chunking import chunk_transcript
from app.services.infographic import generate_summary_infographic
from app.services.lecture_search import search_lecture_moment
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

_MAX_CLUSTERS = 8
_MAX_CLIP_CLUSTERS = 5

_SUMMARY_SYSTEM = """You are an expert instructional coach producing evidence-based feedback for a teacher.

You receive structure, clarity, and exam gap reports plus retrieved teaching moments for each exam cluster.

Write:
1. An executive summary (2–4 sentences) answering: where did teaching break down and how does that
   map to what students got wrong on the exam?
2. Up to 6 priority recommendations across all findings — specific and actionable, not generic.

Be direct and constructive."""

_CLUSTER_SYSTEM = """You are an expert instructional coach linking one exam weakness cluster to a teaching moment.

Explain the causal link between what was taught (or poorly taught) at the retrieved moment and the
exam mistakes. Reference structure/clarity findings when they overlap the same timestamp range.

If no teaching moment was retrieved, explain what was missing from the lecture — do not invent a timestamp.

Keep evidence to 2–4 sentences and the recommendation to one concrete fix for the next lecture."""


class ClusterNarrative(BaseModel):
    evidence: str = Field(
        max_length=800,
        description="How the teaching moment connects to exam failures",
    )
    recommendation: str = Field(
        max_length=400,
        description="One actionable fix for the next lecture",
    )


class CrossReferenceSummaryOutput(BaseModel):
    summary: str = Field(max_length=1200, description="Executive summary for the teacher")
    recommendations: list[str] = Field(
        max_length=6, description="Top priority improvements across all findings"
    )


def _require_upstream(state: AgentState) -> None:
    missing = [
        name
        for name, key in (
            ("structure", "structure_report"),
            ("clarity", "clarity_report"),
            ("exam", "exam_analysis"),
        )
        if not state.get(key)
    ]
    if missing:
        raise ValueError(
            f"Cross-reference requires upstream reports: {', '.join(missing)}"
        )


def _cluster_query(cluster: dict) -> str:
    parts = [cluster.get("topic", "")]
    if cluster.get("syllabus_section"):
        parts.append(cluster["syllabus_section"])
    parts.extend(cluster.get("example_mistakes", [])[:2])
    return " ".join(p for p in parts if p)


def _retrieve_moment(
    state: AgentState,
    cluster: dict,
    chunks: list[dict],
) -> dict | None:
    return search_lecture_moment(
        _cluster_query(cluster),
        transcript=state.get("transcript") or [],
        videodb_collection_id=state.get("videodb_collection_id"),
        videodb_videos=state.get("videodb_videos") or [],
        chunks=chunks,
    )


def _overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> bool:
    return a_start <= b_end and b_start <= a_end


def _related_clarity(heatmap: list[dict], start: float, end: float) -> dict | None:
    for point in heatmap:
        if _overlap(start, end, point["start_sec"], point["end_sec"]):
            return point
    return None


def _related_structure(findings: list[dict], timestamp: float) -> dict | None:
    best = None
    best_dist = 120.0  # seconds
    for finding in findings:
        ts = finding.get("timestamp_sec")
        if ts is None:
            continue
        dist = abs(ts - timestamp)
        if dist < best_dist:
            best_dist = dist
            best = finding
    return best


def _build_summary_context(
    state: AgentState,
    weak_clusters: list[dict],
    retrievals: list[dict | None],
) -> str:
    structure = state["structure_report"]
    clarity = state["clarity_report"]
    exam = state["exam_analysis"]

    lines = [
        f"Teacher: {state['teacher_name']}",
        f"Audience: {state['audience']}",
        "",
        "=== Structure report ===",
        f"Score: {structure.get('score')}/10",
        structure.get("summary", ""),
        "",
        "Findings:",
    ]
    for f in structure.get("findings", [])[:8]:
        ts = f.get("timestamp_sec")
        ts_label = f" @{ts:.0f}s" if ts is not None else ""
        lines.append(f"- [{f.get('severity')}] {f.get('type')}{ts_label}: {f.get('detail')}")

    lines.extend(
        [
            "",
            "=== Clarity report ===",
            f"Score: {clarity.get('score')}/10",
            clarity.get("summary", ""),
            "",
            "Confusion heatmap:",
        ]
    )
    for h in clarity.get("heatmap", [])[:8]:
        lines.append(
            f"- {h['start_sec']:.0f}s–{h['end_sec']:.0f}s "
            f"(severity {h['severity']:.2f}): {h['reason']}"
        )

    lines.extend(
        [
            "",
            "=== Exam gap analysis ===",
            exam.get("summary", ""),
            f"Papers analyzed: {exam.get('exam_count', 0)}",
            "",
        ]
    )

    for cluster, retrieval in zip(weak_clusters, retrievals):
        lines.append(f"--- Exam cluster: {cluster.get('topic')} ---")
        if cluster.get("syllabus_section"):
            lines.append(f"Syllabus: {cluster['syllabus_section']}")
        lines.append(f"Frequency: {cluster.get('frequency', 0):.0%}")
        lines.append("Example mistakes:")
        for mistake in cluster.get("example_mistakes", [])[:3]:
            lines.append(f"  • {mistake}")
        if retrieval:
            lines.append(
                f"Retrieved teaching moment ({retrieval['source']}): "
                f"{retrieval['start_sec']:.0f}s–{retrieval['end_sec']:.0f}s"
            )
            lines.append(f'Excerpt: "{retrieval.get("transcript_excerpt", "")[:300]}"')
        else:
            lines.append("Retrieved teaching moment: none found")
        lines.append("")

    return "\n".join(lines)


def _build_cluster_context(
    state: AgentState,
    cluster: dict,
    retrieval: dict | None,
) -> str:
    structure = state["structure_report"]
    clarity = state["clarity_report"]
    heatmap = clarity.get("heatmap") or []
    findings = structure.get("findings") or []

    lines = [
        f"Teacher: {state['teacher_name']}",
        f"Audience: {state['audience']}",
        "",
        f"Exam cluster topic: {cluster.get('topic')}",
    ]
    if cluster.get("syllabus_section"):
        lines.append(f"Syllabus section: {cluster['syllabus_section']}")
    lines.append(f"Frequency across papers: {cluster.get('frequency', 0):.0%}")
    lines.append("Example exam mistakes:")
    for mistake in cluster.get("example_mistakes", []):
        lines.append(f"  • {mistake}")

    if retrieval:
        lines.extend(
            [
                "",
                f"Retrieved teaching moment ({retrieval.get('source', 'search')}): "
                f"{retrieval['start_sec']:.0f}s–{retrieval['end_sec']:.0f}s",
                f'Excerpt: "{retrieval.get("transcript_excerpt", "")[:500]}"',
            ]
        )
        clarity_link = _related_clarity(
            heatmap, retrieval["start_sec"], retrieval["end_sec"]
        )
        structure_link = _related_structure(findings, retrieval["start_sec"])
        if clarity_link:
            lines.append(
                f"Overlapping clarity issue ({clarity_link['start_sec']:.0f}s–"
                f"{clarity_link['end_sec']:.0f}s, severity {clarity_link['severity']:.2f}): "
                f"{clarity_link['reason']}"
            )
        if structure_link:
            lines.append(
                f"Nearby structure finding [{structure_link.get('severity')}]: "
                f"{structure_link.get('detail')}"
            )
    else:
        lines.append("")
        lines.append("Retrieved teaching moment: none found for this cluster.")

    return "\n".join(lines)


def _generate_summary(
    state: AgentState,
    weak_clusters: list[dict],
    retrievals: list[dict | None],
) -> CrossReferenceSummaryOutput:
    llm = get_llm().with_structured_output(CrossReferenceSummaryOutput)
    return llm.invoke(
        [
            {"role": "system", "content": _SUMMARY_SYSTEM},
            {
                "role": "user",
                "content": _build_summary_context(state, weak_clusters, retrievals)
                + "\n\nProduce the executive summary and priority recommendations.",
            },
        ]
    )


def _generate_cluster_narrative(
    state: AgentState,
    cluster: dict,
    retrieval: dict | None,
) -> ClusterNarrative:
    llm = get_llm().with_structured_output(ClusterNarrative)
    return llm.invoke(
        [
            {"role": "system", "content": _CLUSTER_SYSTEM},
            {
                "role": "user",
                "content": _build_cluster_context(state, cluster, retrieval)
                + "\n\nProduce the evidence link and one recommendation for this cluster.",
            },
        ]
    )


def _empty_narrative() -> ClusterNarrative:
    return ClusterNarrative(
        evidence="Cross-reference narrative could not be generated for this cluster.",
        recommendation="Review this topic in the next lecture with a worked example.",
    )


def run_cross_reference_analysis(state: AgentState) -> dict:
    _require_upstream(state)

    structure = state["structure_report"]
    clarity = state["clarity_report"]
    exam = state["exam_analysis"]
    heatmap = clarity.get("heatmap") or []
    findings = structure.get("findings") or []
    weak_clusters = (exam.get("weak_clusters") or [])[:_MAX_CLUSTERS]

    transcript = state.get("transcript") or []
    chunks = chunk_transcript(transcript)
    retrievals = [
        _retrieve_moment(state, cluster, chunks) for cluster in weak_clusters
    ]

    summary_result = _generate_summary(state, weak_clusters, retrievals)

    narratives: list[ClusterNarrative] = []
    for cluster, retrieval in zip(weak_clusters, retrievals):
        try:
            narratives.append(_generate_cluster_narrative(state, cluster, retrieval))
        except Exception as exc:
            logger.warning(
                "Cluster narrative failed for %r in job %s: %s",
                cluster.get("topic"),
                state["job_id"],
                exc,
            )
            narratives.append(_empty_narrative())

    cross_references: list[dict] = []
    for i, cluster in enumerate(weak_clusters):
        retrieval = retrievals[i]
        topic = cluster.get("topic", "Unknown")
        narrative = narratives[i] if i < len(narratives) else _empty_narrative()

        entry: dict = {
            "exam_topic": topic,
            "syllabus_section": cluster.get("syllabus_section"),
            "exam_frequency": cluster.get("frequency"),
            "example_mistakes": cluster.get("example_mistakes", []),
            "teaching_timestamp": retrieval["start_sec"] if retrieval else None,
            "teaching_end_sec": retrieval["end_sec"] if retrieval else None,
            "video_id": retrieval.get("video_id") if retrieval else None,
            "transcript_excerpt": retrieval.get("transcript_excerpt") if retrieval else None,
            "clip_url": retrieval.get("clip_url") if retrieval else None,
            "retrieval_source": retrieval.get("source") if retrieval else None,
            "evidence": narrative.evidence,
            "recommendation": narrative.recommendation,
            "structure_link": None,
            "clarity_link": None,
        }

        if retrieval:
            entry["structure_link"] = _related_structure(
                findings, retrieval["start_sec"]
            )
            entry["clarity_link"] = _related_clarity(
                heatmap, retrieval["start_sec"], retrieval["end_sec"]
            )

        cross_references.append(entry)

    severity_rank: dict[str, int] = {"high": 0, "medium": 1, "low": 2}
    structure_highlights = sorted(
        findings,
        key=lambda f: severity_rank.get(f.get("severity", "low"), 3),
    )[:5]

    final_report = {
        "summary": summary_result.summary,
        "teacher_name": state["teacher_name"],
        "structure_score": structure.get("score"),
        "clarity_score": clarity.get("score"),
        "structure_highlights": structure_highlights,
        "top_confusion_moments": sorted(
            heatmap, key=lambda h: h.get("severity", 0), reverse=True
        )[:5],
        "exam_gaps": weak_clusters,
        "exam_summary": exam.get("summary"),
        "cross_references": cross_references,
        "recommendations": summary_result.recommendations,
        "evidence_clips": [
            {
                "exam_topic": ref["exam_topic"],
                "start_sec": ref["teaching_timestamp"],
                "end_sec": ref["teaching_end_sec"],
                "clip_url": ref["clip_url"],
            }
            for ref in cross_references[:_MAX_CLIP_CLUSTERS]
            if ref.get("clip_url")
        ],
    }

    if generate_summary_infographic(
        state["job_id"],
        teacher_name=state["teacher_name"],
        summary=summary_result.summary,
        recommendations=summary_result.recommendations,
        structure_score=structure.get("score"),
        clarity_score=clarity.get("score"),
        exam_gaps=weak_clusters,
    ):
        final_report["summary_infographic"] = True

    return {"final_report": final_report}
