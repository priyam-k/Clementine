"use client";
import { Wifi, Clock, Hash } from "lucide-react";
import type { Session } from "@/lib/types";
import { formatRelativeTime } from "@/lib/mock-data";

interface SessionCardProps {
  session: Session;
  workerCount: number;
}

export function SessionCard({ session, workerCount }: SessionCardProps) {
  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm p-6 hover:border-[#EF8354]/20 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
            Active Session
          </p>
          <h3 className="text-lg font-black text-[#120B09] tracking-tight uppercase">
            {session.hostName}
          </h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EF8354]/10 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#EF8354] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#EF8354] font-[Inter,sans-serif]">
            Live
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[#4A3935]/50">
            <Wifi size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif]">Workers</span>
          </div>
          <span className="text-2xl font-black text-[#120B09] tracking-tighter">{workerCount}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[#4A3935]/50">
            <Hash size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif]">Join Code</span>
          </div>
          <span className="text-lg font-black text-[#EF8354] tracking-wider font-[Inter,sans-serif]">
            {session.joinCode}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[#4A3935]/50">
            <Clock size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest font-[Inter,sans-serif]">Started</span>
          </div>
          <span className="text-sm font-black text-[#120B09] tracking-tight">
            {formatRelativeTime(session.startedAt)}
          </span>
        </div>
      </div>

      {/* Session ID */}
      <div className="pt-4 border-t border-[#120B09]/5">
        <span className="text-[9px] font-bold text-[#4A3935]/40 uppercase tracking-widest font-[Inter,sans-serif]">
          Session ID: {session.id}
        </span>
      </div>
    </div>
  );
}
