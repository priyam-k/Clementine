// ─── LangGraph State Schema ────────────────────────────────────────────────────
// Single source of truth for data flowing between graph nodes.

import { Annotation } from "@langchain/langgraph";
import type { LLMDecomposition } from "./llm-decomposer";

export interface GraphJobContext {
  sessionCode: string;
  hostSocketId: string;
  jobId: string;
}

export const JobGraphState = Annotation.Root({
  // Immutable job context (set once at graph entry)
  ctx: Annotation<GraphJobContext>({
    reducer: (_, v) => v,
    default: () => ({ sessionCode: "", hostSocketId: "", jobId: "" }),
  }),

  // Raw command string
  command: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),

  // k2-think-v2 decomposition output (null if LLM unavailable)
  decomposition: Annotation<LLMDecomposition | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),

  // Task IDs created in the store after scheduling
  taskIds: Annotation<string[]>({
    reducer: (_, v) => v,
    default: () => [],
  }),

  // Task completion results (merge-reducer so execute node can stream partial updates)
  taskResults: Annotation<Record<string, "completed" | "failed">>({
    reducer: (prev, patch) => ({ ...prev, ...patch }),
    default: () => ({}),
  }),

  // Final k2-synthesized summary
  finalSummary: Annotation<string>({
    reducer: (_, v) => v,
    default: () => "",
  }),

  // Error propagation
  error: Annotation<string | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
});

export type JobGraphStateType = typeof JobGraphState.State;
