"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { useHostSession } from "@/hooks/useHostSession";
import { JobStatusBadge, TaskStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  ArrowLeft, CheckCircle2, Clock, RefreshCw, XCircle,
  ChevronDown, Activity, BarChart2, Zap, ListTodo, AlertTriangle, Circle, Download,
} from "lucide-react";
import type { WireJob, WireTask, JobType } from "@/lib/shared-types";
import { formatCarbonSaved, getJobCarbonSavedGrams, getTaskCarbonSavedGrams } from "@/lib/carbon-metrics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JOB_TYPE_META: Record<JobType, { label: string; color: string; bg: string }> = {
  "mock-compute": { label: "Compute", color: "text-[#EF8354]", bg: "bg-[#EF8354]" },
  "llm-analysis": { label: "LLM", color: "text-purple-700", bg: "bg-purple-500" },
  "batch-inference": { label: "Inference", color: "text-blue-700", bg: "bg-blue-500" },
  "blender-render": { label: "Render", color: "text-green-700", bg: "bg-green-500" },
  "fractal-render": { label: "Fractal", color: "text-[#6f0600]", bg: "bg-[#6f0600]" },
};

function jobProgress(job: WireJob): number {
  if (!job.tasks.length) return 0;
  return Math.round(job.tasks.filter((t) => t.status === "completed").length / job.tasks.length * 100);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function avgTaskDuration(jobs: WireJob[]): number | null {
  const durations: number[] = [];
  for (const job of jobs) {
    for (const task of job.tasks) {
      if (task.completedAt && task.startedAt) {
        durations.push(task.completedAt - task.startedAt);
      }
    }
  }
  if (!durations.length) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function successRate(jobs: WireJob[]): number {
  const allTasks = jobs.flatMap((j) => j.tasks);
  const done = allTasks.filter((t) => t.status === "completed" || t.status === "failed");
  if (!done.length) return 100;
  return Math.round(allTasks.filter((t) => t.status === "completed").length / done.length * 100);
}

// ─── Job Row with expandable subtasks ────────────────────────────────────────

function TaskIcon({ status }: { status: WireTask["status"] }) {
  if (status === "completed") return <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />;
  if (status === "running") return <RefreshCw size={13} className="text-[#EF8354] animate-spin flex-shrink-0" />;
  if (status === "assigned") return <Circle size={13} className="text-[#EF8354]/60 flex-shrink-0" />;
  if (status === "failed") return <XCircle size={13} className="text-[#BA1A1A] flex-shrink-0" />;
  return <Clock size={13} className="text-[#4A3935]/30 flex-shrink-0" />;
}

function JobCard({ job }: { job: WireJob }) {
  const [open, setOpen] = useState(job.status === "running");
  const meta = JOB_TYPE_META[job.jobType];
  const pct = jobProgress(job);
  const completedCount = job.tasks.filter((t) => t.status === "completed").length;
  const failedCount = job.tasks.filter((t) => t.status === "failed").length;
  const duration = job.completedAt && job.startedAt ? job.completedAt - job.startedAt : null;
  const carbonSaved = getJobCarbonSavedGrams(job);

  return (
    <div className={`border rounded-sm transition-all ${job.status === "running" ? "border-[#EF8354]/30" : "border-[#120B09]/5"} bg-white`}>
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-[#FAFAF8] transition-all rounded-sm"
      >
        {/* Job type chip */}
        <span className={`mt-0.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm font-[Inter,sans-serif] flex-shrink-0 ${meta.color} bg-current/10`} style={{ backgroundColor: meta.bg + "18" }}>
          {meta.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-sm text-[#120B09] tracking-tight leading-tight">{job.title}</span>
            <JobStatusBadge status={
              job.status === "decomposing" || job.status === "reducing" ? "running" :
              job.status === "running" ? "running" :
              job.status === "completed" ? "completed" :
              job.status === "failed" ? "failed" : "queued"
            } />
          </div>
          <p className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif] truncate italic mb-2">
            &ldquo;{job.rawPrompt}&rdquo;
          </p>
          {job.tasks.length > 0 && (
            <div className="flex items-center gap-3">
              <ProgressBar value={pct} height="sm" />
              <span className="text-[10px] font-black text-[#EF8354] font-[Inter,sans-serif] flex-shrink-0">{pct}%</span>
            </div>
          )}
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif]">
              {completedCount}/{job.tasks.length} tasks
            </span>
            <span className="text-[9px] text-green-700 font-black font-[Inter,sans-serif]">
              {formatCarbonSaved(carbonSaved)} saved
            </span>
            {failedCount > 0 && (
              <span className="text-[9px] text-[#BA1A1A] font-black font-[Inter,sans-serif]">{failedCount} failed</span>
            )}
            {duration && (
              <span className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif]">⏱ {formatDuration(duration)}</span>
            )}
          </div>
        </div>

        <ChevronDown size={14} className={`flex-shrink-0 text-[#4A3935]/30 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Subtask list */}
      {open && job.tasks.length > 0 && (
        <div className="border-t border-[#120B09]/5">
          <div className="grid grid-cols-12 gap-3 px-5 py-2 bg-[#F5F1EE]">
            {["Subtask", "Status", "Worker", "Carbon", "Duration"].map((h, i) => (
              <p key={h} className={`text-[8px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif] ${i === 0 ? "col-span-4" : i === 1 ? "col-span-2" : i === 2 ? "col-span-2" : i === 3 ? "col-span-2" : "col-span-2"}`}>{h}</p>
            ))}
          </div>
          {job.tasks.map((task) => {
            const dur = task.completedAt && task.startedAt ? task.completedAt - task.startedAt : null;
            const taskCarbonSaved = getTaskCarbonSavedGrams(task);
            return (
              <div key={task.id} className="grid grid-cols-12 gap-3 items-center px-5 py-2.5 border-t border-[#120B09]/5 hover:bg-[#FAFAF8] transition-all">
                <div className="col-span-4 flex items-center gap-2">
                  <TaskIcon status={task.status} />
                  <span className="text-xs font-medium text-[#120B09] truncate">{task.title}</span>
                </div>
                <div className="col-span-2">
                  <TaskStatusBadge status={task.status} />
                </div>
                <div className="col-span-2">
                  {task.completedByWorkerName ? (
                    <span className="text-[9px] font-black text-green-700 font-[Inter,sans-serif]">
                      {task.completedByWorkerName}
                    </span>
                  ) : task.assignedWorkerId ? (
                    <span className="text-[9px] font-black text-[#EF8354] font-[Inter,sans-serif] uppercase">
                      assigned
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif]">—</span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className={`text-[9px] font-black font-[Inter,sans-serif] ${taskCarbonSaved >= 0 ? "text-green-700" : "text-[#BA1A1A]"}`}>
                    {formatCarbonSaved(taskCarbonSaved)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[9px] text-[#4A3935]/50 font-[Inter,sans-serif]">
                    {dur ? formatDuration(dur) : task.status === "running" ? "…" : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Result panel for completed jobs */}
      {job.status === "completed" && job.result && (
        <div className="border-t border-[#120B09]/5 px-5 py-4 bg-[#FAFAF8]">
          <p className="text-[9px] font-black uppercase tracking-widest text-green-700 font-[Inter,sans-serif] mb-1">Result</p>
          <p className="text-xs font-medium text-[#4A3935]">{job.result.summary}</p>
          <p className="text-[10px] font-black text-green-700 font-[Inter,sans-serif] mt-2">
            Net carbon saved: {formatCarbonSaved(
              typeof job.result.metrics.netCarbonSavedGrams === "number"
                ? job.result.metrics.netCarbonSavedGrams
                : carbonSaved
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { jobs, submitJob, isConnected, session } = useHostSession();
  const [command, setCommand] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "queued">("all");
  const [isDumping, setIsDumping] = useState(false);

  const allTasks = useMemo(() => jobs.flatMap((j) => j.tasks), [jobs]);
  const completedJobs = useMemo(() => jobs.filter((j) => j.status === "completed"), [jobs]);
  const runningJobs = useMemo(() => jobs.filter((j) => j.status === "running" || j.status === "decomposing" || j.status === "reducing"), [jobs]);
  const avgDur = useMemo(() => avgTaskDuration(jobs), [jobs]);
  const sr = useMemo(() => successRate(jobs), [jobs]);
  const totalCarbonSaved = useMemo(
    () => jobs.reduce((sum, job) => sum + getJobCarbonSavedGrams(job), 0),
    [jobs]
  );

  // Job type distribution
  const typeDistribution = useMemo(() => {
    const counts: Partial<Record<JobType, number>> = {};
    for (const j of jobs) counts[j.jobType] = (counts[j.jobType] ?? 0) + 1;
    return Object.entries(counts) as [JobType, number][];
  }, [jobs]);

  const maxTypeCount = Math.max(...typeDistribution.map(([, c]) => c), 1);

  // Filtered jobs
  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "running") return jobs.filter((j) => j.status === "running" || j.status === "decomposing" || j.status === "reducing");
    if (filter === "completed") return jobs.filter((j) => j.status === "completed");
    return jobs.filter((j) => j.status === "queued");
  }, [jobs, filter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    submitJob(command);
    setCommand("");
  };

  const handleDumpSession = async () => {
    if (!session?.code || isDumping) return;
    setIsDumping(true);

    try {
      const response = await fetch(`/api/session-dump/${session.code}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to export session dump");
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${session.code}-mongo-dump.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[tasks] session dump failed", error);
    } finally {
      setIsDumping(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="md:ml-64 flex-1 p-6 md:p-10 lg:p-14">
        {/* Header */}
        <header className="mb-10">
          <Link href="/host" className="inline-flex items-center gap-2 text-[#4A3935]/50 hover:text-[#EF8354] transition-colors mb-5 font-[Inter,sans-serif] text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={13} />
            Dashboard
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif] block mb-2">Workload Orchestration</span>
              <h1 className="text-5xl font-black text-[#120B09] tracking-tighter uppercase">Task Queue</h1>
              <p className="text-[#4A3950]/50 text-xs font-bold uppercase tracking-widest mt-2 font-[Inter,sans-serif]">
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} · {allTasks.length} subtasks
              </p>
              <p className="text-green-700 text-xs font-bold uppercase tracking-widest mt-1 font-[Inter,sans-serif]">
                Net carbon saved: {formatCarbonSaved(totalCarbonSaved)}
              </p>
            </div>
            <button
              onClick={handleDumpSession}
              disabled={!session?.code || isDumping}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#120B09]/8 text-[#120B09] font-black text-[10px] uppercase tracking-widest rounded-sm hover:border-[#EF8354]/30 hover:text-[#EF8354] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-[Inter,sans-serif]"
            >
              <Download size={12} />
              {isDumping ? "Exporting…" : "Dump Session DB"}
            </button>
          </div>
        </header>

        {/* Quick submit */}
        <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Hey Clementine, run a new job…"
            className="flex-1 bg-white border border-[#120B09]/8 rounded-sm px-4 py-3 text-sm text-[#120B09] placeholder-[#120B09]/25 focus:outline-none focus:border-[#EF8354]/50 font-medium"
          />
          <button
            type="submit"
            disabled={!command.trim() || !isConnected}
            className="px-6 py-3 bg-[#EF8354] text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 font-[Inter,sans-serif]"
          >
            <Zap size={12} />
            Dispatch
          </button>
        </form>

        {/* Stat cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Jobs", value: String(jobs.length), sub: `${allTasks.length} subtasks total`, icon: ListTodo, accent: "text-[#6f0600]" },
            { label: "Running Now", value: String(runningJobs.length), sub: `${allTasks.filter(t => t.status === "running").length} tasks active`, icon: Activity, accent: "text-[#EF8354]" },
            { label: "Avg Task Time", value: avgDur ? formatDuration(avgDur) : "—", sub: "Per subtask completion", icon: Clock, accent: "text-[#EF8354]" },
            { label: "Success Rate", value: `${sr}%`, sub: `${completedJobs.length} jobs completed`, icon: CheckCircle2, accent: sr >= 95 ? "text-green-700" : sr >= 80 ? "text-amber-600" : "text-[#BA1A1A]" },
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

        {/* Analytics row */}
        {jobs.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Job type distribution */}
            <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={14} className="text-[#EF8354]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Job Type Mix</h3>
              </div>
              {typeDistribution.length === 0 ? (
                <p className="text-xs text-[#4A3935]/30 font-[Inter,sans-serif]">No jobs yet</p>
              ) : (
                <div className="space-y-3">
                  {typeDistribution.map(([type, count]) => {
                    const meta = JOB_TYPE_META[type];
                    return (
                      <div key={type}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif] ${meta.color}`}>{meta.label}</span>
                          <span className="text-[10px] font-black text-[#120B09] font-[Inter,sans-serif]">{count}</span>
                        </div>
                        <div className="h-1.5 bg-[#EDE7E3] rounded-full overflow-hidden">
                          <div className={`h-full ${meta.bg} rounded-full transition-all duration-500`} style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Task status breakdown */}
            <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={14} className="text-[#EF8354]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Task Status Totals</h3>
              </div>
              {(["completed", "running", "assigned", "queued", "failed"] as const).map((s) => {
                const count = allTasks.filter((t) => t.status === s).length;
                const pct = allTasks.length ? Math.round((count / allTasks.length) * 100) : 0;
                const colors: Record<string, string> = {
                  completed: "bg-green-500", running: "bg-[#EF8354]",
                  assigned: "bg-[#EF8354]/60", queued: "bg-[#EDE7E3]", failed: "bg-[#BA1A1A]",
                };
                return (
                  <div key={s} className="flex items-center gap-3 mb-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[s]}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/60 font-[Inter,sans-serif] w-20">{s}</span>
                    <div className="flex-1 h-1.5 bg-[#EDE7E3] rounded-full overflow-hidden">
                      <div className={`h-full ${colors[s]} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-[#120B09] font-[Inter,sans-serif] w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Quick metrics */}
            <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Zap size={14} className="text-[#EF8354]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#120B09]">Session Metrics</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Avg subtasks / job", value: jobs.length ? (allTasks.length / jobs.length).toFixed(1) : "—" },
                  { label: "Tasks per worker", value: "—" },
                  { label: "Peak concurrent", value: String(Math.min(allTasks.filter(t => t.status !== "queued").length, allTasks.length)) },
                  { label: "Failed tasks", value: String(allTasks.filter(t => t.status === "failed").length) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-[#120B09]/5 last:border-0">
                    <span className="text-[10px] text-[#4A3935]/60 font-[Inter,sans-serif] font-bold">{label}</span>
                    <span className="text-sm font-black text-[#120B09]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Filter tabs + job list */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              {(["all", "running", "completed", "queued"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif] transition-all ${
                    filter === f
                      ? "bg-[#EF8354] text-white"
                      : "bg-white border border-[#120B09]/8 text-[#4A3935]/60 hover:border-[#EF8354]/30"
                  }`}
                >
                  {f}
                  {f !== "all" && (
                    <span className="ml-1.5 opacity-70">
                      {f === "running" ? runningJobs.length :
                       f === "completed" ? completedJobs.length :
                       jobs.filter(j => j.status === "queued").length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">
              {filtered.length} job{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 border-2 border-dashed border-[#120B09]/8 rounded-sm text-center">
              {jobs.length === 0 ? (
                <>
                  <AlertTriangle size={24} className="mx-auto text-[#4A3935]/20 mb-3" />
                  <p className="text-sm font-black text-[#4A3935]/30 uppercase tracking-wide">No jobs yet</p>
                  <p className="text-xs text-[#4A3935]/30 mt-1 font-[Inter,sans-serif]">Submit a job above to get started</p>
                </>
              ) : (
                <p className="text-sm font-black text-[#4A3935]/30 uppercase tracking-wide">No {filter} jobs</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
