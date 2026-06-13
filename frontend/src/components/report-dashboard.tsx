"use client";

import { ConfusionHeatmap } from "@/components/confusion-heatmap";
import {
  CrossReferenceList,
  EvidenceSection,
} from "@/components/evidence-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimestamp, severityLabel } from "@/lib/format";
import type { ParsedReports } from "@/lib/types";

type Props = {
  reports: ParsedReports;
  teacherName: string;
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="veluate-panel overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h3 className="font-display text-[22px] tracking-wide">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function StatPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

export function ReportDashboard({ reports, teacherName }: Props) {
  const { structure, clarity, exam, final } = reports;

  if (!final && !structure && !clarity && !exam) {
    return null;
  }

  const summary = final?.summary;
  const recommendations = final?.recommendations ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="veluate-label">Report</p>
        <h2 className="font-display text-2xl tracking-wide">Feedback</h2>
      </section>

      {(summary || recommendations.length > 0) && (
        <Panel title="Summary" description={teacherName}>
          <div className="space-y-5">
            {summary && (
              <p className="text-[15px] leading-7 text-foreground">{summary}</p>
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
        </Panel>
      )}

      <Tabs defaultValue="cross-reference" className="gap-6">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-6 border-b border-border bg-transparent p-0"
        >
          {[
            ["cross-reference", "Cross-reference"],
            ["heatmap", "Heatmap"],
            ["structure", "Structure"],
            ["exam", "Exam gaps"],
            ["evidence", "Evidence"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none px-0 pb-3 text-sm font-medium text-muted-foreground data-active:text-foreground"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cross-reference" className="mt-0">
          <CrossReferenceList
            crossReferences={final?.cross_references ?? []}
          />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-0">
          <Panel
            title="Confusion heatmap"
            description={
              clarity
                ? `Clarity ${clarity.score}/10 — ${clarity.summary}`
                : undefined
            }
          >
            <ConfusionHeatmap
              heatmap={clarity?.heatmap ?? final?.top_confusion_moments ?? []}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="structure" className="mt-0">
          <Panel
            title="Structure"
            description={
              structure
                ? `Score ${structure.score}/10 — ${structure.summary}`
                : undefined
            }
          >
            <div className="divide-y divide-border border border-border">
              {(structure?.findings ?? final?.structure_highlights ?? []).map(
                (finding, i) => (
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
                )
              )}
              {!structure?.findings?.length &&
                !final?.structure_highlights?.length && (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    No structure findings available.
                  </p>
                )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="exam" className="mt-0">
          <Panel
            title="Exam gaps"
            description={exam?.summary ?? final?.exam_summary}
          >
            <div className="divide-y divide-border border border-border">
              {(exam?.weak_clusters ?? final?.exam_gaps ?? []).map(
                (cluster, i) => (
                  <div key={i} className="px-4 py-4 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-foreground">
                        {cluster.topic}
                      </p>
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
                )
              )}
              {!exam?.weak_clusters?.length && !final?.exam_gaps?.length && (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  {exam?.note ?? "No exam papers uploaded or no weak clusters found."}
                </p>
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="evidence" className="mt-0">
          <Panel title="Video evidence">
            <EvidenceSection
              crossReferences={final?.cross_references ?? []}
              evidenceClips={final?.evidence_clips}
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
