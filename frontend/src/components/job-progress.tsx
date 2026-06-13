"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  Timer,
  XCircle,
} from "lucide-react";

import {
  computeStepTimings,
  formatStopwatch,
  totalElapsedMs,
} from "@/lib/pipeline-timing";
import {
  PIPELINE_STEPS,
  canRetryStep,
  parseFailedAgent,
  retryIncludes,
} from "@/lib/reports";
import type { AgentName, AgentResult, JobStatus } from "@/lib/types";

type Props = {
  status: JobStatus;
  completedAgents: Set<AgentName>;
  agentResults: AgentResult[];
  jobCreatedAt: string;
  jobUpdatedAt: string;
  errorMessage?: string | null;
  failedAgent?: AgentName | null;
  retryingAgent?: AgentName | null;
  onRetry?: (agent: AgentName) => void | Promise<void>;
};

function useTicker(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}

function statusLabel(status: JobStatus): string {
  if (status === "completed") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
}

function StepTimer({
  durationMs,
  isLive,
  state,
}: {
  durationMs: number | null;
  isLive: boolean;
  state: "done" | "active" | "pending" | "failed";
}) {
  if (durationMs == null) {
    return (
      <span className="font-mono text-xs tabular-nums text-muted-foreground/50">
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
        state === "active"
          ? "text-foreground"
          : state === "failed"
            ? "text-muted-foreground"
            : "text-muted-foreground"
      }`}
    >
      {state === "active" && (
        <Timer className="size-3 shrink-0 opacity-70" aria-hidden />
      )}
      {formatStopwatch(durationMs, isLive)}
    </span>
  );
}

function retryHint(agent: AgentName): string | null {
  const also = retryIncludes(agent);
  if (!also.length) return null;
  const labels = also.map(
    (id) => PIPELINE_STEPS.find((s) => s.id === id)?.label ?? id
  );
  return `Also re-runs: ${labels.join(", ")}`;
}

export function JobProgress({
  status,
  completedAgents,
  agentResults,
  jobCreatedAt,
  jobUpdatedAt,
  errorMessage,
  failedAgent,
  retryingAgent,
  onRetry,
}: Props) {
  const resolvedFailed = failedAgent ?? parseFailedAgent(errorMessage);
  const isRunning = status === "running" || status === "pending";
  const now = useTicker(isRunning);

  const timings = computeStepTimings(
    { status, created_at: jobCreatedAt, updated_at: jobUpdatedAt },
    agentResults,
    completedAgents,
    resolvedFailed,
    now
  );

  const totalMs = totalElapsedMs(
    { status, created_at: jobCreatedAt, updated_at: jobUpdatedAt },
    now
  );

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
                ? "Retry a step without re-running transcription."
                : "Transcription runs first, then parallel analysis."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wider text-foreground">
            {statusLabel(status)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            <Timer className="size-3" aria-hidden />
            Total {formatStopwatch(totalMs, isRunning)}
          </span>
        </div>
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
            const timing = timings.get(step.id);
            const state = timing?.state ?? "pending";
            const showRetry =
              onRetry &&
              canRetryStep(
                step.id,
                status,
                completedAgents,
                resolvedFailed
              ) &&
              (state === "failed" ||
                state === "done" ||
                (state === "pending" && status === "failed"));
            const isRetrying = retryingAgent === step.id;
            const hint = showRetry ? retryHint(step.id) : null;

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
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-medium text-foreground">{step.label}</p>
                    <div className="flex items-center gap-2">
                      {showRetry && (
                        <button
                          type="button"
                          disabled={Boolean(retryingAgent) || isRunning}
                          onClick={() => onRetry(step.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isRetrying ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3" />
                          )}
                          Retry
                        </button>
                      )}
                      <StepTimer
                        durationMs={timing?.durationMs ?? null}
                        isLive={timing?.isLive ?? false}
                        state={state}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  {hint && (
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {hint}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {errorMessage && (
          <div className="mt-6 border border-border bg-muted px-4 py-3 text-sm">
            {resolvedFailed && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-foreground">
                  Failed at{" "}
                  {PIPELINE_STEPS.find((s) => s.id === resolvedFailed)?.label ??
                    resolvedFailed}
                </p>
                {onRetry &&
                  canRetryStep(
                    resolvedFailed,
                    status,
                    completedAgents,
                    resolvedFailed
                  ) && (
                    <button
                      type="button"
                      disabled={Boolean(retryingAgent) || isRunning}
                      onClick={() => onRetry(resolvedFailed)}
                      className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {retryingAgent === resolvedFailed ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Retry this step
                    </button>
                  )}
              </div>
            )}
            <p className="break-words text-muted-foreground">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
