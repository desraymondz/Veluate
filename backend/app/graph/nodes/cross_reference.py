from app.graph.state import AgentState


def cross_reference_node(state: AgentState) -> dict:
    """Phase 2 stub — combines upstream outputs into a final report."""
    heatmap = (state.get("clarity_report") or {}).get("heatmap", [])
    weak_clusters = (state.get("exam_analysis") or {}).get("weak_clusters", [])

    return {
        "final_report": {
            "summary": "[stub] Cross-reference report — replaced in Phase 6",
            "teacher_name": state["teacher_name"],
            "structure_highlights": (state.get("structure_report") or {}).get("findings", []),
            "top_confusion_moments": heatmap[:3],
            "exam_gaps": weak_clusters,
            "cross_references": [
                {
                    "exam_topic": cluster.get("topic", "Unknown"),
                    "teaching_timestamp": heatmap[0]["start_sec"] if heatmap else None,
                    "clip_url": None,
                    "evidence": "[stub] Teaching moment linked to exam failure cluster",
                }
                for cluster in weak_clusters[:2]
            ],
        }
    }
