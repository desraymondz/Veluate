# Veluate

AI-powered teacher evaluation system. Analyses lecture recordings with a multi-agent LangGraph pipeline and cross-references teaching gaps with student exam performance.

## Quick start

### Backend

```bash
cd backend
uv sync
cp .env.example .env        # add your API keys
uv run uvicorn app.main:app --reload
```

Health check: http://localhost:8000/health

Create a job (YouTube URLs and/or video files + syllabus PDF):

```bash
curl -X POST http://localhost:8000/jobs \
  -F "teacher_name=Dr Smith" \
  -F "audience=CS undergrads" \
  -F "syllabus=@/path/to/syllabus.pdf" \
  -F "youtube_urls=https://www.youtube.com/watch?v=..." \
  -F "youtube_urls=https://youtu.be/..."
```

Then `GET /jobs/{id}` for status/results, `GET /jobs/{id}/events` for SSE progress.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Sample data

Add demo files to `sample_data/` (see `sample_data/README.md`).

## Switching LLM providers

Set `LLM_PROVIDER` in `backend/.env` — no code changes needed:

| Provider | Value | API key env var | Default model |
|----------|-------|-----------------|---------------|
| Anthropic (Claude) | `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Kimi (Moonshot) | `kimi` | `MOONSHOT_API_KEY` | `moonshot-v1-32k` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |

Optional: override model with `LLM_MODEL=...`

All agents use `get_llm()` from `app/services/llm.py` (LangChain).

## Project structure

```
backend/app/
  main.py           FastAPI entry
  api/routes/       HTTP endpoints
  graph/            LangGraph pipeline (Phase 2+)
  agents/           Agent prompts + logic
  services/         LLM, VideoDB, file parsing
  db/               SQLite models (Phase 1+)
frontend/src/       Next.js dashboard
sample_data/        Demo video, syllabus, exams
```

## Build phases

- [x] Phase 0 — Skeleton (this repo)
- [x] Phase 1 — Job API + SQLite
- [x] Phase 2 — LangGraph shell
- [x] Phase 3 — Transcription agent + VideoDB
- [x] Phase 4 — Structure + Clarity agents
- [x] Phase 5 — Exam agent
- [x] Phase 6 — Cross-reference agent
- [ ] Phase 7 — Frontend dashboard
- [ ] Phase 8 — Polish + demo
