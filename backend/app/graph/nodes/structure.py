from app.agents.structure import run_structure_analysis
from app.graph.nodes._wrap import agent_node

structure_node = agent_node("structure", run_structure_analysis)
