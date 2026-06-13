"""Shared context builders for LLM agents.

Turns pipeline state (transcript, syllabus PDF, exam PDFs) into prompt strings
for structure, clarity, and exam agents. Char limits keep prompts within model
context windows without changing agent code.
"""

import re
from pathlib import Path

from app.graph.state import AgentState
from app.services.parsing import extract_pdf_text

# Structure/clarity agents share one transcript block.
_TRANSCRIPT_CHAR_LIMIT = 14_000
# Syllabus is included in every agent prompt for topic alignment.
_SYLLABUS_CHAR_LIMIT = 6_000
# Exam batch: sample_data has 15 papers × ~3.5k chars ≈ 52k total.
_EXAM_CHAR_LIMIT_PER_PAPER = 5_000
_EXAM_TOTAL_CHAR_LIMIT = 55_000


def format_transcript(transcript: list[dict]) -> str:
    """Render timestamped segments as [start – end] text lines for the LLM."""
    if not transcript:
        return "(no transcript available)"

    lines: list[str] = []
    total = 0
    for seg in transcript:
        line = f"[{seg['start']:.1f}s – {seg['end']:.1f}s] {seg['text']}"
        # Stop early rather than silently truncating mid-segment.
        if total + len(line) > _TRANSCRIPT_CHAR_LIMIT:
            lines.append("...[transcript truncated for context window]")
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


def load_syllabus_text(state: AgentState) -> str:
    """Extract syllabus PDF text; returns a placeholder if missing or unreadable."""
    path = state.get("syllabus_path")
    if not path:
        return "(no syllabus provided)"
    try:
        return extract_pdf_text(path, max_chars=_SYLLABUS_CHAR_LIMIT)
    except Exception as exc:
        return f"(syllabus could not be parsed: {exc})"


def lecture_context(state: AgentState) -> str:
    """Prompt block for structure and clarity agents (transcript + syllabus)."""
    return f"""Teacher: {state['teacher_name']}
Target audience: {state['audience']}

Syllabus:
{load_syllabus_text(state)}

Timestamped transcript:
{format_transcript(state.get('transcript') or [])}
"""


def _exam_paper_label(path: str, index: int) -> str:
    """Derive a human label from upload filename when possible.

    sample_data uses Student_10_Kavitha_Raj.pdf → "Kavitha Raj" so the LLM
    can reference individual papers in frequency estimates.
    """
    stem = Path(path).stem
    match = re.match(r"Student_\d+_(.+)", stem)
    if match:
        return match.group(1).replace("_", " ")
    return f"Exam paper {index}"


def load_exam_texts(exam_paths: list[str]) -> list[tuple[str, str]]:
    """Parse each exam PDF into (label, text) pairs.

    Applies per-paper and total char caps. Papers beyond the budget are marked
    skipped rather than dropped silently so the agent knows data is incomplete.
    """
    papers: list[tuple[str, str]] = []
    total = 0

    for i, path in enumerate(exam_paths, start=1):
        label = _exam_paper_label(path, i)
        try:
            remaining = _EXAM_TOTAL_CHAR_LIMIT - total
            if remaining <= 0:
                papers.append((label, "...(skipped — total context limit reached)"))
                continue

            per_paper_limit = min(_EXAM_CHAR_LIMIT_PER_PAPER, remaining)
            text = extract_pdf_text(path, max_chars=per_paper_limit)
            if not text.strip():
                text = "(no extractable text)"
            papers.append((label, text))
            total += len(text)
        except Exception as exc:
            papers.append((label, f"(could not be parsed: {exc})"))

    return papers


def exam_context(state: AgentState) -> str:
    """Prompt block for the exam agent (syllabus + all student papers)."""
    exam_paths = state.get("exam_paths") or []
    papers = load_exam_texts(exam_paths)

    sections = [
        f"Teacher: {state['teacher_name']}",
        f"Target audience: {state['audience']}",
        f"Number of exam papers: {len(exam_paths)}",
        "",
        "Syllabus:",
        load_syllabus_text(state),
        "",
    ]

    for label, text in papers:
        sections.extend([f"--- {label} ---", text, ""])

    return "\n".join(sections).strip()
