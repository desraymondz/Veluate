"use client";

import { useMemo, useState } from "react";

import { formatDuration, formatTimestamp } from "@/lib/format";
import type { TranscriptionResult, VideoSource } from "@/lib/types";

type Props = {
  transcription: TranscriptionResult;
  jobFiles?: { file_type: string; original_filename: string | null; source_url: string | null }[];
};

function sourceLabel(
  video: VideoSource,
  sources: VideoSource[],
  jobFiles: Props["jobFiles"]
): string {
  if (video.source_type === "youtube") {
    const ytIndex = sources
      .filter((s) => s.source_type === "youtube")
      .indexOf(video);
    const url = jobFiles?.filter((f) => f.file_type === "youtube")[ytIndex]?.source_url;
    return url
      ? `YouTube · ${url.replace(/^https?:\/\//, "").slice(0, 48)}`
      : "YouTube";
  }
  const fileIndex = sources.filter((s) => s.source_type === "file").indexOf(video);
  const upload = jobFiles?.filter((f) => f.file_type === "video")[fileIndex];
  return upload?.original_filename ?? `Upload ${fileIndex + 1}`;
}

function transcriptDuration(segments: TranscriptionResult["transcript"]): number | null {
  if (!segments.length) return null;
  return segments[segments.length - 1]?.end ?? null;
}

export function transcriptSummary(transcription: TranscriptionResult): string {
  const { transcript, videodb_videos: sources } = transcription;
  if (!transcript.length) {
    return "Transcription finished — no spoken segments detected.";
  }

  const duration = transcriptDuration(transcript);
  const parts = [`${transcript.length} segments`];
  if (sources.length > 0) {
    parts.push(`${sources.length} source${sources.length === 1 ? "" : "s"}`);
  }
  if (duration != null) {
    parts.push(`${formatDuration(duration)} total`);
  }
  return parts.join(" · ");
}

export function TranscriptSection({ transcription, jobFiles }: Props) {
  const { transcript, videodb_videos: sources } = transcription;
  const [query, setQuery] = useState("");

  const videoLabels = useMemo(() => {
    const map = new Map<string, string>();
    sources.forEach((source) => {
      map.set(source.id, sourceLabel(source, sources, jobFiles));
    });
    return map;
  }, [sources, jobFiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transcript;
    return transcript.filter((seg) => seg.text.toLowerCase().includes(q));
  }, [transcript, query]);

  const duration = transcriptDuration(transcript);
  const multipleSources = sources.length > 1;

  if (!transcript.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Transcription finished but no spoken segments were detected.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Timestamped speech from your lecture sources — available as soon as
        indexing completes.
      </p>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-border px-3 py-1 font-data text-xs text-foreground">
          {transcript.length} segments
        </span>
        {sources.length > 0 && (
          <span className="inline-flex items-center rounded-full border border-border px-3 py-1 font-data text-xs text-foreground">
            {sources.length} source{sources.length === 1 ? "" : "s"}
          </span>
        )}
        {duration != null && (
          <span className="inline-flex items-center rounded-full border border-border px-3 py-1 font-data text-xs text-foreground">
            {formatDuration(duration)} total
          </span>
        )}
      </div>

      {sources.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {sources.map((source) => (
            <li key={source.id}>
              <span className="font-medium text-foreground">
                {sourceLabel(source, sources, jobFiles)}
              </span>
              {" · "}
              {source.segment_count} segments
              {source.length != null && ` · ${formatDuration(source.length)}`}
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript…"
        className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
      />

      <div className="max-h-[28rem] overflow-y-auto border border-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No segments match &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {filtered.map((seg, i) => (
              <li
                key={`${seg.start}-${seg.end}-${i}`}
                className="flex gap-4 px-4 py-3 text-sm leading-relaxed hover:bg-muted/40"
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {formatTimestamp(seg.start)}
                  {seg.end > seg.start + 0.5 && (
                    <>
                      <span className="text-muted-foreground/50"> – </span>
                      {formatTimestamp(seg.end)}
                    </>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {multipleSources && seg.video_id && videoLabels.has(seg.video_id) && (
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {videoLabels.get(seg.video_id)}
                    </p>
                  )}
                  <p className="text-foreground">{seg.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {query.trim() && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {transcript.length} segments
        </p>
      )}
    </div>
  );
}
