"""Transcript chunking for lecture RAG (cross-reference retrieval fallback)."""

from __future__ import annotations


def chunk_transcript(
    transcript: list[dict],
    chunk_size: int = 6,
    overlap_ratio: float = 0.5,
) -> list[dict]:
    """Sliding window over sentence-level segments (~5–8 sentences, 50% overlap)."""
    if not transcript:
        return []

    step = max(1, int(chunk_size * (1 - overlap_ratio)))
    chunks: list[dict] = []

    for i in range(0, len(transcript), step):
        window = transcript[i : i + chunk_size]
        if not window:
            break

        chunks.append(
            {
                "start_sec": float(window[0]["start"]),
                "end_sec": float(window[-1]["end"]),
                "text": " ".join(seg["text"] for seg in window),
                "video_id": window[0].get("video_id"),
            }
        )

        if i + chunk_size >= len(transcript):
            break

    return chunks


def score_chunks_by_query(chunks: list[dict], query: str, top_k: int = 1) -> list[dict]:
    """Keyword overlap fallback when VideoDB search returns no hits."""
    keywords = {w.lower() for w in query.split() if len(w) > 3}
    if not keywords:
        return []

    scored: list[tuple[int, dict]] = []
    for chunk in chunks:
        text = chunk["text"].lower()
        score = sum(1 for kw in keywords if kw in text)
        if score:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]
