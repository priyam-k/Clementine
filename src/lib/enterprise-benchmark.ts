import type { EnterpriseBenchmarkConfig } from "./shared-types";

export function getEnterpriseBenchmarkConfig(difficulty: number): EnterpriseBenchmarkConfig {
  const normalizedDifficulty = Math.min(Math.max(Math.round(difficulty), 1), 100);
  const vendorCount = Math.min(40, Math.max(1, Math.round(1 + ((normalizedDifficulty - 1) * 39) / 99)));

  if (normalizedDifficulty <= 25) {
    return {
      benchmarkType: "enterprise-vendor-risk-selection",
      difficulty: normalizedDifficulty,
      vendorCount,
      analysisDepth: "light",
    };
  }

  if (normalizedDifficulty <= 50) {
    return {
      benchmarkType: "enterprise-vendor-risk-selection",
      difficulty: normalizedDifficulty,
      vendorCount,
      analysisDepth: "standard",
    };
  }

  if (normalizedDifficulty <= 75) {
    return {
      benchmarkType: "enterprise-vendor-risk-selection",
      difficulty: normalizedDifficulty,
      vendorCount,
      analysisDepth: "deep",
    };
  }

  return {
    benchmarkType: "enterprise-vendor-risk-selection",
    difficulty: normalizedDifficulty,
    vendorCount,
    analysisDepth: "extreme",
  };
}

export function getEnterpriseDifficultyLabel(config: EnterpriseBenchmarkConfig): string {
  switch (config.analysisDepth) {
    case "light":
      return "Light";
    case "standard":
      return "Standard";
    case "deep":
      return "Deep";
    case "extreme":
      return "Extreme";
    default:
      return "Standard";
  }
}

export function buildEnterpriseBenchmarkCommand(config: EnterpriseBenchmarkConfig): string {
  return `Evaluate these vendors and recommend the top 2 based on risk, reliability, cost efficiency, scalability, and compliance. Analyze ${config.vendorCount} vendors at ${config.analysisDepth} depth.`;
}
