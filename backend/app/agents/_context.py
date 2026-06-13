"""Shared context builders for LLM agents."""

from app.graph.state import AgentState
from app.services.parsing import extract_pdf_text

_TRANSCRIPT_CHAR_LIMIT = 14_000
_SYLLABUS_CHAR_LIMIT = 6_000


def format_transcript(transcript: list[dict]) -> str:
    if not transcript:
        return "(no transcript available)"

    lines: list[str] = []
    total = 0
    for seg in transcript:
        line = f"[{seg['start']:.1f}s – {seg['end']:.1f}s] {seg['text']}"
        if total + len(line) > _TRANSCRIPT_CHAR_LIMIT:
            lines.append("...[transcript truncated for context window]")
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


def load_syllabus_text(state: AgentState) -> str:
    path = state.get("syllabus_path")
    if not path:
        return "(no syllabus provided)"
    try:
        return extract_pdf_text(path, max_chars=_SYLLABUS_CHAR_LIMIT)
    except Exception as exc:
        return f"(syllabus could not be parsed: {exc})"


def lecture_context(state: AgentState) -> str:
    return f"""Teacher: {state['teacher_name']}
Target audience: {state['audience']}

Syllabus:
{load_syllabus_text(state)}

Timestamped transcript:
{format_transcript(state.get('transcript') or [])}
"""
