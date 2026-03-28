"use client";
import { RefreshCw, CheckCircle2, Clock, Cpu } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { SubTask } from "@/lib/types";

interface CurrentTaskCardProps {
  task?: SubTask;
  jobName?: string;
}

export function CurrentTaskCard({ task, jobName }: CurrentTaskCardProps) {
  if (!task || task.status === "queued") {
    return (
      <div className="bg-white border border-[#120B09]/5 rounded-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-[#4A3935]/30" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/40 font-[Inter,sans-serif]">
            Current Task
          </p>
        </div>
        <div className="py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F1EE] flex items-center justify-center mx-auto mb-3">
            <Clock size={20} className="text-[#4A3935]/30" />
          </div>
          <p className="text-sm font-black text-[#4A3935]/50 uppercase tracking-wide">Waiting for work</p>
          <p className="text-xs text-[#4A3935]/30 mt-1 font-[Inter,sans-serif]">
            Host will assign tasks shortly
          </p>
        </div>
      </div>
    );
  }

  if (task.status === "completed") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={14} className="text-green-600" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 font-[Inter,sans-serif]">
            Task Completed
          </p>
        </div>
        <p className="font-black text-[#120B09] text-base tracking-tight mb-2">{task.label}</p>
        {jobName && (
          <p className="text-xs text-[#4A3935]/60 font-medium font-[Inter,sans-serif] mb-4">
            Job: {jobName}
          </p>
        )}
        <div className="bg-green-100 rounded-sm px-4 py-2 inline-flex items-center gap-2">
          <CheckCircle2 size={13} className="text-green-700" />
          <span className="text-xs font-black text-green-800 uppercase tracking-widest font-[Inter,sans-serif]">
            Result submitted
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#EF8354]/30 rounded-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw size={14} className="text-[#EF8354] animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#EF8354] font-[Inter,sans-serif]">
          Processing
        </p>
      </div>

      {jobName && (
        <p className="text-[10px] text-[#4A3935]/50 uppercase tracking-widest font-black font-[Inter,sans-serif] mb-1">
          {jobName}
        </p>
      )}
      <p className="font-black text-[#120B09] text-base tracking-tight leading-tight mb-4">
        {task.label}
      </p>

      <ProgressBar value={task.progress} height="md" animated showLabel />

      {/* Live indicators */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#120B09]/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#EF8354] animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[#EF8354] font-[Inter,sans-serif]">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#4A3935]/40">
          <Cpu size={10} />
          <span className="text-[9px] font-[Inter,sans-serif]">Computing...</span>
        </div>
      </div>
    </div>
  );
}
