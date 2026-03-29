// ─── LangGraph Node Factories ─────────────────────────────────────────────────
// Each factory returns an async node function that receives the current graph
// state and returns a partial state update.
//
// Nodes:
//   decompose — k2-think-v2 breaks the command into task specs
//   schedule  — materialises task specs into the store and dispatches to workers
//   execute   — suspends the graph until all Socket.IO tasks are done
//   reduce    — aggregates results and synthesizes a final summary with k2

import type { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../lib/shared-types";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { getK2Model } from "./llm-provider";
import { decomposeJob } from "./decomposer";
import { runScheduler } from "./scheduler";
import { reduceJobResults } from "./reducer";
import {
  getJob,
  updateJob,
  createTask,
  getTasksForJob,
  getWorkersForSession,
  toWireJob,
  toWireWorker,
} from "./store";
import type { LLMDecomposition } from "./llm-decomposer";
import type { JobGraphStateType } from "./graph-state";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

// ─── Async bridge: jobId → resolver ──────────────────────────────────────────
// The execute node registers a Promise resolver here.
// socket-handlers.ts calls the resolver when all tasks for a job are done.
export const executionBridges = new Map<string, () => void>();

// ─── Decompose system prompt (reuses logic from llm-decomposer.ts) ────────────
const DECOMPOSE_SYSTEM_PROMPT = `You are the intelligent task orchestrator for Clementine, a distributed computing platform.

When given a user's request, decompose it into 5–10 concrete parallel subtasks that can be
distributed across browser-based worker nodes. Each worker is a CPU capable of running
computation, data analysis, or inference tasks.

Think like a senior data engineer: identify the stages of the pipeline (fetch, process, analyze,
aggregate), estimate complexity, and break the work into independent chunks that can run in
parallel.

IMPORTANT: For tasks involving external data (YouTube, URLs, APIs), include realistic data
in the task descriptions so workers can simulate meaningful processing. Generate plausible
mock data summaries inline.

Respond ONLY with valid JSON matching this exact schema:
{
  "jobTitle": "short title under 60 chars",
  "tasks": [
    {
      "title": "short task name",
      "description": "detailed description of what this worker should do, including any mock data",
      "complexity": 1-5,
      "estimatedSeconds": 2-15,
      "dataLabel": "optional data label shown in UI"
    }
  ],
  "resultSummaryHint": "1-2 sentences describing what the final aggregate result should contain"
}`;

const SYNTHESIS_SYSTEM_PROMPT = `You are a data analyst synthesizing results from a distributed computation job.
Given the original request and completed task outputs, produce a clear, quantitative report.
Be specific: include numbers, percentages, key findings. Format with bullet points.
Keep it under 300 words.`;

// ─── Node: decompose ──────────────────────────────────────────────────────────

export function makeDecomposeNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { command, ctx } = state;

    updateJob(ctx.jobId, { status: "decomposing" });
    io.to(ctx.hostSocketId).emit("job:update", toWireJob(getJob(ctx.jobId)!));

    let decomposition: LLMDecomposition | null = null;

    try {
      const model = getK2Model();
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", DECOMPOSE_SYSTEM_PROMPT],
        ["human", "{command}"],
      ]);
      const parser = new JsonOutputParser<LLMDecomposition>();
      const chain = prompt.pipe(model).pipe(parser);
      const result = await chain.invoke({ command });

      if (result?.tasks?.length) {
        decomposition = result;
        console.log(`[graph:decompose] k2 produced ${decomposition.tasks.length} tasks: "${decomposition.jobTitle}"`);
      }
    } catch (err) {
      console.warn("[graph:decompose] k2 failed, falling back to heuristics:", err);
    }

    if (decomposition) {
      updateJob(ctx.jobId, { title: decomposition.jobTitle });
    }

    return { decomposition };
  };
}

// ─── Node: schedule ───────────────────────────────────────────────────────────

