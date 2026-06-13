import asyncio
import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas.jobs import (
    AskLectureRequest,
    AskLectureResponse,
    JobCreatedResponse,
    JobResponse,
    JobRetryRequest,
    JobRetryResponse,
)
from app.db.models import FileType, Job, JobFile, JobStatus
from app.db.session import get_session
from app.services import events
from app.services.files import save_upload, validate_youtube_url_http
from app.services.infographic import summary_infographic_path
from app.services.lecture_search import ask_lecture
from app.services.pipeline import get_retry_plan, retry_job, run_job

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


def _load_transcription(job: Job) -> dict:
    for result in job.agent_results:
        if result.agent_name == "transcription" and result.output:
            try:
                return json.loads(result.output)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=500,
                    detail="Transcription data is corrupted",
                ) from exc
    raise HTTPException(
        status_code=409,
        detail="Transcription not available yet. Wait for indexing to complete.",
    )


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
    youtube_urls = [validate_youtube_url_http(url) for url in youtube_urls if url.strip()]

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


@router.post("/{job_id}/ask", response_model=AskLectureResponse)
async def ask_lecture_question(
    job_id: str,
    body: AskLectureRequest,
    session: SessionDep,
) -> AskLectureResponse:
    job = await _get_job_or_404(session, job_id)
    transcription = _load_transcription(job)

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = ask_lecture(
        question,
        transcript=transcription.get("transcript") or [],
        videodb_collection_id=transcription.get("videodb_collection_id"),
        videodb_videos=transcription.get("videodb_videos") or [],
    )
    return AskLectureResponse(**result)


@router.get("/{job_id}/summary-infographic")
async def get_summary_infographic(job_id: str, session: SessionDep) -> FileResponse:
    await _get_job_or_404(session, job_id)
    path = summary_infographic_path(job_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Summary infographic not available")
    return FileResponse(path, media_type="image/png", filename=path.name)


@router.post("/{job_id}/retry", response_model=JobRetryResponse, status_code=202)
async def retry_job_step(
    job_id: str,
    body: JobRetryRequest,
    session: SessionDep,
) -> JobRetryResponse:
    job = await _get_job_or_404(session, job_id)

    if job.status == JobStatus.RUNNING.value:
        raise HTTPException(status_code=409, detail="Job is already running")

    if job.status == JobStatus.PENDING.value:
        raise HTTPException(
            status_code=409,
            detail="Job is still starting. Wait for the first run to finish or fail.",
        )

    try:
        plan = get_retry_plan(body.agent)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    asyncio.create_task(retry_job(job_id, body.agent))

    return JobRetryResponse(
        id=job_id,
        status=JobStatus.RUNNING.value,
        message=f"Retrying from {body.agent}",
        agents=plan,
    )


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
