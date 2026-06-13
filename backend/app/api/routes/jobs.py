import asyncio
import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas.jobs import JobCreatedResponse, JobResponse
from app.db.models import FileType, Job, JobFile, JobStatus
from app.db.session import get_session
from app.services import events
from app.services.files import save_upload, validate_youtube_url
from app.services.pipeline import run_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _get_job_or_404(session: AsyncSession, job_id: str) -> Job:
    result = await session.execute(
        select(Job)
        .where(Job.id == job_id)
        .options(selectinload(Job.files), selectinload(Job.agent_results))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobCreatedResponse, status_code=201)
async def create_job(
    session: SessionDep,
    teacher_name: Annotated[str, Form()],
    audience: Annotated[str, Form()],
    syllabus: Annotated[UploadFile, File()],
    videos: Annotated[list[UploadFile], File()] = [],
    exams: Annotated[list[UploadFile], File()] = [],
    youtube_urls: Annotated[list[str], Form()] = [],
) -> JobCreatedResponse:
    videos = [v for v in videos if v.filename]
    exams = [e for e in exams if e.filename]
    youtube_urls = [validate_youtube_url(url) for url in youtube_urls if url.strip()]

    if not videos and not youtube_urls:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one lecture source: video file(s) and/or YouTube URL(s)",
        )

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        status=JobStatus.PENDING.value,
        teacher_name=teacher_name.strip(),
        audience=audience.strip(),
    )
    session.add(job)

    stored_path, filename, mime_type, size = await save_upload(job_id, syllabus, "syllabus")
    session.add(
        JobFile(
            job_id=job_id,
            file_type=FileType.SYLLABUS.value,
            original_filename=filename,
            stored_path=stored_path,
            mime_type=mime_type,
            size_bytes=size,
        )
    )

    for video in videos:
        stored_path, filename, mime_type, size = await save_upload(job_id, video, "video")
        session.add(
            JobFile(
                job_id=job_id,
                file_type=FileType.VIDEO.value,
                original_filename=filename,
                stored_path=stored_path,
                mime_type=mime_type,
                size_bytes=size,
            )
        )

    for url in youtube_urls:
        session.add(
            JobFile(
                job_id=job_id,
                file_type=FileType.YOUTUBE.value,
                source_url=url,
            )
        )

    for exam in exams:
        stored_path, filename, mime_type, size = await save_upload(job_id, exam, "exam")
        session.add(
            JobFile(
                job_id=job_id,
                file_type=FileType.EXAM.value,
                original_filename=filename,
                stored_path=stored_path,
                mime_type=mime_type,
                size_bytes=size,
            )
        )

    await session.commit()

    asyncio.create_task(run_job(job_id))
    logger.info(
        "Created job %s — %d video(s), %d YouTube URL(s), %d exam(s)",
        job_id,
        len(videos),
        len(youtube_urls),
        len(exams),
    )

    return JobCreatedResponse(
        id=job_id,
        status=JobStatus.PENDING.value,
        message="Job created and pipeline started",
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, session: SessionDep) -> Job:
    return await _get_job_or_404(session, job_id)


@router.get("/{job_id}/events")
async def job_events(job_id: str, session: SessionDep) -> StreamingResponse:
    job = await _get_job_or_404(session, job_id)

    async def event_stream():
        queue = await events.subscribe(job_id)
        try:
            yield f"data: {json.dumps({'type': 'status', 'status': job.status})}\n\n"

            if job.status in (JobStatus.COMPLETED.value, JobStatus.FAILED.value):
                return

            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                    event = json.loads(data)
                    if event.get("type") == "status" and event.get("status") in (
                        JobStatus.COMPLETED.value,
                        JobStatus.FAILED.value,
                    ):
                        break
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            events.unsubscribe(job_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
