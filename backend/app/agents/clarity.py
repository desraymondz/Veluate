"""Clarity agent — detects jargon, density, and confusion spikes with timestamps."""

import logging

from pydantic import BaseModel, Field

from app.agents._context import lecture_context
from app.graph.state import AgentState
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

_SYSTEM = """You are an expert at detecting where students would get confused during a lecture, based on how working memory and prior-knowledge gaps cause comprehension to break down in real time.
Confusion isn't just "hard content" — it's a specific failure mode where the lecture asks the listener to do something they can't yet do. Analyze the timestamped transcript for these failure modes:

1. **Undefined jargon** — A technical term is used as if already understood, with no definition given before or shortly after. The severity depends on how load-bearing the term is: a term the rest of the explanation depends on is far worse than an aside.
2. **Reference without referent** — Phrases like "as we said," "this," "that approach," "the same thing" where the thing being referred to is ambiguous, was mentioned much earlier, or wasn't actually established. The listener has to guess what's being pointed at.
3. **Compression spikes** — A passage where the *rate* of new information suddenly increases: multiple new terms, relationships, or steps introduced within a few sentences with no pause, example, or restatement. Look for places where the teacher seems to be rushing through something they clearly understand deeply but is compressing for a listener who doesn't.
4. **Assumed leaps** — A step in reasoning is skipped because it's "obvious" to the teacher but requires knowledge or an inferential jump the stated audience likely doesn't have. The tell is usually a logical connector ("so," "therefore," "which means") bridging two ideas that aren't actually adjacent in difficulty.
5. **Self-contradiction or hedging cascades** — The teacher says something, then qualifies it, then re-qualifies it, in a way that likely leaves the listener less certain than before the explanation started. Also flag cases where two parts of the lecture appear to state incompatible things about the same concept.

For the heatmap, identify 3–8 moments most likely to cause confusion, ranked by how badly they'd derail a student's understanding of *what comes after* — a confusion point early in an explanation that the rest of the lecture depends on is worse than an isolated confusing aside.
Each heatmap entry MUST use start_sec and end_sec that match real ranges from the transcript timestamps.

severity (0.0–1.0) should reflect:
- 0.0–0.3: a minor friction point a strong student would push through
- 0.3–0.6: likely to cause a noticeable comprehension gap for the target audience
- 0.6–1.0: likely to cause a student to lose the thread of everything that follows

In `reason`, name the specific failure mode (from the categories above), quote or closely paraphrase what was said, and state what the student is now missing as a result — not just that the moment was confusing, but what understanding it costs them downstream.

Score overall clarity from 0 (very confusing) to 10 (crystal clear), weighting compounding/downstream confusion more heavily than isolated dense moments.
You MUST respond entirely in English. Do not use any other language regardless of the language of the transcript or input materials."""


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
        raise ValueError("transcript unavailable — skipping clarity analysis")

    logger.info("Running clarity analysis for job %s", state["job_id"])
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
