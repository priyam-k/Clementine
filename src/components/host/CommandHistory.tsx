"use client";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import type { CommandEntry } from "@/lib/types";
import { formatRelativeTime } from "@/lib/mock-data";

interface CommandHistoryProps {
  commands: CommandEntry[];
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-green-600", label: "Completed" },
  dispatched: { icon: Send, color: "text-[#EF8354]", label: "Dispatched" },
  pending: { icon: Clock, color: "text-[#4A3935]/50", label: "Pending" },
  failed: { icon: XCircle, color: "text-[#BA1A1A]", label: "Failed" },
};

export function CommandHistory({ commands }: CommandHistoryProps) {
  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-6 hover:border-[#EF8354]/20 transition-all" id="activity">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Recent
          </p>
          <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase">Command History</h3>
        </div>
        <span className="text-[10px] font-black text-[#4A3935]/40 uppercase tracking-widest font-[Inter,sans-serif]">
          {commands.length} entries
        </span>
      </div>

      <div className="space-y-2">
        {commands.slice().reverse().map((cmd) => {
          const { icon: Icon, color, label } = statusConfig[cmd.status];
          return (
            <div
              key={cmd.id}
              className="flex items-start gap-3 p-3 rounded-sm bg-[#FAFAF8] hover:bg-[#F5F1EE] transition-all border border-transparent hover:border-[#EDE7E3] group cursor-pointer"
            >
              <Icon size={14} className={`${color} mt-0.5 flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#120B09] leading-snug line-clamp-2">
                  {cmd.text}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif] ${color}`}>
                    {label}
                  </span>
                  <span className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif]">
                    {formatRelativeTime(cmd.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
