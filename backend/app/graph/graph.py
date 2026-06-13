from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.graph.nodes.clarity import clarity_node
from app.graph.nodes.cross_reference import cross_reference_node
from app.graph.nodes.exam import exam_node
from app.graph.nodes.structure import structure_node
from app.graph.nodes.transcription import transcription_node
from app.graph.state import AgentState

_checkpointer = MemorySaver()
_compiled_graph = None


def build_graph():
    """Build the Veluate evaluation graph.

    Flow:
      transcription → structure ─┐
                     → clarity  ─┼→ cross_reference → END
                     → exam     ─┘
    """
    graph = StateGraph(AgentState)

    graph.add_node("transcription", transcription_node)
    graph.add_node("structure", structure_node)
    graph.add_node("clarity", clarity_node)
    graph.add_node("exam", exam_node)
    graph.add_node("cross_reference", cross_reference_node)

    graph.add_edge(START, "transcription")
    graph.add_edge("transcription", "structure")
    graph.add_edge("transcription", "clarity")
    graph.add_edge("transcription", "exam")
    graph.add_edge("structure", "cross_reference")
    graph.add_edge("clarity", "cross_reference")
    graph.add_edge("exam", "cross_reference")
    graph.add_edge("cross_reference", END)

    return graph.compile(checkpointer=_checkpointer)


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph
