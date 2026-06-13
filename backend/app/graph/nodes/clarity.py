from app.agents.clarity import run_clarity_analysis
from app.graph.nodes._wrap import agent_node

clarity_node = agent_node("clarity", run_clarity_analysis)
