"use client";
import { useState, useEffect } from "react";
import { X, Copy, Download, Check } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { WireJob, WireTask, JobType } from "@/lib/shared-types";
import {
  buildJobProcessDump,
  formatDuration,
  formatInputPayload,
  formatOutputPayload,
} from "@/app/host/tasks/task-helpers";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskInspectOverlayProps {
  job: WireJob;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type PhaseStatus = "pending" | "active" | "done";

function PhaseDot({ status }: { status: PhaseStatus }) {
  if (status === "done") return <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />;
  if (status === "active") return <div className="w-2 h-2 rounded-full bg-[#EF8354] flex-shrink-0 animate-pulse" />;
  return <div className="w-2 h-2 rounded-full bg-[#120B09]/15 flex-shrink-0" />;
}

function PhaseSection({
  title,
  status,
  children,
}: {
  title: string;
  status: PhaseStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#120B09]/8 rounded-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#F5F1EE] border-b border-[#120B09]/8">
        <PhaseDot status={status} />
        <span className="text-[9px] font-black uppercase tracking-widest text-[#120B09]">
          {title}
        </span>
        <span className="text-[9px] text-[#4A3935]/40 ml-auto uppercase tracking-wider">
          {status}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5">
      {rows.map(({ label, value }) => (
        <>
          <span
            key={`l-${label}`}
            className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40"
          >
            {label}
          </span>
          <span key={`v-${label}`} className="text-[10px] text-[#120B09] font-medium break-words">
            {value}
          </span>
        </>
      ))}
    </div>
  );
}

function TaskInputBlock({ task, index }: { task: WireTask; index: number }) {
  const rows = formatInputPayload(task.jobType, task.inputPayload);
  return (
    <div className="border border-[#120B09]/6 rounded-sm p-3 bg-white">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 mb-2">
        Task {index + 1} — {task.title}
      </p>
      {task.description && (
        <p className="text-[10px] text-[#4A3935]/60 italic mb-2">{task.description}</p>
      )}
      <InfoGrid rows={rows} />
    </div>
  );
}

function TaskOutputBlock({ task, index }: { task: WireTask; index: number }) {
  const out = formatOutputPayload(task.jobType, task.outputPayload, task.progress, task.status);
  const dur =
    task.completedAt && task.startedAt
      ? formatDuration(task.completedAt - task.startedAt)
      : null;

  return (
    <div className="border border-[#120B09]/6 rounded-sm p-3 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50">
          Task {index + 1} — {task.title}
        </p>
        <span
          className={`ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
            task.status === "completed"
              ? "bg-green-100 text-green-700"
              : task.status === "failed"
              ? "bg-red-100 text-[#BA1A1A]"
              : task.status === "running"
              ? "bg-[#EF8354]/10 text-[#EF8354]"
              : "bg-[#120B09]/5 text-[#4A3935]/50"
          }`}
        >
          {task.status}
        </span>
      </div>

      {(task.completedByWorkerName ?? task.assignedWorkerId) && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#4A3935]/40 w-20 flex-shrink-0">
            Worker
          </span>
          <span className="text-[10px] text-[#120B09] font-medium">
            {task.completedByWorkerName ?? task.assignedWorkerId}
          </span>
          {dur && (
            <span className="text-[10px] text-[#4A3935]/50 ml-2">{dur}</span>
          )}
        </div>
      )}

      {out === "in-progress" ? (
        <div>
          <ProgressBar value={task.progress} height="sm" animated />
          <p className="text-[10px] text-[#EF8354] font-black mt-1">{task.progress}% complete</p>
        </div>
      ) : (
        <InfoGrid rows={out} />
      )}
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function TaskInspectOverlay({ job, onClose }: TaskInspectOverlayProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildJobProcessDump(job));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([buildJobProcessDump(job)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${job.id.slice(0, 8)}-process.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phase status derivation
  const decomposePh: PhaseStatus =
    job.status === "queued" ? "pending" : "done";
  const schedulePh: PhaseStatus =
    job.status === "queued" || job.status === "decomposing" ? "pending" : "done";
  const executePh: PhaseStatus =
    job.status === "running" || job.status === "reducing"
      ? "active"
      : job.status === "completed" || job.status === "failed"
      ? "done"
      : "pending";
  const reducePh: PhaseStatus =
    job.status === "reducing"
      ? "active"
      : job.status === "completed"
      ? "done"
      : "pending";

  const duration =
    job.completedAt && job.startedAt
      ? formatDuration(job.completedAt - job.startedAt)
      : null;

  const btnBase =
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all";

  return (
    <div
      className="fixed inset-0 z-50 bg-[#120B09]/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-sm border border-[#120B09]/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#120B09]/8 bg-[#F5F1EE] flex-shrink-0">
          <div className="min-w-0 mr-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#EF8354] mb-0.5">
              Job Inspector
            </p>
            <h2 className="text-sm font-black text-[#120B09] tracking-tight truncate">
              {job.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopy}
              className={`${btnBase} border border-[#120B09]/10 text-[#4A3935]/60 hover:text-[#120B09] hover:border-[#120B09]/20 bg-white`}
            >
              {copied ? (
                <Check size={10} className="text-green-600" />
              ) : (
                <Copy size={10} />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleExport}
              className={`${btnBase} border border-[#120B09]/10 text-[#4A3935]/60 hover:text-[#120B09] hover:border-[#120B09]/20 bg-white`}
            >
              <Download size={10} />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-sm text-[#4A3935]/40 hover:text-[#120B09] hover:bg-[#120B09]/5 transition-all"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Overview */}
          <PhaseSection title="Job Overview" status="done">
            <InfoGrid
              rows={[
                { label: "Job ID", value: job.id },
                { label: "Type", value: job.jobType },
                { label: "Status", value: job.status },
                { label: "Prompt", value: `"${job.rawPrompt}"` },
                { label: "Created", value: new Date(job.createdAt).toISOString() },
                {
                  label: "Started",
                  value: job.startedAt ? new Date(job.startedAt).toISOString() : "—",
                },
                {
                  label: "Completed",
                  value: job.completedAt ? new Date(job.completedAt).toISOString() : "—",
                },
                { label: "Duration", value: duration ?? "—" },
              ]}
            />
          </PhaseSection>

          {/* Decompose */}
          <PhaseSection title="Decompose" status={decomposePh}>
            <InfoGrid
              rows={[
                { label: "Tasks created", value: String(job.totalTasks || "pending") },
                { label: "Completed", value: String(job.completedTasks) },
                { label: "Failed", value: String(job.failedTasks) },
              ]}
            />
          </PhaseSection>

          {/* Schedule */}
          <PhaseSection title="Schedule" status={schedulePh}>
            {job.tasks.length === 0 ? (
              <p className="text-[10px] text-[#4A3935]/50 italic">Tasks not yet scheduled.</p>
            ) : (
              <div className="space-y-2">
                {job.tasks.map((task, i) => (
                  <TaskInputBlock key={task.id} task={task} index={i} />
                ))}
              </div>
            )}
          </PhaseSection>

          {/* Execute */}
          <PhaseSection title="Execute" status={executePh}>
            {job.tasks.length === 0 ? (
              <p className="text-[10px] text-[#4A3935]/50 italic">Execution not started.</p>
            ) : (
              <div className="space-y-2">
                {job.tasks.map((task, i) => (
                  <TaskOutputBlock key={task.id} task={task} index={i} />
                ))}
              </div>
            )}
          </PhaseSection>

          {/* Reduce */}
          <PhaseSection title="Reduce" status={reducePh}>
            {job.result ? (
              <div className="space-y-3">
                <InfoGrid
                  rows={[
                    { label: "Summary", value: job.result.summary },
                    { label: "Duration", value: formatDuration(job.result.durationMs) },
                    { label: "Workers", value: String(job.result.workerCount) },
                    { label: "Data processed", value: job.result.dataProcessed },
                  ]}
                />
                {job.result.outputLines.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 mb-1.5">
                      Output
                    </p>
                    <div className="bg-[#120B09] rounded-sm px-3 py-2.5 max-h-36 overflow-y-auto">
                      {job.result.outputLines.map((line, i) => (
                        <p key={i} className="text-[10px] font-mono text-green-400 leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(job.result.metrics).length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 mb-1.5">
                      Metrics
                    </p>
                    <InfoGrid
                      rows={Object.entries(job.result.metrics).map(([k, v]) => ({
                        label: k,
                        value: String(v),
                      }))}
                    />
                  </div>
                )}
              </div>
            ) : job.status === "reducing" ? (
              <p className="text-[10px] text-[#EF8354] font-medium italic">
                LLM synthesizing results…
              </p>
            ) : (
              <p className="text-[10px] text-[#4A3935]/50 italic">Pending.</p>
            )}
          </PhaseSection>
        </div>
      </div>
    </div>
  );
}
