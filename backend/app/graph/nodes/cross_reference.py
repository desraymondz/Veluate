from app.agents.cross_reference import run_cross_reference_analysis
from app.graph.state import AgentState


def cross_reference_node(state: AgentState) -> dict:
    return run_cross_reference_analysis(state)
