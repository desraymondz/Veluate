from app.agents.exam import run_exam_analysis
from app.graph.state import AgentState


def exam_node(state: AgentState) -> dict:
    return run_exam_analysis(state)
