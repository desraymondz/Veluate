from app.agents.transcription import run_transcription
from app.graph.state import AgentState


def transcription_node(state: AgentState) -> dict:
    return run_transcription(state)
