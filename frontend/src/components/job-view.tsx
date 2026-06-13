"use client";

import { useCallback, useEffect, useState } from "react";

import { JobProgress } from "@/components/job-progress";
import { ReportDashboard } from "@/components/report-dashboard";
import { getJob, retryJobStep } from "@/lib/api";
import { hasPartialReport, parseAgentResults, parseFailedAgent } from "@/lib/reports";
import type { AgentName, Job } from "@/lib/types";

const POLL_MS = 2000;

type Props = {
  jobId: string;
  initialJob: Job;
};

export function JobView({ jobId, initialJob }: Props) {
  const [job, setJob] = useState<Job>(initialJob);
  const [retryingAgent, setRetryingAgent] = useState<AgentName | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getJob(jobId);
      setJob(next);
    } catch {
      // keep last known state on transient errors
    }
  }, [jobId]);

  useEffect(() => {
    if (job.status === "completed" || job.status === "failed") return;

    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [job.status, refresh]);

  const handleRetry = useCallback(
    async (agent: AgentName) => {
      setRetryError(null);
      setRetryingAgent(agent);
      try {
        await retryJobStep(jobId, agent);
        setJob((prev) => ({
          ...prev,
          status: "running",
          error_message: null,
        }));
        await refresh();
      } catch (err) {
        setRetryError(err instanceof Error ? err.message : "Retry failed");
      } finally {
        setRetryingAgent(null);
      }
    },
    [jobId, refresh]
  );

  const reports = parseAgentResults(job.agent_results);
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const showReport = isDone || (isFailed && hasPartialReport(reports));
  const failedAgent = parseFailedAgent(job.error_message);
  const hasSections = reports.transcription || showReport;

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="veluate-label">Evaluation</p>
        <h1 className="font-display text-3xl tracking-wide sm:text-4xl">
          {job.teacher_name}
        </h1>
        <p className="text-base text-muted-foreground">{job.audience}</p>
        <p className="font-data text-xs text-muted-foreground/80">{job.id}</p>
      </header>

      <JobProgress
        status={job.status}
        completedAgents={reports.completedAgents}
        agentResults={job.agent_results}
        jobCreatedAt={job.created_at}
        jobUpdatedAt={job.updated_at}
        errorMessage={job.error_message}
        failedAgent={failedAgent}
        retryingAgent={retryingAgent}
        onRetry={handleRetry}
      />

      {retryError && (
        <p className="border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {retryError}
        </p>
      )}

      {hasSections && (
        <section className="space-y-3">
          <div className="space-y-1">
            <p className="veluate-label">Results</p>
            <p className="text-sm text-muted-foreground">
              Expand a section for full detail — start with Exam → Lecture links
              for the core insight.
            </p>
          </div>

          {isFailed && hasPartialReport(reports) && (
            <p className="border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Analysis stopped before completion. Showing results from finished
              agents — use Retry on the failed step to continue.
            </p>
          )}

          {(showReport || reports.transcription) && (
            <ReportDashboard
              reports={reports}
              teacherName={job.teacher_name}
              jobId={jobId}
              transcription={reports.transcription}
              jobFiles={job.files}
            />
          )}
        </section>
      )}

      {!hasSections && isFailed && (
        <p className="border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {job.error_message ?? "Evaluation failed before producing results."}
        </p>
      )}
    </div>
  );
}
