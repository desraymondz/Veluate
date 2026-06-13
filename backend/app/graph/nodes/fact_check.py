from app.agents.fact_check import run_fact_check
from app.graph.nodes._wrap import agent_node

fact_check_node = agent_node("fact_check", run_fact_check)
