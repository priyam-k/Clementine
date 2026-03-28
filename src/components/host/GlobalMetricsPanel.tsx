"use client";
import { useEffect, useRef, useState } from "react";
import type { WireWorker } from "@/lib/shared-types";
import { Activity, BatteryCharging, Gauge, Zap } from "lucide-react";

interface MetricSnapshot {
  benchmark: number;
  busy: number;
  efficiency: number;
  battery: number;
}

const HISTORY_LEN = 30;

function buildPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}

function buildFill(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = pts[0].split(",");
  const last = pts[pts.length - 1].split(",");
  return `M ${pts.join(" L ")} L ${last[0]},${h} L ${first[0]},${h} Z`;
}

interface SparklineProps {
  values: number[];
  color: string;
  fillColor: string;
  label: string;
  current: number;
  icon: React.ReactNode;
  unit?: string;
}

function Sparkline({ values, color, fillColor, label, current, icon, unit = "%" }: SparklineProps) {
  const W = 200;
  const H = 48;

  const colorClass = current > 85 ? "text-[#BA1A1A]" : current > 60 ? "text-[#EF8354]" : color;

  return (
    <div className="bg-white border border-[#120B09]/5 rounded-sm p-4 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#F5F1EE] rounded-sm">
            {icon}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
            {label}
          </p>
        </div>
        <span className={`text-xl font-black tracking-tighter ${colorClass}`}>
          {current}{unit}
        </span>
      </div>

      <div className="relative overflow-hidden" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Fill area */}
          <path
            d={buildFill(values, W, H)}
            fill={fillColor}
            opacity={0.25}
          />
          {/* Stroke line */}
          <path
            d={buildPath(values, W, H)}
            fill="none"
            stroke={fillColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Current value dot */}
          {values.length > 0 && (
            <circle
              cx={W}
              cy={H - (values[values.length - 1] / 100) * H}
              r="2.5"
              fill={fillColor}
            />
          )}
        </svg>
      </div>

      {/* Mini bar */}
      <div className="mt-2 h-0.5 bg-[#F5F1EE] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${current}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}

interface GlobalMetricsPanelProps {
  workers: WireWorker[];
}

export function GlobalMetricsPanel({ workers }: GlobalMetricsPanelProps) {
  const [history, setHistory] = useState<MetricSnapshot[]>(() =>
    Array.from({ length: HISTORY_LEN }, () => ({ benchmark: 0, busy: 0, efficiency: 0, battery: 0 }))
  );

  const activeWorkers = workers.filter((w) => w.status !== "offline");
  const avgNumber = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));

  const current: MetricSnapshot = {
    benchmark: avgNumber(activeWorkers.map((worker) => worker.benchmark?.normalizedScore ?? 0)),
    busy: avgNumber(activeWorkers.map((worker) => worker.metrics.busyRatio * 100)),
    efficiency: avgNumber(
      activeWorkers
        .map((worker) => worker.metrics.taskEfficiency)
        .filter((value): value is number => typeof value === "number")
    ),
    battery: avgNumber(
      activeWorkers
        .map((worker) => worker.telemetry?.battery?.level)
        .filter((value): value is number => typeof value === "number")
    ),
  };

  // Push new snapshot on interval or when workers change
  const lastRef = useRef<MetricSnapshot>(current);
  useEffect(() => {
    const id = setInterval(() => {
      setHistory((prev) => {
        const snap = lastRef.current;
        return [...prev.slice(1 - HISTORY_LEN), snap];
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    lastRef.current = current;
  });

  const benchmarkHistory = history.map((h) => h.benchmark);
  const busyHistory = history.map((h) => h.busy);
  const efficiencyHistory = history.map((h) => h.efficiency);
  const batteryHistory = history.map((h) => h.battery);

  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#EF8354] font-[Inter,sans-serif] block mb-1">
            Fleet Telemetry
          </span>
          <h2 className="text-2xl font-black text-[#120B09] tracking-tighter uppercase">
            Global Metrics
          </h2>
        </div>
        <p className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif] font-bold uppercase tracking-wider">
          {activeWorkers.length} active node{activeWorkers.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Sparkline
          values={benchmarkHistory}
          color="text-[#EF8354]"
          fillColor="#EF8354"
          label="Benchmark Avg"
          current={current.benchmark}
          icon={<Gauge size={13} className="text-[#EF8354]" />}
          unit=""
        />
        <Sparkline
          values={busyHistory}
          color="text-[#6f0600]"
          fillColor="#6f0600"
          label="Busy Ratio"
          current={current.busy}
          icon={<Activity size={13} className="text-[#6f0600]" />}
        />
        <Sparkline
          values={efficiencyHistory}
          color="text-[#2D6A4F]"
          fillColor="#2D6A4F"
          label="Task Efficiency"
          current={current.efficiency}
          icon={<Zap size={13} className="text-[#2D6A4F]" />}
        />
        <Sparkline
          values={batteryHistory}
          color="text-blue-600"
          fillColor="#2563eb"
          label="Battery Avg"
          current={current.battery}
          icon={<BatteryCharging size={13} className="text-blue-600" />}
        />
      </div>
    </section>
  );
}
