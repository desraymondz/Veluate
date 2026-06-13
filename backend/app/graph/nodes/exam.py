from app.agents.exam import run_exam_analysis
from app.graph.nodes._wrap import agent_node

exam_node = agent_node("exam", run_exam_analysis)
