"use client";

import { ExternalLink } from "lucide-react";

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
    <div className="space-y-3">
      <video
        controls
        className="w-full border border-border bg-foreground"
        src={url}
        title={title}
      >
        Your browser does not support video playback.
      </video>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Open clip
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
        No video clips available. Timestamps are listed under Cross-reference.
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
        <div
          key={i}
          className="overflow-hidden border border-border bg-background"
        >
          <div className="border-b border-border px-4 py-4">
            <p className="font-medium text-foreground">{clip.exam_topic}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatTimestamp(clip.start_sec)}
              {clip.end_sec != null && ` – ${formatTimestamp(clip.end_sec)}`}
            </p>
          </div>
          <div className="p-4">
            {clip.clip_url ? (
              <ClipPlayer url={clip.clip_url} title={clip.exam_topic} />
            ) : (
              <p className="text-sm text-muted-foreground">Clip unavailable</p>
            )}
          </div>
        </div>
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
        No cross-references yet. Upload exam papers to link teaching gaps to
        student mistakes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {crossReferences.map((ref, i) => (
        <article
          key={i}
          className="overflow-hidden border border-border bg-background"
        >
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-medium text-foreground">{ref.exam_topic}</h4>
                {ref.syllabus_section && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ref.syllabus_section}
                  </p>
                )}
              </div>
              {ref.exam_frequency != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {Math.round(ref.exam_frequency * 100)}% of papers
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 px-5 py-4 text-sm leading-relaxed">
            {ref.teaching_timestamp != null && (
              <p className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(ref.teaching_timestamp)}
                {ref.teaching_end_sec != null &&
                  ` – ${formatTimestamp(ref.teaching_end_sec)}`}
              </p>
            )}
            {ref.transcript_excerpt && (
              <blockquote className="border-l-2 border-foreground/20 pl-4 text-muted-foreground">
                {ref.transcript_excerpt.slice(0, 280)}
                {ref.transcript_excerpt.length > 280 ? "…" : ""}
              </blockquote>
            )}
            {ref.evidence && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Evidence
                </p>
                <p className="text-foreground">{ref.evidence}</p>
              </div>
            )}
            {ref.recommendation && (
              <div className="bg-muted px-4 py-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recommendation
                </p>
                <p className="text-foreground">{ref.recommendation}</p>
              </div>
            )}
            {ref.clarity_link && (
              <p className="text-xs text-muted-foreground">
                Clarity · {Math.round(ref.clarity_link.severity * 100)}% —{" "}
                {ref.clarity_link.reason}
              </p>
            )}
            {ref.structure_link && (
              <p className="text-xs text-muted-foreground">
                Structure · {severityLabel(ref.structure_link.severity)} —{" "}
                {ref.structure_link.detail}
              </p>
            )}
            {ref.clip_url && (
              <a
                href={ref.clip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Watch clip
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
