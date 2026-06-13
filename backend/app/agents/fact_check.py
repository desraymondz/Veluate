"""Fact-check agent — verifies teacher statements against external web sources."""

import logging
import os
from typing import Literal

from pydantic import BaseModel, Field

from app.agents._context import lecture_context
from app.graph.state import AgentState
from app.services.brightdata import SourceSnippet, brightdata_configured, search_google
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

_MAX_CLAIMS_DEFAULT = 6
_SKIP_NOTE = "Fact-check skipped — Bright Data not configured"

_EXTRACT_SYSTEM = """You are an expert fact-checker preparing claims from a lecture transcript for external verification.

Extract 3–6 factual statements the teacher made that can be checked against authoritative web sources
(textbooks, university pages, Wikipedia, official standards — not opinions or rhetorical questions).

Rules:
- Each claim must be a concrete factual assertion (dates, definitions, mechanisms, statistics, named effects).
- Skip opinions, pedagogical metaphors ("think of it like…"), and deliberate simplifications framed as such.
- quote must closely match what the teacher said in the transcript.
- start_sec and end_sec must match real timestamp ranges from the transcript.
- search_query should be a concise Google search phrase to verify the claim (include subject context when helpful).

You MUST respond entirely in English."""

_VERDICT_SYSTEM = """You are an expert fact-checker comparing lecture claims to web search snippets.

For each claim, compare the teacher's statement to the provided search results and assign a verdict:
- supported: matches consensus in reliable sources
- oversimplified: directionally correct but missing important nuance or caveats
- incorrect: contradicts reliable sources or states something factually wrong
- unverified: sources are missing, irrelevant, or insufficient to judge

Be fair to teaching context: introductory lectures often simplify — use oversimplified rather than incorrect
when the core idea is right but imprecise. Use incorrect only when the claim is materially wrong.

Each explanation should be 1–3 sentences citing what the sources say vs what was taught.
You MUST respond entirely in English."""


Verdict = Literal["supported", "oversimplified", "incorrect", "unverified"]


class ExtractedClaim(BaseModel):
    quote: str = Field(description="What the teacher said")
    start_sec: float
    end_sec: float
    topic: str = Field(description="Subject area of the claim")
    search_query: str = Field(description="Google search query to verify this claim")


class ClaimExtractionOutput(BaseModel):
    claims: list[ExtractedClaim] = Field(max_length=8)


class SourceRef(BaseModel):
    title: str
    url: str
    snippet: str = ""


class VerifiedClaim(BaseModel):
    quote: str
    start_sec: float
    end_sec: float
    topic: str
    verdict: Verdict
    explanation: str
    sources: list[SourceRef] = Field(default_factory=list)


class FactCheckReportOutput(BaseModel):
    summary: str = Field(description="2–3 sentence overview of fact-check results")
    claims: list[VerifiedClaim]


class ClaimWithSources(BaseModel):
    quote: str
    start_sec: float
    end_sec: float
    topic: str
    search_query: str
    sources: list[SourceRef]


class BatchVerdictOutput(BaseModel):
    claims: list[VerifiedClaim]


def _max_claims() -> int:
    raw = os.getenv("FACT_CHECK_MAX_CLAIMS", str(_MAX_CLAIMS_DEFAULT)).strip()
    try:
        return max(1, min(int(raw), 10))
    except ValueError:
        return _MAX_CLAIMS_DEFAULT


def _skip_report(note: str = _SKIP_NOTE) -> dict:
    return {
        "fact_check_report": {
            "summary": note,
            "claims": [],
            "note": note,
        }
    }


def _sources_to_refs(snippets: list[SourceSnippet]) -> list[SourceRef]:
    return [
        SourceRef(title=s.title, url=s.url, snippet=s.snippet)
        for s in snippets
    ]


def _format_sources_block(claims_with_sources: list[ClaimWithSources]) -> str:
    sections: list[str] = []
    for i, claim in enumerate(claims_with_sources, start=1):
        lines = [
            f"Claim {i}:",
            f'  Quote: "{claim.quote}"',
            f"  Topic: {claim.topic}",
            f"  Search query: {claim.search_query}",
        ]
        if claim.sources:
            lines.append("  Sources:")
            for src in claim.sources:
                lines.append(f"    - {src.title} ({src.url})")
                if src.snippet:
                    lines.append(f"      {src.snippet}")
        else:
            lines.append("  Sources: (none retrieved)")
        sections.append("\n".join(lines))
    return "\n\n".join(sections)


