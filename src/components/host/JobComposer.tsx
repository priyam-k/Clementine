"use client";
import { useState } from "react";
import { Send, Zap, ChevronDown } from "lucide-react";

const SAMPLE_COMMANDS = [
  "Run distributed neural net analysis on dataset ambrosia-v4",
  "Compress citrus-archive using LZ codec across all workers",
  "Render fractal sequence B at 4K resolution",
  "Scan and classify images in flora-v2 dataset",
  "Benchmark all connected worker nodes",
];

interface JobComposerProps {
  onSubmit?: (command: string) => void;
}

export function JobComposer({ onSubmit }: JobComposerProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(value.trim());
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setValue("");
    }, 1800);
  };

  const fillSuggestion = (cmd: string) => {
    setValue(`Hey Clementine, ${cmd}`);
    setShowSuggestions(false);
  };

  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-6 hover:border-[#EF8354]/20 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Command Input
          </p>
          <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase">Dispatch Job</h3>
        </div>
        <Zap size={16} className="text-[#EF8354]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='Hey Clementine, ...'
            rows={3}
            className="w-full bg-[#F5F1EE] border border-[#120B09]/8 rounded-sm px-4 py-3 text-sm text-[#120B09] placeholder-[#120B09]/30 resize-none focus:outline-none focus:border-[#EF8354]/50 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!value.trim() || submitted}
            className={`flex-1 flex items-center justify-center gap-2 py-3 font-black text-[10px] uppercase tracking-widest rounded-sm transition-all font-[Inter,sans-serif] ${
              submitted
                ? "bg-green-600 text-white"
                : value.trim()
                ? "bg-[#EF8354] text-white hover:brightness-110 active:scale-[0.98]"
                : "bg-[#EDE7E3] text-[#4A3935]/50 cursor-not-allowed"
            }`}
          >
            {submitted ? (
              "Dispatched ✓"
            ) : (
              <>
                <Send size={12} />
                Dispatch
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowSuggestions((s) => !s)}
            className="px-3 py-3 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09]/60 rounded-sm transition-all"
          >
            <ChevronDown size={14} className={`transition-transform ${showSuggestions ? "rotate-180" : ""}`} />
          </button>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="mt-2 border border-[#120B09]/8 rounded-sm overflow-hidden">
          {SAMPLE_COMMANDS.map((cmd, i) => (
            <button
              key={i}
              onClick={() => fillSuggestion(cmd)}
              className="w-full text-left px-4 py-3 text-xs text-[#4A3935] hover:bg-[#F5F1EE] border-b border-[#120B09]/5 last:border-0 transition-all font-medium"
            >
              <span className="text-[#EF8354] font-black text-[10px] uppercase tracking-widest font-[Inter,sans-serif] mr-2">
                Hey Clementine,
              </span>
              {cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
