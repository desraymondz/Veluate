"""Exam agent — parses student papers, clusters weak concepts, maps to syllabus."""

from pydantic import BaseModel, Field

from app.agents._context import exam_context, load_exam_texts
from app.graph.state import AgentState
from app.services.llm import get_llm

_SYSTEM = """You are an expert educator analyzing student exam performance.

Given a course syllabus and one or more answered student exam papers:
1. Identify wrong, incomplete, or weak answers (including conceptual misunderstandings)
2. Cluster recurring mistakes by concept domain
3. Map each cluster to the most relevant syllabus topic or section

For each weak cluster:
- topic: short label aligned with the syllabus (not generic like "math errors")
- syllabus_section: the syllabus heading or module this maps to, if identifiable
- frequency: fraction of exam papers showing this weakness (0.0–1.0)
- example_mistakes: 2–4 concrete examples of what students got wrong

Order clusters by frequency (highest first). Be evidence-based — cite patterns you
actually see in the papers, not hypothetical mistakes. If papers are mostly correct,
return fewer clusters with lower frequencies rather than inventing problems.

Some papers may include bracketed response labels (e.g. [Struggles with Architecture Response])
— treat these as hints about answer quality, but still ground clusters in question topics
and syllabus mapping."""


class WeakCluster(BaseModel):
    topic: str = Field(description="Syllabus-aligned concept label")
    syllabus_section: str | None = Field(
        default=None, description="Matching syllabus heading or module"
    )
    frequency: float = Field(ge=0, le=1, description="Share of papers with this weakness")
    example_mistakes: list[str] = Field(min_length=1, max_length=6)


class ExamAnalysisOutput(BaseModel):
    summary: str = Field(description="2–4 sentence overview of class-wide exam performance")
    weak_clusters: list[WeakCluster] = Field(max_length=12)


def _empty_analysis(exam_count: int, note: str) -> dict:
    return {
        "exam_analysis": {
            "exam_count": exam_count,
            "summary": note,
            "weak_clusters": [],
            "note": note,
        }
    }


def _paper_is_usable(text: str) -> bool:
    if not text.strip():
        return False
    if text.startswith("(could not be parsed"):
        return False
    if text == "(no extractable text)":
        return False
    if text.startswith("...(skipped"):
        return False
    return True


def run_exam_analysis(state: AgentState) -> dict:
    exam_paths = state.get("exam_paths") or []
    exam_count = len(exam_paths)

    if exam_count == 0:
        return _empty_analysis(0, "No exam papers uploaded")

    papers = load_exam_texts(exam_paths)
    if not any(_paper_is_usable(text) for _, text in papers):
        return _empty_analysis(exam_count, "Exam papers could not be parsed")

    llm = get_llm().with_structured_output(ExamAnalysisOutput)
    result: ExamAnalysisOutput = llm.invoke(
        [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": exam_context(state) + "\n\nProduce the exam gap analysis.",
            },
        ]
    )

    clusters = [c.model_dump() for c in result.weak_clusters]
    return {
        "exam_analysis": {
            "exam_count": exam_count,
            "summary": result.summary,
            "weak_clusters": clusters,
            "note": None,
        }
    }
