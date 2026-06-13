"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

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

function statusLabel(status: JobStatus): string {
  if (status === "completed") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
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
    <div className="veluate-panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "completed"
              ? "All agents finished."
              : status === "failed"
                ? "Stopped before completion."
                : "Transcription runs first, then parallel analysis."}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wider text-foreground">
          {statusLabel(status)}
        </span>
      </div>

      <div className="px-6 py-5">
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="space-y-4">
          {PIPELINE_STEPS.map((step) => {
            const state = stepState(step.id, status, completedAgents, resolvedFailed);
            return (
              <li key={step.id} className="flex items-start gap-4">
                {state === "done" && (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground" />
                )}
                {state === "active" && (
                  <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-foreground" />
                )}
                {state === "failed" && (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-foreground" />
                )}
                {state === "pending" && (
                  <Circle className="mt-0.5 size-5 shrink-0 text-border" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{step.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {errorMessage && (
          <div className="mt-6 border border-border bg-muted px-4 py-3 text-sm">
            {resolvedFailed && (
              <p className="mb-1 font-medium text-foreground">
                Failed at{" "}
                {PIPELINE_STEPS.find((s) => s.id === resolvedFailed)?.label ??
                  resolvedFailed}
              </p>
            )}
            <p className="break-words text-muted-foreground">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
