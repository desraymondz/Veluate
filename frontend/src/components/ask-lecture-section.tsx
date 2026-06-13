"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { ClipPlayer } from "@/components/clip-player";
import { Button } from "@/components/ui/button";
import { askLecture } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import type { AskLectureResponse } from "@/lib/types";

type Props = {
  jobId: string;
  disabled?: boolean;
};

export function AskTheLectureSection({ jobId, disabled = false }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskLectureResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading || disabled) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await askLecture(jobId, trimmed);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Ask whether a topic was covered in the lecture. We search the indexed
        transcript and return evidence when we find a match.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Did the lecturer teach about…?"
          disabled={disabled || loading}
          className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={disabled || loading || question.trim().length < 3}
          className="shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </>
          ) : (
            "Ask"
          )}
        </Button>
      </form>

      {disabled && (
        <p className="text-sm text-muted-foreground">
          Available once transcription completes.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <article className="overflow-hidden border border-border bg-background">
          <div
            className={
              result.taught && result.clip_url
                ? "flex flex-col md:flex-row md:items-stretch"
                : undefined
            }
          >
            {result.taught && result.clip_url && (
              <div className="shrink-0 border-b border-border bg-muted/30 p-4 md:w-56 md:border-b-0 md:border-r lg:w-64 xl:w-72">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Lecture clip
                </p>
                <ClipPlayer
                  url={result.clip_url}
                  title={result.question}
                  compact
                />
              </div>
            )}

            <div className="min-w-0 flex-1 px-5 py-4">
              {result.taught ? (
                <>
                  <p className="font-display text-lg tracking-wide text-foreground">
                    Yes
                    {result.start_sec != null && (
                      <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                        — covered at {formatTimestamp(result.start_sec)}
                        {result.end_sec != null &&
                          result.end_sec > result.start_sec + 0.5 &&
                          ` – ${formatTimestamp(result.end_sec)}`}
                      </span>
                    )}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">
                    {result.summary}
                  </p>
                  {result.quote && (
                    <blockquote className="mt-4 border-l-2 border-foreground/25 pl-4 text-sm leading-relaxed text-foreground/90">
                      &ldquo;{result.quote}&rdquo;
                    </blockquote>
                  )}
                  {!result.clip_url && result.start_sec != null && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No video clip for this moment — use the timestamp above in
                      your lecture recording.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-display text-lg tracking-wide text-foreground">
                    No clear evidence
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {result.summary}
                  </p>
                  {result.transcript_excerpt && (
                    <div className="mt-4 border border-border bg-muted/30 px-4 py-3">
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Closest match (not a clear teaching moment)
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        &ldquo;{result.transcript_excerpt.slice(0, 320)}
                        {result.transcript_excerpt.length > 320 ? "…" : ""}
                        &rdquo;
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
