"use client";

import { computeFractalTileAsync } from "@/lib/fractal-compute";
import type { WorkerBenchmark, WorkerTelemetry } from "@/lib/shared-types";
import { createBenchmarkResult, SYNTHETIC_BENCHMARK_INPUT } from "@/lib/worker-benchmark";

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  getBattery?: () => Promise<{
    level?: number;
    charging?: boolean;
  }>;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
    brands?: Array<{ brand: string; version: string }>;
  };
};

function detectBrowserName(nav: NavigatorWithDeviceMemory): string | undefined {
  const fromBrands = nav.userAgentData?.brands?.find((brand) => !/Not/i.test(brand.brand));
  if (fromBrands?.brand) return fromBrands.brand;

  const ua = nav.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return undefined;
}

function detectPlatform(nav: NavigatorWithDeviceMemory): string | undefined {
  return nav.userAgentData?.platform || nav.platform || undefined;
}

function detectIsMobile(nav: NavigatorWithDeviceMemory): boolean {
  if (typeof nav.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
}

function deriveDeviceLabel(telemetry: WorkerTelemetry, fallbackDevice?: string): string {
  const parts = [
    telemetry.isMobile ? "Mobile" : "Desktop",
    telemetry.platform,
    telemetry.browserName,
  ].filter(Boolean);

  return parts.join(" · ") || fallbackDevice || "Browser Worker";
}

async function getBatterySnapshot(nav: NavigatorWithDeviceMemory): Promise<WorkerTelemetry["battery"] | undefined> {
  try {
    if (!nav.getBattery) return undefined;
    const battery = await Promise.race([
      nav.getBattery(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500)),
    ]);
    if (!battery) return undefined;

    return {
      level: typeof battery.level === "number" ? Math.round(battery.level * 100) : undefined,
      charging: typeof battery.charging === "boolean" ? battery.charging : undefined,
    };
  } catch {
    return undefined;
  }
}

async function getStorageSnapshot(): Promise<WorkerTelemetry["storage"] | undefined> {
  try {
    if (!navigator.storage?.estimate) return undefined;
    const estimate = await navigator.storage.estimate();
    const usageBytes = estimate.usage;
    const quotaBytes = estimate.quota;

    return {
      usageBytes,
      quotaBytes,
      usagePercent:
        usageBytes != null && quotaBytes != null && quotaBytes > 0
          ? Math.round((usageBytes / quotaBytes) * 100)
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function collectBrowserTelemetry(fallbackDevice?: string): Promise<{
  telemetry: WorkerTelemetry;
  deviceLabel: string;
}> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      telemetry: {},
      deviceLabel: fallbackDevice || "Browser Worker",
    };
  }

  const nav = navigator as NavigatorWithDeviceMemory;
  const telemetry: WorkerTelemetry = {
    cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined,
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    userAgent: nav.userAgent,
    platform: detectPlatform(nav),
    language: nav.language,
    online: nav.onLine,
    isMobile: detectIsMobile(nav),
    browserName: detectBrowserName(nav),
    screen: typeof window.screen !== "undefined"
      ? {
          width: window.screen.width,
          height: window.screen.height,
          pixelRatio: window.devicePixelRatio || 1,
        }
      : undefined,
    network: nav.connection
      ? {
          effectiveType: nav.connection.effectiveType,
          downlinkMbps: nav.connection.downlink,
          rttMs: nav.connection.rtt,
        }
      : undefined,
  };

  const [battery, storage] = await Promise.all([
    getBatterySnapshot(nav),
    getStorageSnapshot(),
  ]);
  if (battery) telemetry.battery = battery;
  if (storage) telemetry.storage = storage;

  const deviceLabel = deriveDeviceLabel(telemetry, fallbackDevice);
  telemetry.deviceLabel = deviceLabel;

  return { telemetry, deviceLabel };
}

export async function collectTelemetryHeartbeat(): Promise<{
  sentAt: number;
  telemetry?: Partial<WorkerTelemetry>;
}> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { sentAt: Date.now() };
  }

  const nav = navigator as NavigatorWithDeviceMemory;
  const [battery, storage] = await Promise.all([
    getBatterySnapshot(nav),
    getStorageSnapshot(),
  ]);

  return {
    sentAt: Date.now(),
    telemetry: {
      online: nav.onLine,
      network: nav.connection
        ? {
            effectiveType: nav.connection.effectiveType,
            downlinkMbps: nav.connection.downlink,
            rttMs: nav.connection.rtt,
          }
        : undefined,
      battery,
      storage,
    },
  };
}

export async function runSyntheticBenchmark(): Promise<WorkerBenchmark> {
  const startedAt = performance.now();
  await computeFractalTileAsync(SYNTHETIC_BENCHMARK_INPUT);
  const computeMs = performance.now() - startedAt;
  return createBenchmarkResult(computeMs);
}

export async function collectWorkerProfile(fallbackDevice?: string): Promise<{
  device?: string;
  telemetry?: WorkerTelemetry;
  benchmark?: WorkerBenchmark;
}> {
  const [telemetryResult, benchmarkResult] = await Promise.allSettled([
    collectBrowserTelemetry(fallbackDevice),
    runSyntheticBenchmark(),
  ]);

  return {
    device:
      telemetryResult.status === "fulfilled" ? telemetryResult.value.deviceLabel : fallbackDevice,
    telemetry:
      telemetryResult.status === "fulfilled" ? telemetryResult.value.telemetry : undefined,
    benchmark:
      benchmarkResult.status === "fulfilled" ? benchmarkResult.value : undefined,
  };
}
