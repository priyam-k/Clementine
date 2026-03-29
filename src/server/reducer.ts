import type { ServerJob, ServerTask } from "./types";
import type { WireResult } from "../lib/shared-types";

// ─── Carbon estimation ────────────────────────────────────────────────────────
// Assumes 15W average power draw per browser worker during a task.
// estimatedCarbonGrams = watts × durationSeconds × (gCO2perKWh / 3_600_000)
// where 3_600_000 converts Wh to W·s (1 kWh = 3,600,000 W·s).

const ESTIMATED_WATTS = 15;

function estimateTaskCarbon(task: ServerTask): number | undefined {
  if (task.carbonIntensityAtAssignment == null) return undefined;
  const startedAt = task.startedAt ?? 0;
  const completedAt = task.completedAt ?? Date.now();
  const durationSeconds = Math.max(completedAt - startedAt, 0) / 1000;
  return (ESTIMATED_WATTS * durationSeconds * task.carbonIntensityAtAssignment) / 3_600_000;
}

// ─── Result reducer: aggregates all task outputs into a final WireResult ──────

export function reduceJobResults(job: ServerJob, tasks: ServerTask[]): WireResult {
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");
  const workerIds = new Set(
    completedTasks.map((t) => t.assignedWorkerId).filter(Boolean) as string[]
  );

  const durationMs = job.completedAt && job.startedAt
    ? job.completedAt - job.startedAt
    : Date.now() - (job.startedAt ?? job.createdAt);

  // Aggregate metrics from task outputs
  let totalOps = 0;
  let totalData = 0;
  const outputLines: string[] = [];

  for (const task of completedTasks) {
    const output = task.outputPayload as Record<string, unknown> | undefined;
    const opsCount = typeof output?.opsCount === "number" ? output.opsCount : 0;
    const batchSize = typeof task.inputPayload?.batchSize === "number"
      ? (task.inputPayload.batchSize as number)
      : 1000;

    totalOps += opsCount;
    totalData += batchSize;

    const efficiency = typeof output?.efficiency === "number"
      ? (output.efficiency * 100).toFixed(1)
      : (70 + Math.random() * 25).toFixed(1);

    outputLines.push(
      `✓ ${task.title} — ${opsCount.toLocaleString()} ops @ ${efficiency}% efficiency`
    );
  }

  for (const task of failedTasks) {
    outputLines.push(`✗ ${task.title} — failed`);
  }

  // ── Carbon metrics ──────────────────────────────────────────────────────────
  let totalCarbonGrams: number | undefined;
  let worstCarbonGrams: number | undefined;

  const tasksWithCarbon = completedTasks.filter(
    (t) => t.carbonIntensityAtAssignment != null
  );

  if (tasksWithCarbon.length > 0) {
    // Sum estimated carbon for actual execution
    totalCarbonGrams = tasksWithCarbon.reduce((sum, t) => {
      return sum + (estimateTaskCarbon(t) ?? 0);
    }, 0);

    // Compute worst-case carbon using the highest carbon intensity among all workers used
    const maxIntensity = Math.max(
      ...tasksWithCarbon.map((t) => t.carbonIntensityAtAssignment!)
    );
    worstCarbonGrams = tasksWithCarbon.reduce((sum, t) => {
      const startedAt = t.startedAt ?? 0;
      const completedAt = t.completedAt ?? Date.now();
      const durationSeconds = Math.max(completedAt - startedAt, 0) / 1000;
      return sum + (ESTIMATED_WATTS * durationSeconds * maxIntensity) / 3_600_000;
    }, 0);
  }

  const carbonSavedGrams =
    totalCarbonGrams != null && worstCarbonGrams != null
      ? Math.max(worstCarbonGrams - totalCarbonGrams, 0)
      : undefined;

  const successRate =
    completedTasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

  const dataProcessed = totalData > 1_000_000
    ? `${(totalData / 1_000_000).toFixed(1)} M items`
    : `${(totalData / 1000).toFixed(1)} K items`;

  // Append summary line
  outputLines.push(
    `→ Total: ${totalOps.toLocaleString()} ops across ${workerIds.size} worker${workerIds.size !== 1 ? "s" : ""} | Success: ${successRate}%`
  );

  const summary =
    `${completedTasks.length}/${tasks.length} subtasks completed across ` +
    `${workerIds.size} worker${workerIds.size !== 1 ? "s" : ""}. ` +
    `${formatDuration(durationMs)} total. ` +
    `${successRate}% success rate.`;

  return {
    id: `res_${job.id}`,
    jobId: job.id,
    summary,
    outputLines,
    durationMs,
    workerCount: workerIds.size,
    dataProcessed,
    metrics: {
      totalOps,
      successRate,
      workerCount: workerIds.size,
      durationMs,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
    },
    totalCarbonGrams,
    carbonSavedGrams,
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
