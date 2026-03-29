"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { useHostSession } from "@/hooks/useHostSession";
import { WorkerStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, Gauge, TrendingUp, Users, WifiOff, Zap,
} from "lucide-react";
import type { WireWorker } from "@/lib/shared-types";
import {
  formatBattery,
  formatDuration,
  formatRelativeTime,
  getConnectionSummary,
  getWorkerDeviceSummary,
} from "@/lib/worker-format";

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function WorkerWarnings({ workers }: { workers: WireWorker[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const warnings: { icon: typeof AlertTriangle; text: string; level: "red" | "yellow" }[] = [];

  workers.forEach((worker) => {
    if (worker.status === "offline") {
      warnings.push({ icon: WifiOff, text: `${worker.name} is offline`, level: "red" });
      return;
    }

    const heartbeatAge = worker.metrics.lastHeartbeatAt
      ? now - worker.metrics.lastHeartbeatAt
      : undefined;

    if (heartbeatAge && heartbeatAge > 15000) {
      warnings.push({
        icon: AlertTriangle,
        text: `${worker.name} has stale telemetry (${formatRelativeTime(worker.metrics.lastHeartbeatAt)})`,
        level: "yellow",
      });
    } else if (!worker.benchmark) {
      warnings.push({
        icon: AlertTriangle,
        text: `${worker.name} has not completed the benchmark yet`,
        level: "yellow",
      });
    }
  });

  const online = workers.filter((worker) => worker.status !== "offline");
  if (online.length === 0 && workers.length > 0) {
    warnings.push({ icon: WifiOff, text: "All workers are offline", level: "red" });
  }
  if (workers.length === 0) {
    warnings.push({ icon: Users, text: "No workers connected — share the join link", level: "yellow" });
  }

  if (!warnings.length) return null;

  return (
    <div className="mb-8 space-y-2">
      {warnings.slice(0, 4).map((warning, i) => {
        const Icon = warning.icon;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm border text-xs font-bold ${
              warning.level === "red"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <Icon size={14} className="flex-shrink-0" />
            <span>{warning.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function WorkerRow({ worker, rank }: { worker: WireWorker; rank: number }) {
  const isOffline = worker.status === "offline";
  const benchmarkScore = worker.benchmark?.normalizedScore ?? 0;
  const busyValue = Math.round(worker.metrics.busyRatio * 100);

  return (
    <div className={`grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[#120B09]/5 hover:bg-[#FAFAF8] transition-all ${isOffline ? "opacity-50" : ""}`}>
      <div className="col-span-3 flex items-center gap-3">
        <span className="text-[10px] font-black text-[#4A3935]/30 font-[Inter,sans-serif] w-4">{rank}</span>
        <div className="w-8 h-8 rounded-sm bg-[#F5F1EE] flex items-center justify-center text-xs font-black text-[#EF8354]">
          {worker.name[0]}
        </div>
        <div className="min-w-0">
          <p className="font-black text-sm text-[#120B09] truncate">{worker.name}</p>
          <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif] truncate">{getWorkerDeviceSummary(worker)}</p>
        </div>
      </div>

      <div className="col-span-2">
        <WorkerStatusBadge status={worker.status} />
      </div>

      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-black text-[#4A3935]/50 font-[Inter,sans-serif]">Benchmark</span>
          <span className="text-[10px] font-black font-[Inter,sans-serif] text-[#120B09]">
            {worker.benchmark ? worker.benchmark.normalizedScore : "—"}
          </span>
        </div>
        <ProgressBar value={benchmarkScore} height="sm" color={benchmarkScore >= 85 ? "primary" : "red"} />
      </div>

      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-black text-[#4A3935]/50 font-[Inter,sans-serif]">Busy</span>
          <span className="text-[10px] font-black text-[#120B09] font-[Inter,sans-serif]">{busyValue}%</span>
        </div>
        <ProgressBar value={busyValue} height="sm" color={busyValue > 80 ? "red" : "primary"} />
      </div>

      <div className="col-span-1 text-center">
        <p className="text-sm font-black text-[#120B09]">{worker.tasksCompleted}</p>
        <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif]">tasks</p>
      </div>

      <div className="col-span-2 text-right">
        <p className="text-[10px] font-black text-[#120B09]">{formatDuration(worker.metrics.avgTaskDurationMs)}</p>
        <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif]">
          {worker.metrics.renderThroughput ? `${worker.metrics.renderThroughput} px/s` : formatRelativeTime(worker.lastSeenAt)}
        </p>
      </div>
    </div>
  );
}

function StatusBreakdown({ workers }: { workers: WireWorker[] }) {
  const counts = {
    working: workers.filter((worker) => worker.status === "working").length,
    idle: workers.filter((worker) => worker.status === "idle").length,
    done: workers.filter((worker) => worker.status === "done").length,
    offline: workers.filter((worker) => worker.status === "offline").length,
  };
  const total = workers.length || 1;

  return (
    <div className="space-y-3">
      {(["working", "idle", "done", "offline"] as const).map((status) => {
        const count = counts[status];
        const pct = Math.round((count / total) * 100);
        const colors = {
          working: "bg-[#EF8354]",
          idle: "bg-[#EDE7E3]",
          done: "bg-green-500",
          offline: "bg-[#120B09]/20",
        };
        const labels = { working: "Working", idle: "Idle", done: "Done", offline: "Offline" };
        return (
          <div key={status}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/60 font-[Inter,sans-serif]">{labels[status]}</span>
              </div>
              <span className="text-[10px] font-black text-[#120B09] font-[Inter,sans-serif]">{count}</span>
            </div>
            <div className="h-1.5 bg-[#EDE7E3] rounded-full overflow-hidden">
              <div className={`h-full ${colors[status]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkersPage() {
  const { workers, jobs, session, isConnected } = useHostSession();
  const onlineCount = workers.filter((worker) => worker.status !== "offline").length;
  const runningJobCount = jobs.filter(
    (job) => job.status === "running" || job.status === "decomposing" || job.status === "reducing"
  ).length;

  const online = workers.filter((worker) => worker.status !== "offline");
  const working = workers.filter((worker) => worker.status === "working");
  const totalTasksDone = workers.reduce((sum, worker) => sum + worker.tasksCompleted, 0);
  const avgBenchmark = avg(online.map((worker) => worker.benchmark?.normalizedScore ?? 0));
  const avgTaskTime = avg(
    online
      .map((worker) => worker.metrics.avgTaskDurationMs)
      .filter((value): value is number => typeof value === "number")
  );
  const totalThroughput = online.reduce((sum, worker) => sum + (worker.metrics.renderThroughput ?? 0), 0);

  const tierBuckets = [
    { label: "Fast", count: online.filter((worker) => worker.benchmark?.performanceTier === "fast").length },
    { label: "Medium", count: online.filter((worker) => worker.benchmark?.performanceTier === "medium").length },
    { label: "Slow", count: online.filter((worker) => worker.benchmark?.performanceTier === "slow").length },
    { label: "Pending", count: online.filter((worker) => !worker.benchmark).length },
  ];
  const maxBucket = Math.max(...tierBuckets.map((bucket) => bucket.count), 1);

  const statusOrder = { working: 0, idle: 1, done: 2, offline: 3 };
  const sorted = [...workers].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const strongestWorkers = [...online]
    .sort((a, b) => (b.benchmark?.normalizedScore ?? 0) - (a.benchmark?.normalizedScore ?? 0))
    .slice(0, 5);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        workerCountLabel={`${onlineCount}/${workers.length || 0}`}
        taskCountLabel={`${runningJobCount}/${jobs.length || 0}`}
      />
      <main className="md:ml-64 flex-1 p-6 md:p-10 lg:p-14">
        <header className="mb-10">
          <Link href="/host" className="inline-flex items-center gap-2 text-[#4A3935]/50 hover:text-[#EF8354] transition-colors mb-5 font-[Inter,sans-serif] text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={13} />
            Dashboard
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif] block mb-2">Fleet Management</span>
              <h1 className="text-5xl font-black text-[#120B09] tracking-tighter uppercase">Worker Fleet</h1>
              <p className="text-[#4A3935]/50 text-xs font-bold uppercase tracking-widest mt-2 font-[Inter,sans-serif]">
                {isConnected ? (
                  <>{online.length} online · {working.length} working · {session?.code}</>
                ) : "Connecting…"}
              </p>
            </div>
            <Link href="/join" className="hidden md:flex items-center gap-2 px-5 py-3 bg-[#EF8354] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all font-[Inter,sans-serif]">
              <Zap size={12} />
              Invite Worker
            </Link>
          </div>
        </header>

        <WorkerWarnings workers={workers} />

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Workers", value: String(workers.length), sub: `${online.length} online`, icon: Users, accent: "text-[#6f0600]" },
            { label: "Avg Benchmark", value: avgBenchmark > 0 ? String(avgBenchmark) : "—", sub: online.length > 0 ? "Synthetic Mandelbrot score" : "No active workers", icon: Gauge, accent: "text-[#EF8354]" },
            { label: "Avg Task Time", value: formatDuration(avgTaskTime || undefined), sub: "Across active workers", icon: Clock, accent: "text-[#EF8354]" },
            { label: "Render Throughput", value: totalThroughput > 0 ? `${totalThroughput.toLocaleString()} px/s` : "—", sub: `${totalTasksDone} tasks completed`, icon: TrendingUp, accent: "text-green-700" },
          ].map(({ label, value, sub, icon: Icon, accent }) => (
            <div key={label} className="bg-white p-5 border border-[#120B09]/5 shadow-sm rounded-sm hover:border-[#EF8354]/20 transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">{label}</p>
                  <h3 className="text-3xl font-black tracking-tighter text-[#120B09] mt-0.5">{value}</h3>
                </div>
                <div className="p-1.5 bg-[#F5F1EE] rounded-sm">
                  <Icon size={16} className={accent} />
                </div>
              </div>
              <p className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">{sub}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Gauge size={14} className="text-[#EF8354]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Benchmark Tiers</h3>
            </div>
            <div className="flex items-end gap-3 h-24">
              {tierBuckets.map((bucket) => (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-black text-[#4A3935]/60 font-[Inter,sans-serif]">{bucket.count}</span>
                  <div
                    className="w-full rounded-sm transition-all duration-500"
                    style={{
                      height: `${Math.max((bucket.count / maxBucket) * 80, bucket.count > 0 ? 8 : 0)}px`,
                      backgroundColor:
                        bucket.label === "Fast" ? "#2D6A4F" :
                        bucket.label === "Medium" ? "#EF8354" :
                        bucket.label === "Slow" ? "#BA1A1A" : "#EDE7E3",
                    }}
                  />
                  <span className="text-[8px] text-[#4A3935]/40 font-[Inter,sans-serif] text-center">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={14} className="text-[#EF8354]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Status Breakdown</h3>
            </div>
            <StatusBreakdown workers={workers} />
          </div>

          <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap size={14} className="text-[#EF8354]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Strongest Idle Candidates</h3>
            </div>
            {strongestWorkers.length === 0 ? (
              <p className="text-xs text-[#4A3935]/40 font-[Inter,sans-serif] mt-4">No active workers</p>
            ) : (
              <div className="space-y-3">
                {strongestWorkers.map((worker) => (
                  <div key={worker.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-[#120B09] truncate max-w-[100px]">{worker.name}</span>
                      <span className="text-[10px] font-black font-[Inter,sans-serif] text-[#120B09]">
                        {worker.benchmark?.normalizedScore ?? "—"}
                      </span>
                    </div>
                    <ProgressBar value={worker.benchmark?.normalizedScore ?? 0} height="sm" color="primary" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-[#120B09]/5 rounded-sm shadow-sm overflow-hidden mb-10">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-[#F5F1EE] border-b border-[#120B09]/5">
            {["Worker / Device", "Status", "Benchmark", "Busy Ratio", "Tasks", "Avg Task / Seen"].map((header, i) => (
              <div
                key={header}
                className={`text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif] ${
                  i === 0 ? "col-span-3" : i === 1 ? "col-span-2" : i === 2 ? "col-span-2" : i === 3 ? "col-span-2" : i === 4 ? "col-span-1" : "col-span-2 text-right"
                }`}
              >
                {header}
              </div>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={28} className="mx-auto text-[#4A3935]/20 mb-3" />
              <p className="text-sm font-black text-[#4A3935]/30 uppercase tracking-wide">No workers yet</p>
              <p className="text-xs text-[#4A3935]/30 mt-1 font-[Inter,sans-serif]">Share the QR code or join link to add workers</p>
              <Link href="/join" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#EF8354] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all font-[Inter,sans-serif]">
                Open Join Page
              </Link>
            </div>
          ) : (
            sorted.map((worker, i) => <WorkerRow key={worker.id} worker={worker} rank={i + 1} />)
          )}
        </section>

        {workers.length > 0 && (
          <section className="bg-white border border-[#120B09]/5 rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={14} className="text-[#EF8354]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Worker Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#120B09]/5">
                    {["Worker", "Connection", "Battery", "Throughput", "Efficiency", "Last Seen"].map((header) => (
                      <th key={header} className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif] pr-4">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {online.map((worker) => (
                    <tr key={worker.id} className="border-b border-[#120B09]/5 hover:bg-[#FAFAF8] transition-all">
                      <td className="py-2.5 pr-4">
                        <p className="font-black text-[#120B09]">{worker.name}</p>
                        <p className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">{getWorkerDeviceSummary(worker)}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-[#120B09]">{getConnectionSummary(worker)}</td>
                      <td className="py-2.5 pr-4 text-[#120B09]">{formatBattery(worker.telemetry?.battery?.level)}</td>
                      <td className="py-2.5 pr-4 text-[#120B09]">
                        {worker.metrics.renderThroughput ? `${worker.metrics.renderThroughput} px/s` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-[#120B09]">
                        {worker.metrics.taskEfficiency ? `${worker.metrics.taskEfficiency}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-[#120B09]">{formatRelativeTime(worker.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif] mt-3">
              Metrics are browser-derived telemetry plus observed Clementine work, not low-level OS utilization.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
