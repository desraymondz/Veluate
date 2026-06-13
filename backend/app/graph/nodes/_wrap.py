"""Wrap graph nodes for clearer per-agent error messages."""

import logging
from collections.abc import Callable

from app.graph.state import AgentState

logger = logging.getLogger(__name__)


def agent_node(agent_name: str, run_fn: Callable[[AgentState], dict]):
    """Run an agent; prefix failures with agent name for pipeline/UI parsing."""

    def node(state: AgentState) -> dict:
        try:
            return run_fn(state)
        except Exception as exc:
            logger.exception(
                "Agent %s failed for job %s", agent_name, state["job_id"]
            )
            raise RuntimeError(f"{agent_name}: {exc}") from exc

    node.__name__ = f"{agent_name}_node"
    return node
