"""Create and run a demo job from sample_data/ assets."""

import logging
import uuid
from pathlib import Path

from app.db.models import FileType, Job, JobFile, JobStatus
from app.db.session import async_session_factory
from app.services.demo import copy_local_file
from app.services.files import validate_youtube_url
from app.services.pipeline import run_job

logger = logging.getLogger(__name__)

DEFAULT_TEACHER = "Dr Lee"
DEFAULT_AUDIENCE = "Psychology undergrads — Foundations of Psychology"


class DemoSetupError(Exception):
    pass


def _resolve_sample_dir(sample_dir: Path | None) -> Path:
    if sample_dir:
        root = sample_dir.resolve()
    else:
        # repo_root/sample_data from backend/app/services/demo_jobs.py
        root = Path(__file__).resolve().parents[3] / "sample_data"
    if not root.is_dir():
        raise DemoSetupError(f"Sample data directory not found: {root}")
    return root


def _find_syllabus(sample_root: Path, syllabus_override: Path | None) -> Path:
    if syllabus_override:
        path = syllabus_override.resolve()
        if not path.is_file():
            raise DemoSetupError(f"Syllabus not found: {path}")
        return path

    for candidate in (
        sample_root / "syllabus" / "syllabus.pdf",
        sample_root / "syllabus.pdf",
    ):
        if candidate.is_file():
            return candidate

    raise DemoSetupError(
        "No syllabus PDF found. Add sample_data/syllabus/syllabus.pdf "
        "or pass --syllabus /path/to/syllabus.pdf"
    )


def _find_videos(sample_root: Path) -> list[Path]:
    video_dir = sample_root / "video"
    if not video_dir.is_dir():
        return []
    return sorted(
        p
        for p in video_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".mp4", ".webm", ".mov", ".avi"}
    )


def _find_exams(sample_root: Path, max_exams: int | None) -> list[Path]:
    exam_dir = sample_root / "exams"
    if not exam_dir.is_dir():
        return []
    exams = sorted(exam_dir.glob("*.pdf"))
    if max_exams is not None:
        exams = exams[:max_exams]
    return exams


async def create_demo_job(
    *,
    youtube_url: str | None = None,
    sample_dir: Path | None = None,
    syllabus_path: Path | None = None,
    teacher_name: str = DEFAULT_TEACHER,
    audience: str = DEFAULT_AUDIENCE,
    max_exams: int | None = None,
) -> str:
    """Register a job from sample_data files and return job_id."""
    sample_root = _resolve_sample_dir(sample_dir)
    syllabus = _find_syllabus(sample_root, syllabus_path)
    videos = _find_videos(sample_root)
    exams = _find_exams(sample_root, max_exams)

    if not youtube_url and not videos:
        raise DemoSetupError(
            "No lecture source found. Add sample_data/video/lecture.mp4 "
            "or pass --youtube-url (or set DEMO_YOUTUBE_URL)."
        )

    if youtube_url:
        youtube_url = validate_youtube_url(youtube_url)

    job_id = str(uuid.uuid4())

    async with async_session_factory() as session:
        session.add(
            Job(
                id=job_id,
                status=JobStatus.PENDING.value,
                teacher_name=teacher_name,
                audience=audience,
            )
        )

        stored, filename, mime, size = copy_local_file(job_id, syllabus, "syllabus")
        session.add(
            JobFile(
                job_id=job_id,
                file_type=FileType.SYLLABUS.value,
                original_filename=filename,
                stored_path=stored,
                mime_type=mime,
                size_bytes=size,
            )
        )

        for video in videos:
            stored, filename, mime, size = copy_local_file(job_id, video, "video")
            session.add(
                JobFile(
                    job_id=job_id,
                    file_type=FileType.VIDEO.value,
                    original_filename=filename,
                    stored_path=stored,
                    mime_type=mime,
                    size_bytes=size,
                )
            )

        if youtube_url:
            session.add(
                JobFile(
                    job_id=job_id,
                    file_type=FileType.YOUTUBE.value,
                    source_url=youtube_url,
                )
            )

        for exam in exams:
            stored, filename, mime, size = copy_local_file(job_id, exam, "exam")
            session.add(
                JobFile(
                    job_id=job_id,
                    file_type=FileType.EXAM.value,
                    original_filename=filename,
                    stored_path=stored,
                    mime_type=mime,
                    size_bytes=size,
                )
            )

        await session.commit()

    logger.info(
        "Demo job %s created — %d video(s), %d exam(s), youtube=%s",
        job_id,
        len(videos),
        len(exams),
        bool(youtube_url),
    )
    return job_id


async def run_demo_job(
    *,
    youtube_url: str | None = None,
    sample_dir: Path | None = None,
    syllabus_path: Path | None = None,
    teacher_name: str = DEFAULT_TEACHER,
    audience: str = DEFAULT_AUDIENCE,
    max_exams: int | None = None,
) -> str:
    """Create a demo job and run the full pipeline."""
    job_id = await create_demo_job(
        youtube_url=youtube_url,
        sample_dir=sample_dir,
        syllabus_path=syllabus_path,
        teacher_name=teacher_name,
        audience=audience,
        max_exams=max_exams,
    )
    await run_job(job_id)
    return job_id
