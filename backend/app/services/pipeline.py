"""Background job runner for the evaluation pipeline.

Started via asyncio.create_task() from POST /jobs — runs outside the HTTP
request, so it opens its own DB sessions rather than reusing the route's.
"""

import asyncio
import json
import logging
from collections.abc import Callable

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.agents.clarity import run_clarity_analysis
from app.agents.cross_reference import run_cross_reference_analysis
from app.agents.exam import run_exam_analysis
from app.agents.structure import run_structure_analysis
from app.agents.transcription import run_transcription
from app.db.models import AgentResult, FileType, Job, JobStatus
from app.db.session import async_session_factory
from app.graph.graph import get_graph
from app.graph.state import AgentState
from app.services import events
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

# Nodes whose updates are persisted as AgentResult rows.
_TRACKED_AGENTS = frozenset(
    {"transcription", "structure", "clarity", "exam", "cross_reference"}
)

_PARALLEL_AGENTS = frozenset({"structure", "clarity", "exam"})

_AGENT_RUNNERS: dict[str, Callable[[AgentState], dict]] = {
    "transcription": run_transcription,
    "structure": run_structure_analysis,
    "clarity": run_clarity_analysis,
    "exam": run_exam_analysis,
    "cross_reference": run_cross_reference_analysis,
}

_RETRY_PLAN: dict[str, list[str]] = {
    "transcription": [
        "transcription",
        "structure",
        "clarity",
        "exam",
        "cross_reference",
    ],
    "structure": ["structure", "cross_reference"],
    "clarity": ["clarity", "cross_reference"],
    "exam": ["exam", "cross_reference"],
    "cross_reference": ["cross_reference"],
}

_active_jobs: set[str] = set()


def get_retry_plan(from_agent: str) -> list[str]:
    if from_agent not in _RETRY_PLAN:
        raise ValueError(
            f"Unknown agent '{from_agent}'. "
            f"Choose one of: {', '.join(sorted(_TRACKED_AGENTS))}"
        )
    return _RETRY_PLAN[from_agent]


def _failed_agent_from_error(message: str) -> str | None:
    for agent in _TRACKED_AGENTS:
        if message.startswith(f"{agent}:"):
            return agent
    return None


def _merge_output_into_state(
    state: AgentState, agent_name: str, output: dict
) -> None:
    if agent_name == "transcription":
        state["transcript"] = output.get("transcript", [])
        state["videodb_collection_id"] = output.get("videodb_collection_id")
        state["videodb_videos"] = output.get("videodb_videos", [])
    elif agent_name == "structure":
        state["structure_report"] = output.get("structure_report")
    elif agent_name == "clarity":
        state["clarity_report"] = output.get("clarity_report")
    elif agent_name == "exam":
        state["exam_analysis"] = output.get("exam_analysis")
    elif agent_name == "cross_reference":
        state["final_report"] = output.get("final_report")


def _clear_agent_from_state(state: AgentState, agent_name: str) -> None:
    if agent_name == "transcription":
        state["transcript"] = []
        state["videodb_collection_id"] = None
        state["videodb_videos"] = []
    elif agent_name == "structure":
        state["structure_report"] = None
    elif agent_name == "clarity":
        state["clarity_report"] = None
    elif agent_name == "exam":
        state["exam_analysis"] = None
    elif agent_name == "cross_reference":
        state["final_report"] = None


def _validate_prerequisites(state: AgentState, agents: list[str]) -> None:
    needs_transcript = any(
        a in agents for a in ("structure", "clarity", "cross_reference")
    )
    if needs_transcript and not state.get("transcript"):
        raise ValueError(
            "Transcription results are required. Retry transcription first."
        )

    if "cross_reference" in agents:
        for name, key in (
            ("structure", "structure_report"),
            ("clarity", "clarity_report"),
            ("exam", "exam_analysis"),
        ):
            if name not in agents and not state.get(key):
                raise ValueError(
                    f"Missing prior results for {name}. Retry that step first."
                )


async def _set_job_status(
    job_id: str,
    status: JobStatus,
    error: str | None = None,
    *,
    clear_error: bool = False,
) -> None:
    async with async_session_factory() as session:
        job = await session.get(Job, job_id)
        if not job:
            return
        job.status = status.value
        if clear_error:
            job.error_message = None
        elif error is not None:
            job.error_message = error
        await session.commit()

    await events.publish(
        job_id,
        {"type": "status", "status": status.value, "error": error},
    )


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


async def _hydrate_state_from_results(job_id: str, state: AgentState) -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(AgentResult)
            .where(AgentResult.job_id == job_id)
            .order_by(AgentResult.created_at)
        )
        rows = result.scalars().all()

    latest: dict[str, AgentResult] = {}
    for row in rows:
        latest[row.agent_name] = row

    for agent_name, row in latest.items():
        if agent_name not in _TRACKED_AGENTS or not row.output:
            continue
        try:
            output = json.loads(row.output)
        except json.JSONDecodeError:
            logger.warning("Skipping invalid JSON for agent %s", agent_name)
            continue
        _merge_output_into_state(state, agent_name, output)


