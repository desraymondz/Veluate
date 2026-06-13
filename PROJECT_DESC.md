# Veluate — AI-Powered Teacher Evaluation System

---

## 1. Overview

Veluate is an AI-powered teacher evaluation system that analyses lecture recordings using an orchestration of specialised AI agents. It surfaces structural weaknesses in teaching delivery, generates a **confusion heatmap** pinpointing where students most likely lose understanding, cross-references those gaps with actual student exam performance, and optionally **fact-checks factual claims** in the lecture against web sources via Bright Data — producing a targeted, evidence-based feedback report per teacher.

---

## 2. Problem Statement

Teachers receive almost no structured, data-driven feedback on how well they actually teach.

End-of-semester student surveys are:

- **Subjective** — driven by student sentiment, not learning outcomes
- **Delayed** — feedback arrives too late to change anything
- **Disconnected** — never tied to measurable evidence of understanding

There is no system today that connects *how a teacher explains a concept* to *whether students actually understood it at exam time*.

This problem spans universities, bootcamps, corporate training, and online courses globally. The result: students underperform not because the content is hard, but because the delivery was poor — and nobody catches it in time.

---

## 3. Solution

Veluate ingests lecture recordings, syllabi, and student exam data, then runs a multi-agent pipeline to answer one core question:

> **"Where exactly did teaching break down — and how does that map to what students got wrong?"**
> 

### Core outputs:

| Output | Description |
| --- | --- |
| 📐 **Structure Report** | Analysis of lesson flow, concept build-up, and narrative coherence |
| 🌡️ **Confusion Heatmap** | Timestamped map of moments most likely to cause student confusion |
| 📊 **Exam Gap Analysis** | Common weak domains extracted from student exam papers |
| 🎯 **Cross-Reference Report** | Links teaching moments to exam failure clusters |
| 🎬 **Video Clip Evidence** | Direct video clips or timestamps of the problematic teaching moments |
| ✅ **Factual Accuracy Report** | Checkable claims from the lecture verified against web sources (Bright Data SERP); verdicts: supported, oversimplified, incorrect, or unverified |

---

## 4. Target Users

### Primary — Educators

- University lecturers and professors
- Bootcamp instructors
- Corporate L&D trainers

### Secondary — Administrators

- Heads of department
- Curriculum managers
- Learning & Development (L&D) team leads

---

## 5. System Architecture

### 5.1 Input

Users provide:

- 🎥 Lecture video recording(s)
- 📄 Course syllabus
- 👤 Teacher name and metadata
- 🎓 Target student audience profile
- 📝 Answered student exam papers

---

### 5.2 Pipeline Overview

```
[Video Upload]
     │
     ▼
[VideoDB — Index + Store]
     │
     ▼
[Transcription Agent — with timestamps]
     │
     ├──────────────────┬──────────────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
[Structure Agent]  [Clarity Agent]   [Exam Agent]      [Fact-Check Agent]
 - Lesson flow      - Jargon detection  - Parses exam papers   - Extracts checkable claims
 - Concept build-up - Explanation gaps  - Weak concept clusters - Bright Data SERP lookup
 - Narrative flow   - Confusion heatmap - Syllabus mapping      - Verdict per claim
     │                  │                  │                  │
     └──────────────────┴──────────────────┘                  │
                    ▼                                          │
     [Cross-Reference Agent]                                   │
     - Retrieves video clips from VideoDB                     │
     - Links exam failure clusters → teaching moments          │
     - Generates final evidence-based feedback report          │
                    │                                          │
                    ▼                                          ▼
          [Frontend Dashboard]              [Factual Accuracy report]
```

---

### 5.3 Agent Breakdown

### 🔊 Transcription Agent

- Ingests video via VideoDB
- Produces timestamped transcript
- Feeds downstream agents

### 🏗️ Structure Agent

- Evaluates lesson flow and build-up from prior concepts
- Scores narrative coherence and pacing
- Flags structural gaps (e.g. missing scaffolding, abrupt topic jumps)

### 🧠 Clarity Agent

- Detects jargon used without explanation
- Identifies dense or ambiguous passages
- Produces a **confusion heatmap** with timestamps

### 📝 Exam Agent

- Parses answered student exam papers
- Clusters wrong answers by concept domain
- Maps weak areas back to the syllabus

