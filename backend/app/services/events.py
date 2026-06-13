"""In-process pub/sub for job SSE streams.

Pipeline code publishes status/agent updates; GET /jobs/{id}/events subscribers
receive them as Server-Sent Events. State lives in memory only — events are lost
if no client is connected, and this does not work across multiple server workers.
"""

import asyncio
import json
from collections import defaultdict
from typing import Any

# job_id -> queues for every active SSE connection watching that job
_subscribers: dict[str, list[asyncio.Queue[str]]] = defaultdict(list)


async def publish(job_id: str, event: dict[str, Any]) -> None:
    """Broadcast a JSON event to all SSE clients subscribed to this job."""
    payload = json.dumps(event)
    for queue in _subscribers.get(job_id, []):
        await queue.put(payload)


async def subscribe(job_id: str) -> asyncio.Queue[str]:
    """Register a new listener; caller reads JSON strings from the returned queue."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    _subscribers[job_id].append(queue)
    return queue


def unsubscribe(job_id: str, queue: asyncio.Queue[str]) -> None:
    """Remove a listener when its SSE connection closes."""
    queues = _subscribers.get(job_id, [])
    if queue in queues:
        queues.remove(queue)
    if not queues:
        _subscribers.pop(job_id, None)