async def _delete_agent_results(job_id: str, agent_names: list[str]) -> None:
    if not agent_names:
        return
    async with async_session_factory() as session:
        await session.execute(
            delete(AgentResult).where(
                AgentResult.job_id == job_id,
                AgentResult.agent_name.in_(agent_names),
            )
        )
        await session.commit()


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


async def _publish_agent_completed(job_id: str, agent_name: str) -> None:
    await events.publish(
        job_id,
        {
            "type": "agent",
            "agent": agent_name,
            "status": "completed",
        },
    )
    logger.info("Agent %s completed for job %s", agent_name, job_id)


<<<<<<< Updated upstream
async def _execute_agents(
    job_id: str, state: AgentState, agents: list[str]
) -> None:
    idx = 0
    while idx < len(agents):
        agent = agents[idx]
        if agent in _PARALLEL_AGENTS:
            batch: list[str] = []
            while idx < len(agents) and agents[idx] in _PARALLEL_AGENTS:
                batch.append(agents[idx])
                idx += 1

            outputs = await asyncio.gather(
                *[asyncio.to_thread(_AGENT_RUNNERS[name], state) for name in batch]
            )
            for name, output in zip(batch, outputs, strict=True):
                state.update(output)
                await _save_agent_result(job_id, name, output)
                await _publish_agent_completed(job_id, name)
        else:
            output = await asyncio.to_thread(_AGENT_RUNNERS[agent], state)
            state.update(output)
            await _save_agent_result(job_id, agent, output)
            await _publish_agent_completed(job_id, agent)
            idx += 1


async def _run_with_lock(job_id: str, coro) -> None:
    if job_id in _active_jobs:
        raise RuntimeError(f"Job {job_id} is already running")
    _active_jobs.add(job_id)
=======
async def run_job(job_id: str) -> None:
    """Run the LangGraph evaluation pipeline for a job."""
    logger.info("Pipeline started for job %s", job_id)
>>>>>>> Stashed changes
    try:
        get_llm.cache_clear()
        await coro()
    finally:
        _active_jobs.discard(job_id)


async def run_job(job_id: str) -> None:
    """Run the full LangGraph evaluation pipeline for a job."""

<<<<<<< Updated upstream
    async def _run() -> None:
        logger.info("Pipeline started for job %s", job_id)
        try:
            await _set_job_status(job_id, JobStatus.RUNNING, clear_error=True)

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
                    await _publish_agent_completed(job_id, agent_name)

            await _set_job_status(job_id, JobStatus.COMPLETED, clear_error=True)
            logger.info("Pipeline completed for job %s", job_id)
        except Exception as exc:
            logger.exception("Pipeline failed for job %s", job_id)
            message = str(exc)
            failed_agent = _failed_agent_from_error(message)
            if failed_agent:
                await events.publish(
                    job_id,
                    {
                        "type": "agent",
                        "agent": failed_agent,
                        "status": "failed",
                        "message": message,
                    },
                )
            await _set_job_status(job_id, JobStatus.FAILED, message)
            await events.publish(job_id, {"type": "error", "message": message})
=======
                await _save_agent_result(job_id, agent_name, node_output)

                node_errors: list[str] = node_output.get("errors") or []
                if node_errors:
                    for error_msg in node_errors:
                        await events.publish(
                            job_id,
                            {
                                "type": "agent",
                                "agent": agent_name,
                                "status": "failed",
                                "message": error_msg,
                            },
                        )
                    logger.warning(
                        "Agent %s failed gracefully for job %s: %s",
                        agent_name,
                        job_id,
                        node_errors,
                    )
                else:
                    await _publish_agent_completed(job_id, agent_name)
>>>>>>> Stashed changes

    await _run_with_lock(job_id, _run)


async def retry_job(job_id: str, from_agent: str) -> list[str]:
    """Re-run an agent and its downstream steps, keeping prior results."""
    plan = get_retry_plan(from_agent)
    logger.info("Retrying job %s from agent %s — plan: %s", job_id, from_agent, plan)

    async def _run() -> None:
        try:
            await _set_job_status(job_id, JobStatus.RUNNING, clear_error=True)

            state = await _load_initial_state(job_id)
            await _delete_agent_results(job_id, plan)
            await _hydrate_state_from_results(job_id, state)
            _validate_prerequisites(state, plan)

            await _execute_agents(job_id, state, plan)
            await _set_job_status(job_id, JobStatus.COMPLETED, clear_error=True)
            logger.info("Retry completed for job %s", job_id)
        except Exception as exc:
            logger.exception("Retry failed for job %s", job_id)
            message = str(exc)
            failed_agent = _failed_agent_from_error(message)
            if failed_agent:
                await events.publish(
                    job_id,
                    {
                        "type": "agent",
                        "agent": failed_agent,
                        "status": "failed",
                        "message": message,
                    },
                )
            await _set_job_status(job_id, JobStatus.FAILED, message)
            await events.publish(job_id, {"type": "error", "message": message})
            raise

    await _run_with_lock(job_id, _run)
    return plan
