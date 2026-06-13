"""Optional executive-summary infographic via OpenAI image generation."""

import base64
import logging
import os
from pathlib import Path

from app.services.files import UPLOAD_DIR, ensure_upload_dir

logger = logging.getLogger(__name__)

SUMMARY_INFOGRAPHIC_NAME = "summary_infographic.png"
_DEFAULT_IMAGE_MODEL = "gpt-image-2"


def openai_image_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def summary_infographic_path(job_id: str) -> Path:
    return UPLOAD_DIR / job_id / SUMMARY_INFOGRAPHIC_NAME


def _truncate(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _build_prompt(
    *,
    teacher_name: str,
    summary: str,
    recommendations: list[str],
    structure_score: float | int | None,
    clarity_score: float | int | None,
    exam_gaps: list[dict],
) -> str:
    scores: list[str] = []
    if structure_score is not None:
        scores.append(f"Structure {structure_score}/10")
    if clarity_score is not None:
        scores.append(f"Clarity {clarity_score}/10")

    gap_topics = [
        g.get("topic", "")
        for g in exam_gaps[:3]
        if g.get("topic")
    ]
    actions = recommendations[:3]

    lines = [
        "Create a clean teaching evaluation infographic in landscape format.",
        "",
        "Visual style: minimal editorial report card. Off-white paper background (#FAFAFA), "
        "black ink text (#0A0A0A), deep navy (#1A1A6E) accent for score badges only. "
        "No photos, no mascots, no stock illustrations. Use simple geometric blocks, "
        "thin dividers, small bar or gauge motifs, and numbered priority lists. "
        "Serif-style headline, sans-serif body. Generous whitespace. All text legible.",
        "",
        f'Title: "Teaching Evaluation — {teacher_name}"',
        "",
        "Include these content blocks:",
    ]

    if scores:
        lines.append(f"- Score badges: {', '.join(scores)}")
    lines.append(f'- Executive summary (short paragraph): "{_truncate(summary, 320)}"')

    if actions:
        lines.append("- Priority actions (numbered list):")
        for i, action in enumerate(actions, start=1):
            lines.append(f"  {i}. {_truncate(action, 120)}")

    if gap_topics:
        lines.append(f"- Key exam gaps to highlight: {', '.join(gap_topics)}")

    lines.extend(
        [
            "",
            "Layout: left column for scores + summary, right column for actions and exam gaps, "
            "or a balanced two-row dashboard. No clutter. No watermarks.",
        ]
    )
    return "\n".join(lines)


def generate_summary_infographic(
    job_id: str,
    *,
    teacher_name: str,
    summary: str,
    recommendations: list[str],
    structure_score: float | int | None,
    clarity_score: float | int | None,
    exam_gaps: list[dict],
) -> Path | None:
    """Generate and save a summary infographic. Returns path or None if skipped/failed."""
    if not openai_image_configured():
        return None

    from openai import OpenAI

    model = os.getenv("OPENAI_IMAGE_MODEL", _DEFAULT_IMAGE_MODEL)
    prompt = _build_prompt(
        teacher_name=teacher_name,
        summary=summary,
        recommendations=recommendations,
        structure_score=structure_score,
        clarity_score=clarity_score,
        exam_gaps=exam_gaps,
    )

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.images.generate(
            model=model,
            prompt=prompt,
            size="1536x1024",
            quality="medium",
        )
        item = response.data[0] if response.data else None
        if not item or not item.b64_json:
            logger.warning("OpenAI image response missing data for job %s", job_id)
            return None

        ensure_upload_dir()
        out_path = summary_infographic_path(job_id)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(base64.b64decode(item.b64_json))
        logger.info("Summary infographic saved for job %s (%s)", job_id, out_path)
        return out_path
    except Exception as exc:
        logger.warning(
            "Summary infographic generation failed for job %s: %s", job_id, exc
        )
        return None
