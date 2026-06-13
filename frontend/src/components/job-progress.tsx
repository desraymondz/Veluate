"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PIPELINE_STEPS, parseFailedAgent } from "@/lib/reports";
import type { AgentName, JobStatus } from "@/lib/types";

type Props = {
  status: JobStatus;
  completedAgents: Set<AgentName>;
  errorMessage?: string | null;
  failedAgent?: AgentName | null;
};

function stepState(
  stepId: AgentName,
  jobStatus: JobStatus,
  completed: Set<AgentName>,
  failedAgent: AgentName | null
): "done" | "active" | "pending" | "failed" {
  if (failedAgent === stepId) return "failed";
  if (jobStatus === "failed") {
    if (completed.has(stepId)) return "done";
    if (failedAgent) return "pending";
    return "failed";
  }
  if (completed.has(stepId)) return "done";
  if (jobStatus === "running" || jobStatus === "pending") {
    const firstIncomplete = PIPELINE_STEPS.find((s) => !completed.has(s.id));
    if (firstIncomplete?.id === stepId) return "active";
  }
  return "pending";
}

export function JobProgress({ status, completedAgents, errorMessage, failedAgent }: Props) {
  const resolvedFailed = failedAgent ?? parseFailedAgent(errorMessage);
  const doneCount = PIPELINE_STEPS.filter((s) =>
    completedAgents.has(s.id)
  ).length;
  const progress =
    status === "completed"
      ? 100
      : Math.round((doneCount / PIPELINE_STEPS.length) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Pipeline progress</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "completed"
              ? "Analysis complete"
              : status === "failed"
                ? "Pipeline failed"
                : "Agents running in parallel after transcription"}
          </p>
        </div>
        <Badge
          variant={
            status === "completed"
              ? "default"
              : status === "failed"
                ? "destructive"
                : "secondary"
          }
        >
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} />
        <ol className="space-y-3">
          {PIPELINE_STEPS.map((step) => {
            const state = stepState(step.id, status, completedAgents, resolvedFailed);
            return (
              <li key={step.id} className="flex items-start gap-3">
                {state === "done" && (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                )}
                {state === "active" && (
                  <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
                )}
                {state === "failed" && (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                {state === "pending" && (
                  <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
                )}
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-1">
            {resolvedFailed && (
              <p className="font-medium">
                Failed at: {PIPELINE_STEPS.find((s) => s.id === resolvedFailed)?.label ?? resolvedFailed}
              </p>
            )}
            <p className="break-words">{errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
