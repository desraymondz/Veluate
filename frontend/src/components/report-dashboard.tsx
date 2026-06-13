"use client";

import { CollapsibleSection } from "@/components/collapsible-section";
import { AskTheLectureSection } from "@/components/ask-lecture-section";
import { ConfusionHeatmap } from "@/components/confusion-heatmap";
import { TeachingEvidenceSection } from "@/components/evidence-section";
import {
  TranscriptSection,
  transcriptSummary,
} from "@/components/transcript-section";
import { formatTimestamp, severityLabel } from "@/lib/format";
import { summaryInfographicUrl } from "@/lib/api";
import type { ParsedReports, TranscriptionResult } from "@/lib/types";

type Props = {
  reports: ParsedReports;
  teacherName: string;
  jobId?: string;
  transcription?: TranscriptionResult | null;
  jobFiles?: {
    file_type: string;
    original_filename: string | null;
    source_url: string | null;
  }[];
};

function StatPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

export function ReportDashboard({
  reports,
  teacherName,
  jobId,
  transcription,
  jobFiles,
}: Props) {
  const { structure, clarity, exam, final } = reports;

  if (
    !final &&
    !structure &&
    !clarity &&
    !exam &&
    !transcription
  ) {
    return null;
  }

  const summary = final?.summary;
  const recommendations = final?.recommendations ?? [];
  const crossReferences = final?.cross_references ?? [];
  const heatmap = clarity?.heatmap ?? final?.top_confusion_moments ?? [];
  const structureFindings =
    structure?.findings ?? final?.structure_highlights ?? [];
  const examClusters = exam?.weak_clusters ?? final?.exam_gaps ?? [];
  const clipCount = crossReferences.filter((ref) => ref.clip_url).length;

  const summaryPreview = summary
    ? summary.length > 160
      ? `${summary.slice(0, 160)}…`
      : summary
    : recommendations.length > 0
      ? `${recommendations.length} priority action${recommendations.length === 1 ? "" : "s"}`
      : final?.summary_infographic
        ? "Visual summary available"
        : undefined;

  const showInfographic = Boolean(final?.summary_infographic && jobId);

  const hasReport = Boolean(final || structure || clarity || exam);

  return (
    <div className="space-y-2">
      {hasReport && (
        <>
          {(summary || recommendations.length > 0 || showInfographic) && (
            <CollapsibleSection
              label="Report"
              order={1}
              title="Summary"
              summary={summaryPreview}
            >
              <SectionDescription>{teacherName}</SectionDescription>
              <div className="space-y-5">
                {showInfographic && (
                  <figure className="overflow-hidden border border-border bg-muted/30">
                    <img
                      src={summaryInfographicUrl(jobId!)}
                      alt={`Executive summary infographic for ${teacherName}`}
                      className="w-full object-contain"
                    />
                    <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                      Visual summary — scores, priorities, and exam gaps at a glance
                    </figcaption>
                  </figure>
                )}
                {summary && (
                  <p className="text-[15px] leading-7 text-foreground">
                    {summary}
                  </p>
                )}
                {recommendations.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-foreground">
                      Priority actions
                    </p>
                    <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {final?.structure_score != null && (
                    <StatPill label={`Structure ${final.structure_score}/10`} />
                  )}
                  {final?.clarity_score != null && (
                    <StatPill label={`Clarity ${final.clarity_score}/10`} />
                  )}
                  {exam?.exam_count != null && (
                    <StatPill label={`${exam.exam_count} exam papers`} />
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            label="Evidence"
            order={2}
            title="Exam → Lecture links"
            summary={
              crossReferences.length
                ? `${crossReferences.length} link${crossReferences.length === 1 ? "" : "s"} from exam mistakes to teaching moments${clipCount ? ` · ${clipCount} with video` : ""}`
                : "Connects exam weak spots to where they were taught"
            }
          >
            <TeachingEvidenceSection
              crossReferences={crossReferences}
              evidenceClips={final?.evidence_clips}
            />
          </CollapsibleSection>

          <CollapsibleSection
            order={3}
            title="Exam gaps"
            summary={
              examClusters.length
                ? `${examClusters.length} weak cluster${examClusters.length === 1 ? "" : "s"}${exam?.exam_count != null ? ` from ${exam.exam_count} papers` : ""}`
                : exam?.note ?? "Weak concepts from student exam papers"
            }
          >
            <SectionDescription>
              {exam?.summary ??
                final?.exam_summary ??
                "Topics where students struggled most."}
            </SectionDescription>
            <div className="divide-y divide-border border border-border">
              {examClusters.map((cluster, i) => (
                <div key={i} className="px-4 py-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-foreground">{cluster.topic}</p>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {Math.round(cluster.frequency * 100)}%
                    </span>
                  </div>
                  {cluster.syllabus_section && (
                    <p className="mt-1 text-muted-foreground">
                      {cluster.syllabus_section}
                    </p>
                  )}
                  <ul className="mt-3 space-y-1.5 text-muted-foreground">
                    {cluster.example_mistakes.map((m, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-foreground/40">—</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!examClusters.length && (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  {exam?.note ??
                    "No exam papers uploaded or no weak clusters found."}
                </p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            order={4}
            title="Confusion heatmap"
            summary={
              clarity
                ? `Clarity ${clarity.score}/10 · ${heatmap.length} confusion point${heatmap.length === 1 ? "" : "s"}`
                : heatmap.length
                  ? `${heatmap.length} confusion point${heatmap.length === 1 ? "" : "s"}`
                  : "Moments where students may get lost"
            }
          >
            {clarity && (
              <SectionDescription>
                {clarity.score}/10 — {clarity.summary}
              </SectionDescription>
            )}
            <ConfusionHeatmap heatmap={heatmap} />
          </CollapsibleSection>

          <CollapsibleSection
            order={5}
            title="Structure"
            summary={
              structure
                ? `Score ${structure.score}/10 · ${structureFindings.length} finding${structureFindings.length === 1 ? "" : "s"}`
                : structureFindings.length
                  ? `${structureFindings.length} finding${structureFindings.length === 1 ? "" : "s"}`
                  : "Lesson flow and concept sequencing"
            }
          >
            {structure && (
              <SectionDescription>
                Score {structure.score}/10 — {structure.summary}
              </SectionDescription>
            )}
            <div className="divide-y divide-border border border-border">
              {structureFindings.map((finding, i) => (
                <div key={i} className="px-4 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {finding.type}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-foreground">
                      {severityLabel(finding.severity)}
                    </span>
                    {finding.timestamp_sec != null && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTimestamp(finding.timestamp_sec)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 leading-relaxed text-foreground">
                    {finding.detail}
                  </p>
                </div>
              ))}
              {!structureFindings.length && (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  No structure findings available.
                </p>
              )}
            </div>
          </CollapsibleSection>
        </>
      )}

      {transcription && (
        <>
          <CollapsibleSection
            label="Explore"
            order={hasReport ? 6 : 2}
            title="Ask the lecture"
            summary="Search whether a topic was taught"
          >
            <AskTheLectureSection
              jobId={jobId ?? ""}
              disabled={!jobId || !transcription.transcript.length}
            />
          </CollapsibleSection>

          <CollapsibleSection
            label={hasReport ? "Source" : "Transcript"}
            order={hasReport ? 7 : 1}
            title="Lecture transcript"
            summary={transcriptSummary(transcription)}
          >
            <TranscriptSection
              transcription={transcription}
              jobFiles={jobFiles}
            />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
