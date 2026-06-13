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
    <div className="space-y-4">
      {crossReferences.map((ref, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{ref.exam_topic}</CardTitle>
                {ref.syllabus_section && (
                  <CardDescription>{ref.syllabus_section}</CardDescription>
                )}
              </div>
              {ref.exam_frequency != null && (
                <Badge variant="secondary">
                  {Math.round(ref.exam_frequency * 100)}% of papers
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ref.teaching_timestamp != null && (
              <p className="font-mono text-xs text-muted-foreground">
                Lecture moment: {formatTimestamp(ref.teaching_timestamp)}
                {ref.teaching_end_sec != null &&
                  ` – ${formatTimestamp(ref.teaching_end_sec)}`}
              </p>
            )}
            {ref.transcript_excerpt && (
              <blockquote className="border-l-2 pl-3 italic text-muted-foreground">
                &ldquo;{ref.transcript_excerpt.slice(0, 280)}
                {ref.transcript_excerpt.length > 280 ? "…" : ""}&rdquo;
              </blockquote>
            )}
            {ref.evidence && (
              <div>
                <p className="mb-1 font-medium">Evidence</p>
                <p>{ref.evidence}</p>
              </div>
            )}
            {ref.recommendation && (
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="mb-1 font-medium">Recommendation</p>
                <p>{ref.recommendation}</p>
              </div>
            )}
            {ref.clarity_link && (
              <p className="text-xs text-muted-foreground">
                Clarity flag ({Math.round(ref.clarity_link.severity * 100)}%):{" "}
                {ref.clarity_link.reason}
              </p>
            )}
            {ref.structure_link && (
              <p className="text-xs text-muted-foreground">
                Structure ({severityLabel(ref.structure_link.severity)}):{" "}
                {ref.structure_link.detail}
              </p>
            )}
            {ref.clip_url && (
              <a
                href={ref.clip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Watch clip
                <ExternalLink className="size-3" />
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
