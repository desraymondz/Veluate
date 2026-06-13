import operator
from typing import Annotated, TypedDict


class AgentState(TypedDict):
    """Shared state passed between LangGraph nodes."""

    job_id: str
    teacher_name: str
    audience: str
    video_paths: list[str]
    youtube_urls: list[str]
    syllabus_path: str
    exam_paths: list[str]
    transcript: list[dict]
    videodb_collection_id: str | None
    videodb_videos: list[dict]
    structure_report: dict | None
    clarity_report: dict | None
    exam_analysis: dict | None
    fact_check_report: dict | None
    final_report: dict | None
    errors: Annotated[list[str], operator.add]
