"use client";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Job } from "@/lib/types";

interface ProgressSummaryCardProps {
  job: Job;
}

export function ProgressSummaryCard({ job }: ProgressSummaryCardProps) {
  const runningSubtasks = job.subtasks.filter((t) => t.status === "running").length;
  const completedSubtasks = job.subtasks.filter((t) => t.status === "completed").length;
  const queuedSubtasks = job.subtasks.filter((t) => t.status === "queued" || t.status === "assigned").length;

  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-6 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Active Job Progress
          </p>
          <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase leading-tight max-w-[180px]">
            {job.name}
          </h3>
        </div>
        <span className="text-3xl font-black text-[#EF8354] tracking-tighter">
          {job.progress}<span className="text-lg ml-0.5">%</span>
        </span>
      </div>

      <ProgressBar value={job.progress} height="md" animated showLabel={false} />

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { label: "Running", count: runningSubtasks, color: "text-[#EF8354]" },
          { label: "Done", count: completedSubtasks, color: "text-green-700" },
          { label: "Queued", count: queuedSubtasks, color: "text-[#4A3935]/50" },
        ].map(({ label, count, color }) => (
          <div key={label} className="text-center py-2 bg-[#F5F1EE] rounded-sm">
            <p className={`text-lg font-black ${color}`}>{count}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Subtask progress bars for running */}
      {job.subtasks.filter((t) => t.status === "running").length > 0 && (
        <div className="mt-4 space-y-2">
          {job.subtasks
            .filter((t) => t.status === "running")
            .map((t) => (
              <div key={t.id}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[9px] text-[#4A3935]/60 font-medium truncate max-w-[160px]">{t.label}</span>
                  <span className="text-[9px] font-black text-[#EF8354] font-[Inter,sans-serif]">{t.progress}%</span>
                </div>
                <ProgressBar value={t.progress} height="sm" />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
