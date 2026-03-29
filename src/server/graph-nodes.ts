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

const DECOMPOSE_SYSTEM_PROMPT = `You are the intelligent task orchestrator for Clementine, a distributed computing platform.

When given a user's request, decompose it into 5–10 concrete parallel subtasks that can be
distributed across browser-based worker nodes. Each worker is a CPU capable of running
computation, data analysis, or inference tasks.

Think like a senior data engineer: identify the stages of the pipeline (fetch, process, analyze,
aggregate), estimate complexity, and break the work into independent chunks that can run in
parallel.

Respond ONLY with valid JSON matching the requested schema.`;

function toGraphDecomposition(input: LLMDecomposition): JobGraphDecomposition {
  return {
    jobTitle: input.jobTitle,
    resultSummaryHint: input.resultSummaryHint,
    tasks: input.tasks.map((task) => ({
      title: task.title,
      description: task.description,
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
        return { decomposition: toGraphDecomposition(result) };
      }
    } catch (error) {
      console.warn("[graph:decompose] K2 parser path failed, falling back:", error);
    }

    const fallback = await decomposeWithLLM(command);
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
        taskIds = decomposition.tasks.map((task) =>
          createTask({
            jobId: ctx.jobId,
            title: task.title,
            description: task.description,
            jobType: job.jobType,
            status: "queued",
            progress: 0,
            inputPayload: {
              batchSize: Math.floor(1000 + (task.complexity ?? 2) * 1500),
              complexity: task.complexity ?? 2,
              operationType: job.jobType,
              dataLabel: task.dataLabel ?? decomposition.jobTitle,
              estimatedSeconds: task.estimatedSeconds,
              seed: Math.floor(Math.random() * 100000),
            },
          }).id
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
      const tasks = decomposeJob(job);
      taskIds = tasks.map((task) => task.id);
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
        result.summary = await synthesizeResult(
          job.title,
          parsedMetadata.original ?? job.rawPrompt,
          job.completionSamples,
          parsedMetadata.resultSummaryHint ?? result.summary
        );
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
