from app.agents.cross_reference import run_cross_reference_analysis
from app.graph.nodes._wrap import agent_node

cross_reference_node = agent_node("cross_reference", run_cross_reference_analysis)
