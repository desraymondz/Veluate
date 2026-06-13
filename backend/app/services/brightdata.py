"""Bright Data SERP API client for external fact-check evidence retrieval."""

import json
import logging
import os
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

_REQUEST_URL = "https://api.brightdata.com/request"
_TIMEOUT_SEC = 30


@dataclass(frozen=True)
class SourceSnippet:
    title: str
    url: str
    snippet: str


def brightdata_configured() -> bool:
    return bool(
        os.getenv("BRIGHTDATA_API_TOKEN", "").strip()
        and os.getenv("BRIGHTDATA_SERP_ZONE", "").strip()
    )


def _api_token() -> str:
    return os.getenv("BRIGHTDATA_API_TOKEN", "").strip()


def _serp_zone() -> str:
    return os.getenv("BRIGHTDATA_SERP_ZONE", "").strip()


def search_google(query: str, *, max_results: int = 3) -> list[SourceSnippet]:
    """Search Google via Bright Data SERP API; returns empty list on any failure."""
    if not brightdata_configured():
        return []

    query = query.strip()
    if not query:
        return []

    search_url = (
        f"https://www.google.com/search?q={quote_plus(query)}&hl=en&gl=us"
    )
    payload = {
        "zone": _serp_zone(),
        "url": search_url,
        "format": "raw",
        "data_format": "parsed_light",
    }

    try:
        request = Request(
            _REQUEST_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {_api_token()}",
            },
            method="POST",
        )
        with urlopen(request, timeout=_TIMEOUT_SEC) as response:
            body = response.read().decode("utf-8")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.warning("Bright Data SERP request failed for %r: %s", query, exc)
        return []

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        logger.warning("Bright Data SERP returned non-JSON for %r", query)
        return []

    organic = data.get("organic") or []
    results: list[SourceSnippet] = []
    for item in organic[:max_results]:
        if not isinstance(item, dict):
            continue
        url = (item.get("link") or item.get("url") or "").strip()
        title = (item.get("title") or "").strip()
        snippet = (item.get("description") or item.get("snippet") or "").strip()
        if url and (title or snippet):
            results.append(SourceSnippet(title=title or url, url=url, snippet=snippet))

    return results
