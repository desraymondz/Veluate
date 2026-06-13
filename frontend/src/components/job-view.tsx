"use client";

import { useCallback, useEffect, useState } from "react";

import { JobProgress } from "@/components/job-progress";
import { ReportDashboard } from "@/components/report-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJob } from "@/lib/api";
import { parseAgentResults } from "@/lib/reports";
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{job.teacher_name}</CardTitle>
          <p className="text-sm text-muted-foreground">{job.audience}</p>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground font-mono">
          Job {job.id}
        </CardContent>
      </Card>

      <JobProgress
        status={job.status}
        completedAgents={reports.completedAgents}
        errorMessage={job.error_message}
      />

      {isDone && (
        <ReportDashboard reports={reports} teacherName={job.teacher_name} />
      )}
    </div>
  );
}
