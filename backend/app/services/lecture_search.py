"""Semantic lecture search and ask-the-lecture interpretation."""

from __future__ import annotations

import logging
from typing import Literal, TypedDict

from pydantic import BaseModel, Field

from app.services.chunking import chunk_transcript, score_chunks_by_query
from app.services.llm import get_llm
from app.services.videodb import get_videodb_service

logger = logging.getLogger(__name__)

_CONTEXT_WINDOW_SEC = 30.0

_ASK_SYSTEM = """You answer questions about whether a lecture covered a specific topic.

You receive:
- The user's question
- A transcript excerpt from semantic search (may be weak or tangential)
- Surrounding transcript context from the same time range

Rules:
- Set taught=true only if the transcript clearly shows the topic was explained or discussed.
- If the search hit is only loosely related, set taught=false.
- summary: 1–2 plain sentences for the teacher.
- quote: a verbatim substring copied exactly from the provided transcript context when taught=true; null when taught=false.
- Do not invent quotes or timestamps."""


class LectureMoment(TypedDict):
    source: str
    start_sec: float
    end_sec: float
    video_id: str | None
    transcript_excerpt: str
    clip_url: str | None
    search_score: float | None


class LectureAskLLMOutput(BaseModel):
    taught: bool
    summary: str = Field(description="1–2 sentence plain-language answer")
    quote: str | None = Field(
        description="Verbatim quote from transcript context, or null if not taught"
    )
    confidence: Literal["high", "medium", "low"]


def video_offsets(videodb_videos: list[dict]) -> dict[str, float]:
    offsets: dict[str, float] = {}
    offset = 0.0
    for video in videodb_videos:
        offsets[video["id"]] = offset
        offset += float(video.get("length") or 0)
    return offsets


def to_global_time(
    video_id: str | None, local_sec: float, offsets: dict[str, float]
) -> float:
    if not video_id:
        return local_sec
    return offsets.get(video_id, 0.0) + local_sec


def search_lecture_moment(
    query: str,
    *,
    transcript: list[dict],
    videodb_collection_id: str | None,
    videodb_videos: list[dict],
    chunks: list[dict] | None = None,
) -> LectureMoment | None:
    """Find the best teaching moment for a query via VideoDB or transcript fallback."""
    query = query.strip()
    if not query:
        return None

    offsets = video_offsets(videodb_videos)
    chunks = chunks if chunks is not None else chunk_transcript(transcript)

    if videodb_collection_id:
        try:
            service = get_videodb_service()
            collection = service.get_collection(videodb_collection_id)
            hits = service.search_collection(collection, query, top_k=1)
            if hits:
                hit = hits[0]
                global_start = to_global_time(hit["video_id"], hit["start"], offsets)
                global_end = to_global_time(hit["video_id"], hit["end"], offsets)
                clip_url = None
                if hit.get("video_id"):
                    try:
                        video = collection.get_video(hit["video_id"])
                        clip_url = service.get_clip_url(
                            video, hit["start"], hit["end"]
                        )
                    except Exception as exc:
                        logger.warning("Clip URL generation failed: %s", exc)

                return {
                    "source": "videodb",
                    "start_sec": global_start,
                    "end_sec": global_end,
                    "video_id": hit["video_id"],
                    "transcript_excerpt": hit.get("text", ""),
                    "clip_url": clip_url,
                    "search_score": hit.get("score"),
                }
        except Exception as exc:
            logger.warning("VideoDB search failed for %r: %s", query, exc)

    chunk_hits = score_chunks_by_query(chunks, query, top_k=1)
    if chunk_hits:
        hit = chunk_hits[0]
        return {
            "source": "transcript_chunk",
            "start_sec": hit["start_sec"],
            "end_sec": hit["end_sec"],
            "video_id": hit.get("video_id"),
            "transcript_excerpt": hit["text"],
            "clip_url": None,
            "search_score": None,
        }

    return None


def surrounding_transcript_context(
    transcript: list[dict],
    start_sec: float,
    end_sec: float,
    *,
    window_sec: float = _CONTEXT_WINDOW_SEC,
) -> str:
    """Collect transcript text within ±window_sec of the retrieved moment."""
    lo = start_sec - window_sec
    hi = end_sec + window_sec
    parts: list[str] = []
    for seg in transcript:
        if seg["end"] < lo or seg["start"] > hi:
            continue
        parts.append(str(seg.get("text", "")).strip())
    return " ".join(p for p in parts if p)


def interpret_lecture_moment(
    question: str,
    moment: LectureMoment,
    transcript: list[dict],
) -> LectureAskLLMOutput:
    context = surrounding_transcript_context(
        transcript, moment["start_sec"], moment["end_sec"]
    )
    user_content = (
        f"Question: {question}\n\n"
        f"Search excerpt ({moment['start_sec']:.0f}s–{moment['end_sec']:.0f}s):\n"
        f'"{moment["transcript_excerpt"]}"\n\n'
        f"Surrounding transcript context:\n{context or moment['transcript_excerpt']}"
    )

    llm = get_llm().with_structured_output(LectureAskLLMOutput)
    return llm.invoke(
        [
            {"role": "system", "content": _ASK_SYSTEM},
            {"role": "user", "content": user_content},
        ]
    )


def ask_lecture(
    question: str,
    *,
    transcript: list[dict],
    videodb_collection_id: str | None,
    videodb_videos: list[dict],
) -> dict:
    """Search the lecture and interpret whether the topic was taught."""
    question = question.strip()
    moment = search_lecture_moment(
        question,
        transcript=transcript,
        videodb_collection_id=videodb_collection_id,
        videodb_videos=videodb_videos,
    )

    if not moment:
        return {
            "question": question,
            "taught": False,
            "summary": (
                "No matching moment found in the lecture transcript for this topic."
            ),
            "quote": None,
            "confidence": None,
            "start_sec": None,
            "end_sec": None,
            "clip_url": None,
            "transcript_excerpt": None,
        }

    llm_result = interpret_lecture_moment(question, moment, transcript)

    return {
        "question": question,
        "taught": llm_result.taught,
        "summary": llm_result.summary,
        "quote": llm_result.quote if llm_result.taught else None,
        "confidence": llm_result.confidence,
        "start_sec": moment["start_sec"] if llm_result.taught else None,
        "end_sec": moment["end_sec"] if llm_result.taught else None,
        "clip_url": moment["clip_url"] if llm_result.taught else None,
        "transcript_excerpt": moment["transcript_excerpt"],
    }
