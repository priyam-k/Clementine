"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WorkerStatusCard } from "@/components/join/WorkerStatusCard";
import { CurrentTaskCard } from "@/components/join/CurrentTaskCard";
import { useWorkerSession } from "@/hooks/useWorkerSession";
import type { SubTask } from "@/lib/types";
import {
  Wifi,
  Loader2,
  ArrowLeft,
  Settings,
  BarChart2,
  Zap,
} from "lucide-react";

// ─── Worker name generation ───────────────────────────────────────────────────

const WORKER_NAMES = [
  "Satsuma", "Valencia", "Navel", "Tangelo", "Mandarin",
  "Bergamot", "Kumquat", "Yuzu", "Clementine", "Pomelo",
];

function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android Device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Browser";
}

// ─── Inner page component (needs useSearchParams) ────────────────────────────

function JoinPageInner() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const {
    connectionState,
    workerStatus,
    currentTask,
    tasksCompleted,
    selfWorker,
    joinSession,
    leaveSession,
    sessionCode,
  } = useWorkerSession();

  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [manualJoined, setManualJoined] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  const [workerName] = useState(
    () => WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)]
  );
  const [deviceName] = useState(getDeviceName);

  // Auto-join when a QR code URL param is present.
  // Uses [codeFromUrl] as the only dep so it runs once per code change.
  // The server deduplicates duplicate worker:join events by socketId so
  // React Strict Mode's double-invoke doesn't create ghost workers.
  useEffect(() => {
    if (!codeFromUrl || hasLeft) return;
    joinSession(codeFromUrl, workerName, deviceName);
  }, [codeFromUrl, deviceName, hasLeft, joinSession, workerName]);

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    joinSession(code, workerName, deviceName);
    setManualJoined(true);
    setHasLeft(false);
  };

  const handleLeave = () => {
    leaveSession();
    setManualJoined(false);
    setHasLeft(true);
    setJoinCode(codeFromUrl);
  };

  // Worker mode: manually joined, OR auto-joining from URL code and socket is live
  const joined = !hasLeft && (manualJoined || (!!codeFromUrl && connectionState !== "disconnected"));
  // Show the manual form when not in worker mode
  const showManualForm = !joined && (!codeFromUrl || hasLeft);
  // Show connecting indicator when auto-joining but not yet connected
  const isAutoJoining = !joined && !!codeFromUrl && !hasLeft;

  // Adapt WireTask → SubTask for CurrentTaskCard
  const compTask: SubTask | undefined = useMemo(() => {
    if (!currentTask) return undefined;
    return {
      id: currentTask.id,
      label: currentTask.title,
      status: currentTask.status,
      assignedTo: currentTask.assignedWorkerId,
      progress: currentTask.progress,
      startedAt: currentTask.startedAt
        ? new Date(currentTask.startedAt).toISOString()
        : undefined,
      completedAt: currentTask.completedAt
        ? new Date(currentTask.completedAt).toISOString()
        : undefined,
    };
  }, [currentTask]);

  const uptimeLabel = tasksCompleted > 0 ? `${tasksCompleted * 4}m` : "0m";
  const emissionsRating = (() => {
    const carbonIntensity = selfWorker?.carbonIntensity;
    if (typeof carbonIntensity !== "number") return "Awaiting Grid Data";
    if (carbonIntensity <= 100) return "Very Clean";
    if (carbonIntensity <= 200) return "Clean";
    if (carbonIntensity <= 350) return "Moderate";
    if (carbonIntensity <= 500) return "High";
    return "Very High";
  })();

  return (
    <div className="min-h-screen bg-[#FCFAF8]">
      {/* Mobile header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-[#120B09]/5 px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#4A3935]/50 hover:text-[#120B09] transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif]">
            Back
          </span>
        </Link>
        <h1 className="text-lg font-black text-[#6f0600] tracking-tighter uppercase italic">
          Clementine
        </h1>
        <button className="text-[#4A3935]/40 hover:text-[#120B09] transition-colors">
          <Settings size={16} />
        </button>
      </header>

      <div className="max-w-sm mx-auto px-5 pt-6 pb-24 space-y-4">
        {/* Hero label */}
        <div className="text-center py-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#EF8354] font-[Inter,sans-serif]">
            Worker Node
          </span>
          <h2 className="text-2xl font-black text-[#120B09] tracking-tighter uppercase mt-1">
            Join the Orchard
          </h2>
          <p className="text-xs text-[#4A3935]/50 mt-1 font-medium">
            Contribute your device&rsquo;s compute power
          </p>
        </div>

        {/* Connecting indicator — shown while auto-joining from QR code */}
        {isAutoJoining && (
          <div className="bg-white border border-[#EF8354]/20 rounded-sm p-6 flex flex-col items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#EF8354]/10 flex items-center justify-center">
              <Loader2 size={24} className="text-[#EF8354] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-[#120B09] uppercase tracking-tight">
                Connecting…
              </p>
              <p className="text-[10px] text-[#4A3935]/50 font-[Inter,sans-serif] mt-1">
                Joining session <span className="font-black text-[#EF8354]">{codeFromUrl}</span>
              </p>
            </div>
          </div>
        )}

        {/* Manual join form */}
        {showManualForm && (
          <div className="bg-white border border-[#120B09]/5 rounded-sm px-5 pt-5 pb-7 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-3">
              Enter Session Code
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="CLMT-XXXX"
              maxLength={9}
              autoFocus
              className="w-full bg-[#F5F1EE] border border-[#120B09]/8 rounded-sm px-4 py-3 text-center text-lg font-black text-[#120B09] tracking-[0.3em] placeholder-[#120B09]/20 focus:outline-none focus:border-[#EF8354]/50 font-[Inter,sans-serif] uppercase mb-3"
            />
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim() || connectionState === "connecting"}
              className={`w-full py-3 rounded-sm font-black text-[10px] uppercase tracking-widest font-[Inter,sans-serif] transition-all flex items-center justify-center gap-2 ${
                connectionState === "connecting"
                  ? "bg-[#EDE7E3] text-[#4A3935]/50 cursor-not-allowed"
                  : joinCode.trim()
                  ? "bg-[#EF8354] text-white hover:brightness-110 active:scale-95"
                  : "bg-[#EDE7E3] text-[#4A3935]/40 cursor-not-allowed"
              }`}
            >
              {connectionState === "connecting" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wifi size={14} />
              )}
              {connectionState === "connecting" ? "" : "Join"}
            </button>
            <p className="mt-3 text-[9px] text-[#4A3935]/40 text-center font-[Inter,sans-serif]">
              Or scan the QR code on the host dashboard to join instantly
            </p>
          </div>
        )}

        {/* Worker status card */}
        {joined && (
          <WorkerStatusCard
            workerName={workerName}
            device={deviceName}
            sessionCode={sessionCode || codeFromUrl}
            connectionState={connectionState}
            workerStatus={workerStatus}
            carbonIntensity={selfWorker?.carbonIntensity}
            emissionsRating={emissionsRating}
          />
        )}

        {/* Ready banner when connected but no task yet */}
        {joined && !currentTask && connectionState === "connected" && (
          <div className="bg-[#6f0600]/5 border border-[#6f0600]/10 rounded-sm px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#EF8354]/10 flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-[#EF8354]" />
            </div>
            <div>
              <p className="text-xs font-black text-[#120B09] uppercase tracking-tight">
                Ready for tasks
              </p>
              <p className="text-[9px] text-[#4A3935]/50 font-[Inter,sans-serif] mt-0.5">
                Waiting for the host to dispatch work…
              </p>
            </div>
          </div>
        )}

        {/* Current task */}
        {joined && (
          <CurrentTaskCard
            task={compTask}
            jobName={currentTask ? currentTask.description?.slice(0, 50) : undefined}
          />
        )}

        {/* Stats panel */}
        {joined && (
          <div className="bg-white border border-[#120B09]/5 rounded-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={13} className="text-[#EF8354]" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif]">
                Your Stats
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Tasks", value: String(tasksCompleted) },
                { label: "Uptime", value: uptimeLabel },
                { label: "Status", value: workerStatus === "working" ? "Active" : "Ready" },
                {
                  label: "Emissions",
                  value: typeof selfWorker?.carbonIntensity === "number"
                    ? `${Math.round(selfWorker.carbonIntensity)} g`
                    : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 min-w-[120px] text-center py-3 bg-[#F5F1EE] rounded-sm">
                  <p className="text-xl font-black text-[#120B09] tracking-tighter">{value}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif] mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Worker ID chip */}
        {joined && (
          <div className="bg-[#F5F1EE] border border-[#EDE7E3] rounded-sm px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">
              Worker
            </span>
            <span className="text-xs font-black text-[#120B09] uppercase tracking-wide">
              {workerName} · {deviceName}
            </span>
          </div>
        )}

        <p className="text-center text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif] uppercase tracking-widest pb-2">
          Clementine Worker Node v2.0
        </p>
      </div>

      {/* Bottom CTA bar when connected */}
      {joined && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#120B09]/5 px-5 py-3">
          <div className="max-w-sm mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionState === "connected"
                    ? "bg-[#EF8354] animate-pulse"
                    : "bg-[#4A3935]/30"
                }`}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#EF8354] font-[Inter,sans-serif]">
                {connectionState === "connected"
                  ? `Connected · ${sessionCode || codeFromUrl}`
                  : "Connecting..."}
              </span>
            </div>
            <button
              onClick={handleLeave}
              className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 hover:text-[#BA1A1A] transition-colors font-[Inter,sans-serif]"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page (wrapped in Suspense for useSearchParams) ───────────────────────────

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FCFAF8] flex items-center justify-center">
        <Loader2 size={24} className="text-[#EF8354] animate-spin" />
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  );
}