### 🔗 Cross-Reference Agent

- Retrieves video clips from VideoDB matching weak exam concepts
- Connects exam failure patterns to specific teaching moments
- Produces the final combined feedback report
- Chunking strategy: Use a **sliding window of ~5-8 sentences** (roughly 45-90 seconds of speech) with **50% overlap** between chunks. This is the standard production pattern for lecture/podcast RAG.

### ✅ Fact-Check Agent *(optional — requires Bright Data)*

- Runs **in parallel** with structure, clarity, and exam after transcription
- Uses the LLM to extract 3–6 concrete, checkable factual claims from the transcript (definitions, mechanisms, statistics — not opinions)
- Verifies each claim via the **Bright Data SERP API** (Google search with parsed organic results)
- Assigns a verdict per claim: **supported**, **oversimplified**, **incorrect**, or **unverified**
- Surfaces timestamped quotes, source links, and explanations in the **Factual accuracy** report tab
- **Graceful skip:** if `BRIGHTDATA_API_TOKEN` / `BRIGHTDATA_SERP_ZONE` are unset, the pipeline completes without fact-check; the report notes that Bright Data was not configured

---

## 6. Tech Stack

| Layer | Technology | Rationale |
| --- | --- | --- |
| **Video Infrastructure** | VideoDB | Index, search, and clip lecture recordings by semantic content |
| **Web Evidence (optional)** | Bright Data SERP API | Retrieve Google search snippets to verify lecture factual claims |
| **Orchestration** | **LangGraph** | Multi-agent state machine with conditional routing and parallel branches |
| **LLM Framework** | LangChain (within LangGraph nodes) | Tool use, prompt templates, and document parsing |
| **Backend API** | FastAPI | Async-friendly, lightweight, easy to containerise |
| **Database** | SQLite (MVP) → PostgreSQL (post-MVP) | Store job metadata, agent outputs, report history |
| **Frontend** | Next.js + Tailwind CSS + shadcn | SSR dashboard with real-time job status and loading animation |
| **Deployment** | Vercel (frontend) + Railway (backend) | Post-MVP; zero-friction hosting for both layers |

---

## 7. Orchestration Decision: LangGraph

### Why not plain LangChain?

LangChain is a toolkit — it gives you chains, tools, and prompt templates. It's great for **linear pipelines** (Step A → Step B → Step C). But Veluate's pipeline has:

- **Parallel branches** (Structure, Clarity, Exam, and Fact-Check agents run concurrently after transcription)
- **Conditional routing** (Cross-Reference Agent only runs after Structure, Clarity, and Exam succeed)
- **Stateful checkpoints** (you need to know which agents have finished, and resume if one fails)
- **Human-in-the-loop potential** (future: admin can review before final report is sent)

LangChain alone can't manage this cleanly without you writing a lot of glue code.

### Why LangGraph?

LangGraph models your pipeline as a **directed graph of nodes and edges** — each agent is a node, each dependency is an edge. This gives you:

| Feature | LangGraph |
| --- | --- |
| Parallel agent execution | ✅ Native with fan-out edges |
| Conditional routing | ✅ Conditional edges based on state |
| Shared state across agents | ✅ `AgentState` TypedDict passed between nodes |
| Checkpointing / resume on failure | ✅ Built-in with `MemorySaver` or `SqliteSaver` |
| Human-in-the-loop | ✅ `interrupt_before` on any node |
| Streaming partial results to frontend | ✅ `.astream_events()` |

### The mental model

Think of LangGraph like **airport baggage routing** — each bag (your data/state) travels through checkpoints (nodes), can be re-routed at forks (conditional edges), and multiple bags can move through different belts simultaneously (parallel branches). LangChain alone is just one straight conveyor belt.

### Recommended graph structure for Veluate

```
START
  └─► transcription_node
        ├─► structure_node   ──┐
        ├─► clarity_node     ──┼─► cross_reference_node ──► END
        ├─► exam_node        ──┘
        └─► fact_check_node ─────────────────────────────► END
```

`fact_check` is independent of cross-reference: it only needs the transcript and Bright Data credentials. Cross-reference waits for structure, clarity, and exam before producing the final teaching-vs-exam report.

**Verdict: LangGraph is the right call.** It gives you full control over the graph, production-ready state management, and it's built by the same team as LangChain so everything integrates cleanly.