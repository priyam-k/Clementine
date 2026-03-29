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

  updateJob(job.id, { taskIds: createdTasks.map((t) => t.id) });
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
    "mock-compute":   "Compute Job",
    "llm-analysis":   "LLM Analysis",
    "batch-inference":"Batch Inference",
    "blender-render": "Render Job",
    "fractal-render": "Fractal Render",
    "prime-sieve":    "Prime Computation",
    "text-analysis":  "Text Analysis",
    "monte-carlo":    "Monte Carlo Simulation",
    "sort-benchmark": "Sort Benchmark",
    "number-crunch":  "Statistical Analysis",
  };

  if (cleaned.length < 6) return typeLabels[jobType];

  // Capitalize and truncate
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return title.length > 60 ? title.slice(0, 57) + "…" : title;
}

// ─── Generic compute decomposition ────────────────────────────────────────────
// Heuristic fallback used when LLM decompose fails. Generates real computation
// tasks that browser workers can actually execute.

function decomposeMockCompute(job: ServerJob): ServerTask[] {
  const createdTasks: ServerTask[] = [];

  // 4 prime-sieve shards covering 1M–9M
  const primeRanges: Array<[number, number]> = [
    [1_000_000, 3_000_000],
    [3_000_001, 5_000_000],
    [5_000_001, 7_000_000],
    [7_000_001, 9_000_000],
  ];
  for (const [start, end] of primeRanges) {
    createdTasks.push(createTask({
      jobId: job.id,
      title: `Prime Sieve ${(start / 1_000_000).toFixed(0)}M–${(end / 1_000_000).toFixed(0)}M`,
      description: `Count all prime numbers in range ${start.toLocaleString()}–${end.toLocaleString()} via segmented sieve`,
      jobType: "prime-sieve",
      status: "queued",
      progress: 0,
      inputPayload: { rangeStart: start, rangeEnd: end },
    }));
  }

  // 3 Monte Carlo estimations at different precision levels
  for (const iterations of [500_000, 1_500_000, 3_000_000]) {
    createdTasks.push(createTask({
      jobId: job.id,
      title: `Monte Carlo π (${(iterations / 1_000_000).toFixed(1)}M pts)`,
      description: `Estimate π using ${iterations.toLocaleString()} random samples via Monte Carlo method`,
      jobType: "monte-carlo",
      status: "queued",
      progress: 0,
      inputPayload: { iterations, target: "pi" },
    }));
  }

  // 3 sort benchmarks at different sizes
  const sortConfigs: Array<[number, number]> = [[300_000, 42], [600_000, 9371], [1_000_000, 55123]];
  for (const [size, seed] of sortConfigs) {
    createdTasks.push(createTask({
      jobId: job.id,
      title: `Sort Benchmark ${(size / 1000).toFixed(0)}K`,
      description: `Sort ${size.toLocaleString()} pseudo-random numbers and record timing + distribution statistics`,
      jobType: "sort-benchmark",
      status: "queued",
      progress: 0,
      inputPayload: { size, seed },
    }));
  }

  updateJob(job.id, { taskIds: createdTasks.map((t) => t.id) });
  return createdTasks;
}

// ─── LLM Analysis decomposition ───────────────────────────────────────────────

const LLM_TASK_TEMPLATES = [
  { title: "Corpus Ingestion", description: "Load and chunk the input corpus" },
  { title: "Semantic Embedding — Pass 1", description: "Generate embeddings for chunk batch 1" },
  { title: "Semantic Embedding — Pass 2", description: "Generate embeddings for chunk batch 2" },
  { title: "Similarity Clustering", description: "Cluster embedding vectors by semantic proximity" },
  { title: "Key Theme Extraction", description: "Identify dominant themes across clusters" },
  { title: "Summary Synthesis", description: "Synthesize final summary from theme clusters" },
];

function decomposeLlmAnalysis(job: ServerJob): ServerTask[] {
  const createdTasks: ServerTask[] = [];
  for (const template of LLM_TASK_TEMPLATES) {
    const task = createTask({
      jobId: job.id,
      title: template.title,
      description: template.description,
      jobType: "llm-analysis",
      status: "queued",
      progress: 0,
      inputPayload: {
        operationType: "llm-analysis",
        batchSize: Math.floor(500 + Math.random() * 1500),
        complexity: 3 + Math.random() * 2,
        dataLabel: job.title,
        seed: Math.floor(Math.random() * 100000),
      },
    });
    createdTasks.push(task);
  }
  updateJob(job.id, { taskIds: createdTasks.map((t) => t.id) });
  return createdTasks;
}

// ─── Batch Inference decomposition ────────────────────────────────────────────

const INFERENCE_TASK_TEMPLATES = [
  { title: "Data Pipeline Setup", description: "Initialize inference pipeline and load model weights" },
  { title: "Batch Inference — Shard A", description: "Run inference on input shard A" },
  { title: "Batch Inference — Shard B", description: "Run inference on input shard B" },
  { title: "Batch Inference — Shard C", description: "Run inference on input shard C" },
  { title: "Confidence Scoring", description: "Score and rank inference outputs" },
  { title: "Result Consolidation", description: "Merge shard results and write output" },
];

function decomposeBatchInference(job: ServerJob): ServerTask[] {
  const createdTasks: ServerTask[] = [];
  for (const template of INFERENCE_TASK_TEMPLATES) {
    const task = createTask({
      jobId: job.id,
      title: template.title,
      description: template.description,
      jobType: "batch-inference",
      status: "queued",
      progress: 0,
      inputPayload: {
        operationType: "batch-inference",
        batchSize: Math.floor(2000 + Math.random() * 8000),
        complexity: 2 + Math.random() * 3,
        dataLabel: job.title,
        seed: Math.floor(Math.random() * 100000),
      },
    });
    createdTasks.push(task);
  }
  updateJob(job.id, { taskIds: createdTasks.map((t) => t.id) });
  return createdTasks;
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
  updateJob(job.id, { taskIds: createdTasks.map((t) => t.id) });
  return createdTasks;
}
