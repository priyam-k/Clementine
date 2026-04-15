"use client";

import { z } from "zod";
import type { FractalTileInput, WireTask } from "@/lib/shared-types";
import { computeFractalTileMaxCpu } from "@/lib/fractal-parallel";
import { executeK2InferenceTask } from "@/lib/inference-client";

const fractalTileInputSchema = z.object({
  fractalType: z.literal("mandelbrot"),
  tileX: z.number(),
  tileY: z.number(),
  tileWidth: z.number().positive(),
  tileHeight: z.number().positive(),
  imageWidth: z.number().positive(),
  imageHeight: z.number().positive(),
  xMin: z.number(),
  xMax: z.number(),
  yMin: z.number(),
  yMax: z.number(),
  maxIterations: z.number().int().positive(),
});

function getNumericPayloadValue(
  payload: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function executeMockTask(
  inputPayload: Record<string, unknown>,
  onProgress: (progress: number) => void
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const complexity = getNumericPayloadValue(inputPayload, "complexity", 2);
    const batchSize = getNumericPayloadValue(inputPayload, "batchSize", 1000);
    const durationMs = 2000 + complexity * 1200 + Math.random() * 2000;
    const steps = 8 + Math.floor(Math.random() * 5);
    const intervalMs = durationMs / steps;
    let currentStep = 0;
    const startTime = Date.now();

    const interval = window.setInterval(() => {
      currentStep += 1;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 99);
      onProgress(progress);

      if (currentStep >= steps) {
        window.clearInterval(interval);
        const actualDuration = Date.now() - startTime;
        const opsCount = Math.floor(batchSize * (0.5 + Math.random() * 1.5));
        const efficiency = 0.72 + Math.random() * 0.23;

        resolve({
          success: true,
          result: `Processed ${opsCount.toLocaleString()} operations on ${batchSize.toLocaleString()} items`,
          opsCount,
          durationMs: actualDuration,
          efficiency,
        });
      }
    }, intervalMs);
  });
}

async function executeFractalTileTask(
  task: WireTask,
  onProgress: (progress: number) => void
): Promise<Record<string, unknown>> {
  onProgress(5);
  const input = fractalTileInputSchema.parse(task.inputPayload) as FractalTileInput;
  onProgress(10);

  const output = await computeFractalTileMaxCpu(input, (progress) => {
    onProgress(10 + Math.floor(progress * 0.9));
  });

  onProgress(100);
  return output as unknown as Record<string, unknown>;
}

function isInferenceTask(task: WireTask): boolean {
  return (
    task.jobType === "batch-inference" ||
    task.jobType === "llm-analysis" ||
    task.jobType === "enterprise-analysis"
  );
}

export async function executeAssignedTask(
  task: WireTask,
  onProgress: (progress: number) => void
): Promise<Record<string, unknown>> {
  if (task.jobType === "fractal-render") {
    return executeFractalTileTask(task, onProgress);
  }

  if (isInferenceTask(task)) {
    onProgress(15);
    const output = await executeK2InferenceTask(task);
    onProgress(100);
    return output;
  }

  return executeMockTask(task.inputPayload, onProgress);
}