export function makeScheduleNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx, decomposition, command } = state;
    const job = getJob(ctx.jobId)!;

    let taskIds: string[] = [];

    if (decomposition) {
      for (const spec of decomposition.tasks) {
        const t = createTask({
          jobId: ctx.jobId,
          title: spec.title,
          description: spec.description,
          jobType: job.jobType,
          status: "queued",
          progress: 0,
          inputPayload: {
            batchSize: Math.floor(1000 + spec.complexity * 1500),
            complexity: spec.complexity,
            operationType: job.jobType,
            dataLabel: spec.dataLabel ?? decomposition.jobTitle,
            estimatedSeconds: spec.estimatedSeconds,
            seed: Math.floor(Math.random() * 100000),
          },
        });
        taskIds.push(t.id);
      }
      updateJob(ctx.jobId, {
        taskIds,
        totalTasks: taskIds.length,
        completedTasks: 0,
        failedTasks: 0,
        normalizedCommand: JSON.stringify({
          hint: decomposition.resultSummaryHint,
          original: command,
        }),
      });
    } else {
      // Heuristic fallback
      const tasks = decomposeJob(getJob(ctx.jobId)!);
      taskIds = tasks.map(t => t.id);
      console.log(`[graph:schedule] heuristic produced ${taskIds.length} tasks`);
    }

    updateJob(ctx.jobId, { status: "running", startedAt: Date.now() });
    io.to(ctx.hostSocketId).emit("job:update", toWireJob(getJob(ctx.jobId)!));

    runScheduler(io, ctx.sessionCode, ctx.hostSocketId);
    console.log(`[graph:schedule] scheduled ${taskIds.length} tasks for job ${ctx.jobId}`);

    return { taskIds };
  };
}

// ─── Node: execute ────────────────────────────────────────────────────────────
// Suspends until all tasks complete (bridge resolved by socket-handlers).

export function makeExecuteNode() {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx, taskIds } = state;

    if (taskIds.length === 0) {
      console.log(`[graph:execute] no tasks for job ${ctx.jobId}, skipping wait`);
      return { taskResults: {} };
    }

    console.log(`[graph:execute] waiting for ${taskIds.length} tasks on job ${ctx.jobId}`);

    // Timeout safety: 10 minutes max
    const TIMEOUT_MS = 10 * 60 * 1000;
    await Promise.race([
      new Promise<void>((resolve) => {
        executionBridges.set(ctx.jobId, resolve);
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Job ${ctx.jobId} execution timed out`)), TIMEOUT_MS)
      ),
    ]);

    executionBridges.delete(ctx.jobId);
    console.log(`[graph:execute] all tasks done for job ${ctx.jobId}`);

    const allTasks = getTasksForJob(ctx.jobId);
    const taskResults: Record<string, "completed" | "failed"> = {};
    for (const t of allTasks) {
      if (t.status === "completed" || t.status === "failed") {
        taskResults[t.id] = t.status;
      }
    }

    return { taskResults };
  };
}

// ─── Node: reduce ─────────────────────────────────────────────────────────────

export function makeReduceNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx, decomposition, command } = state;
    const job = getJob(ctx.jobId)!;
    const tasks = getTasksForJob(ctx.jobId);

    // Heuristic aggregation
    const result = reduceJobResults(job, tasks);

    // k2 synthesis for non-fractal jobs
    let finalSummary = result.summary;
    if (job.jobType !== "fractal-render") {
      try {
        const model = getK2Model();
        // Tasks may already be deleted from the store by the time reduce runs
        // (socket-handlers deletes them one-by-one as they complete).
        // Fall back to the original decomposition specs which are in graph state.
        const taskSummaries = tasks.length > 0
          ? tasks.filter(t => t.status === "completed").map(t => `${t.title}: ${t.description}`)
          : (decomposition?.tasks ?? []).map(s => `${s.title}: ${s.description}`);
        const hint = decomposition?.resultSummaryHint ?? "Distributed computation completed.";

        const synthesisPrompt = ChatPromptTemplate.fromMessages([
          ["system", SYNTHESIS_SYSTEM_PROMPT],
          ["human", "Original request: \"{command}\"\n\nCompleted tasks:\n{taskList}\n\nHint: {hint}\n\nGenerate the final report:"],
        ]);
        const chain = synthesisPrompt.pipe(model);
        const response = await chain.invoke({
          command,
          taskList: taskSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n"),
          hint,
        });
        finalSummary = typeof response.content === "string"
          ? response.content
          : String(response.content);
        console.log(`[graph:reduce] k2 synthesis complete for job ${ctx.jobId}`);
      } catch (err) {
        console.warn("[graph:reduce] k2 synthesis failed, using heuristic summary:", err);
      }
    }

    result.summary = finalSummary;
    result.outputLines = finalSummary.split("\n").filter(l => l.trim());

    const finishedJob = updateJob(ctx.jobId, { status: "completed", result })!;
    console.log(`[graph:reduce] job "${job.title}" completed`);

    io.to(ctx.hostSocketId).emit("job:complete", { job: toWireJob(finishedJob), result });

    const workers = getWorkersForSession(ctx.sessionCode).map(toWireWorker);
    io.to(ctx.hostSocketId).emit("workers:update", workers);

    return { finalSummary };
  };
}
