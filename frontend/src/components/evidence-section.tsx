"use client";

import { ArrowDown, ExternalLink } from "lucide-react";

import { formatTimestamp, severityLabel } from "@/lib/format";
import type { CrossReference } from "@/lib/types";

type EvidenceClip = {
  exam_topic: string;
  start_sec: number | null;
  end_sec: number | null;
  clip_url: string | null;
};

type Props = {
  crossReferences: CrossReference[];
  evidenceClips?: EvidenceClip[];
};

function ClipPlayer({
  url,
  title,
  compact = false,
}: {
  url: string;
  title: string;
  compact?: boolean;
}) {
  const isVideoDbPlayer = /player\.videodb\.io/i.test(url);
  const embedUrl = isVideoDbPlayer ? url.replace("/watch?", "/embed?") : url;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {isVideoDbPlayer ? (
        <iframe
          src={embedUrl}
          title={title}
          className="aspect-video w-full border border-border bg-foreground"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          controls
          className="aspect-video w-full border border-border bg-foreground object-cover"
          src={url}
          title={title}
        >
          Your browser does not support video playback.
        </video>
      )}
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

function clipUrlForRef(
  ref: CrossReference,
  evidenceClips?: EvidenceClip[]
): string | null {
  if (ref.clip_url) return ref.clip_url;
  const match = evidenceClips?.find(
    (c) => c.exam_topic === ref.exam_topic && c.clip_url
  );
  return match?.clip_url ?? null;
}

function IntroCallout() {
  return (
    <div className="mb-6 border border-border bg-muted/50 px-5 py-4">
      <p className="text-sm font-medium text-foreground">
        Exam struggle → Lecture moment
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Each card connects something students got wrong on the exam to the part
        of the lecture where it was taught — with video when we can find a
        matching clip.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="border border-border bg-background px-2.5 py-1">
          Exam weakness
        </span>
        <ArrowDown className="size-3.5 shrink-0" aria-hidden />
        <span className="border border-border bg-background px-2.5 py-1">
          Teaching clip
        </span>
        <ArrowDown className="size-3.5 shrink-0" aria-hidden />
        <span className="border border-border bg-background px-2.5 py-1">
          What to improve
        </span>
      </div>
    </div>
  );
}

export function TeachingEvidenceSection({
  crossReferences,
  evidenceClips,
}: Props) {
  if (!crossReferences.length) {
    return (
      <>
        <IntroCallout />
        <p className="text-sm text-muted-foreground">
          No links yet. Upload exam papers so we can match student mistakes to
          moments in the lecture.
        </p>
      </>
    );
  }

  const clipCount = crossReferences.filter(
    (ref) => clipUrlForRef(ref, evidenceClips)
  ).length;

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
