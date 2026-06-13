# Sample Data

Demo assets for the Veluate pipeline.

## Included

| Path | Contents |
|------|----------|
| `syllabus/syllabus.pdf` | Foundations of Psychology — weekly topics |
| `exams/Student_*.pdf` | 15 student exam papers (~52k chars total) |

## Optional

| Path | Notes |
|------|-------|
| `video/lecture.mp4` | Local lecture clip (or use YouTube via demo script / UI) |

## Quick demo

```bash
cd backend
export DEMO_YOUTUBE_URL="https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
uv run python -m app.scripts.run_demo
```

## Exam papers

Each answer includes bracketed quality tags useful for validating clustering:

- `[Near-Perfect Academic Response]`
- `[Struggles with Architecture Response]`
- `[Terminology Confused Response]`
- `[Total Concept Reversal Response]`

## Upload all exams via curl

```bash
EXAM_FLAGS=$(for f in sample_data/exams/Student_*.pdf; do echo -n " -F exams=@$f"; done)

curl -X POST http://localhost:8000/jobs \
  -F "teacher_name=Dr Lee" \
  -F "audience=Psychology undergrads" \
  -F "syllabus=@sample_data/syllabus/syllabus.pdf" \
  $EXAM_FLAGS \
  -F "youtube_urls=${DEMO_YOUTUBE_URL}"
```
