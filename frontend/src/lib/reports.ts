import type {
  AgentName,
  AgentResult,
  ClarityReport,
  ExamAnalysis,
  FinalReport,
  ParsedReports,
  StructureReport,
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
  let structure: StructureReport | null = null;
  let clarity: ClarityReport | null = null;
  let exam: ExamAnalysis | null = null;
  let final: FinalReport | null = null;

  for (const result of agentResults) {
    completedAgents.add(result.agent_name);
    const data = parseOutput<Record<string, unknown>>(result.output);
    if (!data) continue;

    if (result.agent_name === "structure" && data.structure_report) {
      structure = data.structure_report as StructureReport;
    }
    if (result.agent_name === "clarity" && data.clarity_report) {
      clarity = data.clarity_report as ClarityReport;
    }
    if (result.agent_name === "exam" && data.exam_analysis) {
      exam = data.exam_analysis as ExamAnalysis;
    }
    if (result.agent_name === "cross_reference" && data.final_report) {
      final = data.final_report as FinalReport;
    }
  }

  return { structure, clarity, exam, final, completedAgents };
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
    id: "cross_reference",
    label: "Cross-reference",
    description: "Linking teaching to exam failures",
  },
];
