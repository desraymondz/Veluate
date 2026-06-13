import type {
  AgentName,
  AgentResult,
  ClarityReport,
  ExamAnalysis,
  FactCheckReport,
  FinalReport,
  JobStatus,
  ParsedReports,
  StructureReport,
  TranscriptionResult,
} from "./types";

function parseOutput<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseAgentResults(
  agentResults: AgentResult[]
): ParsedReports {
  const completedAgents = new Set<AgentName>();
  let transcription: TranscriptionResult | null = null;
  let structure: StructureReport | null = null;
  let clarity: ClarityReport | null = null;
  let exam: ExamAnalysis | null = null;
  let factCheck: FactCheckReport | null = null;
  let final: FinalReport | null = null;

  for (const result of agentResults) {
    completedAgents.add(result.agent_name);
    const data = parseOutput<Record<string, unknown>>(result.output);
    if (!data) continue;

    if (result.agent_name === "transcription" && Array.isArray(data.transcript)) {
      transcription = {
        transcript: data.transcript as TranscriptionResult["transcript"],
        videodb_collection_id:
          typeof data.videodb_collection_id === "string"
            ? data.videodb_collection_id
            : null,
        videodb_videos: Array.isArray(data.videodb_videos)
          ? (data.videodb_videos as TranscriptionResult["videodb_videos"])
          : [],
      };
    }
    if (result.agent_name === "structure" && data.structure_report) {
      structure = data.structure_report as StructureReport;
    }
    if (result.agent_name === "clarity" && data.clarity_report) {
      clarity = data.clarity_report as ClarityReport;
    }
    if (result.agent_name === "exam" && data.exam_analysis) {
      exam = data.exam_analysis as ExamAnalysis;
    }
    if (result.agent_name === "fact_check" && data.fact_check_report) {
      factCheck = data.fact_check_report as FactCheckReport;
    }
    if (result.agent_name === "cross_reference" && data.final_report) {
      final = data.final_report as FinalReport;
    }
  }

  return { transcription, structure, clarity, exam, factCheck, final, completedAgents };
}

/** Parse agent name from backend error messages like "structure: ..." */
export function parseFailedAgent(errorMessage: string | null | undefined): AgentName | null {
  if (!errorMessage) return null;
  for (const step of PIPELINE_STEPS) {
    if (errorMessage.startsWith(`${step.id}:`)) return step.id;
  }
  return null;
}

export function hasPartialReport(reports: ParsedReports): boolean {
  return Boolean(
    reports.structure ||
      reports.clarity ||
      reports.exam ||
      reports.factCheck ||
      reports.final
  );
}

export const RETRY_PLAN: Record<AgentName, AgentName[]> = {
  transcription: [
    "transcription",
    "structure",
    "clarity",
    "exam",
    "fact_check",
    "cross_reference",
  ],
  structure: ["structure", "cross_reference"],
  clarity: ["clarity", "cross_reference"],
  exam: ["exam", "cross_reference"],
  fact_check: ["fact_check"],
  cross_reference: ["cross_reference"],
};

export function retryIncludes(agent: AgentName): AgentName[] {
  return RETRY_PLAN[agent].filter((step) => step !== agent);
}

export function canRetryStep(
  stepId: AgentName,
  jobStatus: JobStatus,
  completedAgents: Set<AgentName>,
  failedAgent: AgentName | null
): boolean {
  if (jobStatus === "running" || jobStatus === "pending") return false;
  if (
    stepId === "transcription" &&
    completedAgents.has("transcription") &&
    failedAgent !== "transcription"
  ) {
    return false;
  }
  return true;
}

export const PIPELINE_STEPS: {
  id: AgentName;
  label: string;
  description: string;
}[] = [
  {
    id: "transcription",
    label: "Transcription",
    description: "Indexing lecture video",
  },
  {
    id: "structure",
    label: "Structure",
    description: "Analyzing lesson flow",
  },
  {
    id: "clarity",
    label: "Clarity",
    description: "Building confusion heatmap",
  },
  {
    id: "exam",
    label: "Exam gaps",
    description: "Clustering weak concepts",
  },
  {
    id: "fact_check",
    label: "Fact check",
    description: "Verifying claims against web sources",
  },
  {
    id: "cross_reference",
    label: "Cross-reference",
    description: "Linking teaching to exam failures",
  },
];
