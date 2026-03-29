import type { ServerJob, ServerTask } from "./types";
import type { WireResult } from "../lib/shared-types";

// ─── Result reducer: aggregates all task outputs into a final WireResult ──────

export function reduceJobResults(job: ServerJob, tasks: ServerTask[]): WireResult {
  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "assigned" || t.status === "queued");
  const workerIds = new Set(job.workerIdsUsed);

  const durationMs = job.completedAt && job.startedAt
    ? job.completedAt - job.startedAt
    : Date.now() - (job.startedAt ?? job.createdAt);

  const outputLines = [...job.completionSamples];
  if (job.failedTasks > 0) {
    outputLines.push(`✗ ${job.failedTasks} task${job.failedTasks === 1 ? "" : "s"} failed`);
  }
  const successRate =
    job.totalTasks > 0
      ? Math.round((job.completedTasks / job.totalTasks) * 100)
      : 0;

  const dataProcessed = job.totalDataProcessed > 1_000_000
    ? `${(job.totalDataProcessed / 1_000_000).toFixed(1)} M items`
    : `${(job.totalDataProcessed / 1000).toFixed(1)} K items`;

  // Append summary line
  outputLines.push(
    `→ Total: ${job.totalOps.toLocaleString()} ops across ${workerIds.size} worker${workerIds.size !== 1 ? "s" : ""} | Success: ${successRate}%`
  );
  outputLines.push(
    `→ Net carbon saved: ${job.totalCarbonSavedGrams >= 0 ? "+" : ""}${job.totalCarbonSavedGrams.toFixed(1)} gCO2e`
  );
  if (activeTasks.length > 0) {
    outputLines.push(`→ ${activeTasks.length} active task${activeTasks.length === 1 ? "" : "s"} remained in memory at reduction time`);
  }

  const summary =
    `${job.completedTasks}/${job.totalTasks} subtasks completed across ` +
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
      totalOps: job.totalOps,
      successRate,
      workerCount: workerIds.size,
      durationMs,
      completedTasks: job.completedTasks,
      failedTasks: job.failedTasks,
      netCarbonSavedGrams: Math.round(job.totalCarbonSavedGrams * 10) / 10,
    },
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
