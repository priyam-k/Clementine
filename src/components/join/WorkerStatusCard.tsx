"use client";
import { useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { WorkerStatus } from "@/lib/types";

type ConnectionState = "disconnected" | "connecting" | "connected";

interface WorkerStatusCardProps {
  workerName: string;
  device: string;
  sessionCode: string;
  connectionState: ConnectionState;
  workerStatus: WorkerStatus;
}

export function WorkerStatusCard({
  workerName,
  device,
  sessionCode,
  connectionState,
  workerStatus,
}: WorkerStatusCardProps) {
  const connectionLabel: Record<ConnectionState, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
  };

  const connectionColor: Record<ConnectionState, string> = {
    disconnected: "text-[#4A3935]/40",
    connecting: "text-[#EF8354]",
    connected: "text-green-600",
  };

  const statusBg: Record<WorkerStatus, string> = {
    idle: "bg-[#F5F1EE] border-[#EDE7E3]",
    working: "bg-[#EF8354]/10 border-[#EF8354]/30",
    done: "bg-green-50 border-green-200",
    offline: "bg-[#EDE7E3] border-[#120B09]/10",
  };

  return (
    <div className={`border rounded-sm p-6 transition-all ${statusBg[workerStatus]}`}>
      {/* Connection status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {connectionState === "connecting" ? (
            <Loader2 size={14} className="text-[#EF8354] animate-spin" />
          ) : connectionState === "connected" ? (
            <Wifi size={14} className="text-green-600" />
          ) : (
            <WifiOff size={14} className="text-[#4A3935]/40" />
          )}
          <span className={`text-xs font-black uppercase tracking-widest font-[Inter,sans-serif] ${connectionColor[connectionState]}`}>
            {connectionLabel[connectionState]}
          </span>
        </div>
        {sessionCode && (
          <span className="text-[10px] font-black tracking-widest text-[#EF8354] font-[Inter,sans-serif]">
            {sessionCode}
          </span>
        )}
      </div>

      {/* Worker identity */}
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#EF8354]/30 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <span className="text-2xl">🍊</span>
        </div>
        <h2 className="text-xl font-black text-[#120B09] tracking-tight uppercase">{workerName}</h2>
        <p className="text-xs text-[#4A3935]/50 font-medium mt-1 font-[Inter,sans-serif]">{device}</p>
      </div>

      {/* Worker status pill */}
      <div className="flex justify-center mt-4">
        <span
          className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif] ${
            workerStatus === "working"
              ? "bg-[#EF8354] text-white"
              : workerStatus === "done"
              ? "bg-green-600 text-white"
              : workerStatus === "idle"
              ? "bg-white text-[#4A3935]/60 border border-[#EDE7E3]"
              : "bg-[#EDE7E3] text-[#4A3935]/50"
          }`}
        >
          {workerStatus === "working" ? "⟳ Working" : workerStatus === "done" ? "✓ Done" : workerStatus === "idle" ? "● Idle" : "Offline"}
        </span>
      </div>
    </div>
  );
}
