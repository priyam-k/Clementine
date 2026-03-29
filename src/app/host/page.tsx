"use client";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { QRCard } from "@/components/host/QRCard";
import { CommandDispatchCard } from "@/components/host/CommandDispatchCard";
import { WorkerGrid } from "@/components/host/WorkerGrid";
import { TaskQueuePanel } from "@/components/host/TaskQueuePanel";
import { ProgressSummaryCard } from "@/components/host/ProgressSummaryCard";
import { ResultPanel } from "@/components/host/ResultPanel";
import { CommandHistory } from "@/components/host/CommandHistory";
import { FractalCanvas } from "@/components/host/FractalCanvas";
import { GlobalMetricsPanel } from "@/components/host/GlobalMetricsPanel";
import { useHostSession } from "@/hooks/useHostSession";
import type { Job, Session, CommandEntry } from "@/lib/types";
import type { WireJob, WireSession, FractalJobConfig } from "@/lib/shared-types";
import { WifiOff, Loader2, Layers, Rocket, ChevronDown, ChevronUp } from "lucide-react";
import { getJobCarbonSavedGrams } from "@/lib/carbon-metrics";
import {
  buildEnterpriseBenchmarkCommand,
  getEnterpriseBenchmarkConfig,
  getEnterpriseDifficultyLabel,
} from "@/lib/enterprise-benchmark";

// Build fractal config from a difficulty value (1-100, log-linear scale)
// Difficulty 1  → 600×400 px, 128 iter  ≈ 5–15 s  (1 worker)
// Difficulty 50 → 1800×1200 px, 724 iter ≈ 60–180 s
// Difficulty 100 → 3600×2400 px, 4096 iter ≈ 300–600 s
function buildFractalConfig(difficulty: number): FractalJobConfig {
  const t = (difficulty - 1) / 99; // 0→1
  const width = Math.round(600 + t * 3000);               // 600 → 3600
  const height = Math.round((600 + t * 3000) * (2 / 3));  // 400 → 2400
  const maxIterations = Math.round(160 * Math.pow(40, t)); // 160 → 6400
  return {
    fractalType: "mandelbrot",
    width,
    height,
    maxIterations,
    xMin: -2.5,
    xMax: 1.0,
    yMin: -1.25,
    yMax: 1.25,
    tileSize: 160,
  };
}

// ─── Wire → component type adapters ──────────────────────────────────────────

function wireJobToComp(j: WireJob & { progress?: number }): Job {
  const totalSubtasks = j.totalTasks;
  const completedSubtasks = j.completedTasks;
  const failedSubtasks = j.failedTasks;
  const runningProgress =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Map job status to the extended set components understand
  const statusMap: Record<string, Job["status"]> = {
    queued: "queued",
    decomposing: "queued",
    running: "running",
    reducing: "running",
    completed: "completed",
    failed: "failed",
  };

  return {
    id: j.id,
    name: j.title,
    description: j.rawPrompt,
    command: j.rawPrompt,
    status: (statusMap[j.status] as Job["status"]) ?? "queued",
    progress: runningProgress,
    totalSubtasks,
    completedSubtasks,
    failedSubtasks,
    createdAt: new Date(j.createdAt).toISOString(),
    startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : undefined,
    completedAt: j.completedAt ? new Date(j.completedAt).toISOString() : undefined,
    estimatedCarbonSavedGrams: getJobCarbonSavedGrams(j),
    artifacts: j.artifacts,
    subtasks: j.tasks.map((t) => ({
      id: t.id,
      label: t.title,
      status: t.status,
      assignedTo: t.assignedWorkerId,
      progress: t.progress,
      startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : undefined,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
    })),
    workerContributions: j.workerContributions,
    result: j.result
      ? {
          summary: j.result.summary,
          outputLines: j.result.outputLines,
          durationMs: j.result.durationMs,
          workerCount: j.result.workerCount,
          dataProcessed: j.result.dataProcessed,
          estimatedCarbonSavedGrams:
            typeof j.result.metrics.netCarbonSavedGrams === "number"
              ? j.result.metrics.netCarbonSavedGrams
              : getJobCarbonSavedGrams(j),
        }
      : undefined,
  };
}

