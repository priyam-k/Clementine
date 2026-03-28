"use client";
import { Activity, BatteryCharging, CheckCircle2, Cpu, Gauge, Timer } from "lucide-react";
import type { WireWorker } from "@/lib/shared-types";
import { WorkerStatusBadge } from "@/components/ui/Badge";
import { formatBattery, formatDuration, formatPercent, formatRelativeTime, getWorkerDeviceSummary } from "@/lib/worker-format";

interface WorkerCardProps {
  worker: WireWorker;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const isOffline = worker.status === "offline";
  const batteryLevel = worker.telemetry?.battery?.level;
  const benchmarkScore = worker.benchmark?.normalizedScore;
  const busyPct = formatPercent(worker.metrics.busyRatio);

  return (
    <div
      className={`bg-white border rounded-sm p-5 transition-all group ${
        isOffline
          ? "border-[#120B09]/5 opacity-50"
          : "border-[#120B09]/5 hover:border-[#EF8354]/30 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-black text-sm text-[#120B09] tracking-tight leading-tight">
            {worker.name}
          </p>
          <p className="text-[10px] text-[#4A3935]/50 font-medium font-[Inter,sans-serif]">
            {getWorkerDeviceSummary(worker)}
          </p>
        </div>
        <WorkerStatusBadge status={worker.status} />
      </div>

      {!isOffline && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <MetricPill
            icon={<Gauge size={11} />}
            label="Benchmark"
            value={benchmarkScore != null ? String(benchmarkScore) : "—"}
            sub={worker.benchmark?.performanceTier ?? "pending"}
          />
          <MetricPill
            icon={<Cpu size={11} />}
            label="Device"
            value={worker.telemetry?.cores ? `${worker.telemetry.cores} cores` : "—"}
            sub={worker.telemetry?.deviceMemoryGb ? `${worker.telemetry.deviceMemoryGb} GB mem` : "mem n/a"}
          />
          <MetricPill
            icon={<Timer size={11} />}
            label="Avg Task"
            value={formatDuration(worker.metrics.avgTaskDurationMs)}
            sub={`${worker.tasksCompleted} tasks`}
          />
          <MetricPill
            icon={<Activity size={11} />}
            label="Busy Ratio"
            value={busyPct}
            sub={worker.metrics.renderThroughput ? `${worker.metrics.renderThroughput} px/s` : "throughput n/a"}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#120B09]/5">
        <div className="flex items-center gap-1 text-[#4A3935]/40">
          <CheckCircle2 size={11} />
          <span className="text-[9px] font-bold font-[Inter,sans-serif]">
            {worker.tasksCompleted} tasks
          </span>
        </div>
        <span className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif]">
          Seen {formatRelativeTime(worker.lastSeenAt)}
        </span>
      </div>

      {!isOffline && (
        <div className="mt-3 flex items-center justify-between text-[9px] text-[#4A3935]/50 font-[Inter,sans-serif]">
          <span>{worker.telemetry?.network?.effectiveType?.toUpperCase() ?? "Network n/a"}</span>
          <span className="inline-flex items-center gap-1">
            <BatteryCharging size={10} className={worker.telemetry?.battery?.charging ? "text-green-600" : "text-[#4A3935]/30"} />
            {formatBattery(batteryLevel)}
          </span>
        </div>
      )}
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-sm border border-[#120B09]/5 bg-[#FCFAF8] px-3 py-2.5">
      <div className="flex items-center gap-1 text-[#4A3935]/50 mb-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif]">{label}</span>
      </div>
      <p className="text-sm font-black text-[#120B09] tracking-tight">{value}</p>
      <p className="text-[9px] text-[#4A3935]/35 font-[Inter,sans-serif]">{sub}</p>
    </div>
  );
}
