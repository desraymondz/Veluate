import shutil
import uuid
from pathlib import Path

from app.services.files import UPLOAD_DIR, ensure_upload_dir

MIME_BY_TYPE = {
    "video": "video/mp4",
    "syllabus": "application/pdf",
    "exam": "application/pdf",
}


def copy_local_file(
    job_id: str,
    source: str | Path,
    file_type: str,
) -> tuple[str, str, str, int]:
    """Copy a file on disk into the job upload directory.

    Returns (stored_path, original_filename, mime_type, size_bytes).
    """
    src = Path(source)
    if not src.is_file():
        raise FileNotFoundError(f"{file_type} file not found: {src}")

    ensure_upload_dir()
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = src.suffix or ".bin"
    stored_name = f"{file_type}_{uuid.uuid4().hex}{suffix}"
    dest = job_dir / stored_name
    shutil.copy2(src, dest)
    size = dest.stat().st_size
    mime = MIME_BY_TYPE.get(file_type, "application/octet-stream")
    return str(dest), src.name, mime, size
