# Sample Data

Demo assets for the Veluate pipeline.

## Exams (`exams/`)

**15 student papers** for *Foundations of Psychology* (SIM, Semester 2 2026):

| File | Student |
|------|---------|
| `Student_1_Beatrice_Lim.pdf` | Beatrice Lim |
| `Student_2_Chao_Fletcher.pdf` | Chao Fletcher |
| … | … |
| `Student_15_Prakash_Kumar.pdf` | Prakash Kumar |

Each PDF is ~3–5k chars (~52k total). Answers include bracketed quality tags such as:

- `[Near-Perfect Academic Response]`
- `[Struggles with Architecture Response]`
- `[Terminology Confused Response]`
- `[Total Concept Reversal Response]`

These are useful for validating exam clustering in Phase 5.

### Upload all exams via curl

```bash
EXAM_FLAGS=$(for f in sample_data/exams/Student_*.pdf; do echo -n " -F exams=@$f"; done)

curl -X POST http://localhost:8000/jobs \
  -F "teacher_name=Dr Smith" \
  -F "audience=Psychology undergrads" \
  -F "syllabus=@sample_data/syllabus/syllabus.pdf" \
  $EXAM_FLAGS \
  -F "youtube_urls=https://www.youtube.com/watch?v=..."
```

## Still needed

| Folder | File | Notes |
|--------|------|-------|
| `syllabus/` | `syllabus.pdf` | Course syllabus — **required** for job creation |
| `video/` | `lecture.mp4` | Lecture clip for transcription (or use YouTube URL) |
