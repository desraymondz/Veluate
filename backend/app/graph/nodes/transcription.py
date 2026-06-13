from app.agents.transcription import run_transcription
from app.graph.nodes._wrap import agent_node

transcription_node = agent_node("transcription", run_transcription)
