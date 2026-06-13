"""VideoDB wrapper for upload, transcription, search, and clip streaming."""

import logging
import os
from functools import lru_cache

import videodb
from videodb import Segmenter
from videodb.collection import Collection
from videodb.video import Video

logger = logging.getLogger(__name__)


class VideoDBService:
    def __init__(self, api_key: str | None = None) -> None:
        api_key = api_key or os.getenv("VIDEODB_API_KEY")
        if not api_key:
            raise ValueError(
                "VIDEODB_API_KEY is required. Set it in backend/.env or .env.local"
            )
        self._conn = videodb.connect(api_key=api_key)
        self._language_code = os.getenv("VIDEODB_LANGUAGE_CODE", "en")

    def ensure_job_collection(self, job_id: str) -> Collection:
        """One VideoDB collection per Veluate job."""
        coll_name = f"veluate-{job_id}"
        for coll in self._conn.get_collections():
            if coll.name == coll_name:
                return coll
        return self._conn.create_collection(
            name=coll_name,
            description=f"Veluate evaluation job {job_id}",
        )

    def upload_source(
        self,
        collection: Collection,
        *,
        file_path: str | None = None,
        url: str | None = None,
        name: str | None = None,
    ) -> Video:
        video = collection.upload(file_path=file_path, url=url, name=name)
        if not isinstance(video, Video):
            raise RuntimeError("Expected a video upload from VideoDB")
        logger.info("Uploaded video %s to collection %s", video.id, collection.id)
        return video

    def upload_and_index(
        self,
        collection: Collection,
        *,
        file_path: str | None = None,
        url: str | None = None,
        name: str | None = None,
    ) -> Video:
        """Upload a lecture source, transcribe it, and index spoken words for search."""
        video = self.upload_source(
            collection, file_path=file_path, url=url, name=name
        )
        video.generate_transcript(language_code=self._language_code)
        video.index_spoken_words(language_code=self._language_code)
        return video

    def get_transcript_segments(self, video: Video) -> list[dict]:
        """Return sentence-level segments as {start, end, text}."""
        raw = video.get_transcript(segmenter=Segmenter.sentence)
        return [
            {
                "start": float(seg["start"]),
                "end": float(seg["end"]),
                "text": str(seg["text"]).strip(),
            }
            for seg in raw
            if str(seg.get("text", "")).strip()
        ]

    def merge_transcripts(
        self, videos_and_segments: list[tuple[Video, list[dict]]]
    ) -> list[dict]:
        """Merge per-video segments into one timeline with global timestamps."""
        merged: list[dict] = []
        offset = 0.0

        for video, segments in videos_and_segments:
            for seg in segments:
                merged.append(
                    {
                        "start": seg["start"] + offset,
                        "end": seg["end"] + offset,
                        "text": seg["text"],
                        "video_id": video.id,
                        "local_start": seg["start"],
                        "local_end": seg["end"],
                    }
                )

            if video.length:
                offset += float(video.length)
            elif segments:
                offset += segments[-1]["end"]
            logger.info(
                "Merged %d segments from video %s (offset now %.1fs)",
                len(segments),
                video.id,
                offset,
            )

        return merged

    def get_collection(self, collection_id: str) -> Collection:
        return self._conn.get_collection(collection_id)

    def search_collection(
        self, collection: Collection, query: str, top_k: int = 3
    ) -> list[dict]:
        """Semantic search across all videos in a collection."""
        results = collection.search(query, result_threshold=top_k)
        return [
            {
                "video_id": shot.video_id,
                "start": float(shot.start),
                "end": float(shot.end),
                "text": shot.text or "",
                "score": shot.search_score,
                "stream_url": shot.stream_url,
                "player_url": shot.player_url,
            }
            for shot in results.shots
        ]

    def search_video(
        self, video: Video, query: str, top_k: int = 5
    ) -> list[dict]:
        """Semantic search within a single video. Used by cross-reference in Phase 6."""
        results = video.search(query, result_threshold=top_k)
        return [
            {
                "video_id": shot.video_id,
                "start": shot.start,
                "end": shot.end,
                "text": shot.text,
                "score": shot.search_score,
                "stream_url": shot.stream_url,
                "player_url": shot.player_url,
            }
            for shot in results.shots
        ]

    def get_clip_url(self, video: Video, start: float, end: float) -> str:
        """Generate an HLS stream URL for a time range within a video."""
        return video.generate_stream(timeline=[(start, end)])


@lru_cache
def get_videodb_service() -> VideoDBService:
    return VideoDBService()
