import type { FractalTileInput, WorkerBenchmark, WorkerPerformanceTier } from "@/lib/shared-types";

export const SYNTHETIC_BENCHMARK_INPUT: FractalTileInput = {
  fractalType: "mandelbrot",
  tileX: 0,
  tileY: 0,
  tileWidth: 64,
  tileHeight: 64,
  imageWidth: 64,
  imageHeight: 64,
  xMin: -2.2,
  xMax: 0.8,
  yMin: -1.2,
  yMax: 1.2,
  maxIterations: 180,
};

export const SYNTHETIC_BENCHMARK_PIXELS =
  SYNTHETIC_BENCHMARK_INPUT.tileWidth * SYNTHETIC_BENCHMARK_INPUT.tileHeight;

export function normalizeBenchmarkScore(computeMs: number): number {
  // Score is anchored to a 100 ms baseline and softened with sqrt scaling
  // so slower devices are differentiated without tiny timing changes causing
  // noisy swings. Faster compute time always yields a higher score.
  const baselineMs = 100;
  const score = 100 * Math.sqrt(baselineMs / Math.max(computeMs, 1));
  return Math.max(10, Math.min(100, Math.round(score)));
}

export function derivePerformanceTier(score: number): WorkerPerformanceTier {
  if (score >= 85) return "fast";
  if (score >= 60) return "medium";
  return "slow";
}

export function benchmarkPixelsPerSecond(computeMs: number): number {
  if (computeMs <= 0) return 0;
  return Math.round(SYNTHETIC_BENCHMARK_PIXELS / (computeMs / 1000));
}

export function createBenchmarkResult(computeMs: number, benchmarkRoundTripMs?: number): WorkerBenchmark {
  const normalizedScore = normalizeBenchmarkScore(computeMs);
  return {
    benchmarkComputeMs: Math.round(computeMs * 10) / 10,
    benchmarkRoundTripMs,
    normalizedScore,
    performanceTier: derivePerformanceTier(normalizedScore),
    benchmarkCompletedAt: Date.now(),
  };
}
