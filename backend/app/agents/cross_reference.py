"""Cross-reference agent — links exam gaps to teaching moments with video evidence."""

import logging

from pydantic import BaseModel, Field

from app.graph.state import AgentState
from app.services.chunking import chunk_transcript, score_chunks_by_query
from app.services.infographic import generate_summary_infographic
from app.services.llm import get_llm
from app.services.videodb import get_videodb_service

logger = logging.getLogger(__name__)

_MAX_CLUSTERS = 8
_MAX_CLIP_CLUSTERS = 5

_SYSTEM = """You are an expert instructional coach producing evidence-based feedback for a teacher.

You receive:
- Structure report (lesson flow issues with timestamps)
- Clarity report (confusion heatmap with timestamps)
- Exam gap analysis (weak concept clusters from student papers)
- Retrieved teaching moments from the lecture for each exam cluster

Write a final feedback report that answers: "Where did teaching break down — and how does
that map to what students got wrong on the exam?"

For each exam cluster, explain the causal link between what was taught (or poorly taught)
at the retrieved moment and the exam mistakes. Reference structure/clarity findings when
they overlap the same timestamp range.

Be direct, constructive, and specific. Avoid generic advice. If a cluster has no retrieved
moment, say what was missing from the lecture rather than inventing a timestamp."""


class ClusterNarrative(BaseModel):
    exam_topic: str
    evidence: str = Field(description="How the teaching moment connects to exam failures")
    recommendation: str = Field(description="One actionable fix for the next lecture")


class CrossReferenceLLMOutput(BaseModel):
    summary: str = Field(description="Executive summary for the teacher")
    cluster_narratives: list[ClusterNarrative]
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


def _video_offsets(videodb_videos: list[dict]) -> dict[str, float]:
    offsets: dict[str, float] = {}
    offset = 0.0
    for video in videodb_videos:
        offsets[video["id"]] = offset
        offset += float(video.get("length") or 0)
    return offsets


def _to_global_time(
    video_id: str | None, local_sec: float, offsets: dict[str, float]
) -> float:
    if not video_id:
        return local_sec
    return offsets.get(video_id, 0.0) + local_sec


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
    offsets: dict[str, float],
) -> dict | None:
    query = _cluster_query(cluster)
    collection_id = state.get("videodb_collection_id")

    if collection_id:
        try:
            service = get_videodb_service()
            collection = service.get_collection(collection_id)
            hits = service.search_collection(collection, query, top_k=1)
            if hits:
                hit = hits[0]
                global_start = _to_global_time(hit["video_id"], hit["start"], offsets)
                global_end = _to_global_time(hit["video_id"], hit["end"], offsets)
                clip_url = None
                if hit.get("video_id"):
                    try:
                        video = collection.get_video(hit["video_id"])
                        clip_url = service.get_clip_url(
                            video, hit["start"], hit["end"]
                        )
                    except Exception as exc:
                        logger.warning("Clip URL generation failed: %s", exc)

                return {
                    "source": "videodb",
                    "start_sec": global_start,
                    "end_sec": global_end,
                    "video_id": hit["video_id"],
                    "transcript_excerpt": hit.get("text", ""),
                    "clip_url": clip_url,
                    "search_score": hit.get("score"),
                }
        except Exception as exc:
            logger.warning("VideoDB search failed for %r: %s", query, exc)

    chunk_hits = score_chunks_by_query(chunks, query, top_k=1)
    if chunk_hits:
        hit = chunk_hits[0]
        return {
            "source": "transcript_chunk",
            "start_sec": hit["start_sec"],
            "end_sec": hit["end_sec"],
            "video_id": hit.get("video_id"),
            "transcript_excerpt": hit["text"],
            "clip_url": None,
            "search_score": None,
        }

    return None


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


def _build_llm_context(
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
        for mistake in cluster.get("example_mistakes", []):
            lines.append(f"  • {mistake}")
        if retrieval:
            lines.append(
                f"Retrieved teaching moment ({retrieval['source']}): "
                f"{retrieval['start_sec']:.0f}s–{retrieval['end_sec']:.0f}s"
            )
            lines.append(f'Excerpt: "{retrieval.get("transcript_excerpt", "")[:400]}"')
        else:
            lines.append("Retrieved teaching moment: none found")
        lines.append("")

    return "\n".join(lines)


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
    offsets = _video_offsets(state.get("videodb_videos") or [])

    retrievals = [
        _retrieve_moment(state, cluster, chunks, offsets) for cluster in weak_clusters
    ]

    llm = get_llm().with_structured_output(CrossReferenceLLMOutput)
    llm_result: CrossReferenceLLMOutput = llm.invoke(
        [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": _build_llm_context(state, weak_clusters, retrievals)
                + "\n\nProduce the cross-reference feedback report.",
            },
        ]
    )

    narrative_by_topic = {n.exam_topic: n for n in llm_result.cluster_narratives}

    cross_references: list[dict] = []
    for i, cluster in enumerate(weak_clusters):
        retrieval = retrievals[i]
        topic = cluster.get("topic", "Unknown")
        narrative = narrative_by_topic.get(topic)

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
            "evidence": narrative.evidence if narrative else "",
            "recommendation": narrative.recommendation if narrative else "",
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
        "summary": llm_result.summary,
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
        "recommendations": llm_result.recommendations,
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
        summary=llm_result.summary,
        recommendations=llm_result.recommendations,
        structure_score=structure.get("score"),
        clarity_score=clarity.get("score"),
        exam_gaps=weak_clusters,
    ):
        final_report["summary_infographic"] = True

    return {"final_report": final_report}
