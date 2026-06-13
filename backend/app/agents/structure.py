"""Structure agent — evaluates lesson flow, sequencing, and narrative coherence."""

from typing import Literal

from pydantic import BaseModel, Field

from app.agents._context import lecture_context
from app.graph.state import AgentState
from app.services.llm import get_llm

_SYSTEM = """You are an expert instructional designer evaluating lecture structure.

Analyze the timestamped transcript against the syllabus and target audience. Focus on:
- Lesson flow and logical build-up of concepts
- Whether prerequisites are established before advanced topics
- Pacing (rushed vs. dragging sections)
- Abrupt topic jumps or missing scaffolding
- Narrative coherence across the lecture

Score from 0 (incoherent) to 10 (excellent structure).
Each finding must reference a specific moment when possible (timestamp_sec).
Be concrete and evidence-based — cite what was said, not generic advice."""


class StructureFinding(BaseModel):
    type: str = Field(description="e.g. pacing, scaffolding, sequencing, coherence")
    severity: Literal["low", "medium", "high"]
    detail: str
    timestamp_sec: float | None = Field(
        default=None, description="Approximate second in the lecture"
    )


class StructureReportOutput(BaseModel):
    score: float = Field(ge=0, le=10)
    summary: str
    findings: list[StructureFinding]


def run_structure_analysis(state: AgentState) -> dict:
    if not state.get("transcript"):
        raise ValueError("Structure analysis requires a transcript from the transcription step")

    llm = get_llm().with_structured_output(StructureReportOutput)
    result: StructureReportOutput = llm.invoke(
        [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": lecture_context(state)
                + "\n\nProduce the structure evaluation.",
            },
        ]
    )

    report = result.model_dump()
    report["audience"] = state["audience"]
    return {"structure_report": report}
