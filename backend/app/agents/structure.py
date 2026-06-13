"""Structure agent — evaluates lesson flow, sequencing, and narrative coherence."""

from typing import Literal

from pydantic import BaseModel, Field

from app.agents._context import lecture_context
from app.graph.state import AgentState
from app.services.llm import get_llm

<<<<<<< Updated upstream
_SYSTEM = """You are an expert instructional designer evaluating lecture structure.
=======
logger = logging.getLogger(__name__)

_SYSTEM = """You are an expert instructional designer evaluating lecture structure, in the tradition of backward design and cognitive load theory.
>>>>>>> Stashed changes

You will receive a timestamped transcript, the course syllabus, and the target audience profile. Your job is not to summarize the lecture — it's to diagnose where the *design* of the lecture helps or hurts learning.

Analyze for:
1. **Conceptual scaffolding** — Does each new idea build on something already established? Flag moments where a concept is used before its prerequisite is introduced, even if the prerequisite appears later in the lecture (a sequencing error, not just a gap).
2. **Cognitive load pacing** — Identify segments where multiple new concepts are introduced in rapid succession without consolidation (worked examples, repetition, pause for synthesis), versus segments that over-explain already-familiar material relative to the stated audience level.
3. **Narrative throughline** — Lectures that work tend to set up a problem or question early and resolve it progressively. Identify whether this lecture has a throughline, or whether it reads as a list of disconnected topics. If there's no explicit motivating question, say so — this is itself a structural finding, not a neutral observation.
4. **Transition quality** — For each major topic shift, classify it as: (a) explicitly bridged ("now that we understand X, we can use it to..."), (b) implicitly bridged (the connection exists but isn't stated — a missed teaching opportunity), or (c) unbridged (abrupt jump with no connective signal).
5. **Audience-fit mismatches** — Given the target audience, flag both over-explanation (wastes time, may bore advanced students) and under-explanation (assumes background the audience likely lacks).

For each finding:
- Reference the specific timestamp(s) where it occurs (timestamp_sec)
- Quote or closely paraphrase what was actually said — never describe a finding in the abstract
- State the *consequence* for the learner, not just the observation (e.g., not "topic jump at 4:32" but "at 4:32, the lecture moves from defining a derivative to applying the chain rule without establishing why the chain rule is needed — a student who hasn't seen this connection before will likely experience this as two unrelated topics")
- Where possible, note what a fix would look like in one sentence

Score from 0 (incoherent, no discernible design) to 10 (excellent structure: clear throughline, well-scaffolded, paced appropriately for the audience). A lecture can be factually correct and still score low if its structure undermines learning — score the design, not the content's correctness.

Avoid generic instructional-design advice ("consider using more examples"). Every finding must be traceable to something specific that happened in this transcript.

You MUST respond entirely in English. Do not use any other language regardless of the language of the transcript or input materials."""


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
