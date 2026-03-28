import type { WireWorker } from "@/lib/shared-types";

export function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

export function formatPercent(value?: number, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatBattery(level?: number): string {
  return typeof level === "number" ? `${level}%` : "—";
}

export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "—";
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.max(Math.round(diffMs / 1000), 0);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

export function getWorkerDeviceSummary(worker: WireWorker): string {
  const kind = worker.telemetry?.isMobile ? "Mobile" : "Desktop";
  const parts = [
    kind,
    worker.telemetry?.platform,
    worker.telemetry?.browserName,
  ].filter(Boolean);
  return parts.join(" · ") || worker.device;
}

export function getConnectionSummary(worker: WireWorker): string {
  const net = worker.telemetry?.network;
  if (!net?.effectiveType && !net?.downlinkMbps && !net?.rttMs) return "No network hint";

  const parts = [
    net.effectiveType?.toUpperCase(),
    typeof net.downlinkMbps === "number" ? `${net.downlinkMbps} Mbps` : undefined,
    typeof net.rttMs === "number" ? `${net.rttMs} ms RTT` : undefined,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function getWorkerSortScore(worker: WireWorker): number {
  const busyPenalty = worker.metrics.busyRatio * 100;
  const benchmarkBonus = worker.benchmark?.normalizedScore ?? 0;
  return benchmarkBonus - busyPenalty;
}
