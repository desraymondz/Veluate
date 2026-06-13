from app.graph.state import AgentState


def exam_node(state: AgentState) -> dict:
    """Phase 2 stub — returns placeholder exam gap analysis."""
    exam_count = len(state["exam_paths"])
    return {
        "exam_analysis": {
            "exam_count": exam_count,
            "summary": "[stub] Exam gap analysis — replaced in Phase 5",
            "weak_clusters": [
                {
                    "topic": "Core concept application",
                    "frequency": 0.7,
                    "example_mistakes": ["Confused definitions", "Incomplete worked example"],
                }
            ]
            if exam_count
            else [],
            "note": "No exam papers uploaded" if not exam_count else None,
        }
    }
