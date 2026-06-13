"""Transcription agent — ingests lecture sources via VideoDB and returns timestamped segments."""

import logging

from app.graph.state import AgentState
from app.services.videodb import get_videodb_service

logger = logging.getLogger(__name__)


def run_transcription(state: AgentState) -> dict:
    """Upload all lecture sources, transcribe, index, and merge into one timeline."""
    service = get_videodb_service()
    collection = service.ensure_job_collection(state["job_id"])

    uploaded: list = []
    sources: list[tuple[str | None, str | None, str]] = []

    for index, path in enumerate(state["video_paths"]):
        sources.append((path, None, f"{state['job_id']}-file-{index}"))

    for index, url in enumerate(state["youtube_urls"]):
        sources.append((None, url, f"{state['job_id']}-youtube-{index}"))

    for file_path, url, name in sources:
        logger.info("Uploading lecture source %s to VideoDB", name)
        video = service.upload_and_index(
            collection,
            file_path=file_path,
            url=url,
            name=name,
        )
        segments = service.get_transcript_segments(video)
        uploaded.append((video, segments))
        logger.info(
            "Transcribed video %s — %d sentence segments",
            video.id,
            len(segments),
        )

    transcript = service.merge_transcripts(uploaded)

    return {
        "transcript": transcript,
        "videodb_collection_id": collection.id,
        "videodb_videos": [
            {
                "id": video.id,
                "name": video.name,
                "length": float(video.length) if video.length else None,
                "segment_count": len(segments),
                "source_type": "file" if file_path else "youtube",
            }
            for (video, segments), (file_path, url, _) in zip(uploaded, sources)
        ],
    }
