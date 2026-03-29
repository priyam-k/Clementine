import type { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../lib/shared-types";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { getK2Model } from "./llm-provider";
import { decomposeJob } from "./decomposer";
import { runScheduler } from "./scheduler";
import { reduceJobResults } from "./reducer";
import {
  appendJobArtifact,
  createTask,
  getJob,
  getTasksForJob,
  getWorkersForSession,
  toWireJob,
  toWireWorker,
  updateJob,
} from "./store";
import { decomposeWithLLM, type LLMDecomposition, synthesizeResult } from "./llm-decomposer";
import { smartDecompose, outputsAreCode, assembleCodeResult } from "./smart-decomposer";
import {
  buildEnterpriseResultSummary,
  buildEnterpriseTaskPayload,
  createEnterpriseMarkdownArtifact,
  decomposeEnterpriseAnalysis,
  synthesizeEnterpriseMarkdown,
} from "./enterprise-benchmark";
import { createJobResultArtifact } from "./results-writer";
import type { JobGraphDecomposition, JobGraphStateType } from "./graph-state";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

export const executionBridges = new Map<string, () => void>();

const DECOMPOSE_SYSTEM_PROMPT = `You are the task orchestrator for Clementine, a distributed computing platform.

Each worker runs K2-Think (a reasoning LLM) in parallel. Decompose the user's request into
4–8 independent subtasks that run simultaneously across workers, producing the answer faster
than any single device could alone.

Rules:
- Each task must be completely self-contained. The worker ONLY sees its own taskPrompt.
- Each task must cover a distinct aspect so outputs combine into a complete answer.
- taskPrompt must be a direct, complete instruction for K2 with all context embedded inline.
- Never reference other tasks or leave placeholders — the worker has no other information.
- If external data is involved (URLs, files), instruct the worker to reason from domain knowledge.

Respond ONLY with valid JSON:
{
  "jobTitle": "concise title under 60 chars",
  "tasks": [
    {
      "title": "short task name",
      "description": "one sentence: what concrete output this task produces",
      "taskPrompt": "Complete standalone K2 prompt with all context inline. Demand specific output.",
      "complexity": 1-5,
      "estimatedSeconds": 2-15,
      "dataLabel": "optional UI label"
    }
  ],
  "resultSummaryHint": "what final synthesis should produce from all task outputs"
}`;

function toGraphDecomposition(input: LLMDecomposition): JobGraphDecomposition {
  return {
    jobTitle: input.jobTitle,
    resultSummaryHint: input.resultSummaryHint,
    tasks: input.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      taskPrompt: task.taskPrompt,
      complexity: task.complexity,
      estimatedSeconds: task.estimatedSeconds,
      dataLabel: task.dataLabel,
    })),
  };
}

export function makeDecomposeNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { command, ctx } = state;
    const job = getJob(ctx.jobId);
    if (!job) return {};

    updateJob(ctx.jobId, { status: "decomposing" });
    io.to(ctx.hostSocketId).emit("job:update", toWireJob(getJob(ctx.jobId)!));

    if (job.jobType === "enterprise-analysis" && job.benchmarkConfig && job.vendorProfiles) {
      const decomposition = await decomposeEnterpriseAnalysis(
        command,
        job.vendorProfiles,
        job.benchmarkConfig
      );
      return { decomposition };
    }

    // ── Fast heuristic path — no LLM needed ──────────────────────────────────
    const smart = smartDecompose(command);
    if (smart) {
      console.log(
        `[graph:decompose] Smart heuristic produced ${smart.tasks.length} tasks (kind=${smart.kind}) — skipping LLM decomposition`
      );
      return {
        decomposition: {
          jobTitle: smart.jobTitle,
          resultSummaryHint: smart.resultSummaryHint,
          tasks: smart.tasks,
        },
      };
    }

    // ── LLM decomposition (only reached for ambiguous commands) ──────────────
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
        // Ensure every task has a real taskPrompt before accepting the decomposition
        const allHavePrompts = result.tasks.every(
          (t) => typeof t.taskPrompt === "string" && t.taskPrompt.trim().length > 20
        );
        if (allHavePrompts) {
          console.log(`[graph:decompose] K2 produced ${result.tasks.length} tasks for "${result.jobTitle}"`);
          return { decomposition: toGraphDecomposition(result) };
        }
        console.warn("[graph:decompose] K2 result missing taskPrompts, falling back to Claude");
      }
    } catch (error) {
      console.warn("[graph:decompose] K2 decompose failed, falling back to Claude:", error);
    }

    const fallback = await decomposeWithLLM(command);
    if (fallback) {
      console.log(`[graph:decompose] Claude produced ${fallback.tasks.length} tasks for "${fallback.jobTitle}"`);
    } else {
      console.warn("[graph:decompose] No LLM decomposition available, will use heuristic fallback");
    }
    return { decomposition: fallback ? toGraphDecomposition(fallback) : null };
  };
}

