"""Clarity agent — detects jargon, density, and confusion spikes with timestamps."""

from pydantic import BaseModel, Field

from app.agents._context import lecture_context
from app.graph.state import AgentState
from app.services.llm import get_llm

_SYSTEM = """You are an expert at detecting where students would get confused during a lecture.

Analyze the timestamped transcript for:
- Jargon or technical terms used without definition
- Dense or information-overloaded passages
- Ambiguous or contradictory explanations
- Assumed knowledge that the stated audience may not have

Score overall clarity from 0 (very confusing) to 10 (crystal clear).

For the heatmap, identify 3–8 moments most likely to cause confusion.
Each heatmap entry MUST use start_sec and end_sec that match real ranges from the
transcript timestamps. severity is 0.0 (mild) to 1.0 (severe).
Be specific in reason — quote or paraphrase what the teacher said."""


class HeatmapPoint(BaseModel):
    start_sec: float
    end_sec: float
    severity: float = Field(ge=0, le=1)
    reason: str


class ClarityReportOutput(BaseModel):
    score: float = Field(ge=0, le=10)
    summary: str
    heatmap: list[HeatmapPoint]


def run_clarity_analysis(state: AgentState) -> dict:
    if not state.get("transcript"):
        raise ValueError("Clarity analysis requires a transcript from the transcription step")

    llm = get_llm().with_structured_output(ClarityReportOutput)
    result: ClarityReportOutput = llm.invoke(
        [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": lecture_context(state)
                + "\n\nProduce the clarity evaluation and confusion heatmap.",
            },
        ]
    )

    return {"clarity_report": result.model_dump()}
