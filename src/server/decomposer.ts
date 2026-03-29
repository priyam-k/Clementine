import type { ServerJob, ServerTask } from "./types";
import type { JobType, FractalTileInput } from "../lib/shared-types";
import { createTask, updateJob } from "./store";

// ─── Decomposer: Job → Tasks ──────────────────────────────────────────────────

export interface DecompositionResult {
  tasks: ServerTask[];
  title: string;
  jobType: JobType;
}

export function decomposeJob(job: ServerJob): ServerTask[] {
  switch (job.jobType) {
    case "mock-compute":
      return decomposeMockCompute(job);
    case "llm-analysis":
      return decomposeLlmAnalysis(job);
    case "batch-inference":
      return decomposeBatchInference(job);
    case "blender-render":
      return decomposeBlenderRender(job);
    case "fractal-render":
      return decomposeFractalRender(job);
    case "enterprise-analysis":
      return decomposeLlmAnalysis(job);
    default:
      return decomposeMockCompute(job);
  }
}

// ─── Fractal Render decomposition ─────────────────────────────────────────────

function decomposeFractalRender(job: ServerJob): ServerTask[] {
  const cfg = job.fractalConfig;
  if (!cfg) {
    console.warn(`[decomposer] fractal-render job "${job.id}" missing fractalConfig`);
    return [];
  }

  const { width, height, tileSize, fractalType, maxIterations, xMin, xMax, yMin, yMax } = cfg;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);
  const createdTasks: ServerTask[] = [];

  const tileSpecs: Array<{
    tx: number;
    ty: number;
    tileX: number;
    tileY: number;
    tileWidth: number;
    tileHeight: number;
    distanceToCenter: number;
  }> = [];

  const imageCenterX = width / 2;
  const imageCenterY = height / 2;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const tileX = tx * tileSize;
      const tileY = ty * tileSize;
      const tileWidth = Math.min(tileSize, width - tileX);
      const tileHeight = Math.min(tileSize, height - tileY);
      const tileCenterX = tileX + tileWidth / 2;
      const tileCenterY = tileY + tileHeight / 2;

      tileSpecs.push({
        tx,
        ty,
        tileX,
        tileY,
        tileWidth,
        tileHeight,
        distanceToCenter: Math.hypot(tileCenterX - imageCenterX, tileCenterY - imageCenterY),
      });
    }
  }

  tileSpecs
    .sort((a, b) => a.distanceToCenter - b.distanceToCenter)
    .forEach(({ tx, ty, tileX, tileY, tileWidth, tileHeight }) => {
      const input: FractalTileInput = {
        fractalType,
        tileX,
        tileY,
        tileWidth,
        tileHeight,
        imageWidth: width,
        imageHeight: height,
        xMin,
        xMax,
        yMin,
        yMax,
        maxIterations,
      };

      const task = createTask({
        jobId: job.id,
        title: `Tile (${tx}, ${ty})`,
        description: `Fractal tile at pixel (${tileX}, ${tileY}), ${tileWidth}×${tileHeight}px`,
        jobType: "fractal-render",
        status: "queued",
        progress: 0,
        inputPayload: input as unknown as Record<string, unknown>,
      });
      createdTasks.push(task);
    });

  updateJob(job.id, {
    taskIds: createdTasks.map((t) => t.id),
    totalTasks: createdTasks.length,
    completedTasks: 0,
    failedTasks: 0,
  });
  return createdTasks;
}

// ─── Detect job type from command text ───────────────────────────────────────

export function detectJobType(command: string): JobType {
  const lower = command.toLowerCase();
  if (lower.includes("render") || lower.includes("frame") || lower.includes("blender")) {
    return "blender-render";
  }
  if (lower.includes("inference") || lower.includes("classify") || lower.includes("detect")) {
    return "batch-inference";
  }
  if (
    lower.includes("vendor") ||
    lower.includes("compliance") ||
    lower.includes("enterprise") ||
    lower.includes("risk") ||
    lower.includes("selection")
  ) {
    return "enterprise-analysis";
  }
  if (
    lower.includes("analyze") ||
    lower.includes("analysis") ||
    lower.includes("neural") ||
    lower.includes("model") ||
    lower.includes("llm") ||
    lower.includes("gpt") ||
    lower.includes("summarize")
  ) {
    return "llm-analysis";
  }
  return "mock-compute";
}

// ─── Derive a title from the command ─────────────────────────────────────────

