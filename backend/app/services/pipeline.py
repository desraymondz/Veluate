"""Background job runner for the evaluation pipeline.

Started via asyncio.create_task() from POST /jobs — runs outside the HTTP
request, so it opens its own DB sessions rather than reusing the route's.
"""

import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import AgentResult, FileType, Job, JobStatus
from app.db.session import async_session_factory
from app.graph.graph import get_graph
from app.graph.state import AgentState
from app.services import events

logger = logging.getLogger(__name__)

# Nodes whose updates are persisted as AgentResult rows.
_TRACKED_AGENTS = frozenset(
    {"transcription", "structure", "clarity", "exam", "cross_reference"}
)


async def _set_job_status(job_id: str, status: JobStatus, error: str | None = None) -> None:
    async with async_session_factory() as session:
        job = await session.get(Job, job_id)
        if not job:
            return
        job.status = status.value
        if error:
            job.error_message = error
        await session.commit()

    # Publish after commit so SSE clients and GET /jobs see the same state.
    await events.publish(job_id, {"type": "status", "status": status.value, "error": error})


async def _load_initial_state(job_id: str) -> AgentState:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Job).where(Job.id == job_id).options(selectinload(Job.files))
        )
        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        video_paths = [
            f.stored_path
            for f in job.files
            if f.file_type == FileType.VIDEO.value and f.stored_path
        ]
        youtube_urls = [
            f.source_url
            for f in job.files
            if f.file_type == FileType.YOUTUBE.value and f.source_url
        ]
        exam_paths = [
            f.stored_path
            for f in job.files
            if f.file_type == FileType.EXAM.value and f.stored_path
        ]
        syllabus = next(
            (f for f in job.files if f.file_type == FileType.SYLLABUS.value),
            None,
        )
        if not syllabus or not syllabus.stored_path:
            raise ValueError(f"Job {job_id} is missing a syllabus file")

        return AgentState(
            job_id=job_id,
            teacher_name=job.teacher_name,
            audience=job.audience,
            video_paths=video_paths,
            youtube_urls=youtube_urls,
            syllabus_path=syllabus.stored_path,
            exam_paths=exam_paths,
            transcript=[],
            videodb_collection_id=None,
            videodb_videos=[],
            structure_report=None,
            clarity_report=None,
            exam_analysis=None,
            final_report=None,
            errors=[],
        )


async def _save_agent_result(job_id: str, agent_name: str, output: dict) -> None:
    async with async_session_factory() as session:
        session.add(
            AgentResult(
                job_id=job_id,
                agent_name=agent_name,
                output=json.dumps(output),
            )
        )
        await session.commit()


async def run_job(job_id: str) -> None:
    """Run the LangGraph evaluation pipeline for a job."""
    logger.info("Pipeline started for job %s", job_id)
    try:
        await _set_job_status(job_id, JobStatus.RUNNING)

        initial_state = await _load_initial_state(job_id)
        graph = get_graph()
        config = {"configurable": {"thread_id": job_id}}

        async for update in graph.astream(
            initial_state,
            config=config,
            stream_mode="updates",
        ):
            for agent_name, node_output in update.items():
                if agent_name not in _TRACKED_AGENTS or not node_output:
                    continue

                await _save_agent_result(job_id, agent_name, node_output)
                await events.publish(
                    job_id,
                    {
                        "type": "agent",
                        "agent": agent_name,
                        "status": "completed",
                    },
                )
                logger.info("Agent %s completed for job %s", agent_name, job_id)

        await _set_job_status(job_id, JobStatus.COMPLETED)
        logger.info("Pipeline completed for job %s", job_id)
    except Exception as exc:
        logger.exception("Pipeline failed for job %s", job_id)
        await _set_job_status(job_id, JobStatus.FAILED, str(exc))
        await events.publish(job_id, {"type": "error", "message": str(exc)})
