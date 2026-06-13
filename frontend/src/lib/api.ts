import type { AgentName, AskLectureResponse, Job, JobRetryResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HealthResponse = {
  status: string;
  llm_provider: string;
  llm_model: string;
  llm_temperature?: number;
};

export type CreateJobPayload = {
  teacherName: string;
  audience: string;
  syllabus: File;
  videos: File[];
  exams: File[];
  youtubeUrls: string[];
};

export type JobCreatedResponse = {
  id: string;
  status: string;
  message: string;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      if (parsed.detail) message = parsed.detail;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  return handleResponse(res);
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { cache: "no-store" });
  return handleResponse(res);
}

export async function createJob(payload: CreateJobPayload): Promise<JobCreatedResponse> {
  const form = new FormData();
  form.append("teacher_name", payload.teacherName);
  form.append("audience", payload.audience);
  form.append("syllabus", payload.syllabus);

  for (const video of payload.videos) {
    form.append("videos", video);
  }
  for (const exam of payload.exams) {
    form.append("exams", exam);
  }
  for (const url of payload.youtubeUrls) {
    form.append("youtube_urls", url);
  }

  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    body: form,
  });
  return handleResponse(res);
}

export async function retryJobStep(
  jobId: string,
  agent: AgentName
): Promise<JobRetryResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent }),
  });
  return handleResponse(res);
}

export function summaryInfographicUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/summary-infographic`;
}

export async function askLecture(
  jobId: string,
  question: string
): Promise<AskLectureResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return handleResponse(res);
}
