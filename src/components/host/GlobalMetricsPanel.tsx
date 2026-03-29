"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WireJob, WireWorker } from "@/lib/shared-types";
import { Cpu, Database, Leaf, Users } from "lucide-react";
import { formatCarbonSaved } from "@/lib/carbon-metrics";

interface MetricSnapshot {
  cpuPressure: number;
  memoryPoolGb: number;
  activeWorkers: number;
  carbonSavedGrams: number;
}

const HISTORY_LEN = 30;

function buildPath(values: number[], w: number, h: number, maxValue: number): string {
  if (values.length < 2) return "";
  const step = w / (values.length - 1);
  const points = values.map((value, i) => {
    const x = i * step;
    const y = h - (value / Math.max(maxValue, 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}

function buildFill(values: number[], w: number, h: number, maxValue: number): string {
  if (values.length < 2) return "";
  const step = w / (values.length - 1);
  const pts = values.map((value, i) => {
    const x = i * step;
    const y = h - (value / Math.max(maxValue, 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = pts[0].split(",");
  const last = pts[pts.length - 1].split(",");
  return `M ${pts.join(" L ")} L ${last[0]},${h} L ${first[0]},${h} Z`;
}

function Sparkline({
  values,
  color,
  fillColor,
  label,
  current,
  icon,
  displayValue,
  unit = "%",
  maxValue = 100,
}: {
  values: number[];
  color: string;
  fillColor: string;
  label: string;
  current: number;
  icon: React.ReactNode;
  displayValue?: string;
  unit?: string;
  maxValue?: number;
}) {
  const W = 200;
  const H = 48;
  const colorClass = current > 85 ? "text-[#BA1A1A]" : current > 60 ? "text-[#EF8354]" : color;

  return (
    <div className="bg-white border border-[#120B09]/5 rounded-sm p-4 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#F5F1EE] rounded-sm">{icon}</div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
            {label}
          </p>
        </div>
        <span className={`text-xl font-black tracking-tighter ${colorClass}`}>
          {displayValue ?? `${current}${unit}`}
        </span>
      </div>

      <div className="relative overflow-hidden" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <path d={buildFill(values, W, H, maxValue)} fill={fillColor} opacity={0.25} />
          <path
            d={buildPath(values, W, H, maxValue)}
            fill="none"
            stroke={fillColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {values.length > 0 && (
            <circle
              cx={W}
              cy={H - (values[values.length - 1] / Math.max(maxValue, 1)) * H}
              r="2.5"
              fill={fillColor}
            />
          )}
        </svg>
      </div>

      <div className="mt-2 h-0.5 bg-[#F5F1EE] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${Math.min((current / Math.max(maxValue, 1)) * 100, 100)}%`,
            background: fillColor,
          }}
        />
      </div>
    </div>
  );
}

function MetricNumber({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#120B09]/5 rounded-sm p-4 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-[#F5F1EE] rounded-sm">{icon}</div>
        <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
          {label}
        </p>
      </div>
      <p className="text-3xl font-black tracking-tighter text-[#120B09]">{value}</p>
    </div>
  );
}

export function GlobalMetricsPanel({
  workers,
  jobs,
  schedulerBias,
}: {
  workers: WireWorker[];
  jobs: WireJob[];
  schedulerBias: number;
}) {
  const [history, setHistory] = useState<MetricSnapshot[]>(() =>
    Array.from({ length: HISTORY_LEN }, () => ({
      cpuPressure: 0,
      memoryPoolGb: 0,
      activeWorkers: 0,
      carbonSavedGrams: 0,
    }))
  );

  const activeWorkers = workers.filter((worker) => worker.status !== "offline");
  const avgNumber = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
  const sumNumber = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0));

  const current = useMemo<MetricSnapshot>(() => {
    const totalTasksDone = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
    // Eco-weighted carbon savings: more eco bias = more grams saved vs. a baseline centralized run.
    // Formula is intentionally frontend-only and does not affect any job scheduling logic.
    const carbonSavedGrams =
      Math.round(totalTasksDone * (1.5 - schedulerBias) * 0.22 * 10) / 10;

    return {
      cpuPressure: avgNumber(activeWorkers.map((worker) => worker.metrics.busyRatio * 100)),
      memoryPoolGb: sumNumber(
        activeWorkers
          .map((worker) => worker.telemetry?.deviceMemoryGb)
          .filter((value): value is number => typeof value === "number")
      ),
      activeWorkers: activeWorkers.length,
      carbonSavedGrams,
    };
  }, [activeWorkers, workers, schedulerBias, jobs]);

  const lastRef = useRef<MetricSnapshot>(current);
  useEffect(() => {
    const id = setInterval(() => {
      setHistory((prev) => [...prev.slice(1), lastRef.current]);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    lastRef.current = current;
  }, [current]);

  const cpuHistory = history.map((snap) => snap.cpuPressure);
  const memoryHistory = history.map((snap) => snap.memoryPoolGb);
  const carbonHistory = history.map((snap) => snap.carbonSavedGrams);
  const maxMemoryPool = Math.max(...memoryHistory, current.memoryPoolGb, 1);
  const carbonBounds = Math.max(...carbonHistory.map((value) => Math.abs(value)), Math.abs(current.carbonSavedGrams), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <Sparkline
        values={cpuHistory}
        color="text-[#EF8354]"
        fillColor="#EF8354"
        label="Global CPU Pressure"
        current={current.cpuPressure}
        icon={<Cpu size={13} className="text-[#EF8354]" />}
      />
      <Sparkline
        values={memoryHistory}
        color="text-[#6f0600]"
        fillColor="#6f0600"
        label="Memory Pool"
        current={current.memoryPoolGb}
        icon={<Database size={13} className="text-[#6f0600]" />}
        unit=" GB"
        maxValue={maxMemoryPool}
      />
      <Sparkline
        values={carbonHistory.map((value) => value + carbonBounds)}
        color={current.carbonSavedGrams >= 0 ? "text-green-700" : "text-[#BA1A1A]"}
        fillColor={current.carbonSavedGrams >= 0 ? "#2D6A4F" : "#BA1A1A"}
        label="Net Carbon Saved"
        current={current.carbonSavedGrams + carbonBounds}
        icon={<Leaf size={13} className={current.carbonSavedGrams >= 0 ? "text-green-700" : "text-[#BA1A1A]"} />}
        displayValue={formatCarbonSaved(current.carbonSavedGrams)}
        unit=""
        maxValue={carbonBounds * 2}
      />
      <MetricNumber
        label="Active Workers"
        value={String(current.activeWorkers)}
        icon={<Users size={13} className="text-[#6f0600]" />}
      />
    </div>
  );
}
