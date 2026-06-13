from app.agents.clarity import run_clarity_analysis
from app.graph.state import AgentState


def clarity_node(state: AgentState) -> dict:
    return run_clarity_analysis(state)