def _extract_claims(state: AgentState, max_claims: int) -> list[ExtractedClaim]:
    llm = get_llm().with_structured_output(ClaimExtractionOutput)
    result: ClaimExtractionOutput = llm.invoke(
        [
            {"role": "system", "content": _EXTRACT_SYSTEM},
            {
                "role": "user",
                "content": lecture_context(state)
                + f"\n\nExtract up to {max_claims} checkable factual claims with timestamps.",
            },
        ]
    )
    return result.claims[:max_claims]


def _verdict_on_claims(claims_with_sources: list[ClaimWithSources]) -> list[VerifiedClaim]:
    if not claims_with_sources:
        return []

    llm = get_llm().with_structured_output(BatchVerdictOutput)
    result: BatchVerdictOutput = llm.invoke(
        [
            {"role": "system", "content": _VERDICT_SYSTEM},
            {
                "role": "user",
                "content": (
                    "Verify each claim using the search snippets below.\n\n"
                    + _format_sources_block(claims_with_sources)
                ),
            },
        ]
    )
    return result.claims


def _unverified_claim(claim: ExtractedClaim, sources: list[SourceRef]) -> VerifiedClaim:
    return VerifiedClaim(
        quote=claim.quote,
        start_sec=claim.start_sec,
        end_sec=claim.end_sec,
        topic=claim.topic,
        verdict="unverified",
        explanation="No usable web sources were retrieved to verify this claim.",
        sources=sources,
    )


def run_fact_check(state: AgentState) -> dict:
    if not state.get("transcript"):
        raise ValueError("transcript unavailable — skipping fact-check")

    if not brightdata_configured():
        logger.info(
            "Fact-check skipped for job %s — Bright Data not configured",
            state["job_id"],
        )
        return _skip_report()

    max_claims = _max_claims()
    logger.info("Running fact-check for job %s (max %d claims)", state["job_id"], max_claims)

    extracted = _extract_claims(state, max_claims)
    if not extracted:
        return {
            "fact_check_report": {
                "summary": "No checkable factual claims were identified in the lecture.",
                "claims": [],
                "note": None,
            }
        }

    claims_with_sources: list[ClaimWithSources] = []
    for claim in extracted:
        snippets = search_google(claim.search_query, max_results=3)
        refs = _sources_to_refs(snippets)
        claims_with_sources.append(
            ClaimWithSources(
                quote=claim.quote,
                start_sec=claim.start_sec,
                end_sec=claim.end_sec,
                topic=claim.topic,
                search_query=claim.search_query,
                sources=refs,
            )
        )

    verifiable = [c for c in claims_with_sources if c.sources]
    unverifiable = [c for c in claims_with_sources if not c.sources]

    verified: list[VerifiedClaim] = []
    if verifiable:
        try:
            verified.extend(_verdict_on_claims(verifiable))
        except Exception as exc:
            logger.warning(
                "Fact-check verdict LLM failed for job %s: %s",
                state["job_id"],
                exc,
            )
            for claim in verifiable:
                extracted_match = next(
                    (e for e in extracted if e.quote == claim.quote),
                    None,
                )
                if extracted_match:
                    verified.append(_unverified_claim(extracted_match, claim.sources))

    for claim in unverifiable:
        extracted_match = next(
            (e for e in extracted if e.quote == claim.quote),
            None,
        )
        if extracted_match:
            verified.append(_unverified_claim(extracted_match, []))

    verified.sort(key=lambda c: c.start_sec)

    counts = {v: 0 for v in ("supported", "oversimplified", "incorrect", "unverified")}
    for claim in verified:
        counts[claim.verdict] = counts.get(claim.verdict, 0) + 1

    parts = []
    if counts["supported"]:
        parts.append(f"{counts['supported']} supported")
    if counts["oversimplified"]:
        parts.append(f"{counts['oversimplified']} oversimplified")
    if counts["incorrect"]:
        parts.append(f"{counts['incorrect']} incorrect")
    if counts["unverified"]:
        parts.append(f"{counts['unverified']} unverified")

    summary = (
        f"Checked {len(verified)} claim(s): {', '.join(parts)}."
        if parts
        else f"Checked {len(verified)} claim(s)."
    )

    return {
        "fact_check_report": {
            "summary": summary,
            "claims": [c.model_dump() for c in verified],
            "note": None,
        }
    }
