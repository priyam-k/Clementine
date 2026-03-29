import { Annotation } from "@langchain/langgraph";

export interface JobGraphContext {
  jobId: string;
  sessionCode: string;
  hostSocketId: string;
}

export interface JobGraphTaskSpec {
  title: string;
  description: string;
  complexity?: number;
  estimatedSeconds?: number;
  dataLabel?: string;
  role?: string;
  vendorIds?: string[];
  criteria?: string[];
}

export interface JobGraphDecomposition {
  jobTitle: string;
  resultSummaryHint: string;
  tasks: JobGraphTaskSpec[];
}

export const JobGraphState = Annotation.Root({
  command: Annotation<string>(),
  ctx: Annotation<JobGraphContext>(),
  decomposition: Annotation<JobGraphDecomposition | null>(),
  taskIds: Annotation<string[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),
  taskResults: Annotation<Record<string, "completed" | "failed">>({
    reducer: (_, value) => value,
    default: () => ({}),
  }),
  finalSummary: Annotation<string>({
    reducer: (_, value) => value,
    default: () => "",
  }),
});

export type JobGraphStateType = typeof JobGraphState.State;
