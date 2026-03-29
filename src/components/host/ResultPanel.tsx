"use client";
import { useMemo } from "react";
import { CheckCircle2, Download, Clock, Users } from "lucide-react";
import type { Job } from "@/lib/types";
import { formatDuration } from "@/lib/mock-data";
import { formatCarbonSaved } from "@/lib/carbon-metrics";
import { MarkdownArtifactView } from "@/components/host/MarkdownArtifactView";

interface ResultPanelProps {
  job: Job;
  wide?: boolean;
}

export function ResultPanel({ job, wide = false }: ResultPanelProps) {
  if (!job.result) return null;
  const { result } = job;
  const markdownArtifact = useMemo(
    () => job.artifacts?.find((artifact) => artifact.artifactType === "markdown"),
    [job.artifacts]
  );

  const handleExport = () => {
    if (!markdownArtifact || typeof window === "undefined") return;
    const blob = new Blob([markdownArtifact.content], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = markdownArtifact.filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-[#120B09] border border-[#EF8354]/20 rounded-sm p-6 hover:border-[#EF8354]/40 transition-all ${wide ? "w-full" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-green-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400 font-[Inter,sans-serif]">
              Completed
            </p>
          </div>
          <h3 className="text-sm font-black text-white tracking-tight uppercase">{job.name}</h3>
        </div>
        <button
          onClick={handleExport}
          disabled={!markdownArtifact}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/60 rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={11} />
          <span className="text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif]">Export</span>
        </button>
      </div>

      {/* Summary */}
      <p className="text-white/70 text-xs leading-relaxed mb-4 font-medium">{result.summary}</p>

      {/* Stats */}
      <div className={`grid gap-3 mb-4 ${wide ? "grid-cols-1 md:grid-cols-3" : "grid-cols-3"}`}>
        {[
          { icon: Clock, label: "Duration", value: formatDuration(result.durationMs) },
          { icon: Users, label: "Workers", value: String(result.workerCount) },
          {
            icon: CheckCircle2,
            label: "Net Carbon Saved",
            value: formatCarbonSaved(result.estimatedCarbonSavedGrams ?? job.estimatedCarbonSavedGrams ?? 0),
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white/5 rounded-sm px-3 py-2 text-center">
            <Icon size={11} className="mx-auto text-[#EF8354] mb-1" />
            <p className="text-white font-black text-sm">{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 font-[Inter,sans-serif]">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Output log */}
      {markdownArtifact ? (
        <div className="bg-black/40 rounded-sm p-4 max-h-[28rem] overflow-y-auto custom-scrollbar">
          <MarkdownArtifactView content={markdownArtifact.content} />
        </div>
      ) : (
        <div className="bg-black/40 rounded-sm p-3 max-h-40 overflow-y-auto custom-scrollbar">
          {result.outputLines.map((line, i) => (
            <p key={i} className="text-[10px] font-[Inter,sans-serif] text-green-400/80 leading-relaxed py-0.5">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
