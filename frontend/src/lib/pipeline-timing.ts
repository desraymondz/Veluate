import { PIPELINE_STEPS } from "@/lib/reports";
import type { AgentName, AgentResult, JobStatus } from "@/lib/types";

const PARALLEL_AGENTS: AgentName[] = ["structure", "clarity", "exam"];

export type StepState = "done" | "active" | "pending" | "failed";

export type StepTiming = {
  durationMs: number | null;
  state: StepState;
  isLive: boolean;
};

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

function completionTimes(agentResults: AgentResult[]): Map<AgentName, number> {
  const map = new Map<AgentName, number>();
  for (const result of agentResults) {
    map.set(result.agent_name, parseTime(result.created_at));
  }
  return map;
}

export function stepState(
  stepId: AgentName,
  jobStatus: JobStatus,
  completed: Set<AgentName>,
  failedAgent: AgentName | null
): StepState {
  if (failedAgent === stepId) return "failed";
  if (jobStatus === "failed") {
    if (completed.has(stepId)) return "done";
    if (failedAgent) return "pending";
    return "failed";
  }
  if (completed.has(stepId)) return "done";
  if (jobStatus !== "running" && jobStatus !== "pending") return "pending";

  if (!completed.has("transcription")) {
    return stepId === "transcription" ? "active" : "pending";
  }

  if (PARALLEL_AGENTS.includes(stepId) && !completed.has(stepId)) {
    return "active";
  }

  if (stepId === "cross_reference") {
    const parallelDone = PARALLEL_AGENTS.every((id) => completed.has(id));
    if (parallelDone && !completed.has("cross_reference")) return "active";
  }

  return "pending";
}

function stepStartMs(
  stepId: AgentName,
  pipelineStart: number,
  transcriptionEnd: number | undefined,
  crossRefStart: number | undefined
): number | null {
  if (stepId === "transcription") return pipelineStart;
  if (PARALLEL_AGENTS.includes(stepId)) {
    return transcriptionEnd ?? null;
  }
  if (stepId === "cross_reference") {
    return crossRefStart ?? null;
  }
  return pipelineStart;
}

export function computeStepTimings(
  job: { status: JobStatus; created_at: string; updated_at: string },
  agentResults: AgentResult[],
  completed: Set<AgentName>,
  failedAgent: AgentName | null,
  now: number
): Map<AgentName, StepTiming> {
  const finished = completionTimes(agentResults);
  const pipelineStart = parseTime(job.created_at);
  const transcriptionEnd = finished.get("transcription");
  const parallelEnds = PARALLEL_AGENTS.map((id) => finished.get(id)).filter(
    (t): t is number => t != null
  );
  const crossRefStart =
    parallelEnds.length === PARALLEL_AGENTS.length
      ? Math.max(...parallelEnds)
      : undefined;
  const failTime =
    job.status === "failed" ? parseTime(job.updated_at) : undefined;

  const timings = new Map<AgentName, StepTiming>();

  for (const { id } of PIPELINE_STEPS) {
    const state = stepState(id, job.status, completed, failedAgent);
    const end = finished.get(id);
    const start = stepStartMs(id, pipelineStart, transcriptionEnd, crossRefStart);

    if (end != null && start != null) {
      timings.set(id, {
        durationMs: end - start,
        state: "done",
        isLive: false,
      });
      continue;
    }

    if (state === "failed" && start != null && failTime != null) {
      timings.set(id, {
        durationMs: failTime - start,
        state: "failed",
        isLive: false,
      });
      continue;
    }

    if (state === "active" && start != null) {
      timings.set(id, {
        durationMs: now - start,
        state: "active",
        isLive: true,
      });
      continue;
    }

    timings.set(id, { durationMs: null, state, isLive: false });
  }

  return timings;
}

export function totalElapsedMs(
  job: { status: JobStatus; created_at: string; updated_at: string },
  now: number
): number {
  const start = parseTime(job.created_at);
  if (job.status === "completed" || job.status === "failed") {
    return parseTime(job.updated_at) - start;
  }
  return now - start;
}

export function formatStopwatch(ms: number, live = false): string {
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return live ? `${totalSec.toFixed(1)}s` : `${Math.round(totalSec)}s`;
  }

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
