"use client";

import { useCallback, useEffect, useState } from "react";

import { JobProgress } from "@/components/job-progress";
import { ReportDashboard } from "@/components/report-dashboard";
import { TranscriptSection } from "@/components/transcript-section";
import { getJob } from "@/lib/api";
import { hasPartialReport, parseAgentResults, parseFailedAgent } from "@/lib/reports";
import type { Job } from "@/lib/types";

const POLL_MS = 2000;

type Props = {
  jobId: string;
  initialJob: Job;
};

export function JobView({ jobId, initialJob }: Props) {
  const [job, setJob] = useState<Job>(initialJob);

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

  const reports = parseAgentResults(job.agent_results);
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const showReport = isDone || (isFailed && hasPartialReport(reports));
  const failedAgent = parseFailedAgent(job.error_message);

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
      />

      {reports.transcription && (
        <TranscriptSection
          transcription={reports.transcription}
          jobFiles={job.files}
        />
      )}

      {isFailed && hasPartialReport(reports) && (
        <p className="border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Analysis stopped before completion. Showing results from finished
          agents.
        </p>
      )}

      {showReport && (
        <ReportDashboard reports={reports} teacherName={job.teacher_name} />
      )}
    </div>
  );
}
