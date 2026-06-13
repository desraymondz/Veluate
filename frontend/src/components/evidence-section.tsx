"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTimestamp, severityLabel } from "@/lib/format";
import type { CrossReference } from "@/lib/types";

type Props = {
  crossReferences: CrossReference[];
  evidenceClips?: {
    exam_topic: string;
    start_sec: number | null;
    end_sec: number | null;
    clip_url: string | null;
  }[];
};

function ClipPlayer({ url, title }: { url: string; title: string }) {
  return (
    <div className="space-y-2">
      <video
        controls
        className="w-full rounded-lg border bg-black"
        src={url}
        title={title}
      >
        Your browser does not support video playback.
      </video>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Open clip in new tab
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

export function EvidenceSection({ crossReferences, evidenceClips }: Props) {
  const withClips = crossReferences.filter((ref) => ref.clip_url);

  if (!withClips.length && !evidenceClips?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No video clips available. Timestamps are still listed in cross-references.
      </p>
    );
  }

  const clips =
    evidenceClips?.filter((c) => c.clip_url) ??
    withClips.map((ref) => ({
      exam_topic: ref.exam_topic,
      start_sec: ref.teaching_timestamp,
      end_sec: ref.teaching_end_sec ?? null,
      clip_url: ref.clip_url ?? null,
    }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {clips.map((clip, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">{clip.exam_topic}</CardTitle>
            <CardDescription>
              {formatTimestamp(clip.start_sec)}
              {clip.end_sec != null && ` – ${formatTimestamp(clip.end_sec)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clip.clip_url ? (
              <ClipPlayer url={clip.clip_url} title={clip.exam_topic} />
            ) : (
              <p className="text-sm text-muted-foreground">Clip unavailable</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CrossReferenceList({
  crossReferences,
}: {
  crossReferences: CrossReference[];
}) {
  if (!crossReferences.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No cross-references generated. Upload exam papers to link teaching gaps to
        student mistakes.
      </p>
    );
  }

  return (
    <>
      <IntroCallout />
      {clipCount > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          {clipCount} of {crossReferences.length} link
          {crossReferences.length === 1 ? "" : "s"} include video
        </p>
      )}
      <div className="space-y-8">
        {crossReferences.map((ref, i) => {
          const clip = clipUrlForRef(ref, evidenceClips);

          return (
            <article
              key={i}
              className="overflow-hidden border border-border bg-background"
            >
              <div
                className={
                  clip
                    ? "flex flex-col md:flex-row md:items-stretch"
                    : undefined
                }
              >
                {clip && (
                  <div className="shrink-0 border-b border-border bg-muted/30 p-4 md:w-56 md:border-b-0 md:border-r lg:w-64 xl:w-72">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Lecture clip
                    </p>
                    <ClipPlayer
                      url={clip}
                      title={ref.exam_topic}
                      compact
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="border-b border-border bg-muted/20 px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Students struggled with
                    </p>
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                      <h4 className="font-display text-lg tracking-wide text-foreground sm:text-xl">
                        {ref.exam_topic}
                      </h4>
                      {ref.exam_frequency != null && (
                        <span className="shrink-0 rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-foreground">
                          {Math.round(ref.exam_frequency * 100)}% of papers
                        </span>
                      )}
                    </div>
                    {ref.syllabus_section && (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Syllabus: {ref.syllabus_section}
                      </p>
                    )}
                    {ref.example_mistakes && ref.example_mistakes.length > 0 && (
                      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {ref.example_mistakes.map((mistake, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-foreground/30">—</span>
                            {mistake}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="px-5 py-4">
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ArrowDown className="size-3.5 shrink-0 md:hidden" aria-hidden />
                      <span className="hidden text-muted-foreground md:inline">→</span>
                      <span className="font-medium uppercase tracking-wider">
                        Taught in the lecture
                      </span>
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed">
                      {ref.teaching_timestamp != null && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatTimestamp(ref.teaching_timestamp)}
                          {ref.teaching_end_sec != null &&
                            ` – ${formatTimestamp(ref.teaching_end_sec)}`}
                        </p>
                      )}

                      {ref.transcript_excerpt && (
                        <blockquote className="border-l-2 border-foreground/25 pl-4 text-sm leading-relaxed text-foreground/90">
                          &ldquo;{ref.transcript_excerpt.slice(0, 320)}
                          {ref.transcript_excerpt.length > 320 ? "…" : ""}&rdquo;
                        </blockquote>
                      )}

                      {!clip && ref.teaching_timestamp != null && (
                        <p className="text-xs text-muted-foreground">
                          No video clip for this moment — use the timestamp above
                          in your lecture recording.
                        </p>
                      )}

                      {ref.evidence && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Why they link
                          </p>
                          <p className="text-foreground">{ref.evidence}</p>
                        </div>
                      )}

                      {ref.recommendation && (
                        <div className="border border-border bg-muted px-4 py-3">
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            What to try next
                          </p>
                          <p className="text-foreground">{ref.recommendation}</p>
                        </div>
                      )}

                      {ref.rewrite_suggestion && (
                        <div className="border border-foreground/20 bg-background px-4 py-3">
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Try saying it this way
                          </p>
                          <p className="italic leading-relaxed text-foreground/90">
                            &ldquo;{ref.rewrite_suggestion}&rdquo;
                          </p>
                        </div>
                      )}

                      {(ref.clarity_link || ref.structure_link) && (
                        <div className="space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                          {ref.clarity_link && (
                            <p>
                              Clarity ·{" "}
                              {Math.round(ref.clarity_link.severity * 100)}% —{" "}
                              {ref.clarity_link.reason}
                            </p>
                          )}
                          {ref.structure_link && (
                            <p>
                              Structure ·{" "}
                              {severityLabel(ref.structure_link.severity)} —{" "}
                              {ref.structure_link.detail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

/** @deprecated Use TeachingEvidenceSection */
export function CrossReferenceList({
  crossReferences,
}: {
  crossReferences: CrossReference[];
}) {
  return (
    <TeachingEvidenceSection crossReferences={crossReferences} />
  );
}

/** @deprecated Use TeachingEvidenceSection */
export function EvidenceSection({
  crossReferences,
  evidenceClips,
}: Props) {
  return (
    <TeachingEvidenceSection
      crossReferences={crossReferences}
      evidenceClips={evidenceClips}
    />
  );
}
