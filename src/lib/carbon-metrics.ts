import type { WireJob, WireTask } from "./shared-types";

export const BASELINE_CARBON_INTENSITY = 250;
export const ESTIMATED_BROWSER_WORKER_POWER_KW = 0.035;

export function estimateTaskCarbonSavedGrams(
  durationMs: number,
  carbonIntensity: number,
  baselineCarbonIntensity = BASELINE_CARBON_INTENSITY
): number {
  const durationHours = Math.max(durationMs, 0) / 3_600_000;
  const estimatedEnergyKwh = durationHours * ESTIMATED_BROWSER_WORKER_POWER_KW;
  const baselineEmissions = baselineCarbonIntensity * estimatedEnergyKwh;
  const actualEmissions = carbonIntensity * estimatedEnergyKwh;
  return baselineEmissions - actualEmissions;
}

export function getTaskCarbonSavedGrams(task: Pick<WireTask, "estimatedCarbonSavedGrams" | "completedAt" | "startedAt" | "completedCarbonIntensity">): number {
  if (typeof task.estimatedCarbonSavedGrams === "number") {
    return task.estimatedCarbonSavedGrams;
  }

  if (
    typeof task.startedAt === "number" &&
    typeof task.completedAt === "number" &&
    typeof task.completedCarbonIntensity === "number"
  ) {
    return estimateTaskCarbonSavedGrams(
      task.completedAt - task.startedAt,
      task.completedCarbonIntensity
    );
  }

  return 0;
}

export function getJobCarbonSavedGrams(job: Pick<WireJob, "tasks">): number {
  return job.tasks.reduce((sum, task) => sum + getTaskCarbonSavedGrams(task), 0);
}

export function formatCarbonSaved(valueGrams: number): string {
  const absValue = Math.abs(valueGrams);
  const prefix = valueGrams > 0 ? "" : valueGrams < 0 ? "-" : "";

  if (absValue >= 1000) {
    return `${prefix}${(absValue / 1000).toFixed(2)} kg`;
  }

  return `${prefix}${absValue.toFixed(absValue >= 100 ? 0 : 1)} g`;
}
