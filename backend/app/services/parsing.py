"""Document text extraction for syllabus and exam PDFs."""

from pathlib import Path

from pypdf import PdfReader


def extract_pdf_text(path: str, max_chars: int | None = None) -> str:
    reader = PdfReader(Path(path))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text.strip())
    full = "\n\n".join(parts).strip()
    if max_chars and len(full) > max_chars:
        return full[:max_chars] + "\n...[truncated]"
    return full