function wireSessionToComp(s: WireSession, workerCount: number): Session {
  return {
    id: "session",
    hostName: s.hostName,
    joinCode: s.code,
    joinUrl: s.joinUrl,
    startedAt: new Date(s.startedAt).toISOString(),
    workerCount,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HostPage() {
  const {
    isConnected,
    session,
    workers,
    jobs,
    fractalTiles,
    submitJob,
    submitFractalJob,
    submitEnterpriseBenchmark,
    schedulerBias,
    setSchedulerBias,
    reconnect,
  } =
    useHostSession();

  const [difficulty, setDifficulty] = useState(40);
  const [showFractalResults, setShowFractalResults] = useState(true);
  const [showEnterpriseResults, setShowEnterpriseResults] = useState(true);
  const fractalConfig = useMemo(() => buildFractalConfig(difficulty), [difficulty]);
  const enterpriseBenchmarkConfig = useMemo(
    () => getEnterpriseBenchmarkConfig(difficulty),
    [difficulty]
  );
  const enterpriseBenchmarkCommand = useMemo(
    () => buildEnterpriseBenchmarkCommand(enterpriseBenchmarkConfig),
    [enterpriseBenchmarkConfig]
  );

  // Adapt wire types to component prop shapes
  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt - a.createdAt),
    [jobs]
  );
  const compJobs = useMemo(() => sortedJobs.map(wireJobToComp), [sortedJobs]);
  const compSession = useMemo(
    () =>
      session
        ? wireSessionToComp(session, workers.filter((w) => w.status !== "offline").length)
        : ({
            id: "pending",
            hostName: "Connecting...",
            joinCode: "—",
            joinUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/join`,
            startedAt: new Date().toISOString(),
            workerCount: 0,
          } as Session),
    [session, workers]
  );

  // Derive stat card data from live state
  const activeWorkers = workers.filter((w) => w.status !== "offline");
  const workersWithCarbon = activeWorkers.filter((worker) => typeof worker.carbonIntensity === "number");
  const averageCarbonIntensity = useMemo(
    () =>
      workersWithCarbon.length > 0
        ? Math.round(
            workersWithCarbon.reduce((sum, worker) => sum + (worker.carbonIntensity ?? 0), 0) /
              workersWithCarbon.length
          )
        : null,
    [workersWithCarbon]
  );
  const cleanestWorker = useMemo(
    () =>
      workersWithCarbon.length > 0
        ? [...workersWithCarbon].sort(
            (a, b) => (a.carbonIntensity ?? Number.POSITIVE_INFINITY) - (b.carbonIntensity ?? Number.POSITIVE_INFINITY)
          )[0]
        : null,
    [workersWithCarbon]
  );
  const fastestWorker = useMemo(
    () =>
      activeWorkers
        .filter((worker) => typeof worker.benchmark?.normalizedScore === "number")
        .sort(
          (a, b) => (b.benchmark?.normalizedScore ?? 0) - (a.benchmark?.normalizedScore ?? 0)
        )[0] ?? null,
    [activeWorkers]
  );
  const runningJobs = compJobs.filter((j) => j.status === "running");
  const activeJob =
    runningJobs.filter((j) => j.id !== jobs.find((j2) => j2.jobType === "fractal-render")?.id)[0] ??
    null;
  const latestEnterpriseJob =
    compJobs.find(
      (j) =>
        j.status === "completed" &&
        jobs.find((j2) => j2.id === j.id)?.jobType === "enterprise-analysis"
    ) ?? null;
  const lastCompletedJob =
    compJobs.find(
      (j) =>
        j.status === "completed" &&
        jobs.find((j2) => j2.id === j.id)?.jobType !== "fractal-render" &&
        jobs.find((j2) => j2.id === j.id)?.jobType !== "enterprise-analysis"
    ) ?? null;

  // Active fractal job (most recent fractal-render, running or completed)
  const fractalJob = useMemo(
    () => sortedJobs.find((j) => j.jobType === "fractal-render" && (j.status !== "queued")) ?? null,
    [sortedJobs]
  );
  const isFractalRunning = fractalJob?.status === "running" || fractalJob?.status === "decomposing" || fractalJob?.status === "reducing";

  // Build command history from jobs
  const commandHistory: CommandEntry[] = useMemo(
    () =>
      sortedJobs.map((j) => ({
        id: j.id,
        text: j.rawPrompt,
        timestamp: new Date(j.createdAt).toISOString(),
        status:
          j.status === "completed"
            ? "completed"
            : j.status === "failed"
            ? "failed"
            : j.status === "queued" || j.status === "decomposing"
            ? "pending"
            : "dispatched",
        jobId: j.id,
      })),
    [sortedJobs]
  );

  const workerCountLabel = `${activeWorkers.length}/${workers.length || 0}`;
  const taskCountLabel = `${runningJobs.length}/${jobs.length || 0}`;
  // Green score: rewards eco-leaning bias. Uses a gentle power curve so small eco
  // commitments feel meaningful. Minimum 10 just for participating.
  // Formula is frontend-only and does not affect scheduling.
  const greenScore = Math.round(10 + 90 * Math.pow(1 - schedulerBias, 0.7));

  return (
    <div className="flex min-h-screen">
      <Sidebar workerCountLabel={workerCountLabel} taskCountLabel={taskCountLabel} greenScore={greenScore} />

      <main className="md:ml-64 flex-1 p-6 md:p-10 lg:p-14 max-w-[1400px]">
        {/* Page header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif] block mb-2">
              Orchard Overview
            </span>
            <h1 className="text-5xl md:text-6xl font-black text-[#120B09] tracking-tighter uppercase leading-none">
              Host Dashboard
            </h1>
            <p className="text-[#4A3935]/60 font-bold mt-2 text-xs uppercase tracking-widest font-[Inter,sans-serif]">
              Status:{" "}
              <span
                className={
                  !isConnected
                    ? "text-[#4A3935]/40"
                    : runningJobs.length > 0
                    ? "text-[#EF8354]"
                    : "text-green-700"
                }
              >
                {!isConnected ? "Off Network" : runningJobs.length > 0 ? "Busy" : "Online"}
              </span>
              {session && ` • Session ${session.code}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Worker avatars */}
            {activeWorkers.length > 0 && (
              <div className="flex -space-x-2">
                {activeWorkers.slice(0, 4).map((w) => (
                  <div
                    key={w.id}
                    className="w-9 h-9 rounded-full border-2 border-[#FCFAF8] bg-[#EDE7E3] flex items-center justify-center text-xs font-black text-[#4A3935]"
                    title={w.name}
                  >
                    {w.name[0]}
                  </div>
                ))}
                {activeWorkers.length > 4 && (
                  <div className="w-9 h-9 rounded-full bg-[#EF8354]/10 border-2 border-[#FCFAF8] flex items-center justify-center text-[10px] font-black text-[#EF8354]">
                    +{activeWorkers.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Connection badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-full shadow-sm cursor-pointer ${
                isConnected
                  ? "bg-white border-[#120B09]/5"
                  : "bg-[#F5F1EE] border-[#120B09]/5"
              }`}
              onClick={!isConnected ? reconnect : undefined}
              title={!isConnected ? "Click to reconnect" : undefined}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#EF8354] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#EF8354] font-[Inter,sans-serif]">
                    Live
                  </span>
                </>
              ) : (
                <>
                  <WifiOff size={12} className="text-[#4A3935]/40" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
                    Offline
                  </span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Connecting banner */}
        {!isConnected && (
          <div className="mb-8 flex items-center gap-3 p-4 bg-[#F5F1EE] border border-[#EDE7E3] rounded-sm">
            <Loader2 size={14} className="text-[#EF8354] animate-spin flex-shrink-0" />
            <p className="text-xs font-medium text-[#4A3935]">
              Connecting to Clementine orchestration server…{" "}
              <button onClick={reconnect} className="font-black text-[#EF8354] hover:underline">
                Retry
              </button>
            </p>
          </div>
        )}

        {/* Global metrics graphs */}
        {workers.length > 0 && (
          <section className="mb-8">
            <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-5 md:p-6 hover:border-[#EF8354]/20 transition-all">
              <div className="mb-4">

                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/45 font-[Inter,sans-serif]">
                  Fleet Telemetry
                </p>
                
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#120B09]">
                  Global Metrics
                </h2>
              </div>
              <GlobalMetricsPanel workers={workers} jobs={jobs} schedulerBias={schedulerBias} />
            </div>
          </section>
        )}

        {/* Row 1: Command Dispatch + Schedule Invite */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="md:col-span-2">
            <CommandDispatchCard onSubmit={submitJob} />
          </div>
          <QRCard session={compSession} />
        </section>

        {/* Row 2: Scheduler Bias + Benchmark Network */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-10">
          <div className="xl:col-span-3 bg-white p-6 border border-[#120B09]/5 shadow-sm rounded-sm hover:border-[#EF8354]/20 transition-all">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
                  Scheduler Bias
                </p>
                <h3 className="text-3xl font-black tracking-tighter text-[#120B09] mt-1">
                  Choose Clean Energy vs Raw Speed
                </h3>
                <p className="text-sm text-[#4A3935]/55 max-w-2xl mt-2">
                  Shift Clementine toward lower-carbon workers or push harder toward the fastest available browsers. This directly changes how new work is assigned.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
                  Current Bias
                </p>
                <p className="text-4xl font-black tracking-tighter text-[#EF8354]">
                  {Math.round(schedulerBias * 100)}%
                </p>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(schedulerBias * 100)}
              onChange={(e) => setSchedulerBias(Number(e.target.value) / 100)}
              className="w-full h-3 accent-[#6f0600] cursor-pointer"
            />
            <div className="flex items-center justify-between mt-3 text-[11px] font-black uppercase tracking-widest font-[Inter,sans-serif]">
              <span className="text-green-700">Emissions Efficient</span>
              <span className="text-[#4A3935]/35">Balanced</span>
              <span className="text-[#6f0600]">Best Performance</span>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-sm bg-[#F8F5F2] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
                  Session Grid Avg
                </p>
                <p className="mt-1 text-2xl font-black tracking-tighter text-[#120B09]">
                  {averageCarbonIntensity !== null ? `${averageCarbonIntensity}` : "—"}
                </p>
                <p className="text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif]">
                  {averageCarbonIntensity !== null ? "gCO2e/kWh across active workers" : "Awaiting carbon-aware workers"}
                </p>
              </div>
              <div className="rounded-sm bg-[#F8F5F2] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
                  Cleanest Worker
                </p>
                <p className="mt-1 text-lg font-black tracking-tight text-[#120B09]">
                  {cleanestWorker?.name ?? "—"}
                </p>
                <p className="text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif]">
                  {cleanestWorker?.carbonIntensity !== undefined
                    ? `${Math.round(cleanestWorker.carbonIntensity)} gCO2e/kWh`
                    : "No carbon readings yet"}
                </p>
              </div>
              <div className="rounded-sm bg-[#F8F5F2] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
                  Fastest Worker
                </p>
                <p className="mt-1 text-lg font-black tracking-tight text-[#120B09]">
                  {fastestWorker?.name ?? "—"}
                </p>
                <p className="text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif]">
                  {fastestWorker?.benchmark?.normalizedScore !== undefined
                    ? `Benchmark ${Math.round(fastestWorker.benchmark.normalizedScore)}`
                    : "No benchmark scores yet"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-sm border border-[#120B09]/8 bg-[#120B09] px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/35 font-[Inter,sans-serif]">
                Live Routing Bias
              </p>
              <p className="mt-1 text-sm font-medium text-white/80">
                {schedulerBias <= 0.33
                  ? "New work is leaning toward cleaner workers whenever possible, while still using the active benchmark network."
                  : schedulerBias >= 0.67
                  ? "New work is leaning toward the fastest benchmarked workers, even when cleaner nodes are available."
                  : "New work is balancing cleaner routing with stronger benchmarked workers."}
              </p>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white p-4 border border-[#120B09]/5 shadow-sm rounded-sm hover:border-[#EF8354]/20 transition-all self-start">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
                  Benchmark Network
                </p>
                <h3 className="text-xl font-black tracking-tighter text-[#120B09] mt-0.5">
                  Shared Difficulty
                </h3>
                <p className="text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif] mt-1">
                  Scale fractal and enterprise runs with one control.
                </p>
              </div>
              <div className="p-2 bg-[#F5F1EE] rounded-sm">
                <Rocket size={18} className="text-[#6f0600]" />
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
                Difficulty
              </span>
              <span className="text-sm font-black text-[#EF8354] font-[Inter,sans-serif]">
                {difficulty}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              disabled={isFractalRunning}
              className="w-full h-2 accent-[#EF8354] cursor-pointer disabled:opacity-40"
            />
            <div className="flex items-center justify-between mt-2 text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">
              <span>{fractalConfig.width}×{fractalConfig.height}</span>
              <span>{enterpriseBenchmarkConfig.vendorCount} vendors</span>
              <span>{fractalConfig.maxIterations} iterations</span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={() => submitFractalJob(fractalConfig)}
                disabled={!isConnected || isFractalRunning}
                className="w-full px-4 py-2.5 bg-[#6f0600] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-[#EF8354] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-[Inter,sans-serif]"
                title={isFractalRunning ? "Fractal render in progress…" : "Launch distributed fractal render"}
              >
                {isFractalRunning ? "Fractal Running…" : "Launch Fractal"}
              </button>

              <button
                onClick={() =>
                  submitEnterpriseBenchmark(
                    enterpriseBenchmarkCommand,
                    enterpriseBenchmarkConfig
                  )
                }
                disabled={!isConnected}
                className="w-full px-4 py-2.5 bg-[#120B09] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-[#2a1b17] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-[Inter,sans-serif]"
              >
                Launch Enterprise
              </button>
            </div>

            <div className="mt-3 rounded-sm border border-[#120B09]/8 bg-[#F8F5F2] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/45 font-[Inter,sans-serif]">
                  Enterprise Scope
                </p>
                <p className="text-lg font-black tracking-tighter text-[#6f0600]">
                  {enterpriseBenchmarkConfig.vendorCount}
                </p>
              </div>
              <p className="text-[10px] text-[#4A3935]/55 mt-1">
                {getEnterpriseDifficultyLabel(enterpriseBenchmarkConfig)} depth across the benchmark network.
              </p>
            </div>
          </div>
        </section>

        {/* Progress + Result */}
        {(activeJob || lastCompletedJob) && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
            <div className="space-y-4">
              {activeJob && <ProgressSummaryCard job={activeJob} />}
              {fractalJob && (
                <div className="border border-[#120B09]/5 bg-white rounded-sm shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowFractalResults((current) => !current)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#FAFAF8] transition-all"
                  >
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/45 font-[Inter,sans-serif]">
                        Fractal Results
                      </p>
                      <h3 className="text-lg font-black tracking-tight text-[#120B09]">
                        {fractalJob.title}
                      </h3>
                    </div>
                    {showFractalResults ? (
                      <ChevronUp size={16} className="text-[#6f0600]" />
                    ) : (
                      <ChevronDown size={16} className="text-[#6f0600]" />
                    )}
                  </button>
                  {showFractalResults && (
                    <div className="px-5 pb-5">
                      <FractalCanvas key={fractalJob.id} job={fractalJob} tiles={fractalTiles} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {lastCompletedJob && <ResultPanel job={lastCompletedJob} />}
          </section>
        )}

        {!activeJob && fractalJob && (
          <section className="mb-10">
            <div className="border border-[#120B09]/5 bg-white rounded-sm shadow-sm overflow-hidden">
              <button
                onClick={() => setShowFractalResults((current) => !current)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#FAFAF8] transition-all"
              >
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/45 font-[Inter,sans-serif]">
                    Fractal Results
                  </p>
                  <h3 className="text-lg font-black tracking-tight text-[#120B09]">
                    {fractalJob.title}
                  </h3>
                </div>
                {showFractalResults ? (
                  <ChevronUp size={16} className="text-[#6f0600]" />
                ) : (
                  <ChevronDown size={16} className="text-[#6f0600]" />
                )}
              </button>
              {showFractalResults && (
                <div className="px-5 pb-5">
                  <FractalCanvas key={fractalJob.id} job={fractalJob} tiles={fractalTiles} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Enterprise result */}
        {latestEnterpriseJob && (
          <section className="mb-10">
            <div className="border border-[#120B09]/5 bg-white rounded-sm shadow-sm overflow-hidden">
              <button
                onClick={() => setShowEnterpriseResults((current) => !current)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#FAFAF8] transition-all"
              >
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/45 font-[Inter,sans-serif]">
                    Enterprise Vendor Results
                  </p>
                  <h3 className="text-lg font-black tracking-tight text-[#120B09]">
                    {latestEnterpriseJob.name}
                  </h3>
                </div>
                {showEnterpriseResults ? (
                  <ChevronUp size={16} className="text-[#6f0600]" />
                ) : (
                  <ChevronDown size={16} className="text-[#6f0600]" />
                )}
              </button>
              {showEnterpriseResults && (
                <div className="px-5 pb-5">
                  <ResultPanel job={latestEnterpriseJob} wide />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Worker grid */}
        <section className="mb-10">
          <WorkerGrid workers={workers} joinUrl={session?.joinUrl} session={compSession} />
        </section>

        {/* Task queue + Command history */}
        {(compJobs.length > 0 || commandHistory.length > 0) && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
            <div className="lg:col-span-2">
              <TaskQueuePanel jobs={compJobs} />
            </div>
            <div>
              <CommandHistory commands={commandHistory} />
            </div>
          </section>
        )}

        {/* Empty state */}
        {isConnected && compJobs.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-[#120B09]/8 rounded-sm">
            <p className="text-3xl font-black text-[#120B09]/20 uppercase tracking-tighter mb-2">
              Ready to harvest
            </p>
            <p className="text-sm text-[#4A3935]/40 font-medium mb-6">
              Submit a job above or start with a distributed fractal render.
            </p>
            <button
              onClick={() => submitFractalJob(fractalConfig)}
              disabled={!isConnected || activeWorkers.length === 0}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#6f0600] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-[#EF8354] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-[Inter,sans-serif]"
            >
              <Layers size={13} />
              {activeWorkers.length === 0 ? "Connect a worker first" : "Launch Fractal Render"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
