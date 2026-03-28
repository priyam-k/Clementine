"use client";

import { computeFractalTile } from "@/lib/fractal-compute";
import type { FractalTileInput, FractalTileOutput } from "@/lib/shared-types";

interface StripePlan {
  index: number;
  startRow: number;
  rowCount: number;
}

interface WorkerStripeResponse {
  output: FractalTileOutput;
}

function getParallelism(): number {
  if (typeof navigator === "undefined") return 1;
  const cores = navigator.hardwareConcurrency || 1;
  return Math.max(1, cores);
}

function buildStripePlans(tileHeight: number, stripeCount: number): StripePlan[] {
  const plans: StripePlan[] = [];
  const baseRows = Math.floor(tileHeight / stripeCount);
  let remainder = tileHeight % stripeCount;
  let startRow = 0;

  for (let index = 0; index < stripeCount; index++) {
    const extraRow = remainder > 0 ? 1 : 0;
    const rowCount = baseRows + extraRow;
    remainder -= extraRow;
    if (rowCount <= 0) continue;

    plans.push({ index, startRow, rowCount });
    startRow += rowCount;
  }

  return plans;
}

function createStripeInput(input: FractalTileInput, stripe: StripePlan): FractalTileInput {
  return {
    ...input,
    tileY: input.tileY + stripe.startRow,
    tileHeight: stripe.rowCount,
  };
}

async function executeStripeInWorker(input: FractalTileInput): Promise<FractalTileOutput> {
  const worker = new Worker(new URL("../workers/fractal-tile.worker.ts", import.meta.url), {
    type: "module",
  });

  try {
    return await new Promise<FractalTileOutput>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerStripeResponse>) => {
        resolve(event.data.output);
      };
      worker.onerror = (error) => {
        reject(error);
      };
      worker.postMessage({ input });
    });
  } finally {
    worker.terminate();
  }
}

function mergeStripeOutputs(
  input: FractalTileInput,
  stripePlans: StripePlan[],
  stripeOutputs: FractalTileOutput[]
): FractalTileOutput {
  const pixels = new Array<number>(input.tileWidth * input.tileHeight * 4);
  let totalDurationMs = 0;

  stripePlans.forEach((stripe, stripeIndex) => {
    const stripeOutput = stripeOutputs[stripeIndex];
    totalDurationMs = Math.max(totalDurationMs, stripeOutput.durationMs);

    for (let row = 0; row < stripe.rowCount; row++) {
      const sourceStart = row * input.tileWidth * 4;
      const sourceEnd = sourceStart + input.tileWidth * 4;
      const targetStart = (stripe.startRow + row) * input.tileWidth * 4;

      for (let i = sourceStart; i < sourceEnd; i++) {
        pixels[targetStart + (i - sourceStart)] = stripeOutput.pixels[i];
      }
    }
  });

  return {
    pixels,
    durationMs: totalDurationMs,
  };
}

export async function computeFractalTileMaxCpu(
  input: FractalTileInput,
  onProgress?: (progress: number) => void
): Promise<FractalTileOutput> {
  const maxParallelism = getParallelism();
  const stripeCount = Math.min(Math.max(1, maxParallelism), input.tileHeight);

  if (stripeCount <= 1 || typeof Worker === "undefined") {
    const output = computeFractalTile(input);
    onProgress?.(100);
    return output;
  }

  const stripePlans = buildStripePlans(input.tileHeight, stripeCount);
  const startedAt = performance.now();
  let completed = 0;

  const stripeOutputs = await Promise.all(
    stripePlans.map(async (stripe) => {
      const output = await executeStripeInWorker(createStripeInput(input, stripe));
      completed += 1;
      onProgress?.(Math.round((completed / stripePlans.length) * 100));
      return output;
    })
  );

  const merged = mergeStripeOutputs(input, stripePlans, stripeOutputs);
  return {
    pixels: merged.pixels,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