export function deriveTitle(command: string, jobType: JobType): string {
  // Strip wake phrase
  const cleaned = command
    .replace(/^(hey\s+)?clementine[,.]?\s*/i, "")
    .trim();

  const typeLabels: Record<JobType, string> = {
    "mock-compute": "Compute Job",
    "llm-analysis": "LLM Analysis",
    "batch-inference": "Batch Inference",
    "blender-render": "Render Job",
    "fractal-render": "Fractal Render",
    "enterprise-analysis": "Enterprise Analysis",
  };

  if (cleaned.length < 6) return typeLabels[jobType];

  // Capitalize and truncate
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return title.length > 60 ? title.slice(0, 57) + "…" : title;
}

// ─── Shared real-task builder ─────────────────────────────────────────────────
// Used by all heuristic fallback paths. Each angle runs as a real K2 inference
// call on a worker, so outputs are genuine and parallelism provides real speedup.

const ANALYSIS_ANGLES = [
  {
    title: "Core Research",
    role: "researcher",
    focus: "primary facts, key definitions, and the main scope of the request",
  },
  {
    title: "In-Depth Analysis",
    role: "analyst",
    focus: "underlying mechanisms, patterns, and second-order implications",
  },
  {
    title: "Comparative Evaluation",
    role: "evaluator",
    focus: "comparisons, trade-offs, and contrasting perspectives",
  },
  {
    title: "Practical Recommendations",
    role: "advisor",
    focus: "concrete applications, actionable steps, and real-world examples",
  },
];

function buildRealAnalysisTasks(job: ServerJob, angleCount = 4): ServerTask[] {
  const command = job.normalizedCommand || job.rawPrompt;
  const angles = ANALYSIS_ANGLES.slice(0, angleCount);
  const createdTasks: ServerTask[] = [];

  for (const angle of angles) {
    const task = createTask({
      jobId: job.id,
      title: angle.title,
      description: `${angle.title} — focusing on ${angle.focus}`,
      jobType: "llm-analysis",
      status: "queued",
      progress: 0,
      inputPayload: {
        taskPrompt:
          `You are an expert ${angle.role}. Address the following request, focusing specifically on ${angle.focus}:\n\n` +
          `${command}\n\n` +
          `Be specific and concrete. Your response will be combined with parallel analyses from other workers to produce a complete answer.`,
        originalCommand: command,
        jobContext: job.title,
        dataLabel: job.title,
        complexity: 3,
      },
    });
    createdTasks.push(task);
  }

  updateJob(job.id, {
    taskIds: createdTasks.map((t) => t.id),
    totalTasks: createdTasks.length,
    completedTasks: 0,
    failedTasks: 0,
  });
  return createdTasks;
}

function decomposeMockCompute(job: ServerJob): ServerTask[] {
  return buildRealAnalysisTasks(job, 3);
}

function decomposeLlmAnalysis(job: ServerJob): ServerTask[] {
  return buildRealAnalysisTasks(job, 4);
}

function decomposeBatchInference(job: ServerJob): ServerTask[] {
  return buildRealAnalysisTasks(job, 4);
}

// ─── Blender Render decomposition ─────────────────────────────────────────────
// (Placeholder — future GPU worker support)

function decomposeBlenderRender(job: ServerJob): ServerTask[] {
  const frameCount = 24; // 1 second at 24fps
  const chunkSize = 4;
  const chunks = Math.ceil(frameCount / chunkSize);
  const createdTasks: ServerTask[] = [];

  for (let i = 0; i < chunks; i++) {
    const startFrame = i * chunkSize + 1;
    const endFrame = Math.min((i + 1) * chunkSize, frameCount);
    const task = createTask({
      jobId: job.id,
      title: `Frame Chunk ${i + 1}/${chunks} (f${startFrame}–f${endFrame})`,
      description: `Render frames ${startFrame} through ${endFrame}`,
      jobType: "blender-render",
      status: "queued",
      progress: 0,
      inputPayload: {
        operationType: "blender-render",
        startFrame,
        endFrame,
        batchSize: endFrame - startFrame + 1,
        complexity: 4 + Math.random() * 2,
        dataLabel: job.title,
        seed: Math.floor(Math.random() * 100000),
      },
    });
    createdTasks.push(task);
  }
  updateJob(job.id, {
    taskIds: createdTasks.map((t) => t.id),
    totalTasks: createdTasks.length,
    completedTasks: 0,
    failedTasks: 0,
  });
  return createdTasks;
}
