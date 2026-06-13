"""Run a full Veluate pipeline on sample_data/ assets.

Usage (from backend/):
  uv run python -m app.scripts.run_demo --youtube-url "https://www.youtube.com/watch?v=..."

Environment:
  DEMO_YOUTUBE_URL  — default YouTube lecture if --youtube-url omitted
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create and run a demo evaluation job from sample_data/"
    )
    parser.add_argument(
        "--youtube-url",
        default=os.getenv("DEMO_YOUTUBE_URL", "").strip() or None,
        help="YouTube lecture URL (or set DEMO_YOUTUBE_URL)",
    )
    parser.add_argument(
        "--sample-dir",
        type=Path,
        default=None,
        help="Path to sample_data/ (default: repo sample_data/)",
    )
    parser.add_argument(
        "--syllabus",
        type=Path,
        default=None,
        help="Override syllabus PDF path",
    )
    parser.add_argument("--teacher-name", default="Dr Lee")
    parser.add_argument(
        "--audience",
        default="Psychology undergrads — Foundations of Psychology",
    )
    parser.add_argument(
        "--max-exams",
        type=int,
        default=None,
        help="Limit number of exam PDFs (default: all in sample_data/exams/)",
    )
    parser.add_argument(
        "--frontend-url",
        default=os.getenv("FRONTEND_URL", "http://localhost:3000"),
        help="Printed dashboard link after job is created",
    )
    return parser.parse_args()


async def _main() -> int:
    from app.db.session import init_db
    from app.services.demo_jobs import DemoSetupError, run_demo_job

    args = _parse_args()
    await init_db()

    try:
        job_id = await run_demo_job(
            youtube_url=args.youtube_url,
            sample_dir=args.sample_dir,
            syllabus_path=args.syllabus,
            teacher_name=args.teacher_name,
            audience=args.audience,
            max_exams=args.max_exams,
        )
    except DemoSetupError as exc:
        print(f"Demo setup failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        return 2

    print("\nDemo job finished")
    print(f"  Job ID:  {job_id}")
    print(f"  API:     http://localhost:8000/jobs/{job_id}")
    print(f"  UI:      {args.frontend_url.rstrip('/')}/jobs/{job_id}")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(_main()))


if __name__ == "__main__":
    main()
