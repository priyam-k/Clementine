"use client";
import Link from "next/link";
import { ArrowRight, RefreshCw, Circle, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Job, SubTask } from "@/lib/types";
import { JobStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatRelativeTime } from "@/lib/mock-data";
import { useState } from "react";
import { formatCarbonSaved } from "@/lib/carbon-metrics";

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

interface TaskQueuePanelProps {
  jobs: Job[];
}

function SubTaskRow({ task }: { task: SubTask }) {
  const iconMap = {
    completed: <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />,
    running: <RefreshCw size={13} className="text-[#EF8354] animate-spin flex-shrink-0" />,
    assigned: <Circle size={13} className="text-[#EF8354] flex-shrink-0" />,
    queued: <Clock size={13} className="text-[#4A3935]/30 flex-shrink-0" />,
    failed: <XCircle size={13} className="text-[#BA1A1A] flex-shrink-0" />,
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-sm hover:bg-[#F5F1EE] transition-all group">
      {iconMap[task.status]}
      <span className="text-xs font-medium text-[#120B09] flex-1 truncate">{task.label}</span>
      {task.status === "running" && (
        <span className="text-[10px] font-black text-[#EF8354] font-[Inter,sans-serif]">{task.progress}%</span>
      )}
      {task.assignedTo && task.status !== "queued" && (
        <span className="text-[9px] font-bold text-[#4A3935]/40 uppercase tracking-wider font-[Inter,sans-serif] hidden group-hover:inline">
          → wkr
        </span>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(job.status === "running");
  const contributions = job.workerContributions ?? [];

  return (
    <div className={`border rounded-sm transition-all ${job.status === "running" ? "border-[#EF8354]/30 bg-white" : "border-[#120B09]/5 bg-white"}`}>
      {/* Job header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-[#FAFAF8] transition-all rounded-sm"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="font-black text-sm text-[#120B09] tracking-tight">{job.name}</span>
            <JobStatusBadge status={job.status} />
          </div>
          {job.status === "running" && (
            <ProgressBar value={job.progress} animated height="sm" />
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] text-[#4A3935]/50 font-[Inter,sans-serif]">
              {job.completedSubtasks}/{job.totalSubtasks} subtasks
            </span>
            <span className="text-[10px] text-green-700 font-[Inter,sans-serif]">
              {formatCarbonSaved(job.estimatedCarbonSavedGrams ?? 0)} saved
            </span>
            {job.startedAt && (
              <span className="text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">
                {formatRelativeTime(job.startedAt)}
              </span>
            )}
            {job.status === "running" && (
              <span className="text-[10px] font-black text-[#EF8354] font-[Inter,sans-serif]">
                {job.progress}%
              </span>
            )}
          </div>
        </div>
        <ArrowRight
          size={14}
          className={`flex-shrink-0 text-[#4A3935]/30 mt-1 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Subtasks */}
      {expanded && (
        <div className="border-t border-[#120B09]/5 px-3 pb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#4A3935]/40 font-[Inter,sans-serif] px-3 pt-3 pb-1">
            Node Contribution
          </p>
          {contributions.length > 0 ? (
            contributions.map((entry) => (
              <div key={entry.workerId} className="flex items-center gap-3 py-2 px-3 rounded-sm hover:bg-[#F5F1EE] transition-all">
                <div className="w-8 h-8 rounded-full bg-[#F5F1EE] flex items-center justify-center text-[10px] font-black text-[#6f0600]">
                  {entry.workerName[0] ?? "W"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-[#120B09] truncate">{entry.workerName}</p>
                  <p className="text-[10px] text-[#4A3935]/45 font-[Inter,sans-serif]">
                    {entry.tasksCompleted} tasks · {formatDuration(entry.totalDurationMs)} compute · {formatCarbonSaved(entry.carbonSavedGrams)} saved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#EF8354] font-[Inter,sans-serif]">
                    {entry.pixelsRendered > 0 ? `${Math.round(entry.pixelsRendered / 1000)}k px` : `${entry.opsCount.toLocaleString()} ops`}
                  </p>
                </div>
              </div>
            ))
          ) : job.subtasks.length > 0 ? (
            job.subtasks.map((t) => <SubTaskRow key={t.id} task={t} />)
          ) : (
            <div className="px-3 py-3 text-[10px] text-[#4A3935]/40 font-[Inter,sans-serif]">
              Waiting for node contribution data…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskQueuePanel({ jobs }: TaskQueuePanelProps) {
  const sortedJobs = [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <section id="tasks">
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#EF8354] font-[Inter,sans-serif] block mb-1">
            Workload Orchestration
          </span>
          <h2 className="text-3xl font-black text-[#120B09] tracking-tighter uppercase">
            Task Queue
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-[#4A3935]/50 uppercase tracking-widest font-[Inter,sans-serif]">
            {jobs.filter((j) => j.status === "running").length} running
          </span>
          <Link
            href="/host/tasks"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09] font-black text-[10px] uppercase tracking-widest rounded-sm transition-all font-[Inter,sans-serif]"
          >
            View All
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {sortedJobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}
