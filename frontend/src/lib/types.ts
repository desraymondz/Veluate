export type JobStatus = "pending" | "running" | "completed" | "failed";

export type AgentName =
  | "transcription"
  | "structure"
  | "clarity"
  | "exam"
  | "cross_reference";

export type JobFile = {
  id: string;
  file_type: string;
  original_filename: string | null;
  source_url: string | null;
};

export type AgentResult = {
  id: string;
  agent_name: AgentName;
  output: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  status: JobStatus;
  teacher_name: string;
  audience: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  files: JobFile[];
  agent_results: AgentResult[];
};

export type JobRetryResponse = {
  id: string;
  status: string;
  message: string;
  agents: string[];
};

export type StructureFinding = {
  type: string;
  severity: "low" | "medium" | "high";
  detail: string;
  timestamp_sec: number | null;
};

export type StructureReport = {
  score: number;
  summary: string;
  findings: StructureFinding[];
};

export type HeatmapPoint = {
  start_sec: number;
  end_sec: number;
  severity: number;
  reason: string;
};

export type ClarityReport = {
  score: number;
  summary: string;
  heatmap: HeatmapPoint[];
};

export type WeakCluster = {
  topic: string;
  syllabus_section?: string | null;
  frequency: number;
  example_mistakes: string[];
};

export type ExamAnalysis = {
  exam_count: number;
  summary: string;
  weak_clusters: WeakCluster[];
  note?: string | null;
};

export type CrossReference = {
  exam_topic: string;
  syllabus_section?: string | null;
  exam_frequency?: number;
  example_mistakes?: string[];
  teaching_timestamp: number | null;
  teaching_end_sec?: number | null;
  transcript_excerpt?: string | null;
  clip_url?: string | null;
  evidence: string;
  recommendation?: string;
  structure_link?: StructureFinding | null;
  clarity_link?: HeatmapPoint | null;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  video_id?: string;
  local_start?: number;
  local_end?: number;
};

export type VideoSource = {
  id: string;
  name: string;
  length: number | null;
  segment_count: number;
  source_type: "file" | "youtube";
};

export type TranscriptionResult = {
  transcript: TranscriptSegment[];
  videodb_collection_id: string | null;
  videodb_videos: VideoSource[];
};

export type FinalReport = {
  summary: string;
  teacher_name: string;
  structure_score?: number;
  clarity_score?: number;
  structure_highlights?: StructureFinding[];
  top_confusion_moments?: HeatmapPoint[];
  exam_gaps?: WeakCluster[];
  exam_summary?: string;
  cross_references: CrossReference[];
  recommendations?: string[];
  evidence_clips?: {
    exam_topic: string;
    start_sec: number | null;
    end_sec: number | null;
    clip_url: string | null;
  }[];
};

export type ParsedReports = {
  transcription: TranscriptionResult | null;
  structure: StructureReport | null;
  clarity: ClarityReport | null;
  exam: ExamAnalysis | null;
  final: FinalReport | null;
  completedAgents: Set<AgentName>;
};
