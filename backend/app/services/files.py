import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))

ALLOWED_MIME: dict[str, set[str]] = {
    "video": {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"},
    "syllabus": {"application/pdf"},
    "exam": {"application/pdf"},
}

MAX_FILE_BYTES = 500 * 1024 * 1024  # 500 MB per file

YOUTUBE_URL_PATTERN = re.compile(
    r"^https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)[\w-]+"
)


def ensure_upload_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


def validate_youtube_url(url: str) -> str:
    url = url.strip()
    if not YOUTUBE_URL_PATTERN.match(url):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid YouTube URL: {url}",
        )
    return url


async def save_upload(
    job_id: str,
    file: UploadFile,
    file_type: str,
) -> tuple[str, str, str | None, int]:
    """Save an uploaded file. Returns (stored_path, original_filename, mime_type, size_bytes)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail=f"{file_type} file must have a filename")

    mime_type = file.content_type or "application/octet-stream"
    allowed = ALLOWED_MIME.get(file_type, set())
    if mime_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported {file_type} MIME type: {mime_type}. Allowed: {sorted(allowed)}",
        )

    ensure_upload_dir()
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename).suffix or ".bin"
    stored_name = f"{file_type}_{uuid.uuid4().hex}{suffix}"
    stored_path = job_dir / stored_name

    size = 0
    with stored_path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                stored_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"{file_type} file exceeds {MAX_FILE_BYTES // (1024 * 1024)} MB limit",
                )
            out.write(chunk)

    return str(stored_path), file.filename, mime_type, size