export function makeScheduleNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx, decomposition, command } = state;
    const job = getJob(ctx.jobId);
    if (!job) return {};

    let taskIds: string[] = [];

    if (decomposition?.tasks?.length) {
      if (job.jobType === "enterprise-analysis" && job.vendorProfiles && job.benchmarkConfig) {
        const vendorProfiles = job.vendorProfiles;
        const benchmarkConfig = job.benchmarkConfig;
        taskIds = decomposition.tasks.map((task) =>
          createTask({
            jobId: ctx.jobId,
            title: task.title,
            description: task.description,
            jobType: "enterprise-analysis",
            status: "queued",
            progress: 0,
            inputPayload: buildEnterpriseTaskPayload(
              {
                title: task.title,
                description: task.description,
                role: task.role ?? "Analyst",
                vendorIds: task.vendorIds ?? [],
                criteria: task.criteria ?? [],
              },
              vendorProfiles,
              benchmarkConfig
            ),
          }).id
        );
      } else {
        // Non-enterprise: always use llm-analysis so workers execute real K2 inference.
        // Embed taskPrompt directly in payload so buildInferencePrompt uses it verbatim.
        taskIds = decomposition.tasks.map((task) =>
          createTask({
            jobId: ctx.jobId,
            title: task.title,
            description: task.description,
            jobType: "llm-analysis",
            status: "queued",
            progress: 0,
            inputPayload: {
              taskPrompt: task.taskPrompt ?? task.description,
              originalCommand: command,
              jobContext: decomposition.jobTitle,
              complexity: task.complexity ?? 2,
              dataLabel: task.dataLabel ?? decomposition.jobTitle,
            },
          }).id
        );
        console.log(
          `[graph:schedule] Created ${taskIds.length} parallel K2 tasks for "${decomposition.jobTitle}"`
        );
      }

      updateJob(ctx.jobId, {
        title: decomposition.jobTitle,
        taskIds,
        totalTasks: taskIds.length,
        completedTasks: 0,
        failedTasks: 0,
        normalizedCommand: JSON.stringify({
          original: command,
          resultSummaryHint: decomposition.resultSummaryHint,
        }),
      });
    } else {
      // Heuristic fallback: decomposer creates llm-analysis tasks with real prompts
      const tasks = decomposeJob(job);
      taskIds = tasks.map((task) => task.id);
      console.log(`[graph:schedule] Heuristic fallback created ${taskIds.length} K2 tasks`);
    }

    updateJob(ctx.jobId, { status: "running", startedAt: Date.now() });
    io.to(ctx.hostSocketId).emit("job:update", toWireJob(getJob(ctx.jobId)!));
    runScheduler(io, ctx.sessionCode, ctx.hostSocketId);

    return { taskIds };
  };
}

export function makeExecuteNode() {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx, taskIds } = state;
    if (taskIds.length === 0) {
      return { taskResults: {} };
    }

    await new Promise<void>((resolve) => {
      executionBridges.set(ctx.jobId, resolve);
    });
    executionBridges.delete(ctx.jobId);

    const tasks = getTasksForJob(ctx.jobId);
    const taskResults: Record<string, "completed" | "failed"> = {};
    for (const task of tasks) {
      if (task.status === "completed" || task.status === "failed") {
        taskResults[task.id] = task.status;
      }
    }

    return { taskResults };
  };
}

export function makeReduceNode(io: IO) {
  return async (state: JobGraphStateType): Promise<Partial<JobGraphStateType>> => {
    const { ctx } = state;
    const job = getJob(ctx.jobId);
    if (!job) return {};

    const tasks = getTasksForJob(ctx.jobId);
    const result = reduceJobResults(job, tasks);

    if (job.jobType === "enterprise-analysis") {
      try {
        const markdown = await synthesizeEnterpriseMarkdown(
          job,
          job.vendorProfiles ?? [],
          job.completionSamples
        );
        const artifact = await createEnterpriseMarkdownArtifact(job, markdown);
        const updatedWithArtifact = appendJobArtifact(job.id, artifact) ?? job;
        result.summary = buildEnterpriseResultSummary(markdown);
        result.outputLines = markdown
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 12);
        result.metrics.artifactType = "markdown";
        result.metrics.vendorCount = job.vendorProfiles?.length ?? 0;
        job.artifacts = updatedWithArtifact.artifacts;
      } catch (error) {
        console.warn("[graph:reduce] enterprise synthesis failed:", error);
      }
    } else if (job.jobType !== "fractal-render") {
      try {
        const parsedMetadata = safeParseJobMetadata(job.normalizedCommand);
        const samples = job.completionSamples;

        // Deterministic code assembly — no LLM call needed
        if (outputsAreCode(samples)) {
          const taskTitles = getTasksForJob(ctx.jobId)
            .filter((t) => t.status === "completed")
            .map((t) => t.title);
          result.summary = assembleCodeResult(job.title, taskTitles, samples);
          console.log("[graph:reduce] Code outputs detected — assembled without LLM synthesis");
        } else {
          // Prose synthesis via Gemini (only for non-code results)
          result.summary = await synthesizeResult(
            job.title,
            parsedMetadata.original ?? job.rawPrompt,
            samples,
            parsedMetadata.resultSummaryHint ?? result.summary
          );
        }

        result.outputLines = result.summary
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const artifact = await createJobResultArtifact(job, result);
        const updatedWithArtifact = appendJobArtifact(job.id, artifact) ?? job;
        job.artifacts = updatedWithArtifact.artifacts;
        result.metrics.artifactType = "markdown";
      } catch (error) {
        console.warn("[graph:reduce] generic synthesis failed:", error);
      }
    }

    const finishedJob = updateJob(ctx.jobId, {
      status: "completed",
      result,
      taskIds: [],
    })!;

    io.to(ctx.hostSocketId).emit("job:complete", {
      job: toWireJob(finishedJob),
      result,
    });
    io.to(ctx.hostSocketId).emit(
      "workers:update",
      getWorkersForSession(ctx.sessionCode).map(toWireWorker)
    );

    return { finalSummary: result.summary };
  };
}

function safeParseJobMetadata(normalizedCommand: string): {
  original?: string;
  resultSummaryHint?: string;
} {
  try {
    const parsed = JSON.parse(normalizedCommand) as {
      original?: string;
      resultSummaryHint?: string;
    };
    return parsed ?? {};
  } catch {
    return {};
  }
}
