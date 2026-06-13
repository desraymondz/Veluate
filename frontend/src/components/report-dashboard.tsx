"use client";

import { ConfusionHeatmap } from "@/components/confusion-heatmap";
import {
  CrossReferenceList,
  EvidenceSection,
} from "@/components/evidence-section";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTimestamp, severityLabel } from "@/lib/format";
import type { ParsedReports } from "@/lib/types";

type Props = {
  reports: ParsedReports;
  teacherName: string;
};

export function ReportDashboard({ reports, teacherName }: Props) {
  const { structure, clarity, exam, final } = reports;

  if (!final && !structure && !clarity && !exam) {
    return null;
  }

  const summary = final?.summary;
  const recommendations = final?.recommendations ?? [];

  return (
    <div className="space-y-6">
      {(summary || recommendations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Feedback summary</CardTitle>
            <CardDescription>{teacherName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary && <p className="leading-relaxed">{summary}</p>}
            {recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Priority actions</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {final?.structure_score != null && (
                <Badge variant="outline">
                  Structure {final.structure_score}/10
                </Badge>
              )}
              {final?.clarity_score != null && (
                <Badge variant="outline">Clarity {final.clarity_score}/10</Badge>
              )}
              {exam?.exam_count != null && (
                <Badge variant="outline">{exam.exam_count} exam papers</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cross-reference">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="cross-reference">Cross-reference</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="exam">Exam gaps</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="cross-reference" className="mt-4">
          <CrossReferenceList
            crossReferences={final?.cross_references ?? []}
          />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Confusion heatmap</CardTitle>
              {clarity && (
                <CardDescription>
                  Clarity score: {clarity.score}/10 — {clarity.summary}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ConfusionHeatmap
                heatmap={
                  clarity?.heatmap ?? final?.top_confusion_moments ?? []
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Structure report</CardTitle>
              {structure && (
                <CardDescription>
                  Score: {structure.score}/10 — {structure.summary}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {(structure?.findings ?? final?.structure_highlights ?? []).map(
                (finding, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{finding.type}</Badge>
                      <Badge
                        variant={
                          finding.severity === "high"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {severityLabel(finding.severity)}
                      </Badge>
                      {finding.timestamp_sec != null && (
                        <span className="font-mono text-xs text-muted-foreground">
                          @{formatTimestamp(finding.timestamp_sec)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2">{finding.detail}</p>
                  </div>
                )
              )}
              {!structure?.findings?.length &&
                !final?.structure_highlights?.length && (
                  <p className="text-sm text-muted-foreground">
                    No structure findings available.
                  </p>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exam" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam gap analysis</CardTitle>
              {(exam?.summary || final?.exam_summary) && (
                <CardDescription>
                  {exam?.summary ?? final?.exam_summary}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {(exam?.weak_clusters ?? final?.exam_gaps ?? []).map(
                (cluster, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{cluster.topic}</p>
                      <Badge variant="secondary">
                        {Math.round(cluster.frequency * 100)}%
                      </Badge>
                    </div>
                    {cluster.syllabus_section && (
                      <p className="mt-1 text-muted-foreground">
                        {cluster.syllabus_section}
                      </p>
                    )}
                    <ul className="mt-2 list-inside list-disc text-muted-foreground">
                      {cluster.example_mistakes.map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
              {!exam?.weak_clusters?.length && !final?.exam_gaps?.length && (
                <p className="text-sm text-muted-foreground">
                  {exam?.note ?? "No exam papers uploaded or no weak clusters found."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <EvidenceSection
            crossReferences={final?.cross_references ?? []}
            evidenceClips={final?.evidence_clips}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
