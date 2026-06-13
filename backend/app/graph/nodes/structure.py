from app.agents.structure import run_structure_analysis
from app.graph.state import AgentState


def structure_node(state: AgentState) -> dict:
    return run_structure_analysis(state)
