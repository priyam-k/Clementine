"use client";
import { Plus, ArrowRight, X, Copy, CheckCheck, Smartphone, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import QRCode from "react-qr-code";
import type { WireWorker } from "@/lib/shared-types";
import type { Session } from "@/lib/types";
import { WorkerCard } from "./WorkerCard";

interface WorkerGridProps {
  workers: WireWorker[];
  joinUrl?: string;
  session?: Session;
}

export function WorkerGrid({ workers, joinUrl, session }: WorkerGridProps) {
  const activeCount = workers.filter((w) => w.status !== "offline").length;
  const workingCount = workers.filter((w) => w.status === "working").length;
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = session?.joinUrl ?? joinUrl ?? "/join";
  const code = session?.joinCode;
  const isReady = !!code && code !== "—";

  const handleCopy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <section id="workers">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#EF8354] font-[Inter,sans-serif] block mb-1">
              Connected Workers
            </span>
            <h2 className="text-3xl font-black text-[#120B09] tracking-tighter uppercase">
              Worker Fleet
            </h2>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">Active</p>
              <p className="text-xl font-black text-[#120B09]">{activeCount}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">Working</p>
              <p className="text-xl font-black text-[#EF8354]">{workingCount}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/50 font-[Inter,sans-serif]">Total</p>
              <p className="text-xl font-black text-[#120B09]">{workers.length}</p>
            </div>
            <Link
              href="/host/workers"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09] font-black text-[10px] uppercase tracking-widest rounded-sm transition-all font-[Inter,sans-serif]"
            >
              View All
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}

          {/* Invite Worker slot — opens modal */}
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#F5F1EE]/60 border-2 border-dashed border-[#120B09]/10 rounded-sm p-5 flex flex-col items-center justify-center gap-3 group hover:bg-[#EDE7E3]/60 hover:border-[#EF8354]/20 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Plus size={16} className="text-[#EF8354]" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-[#120B09]/60 uppercase tracking-wider">Invite Worker</p>
              <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif] mt-0.5">
                Share join link or QR
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Invite modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#120B09]/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white border border-[#120B09]/5 shadow-xl rounded-sm w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-1">
                  Worker Invite
                </p>
                <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase">Scan to Join</h3>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-[#4A3935]/30" />
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[#4A3935]/40 hover:text-[#120B09] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white border border-[#EDE7E3] rounded-sm">
                {isReady ? (
                  <QRCode value={url} size={160} fgColor="#120B09" bgColor="white" level="M" />
                ) : (
                  <div className="w-40 h-40 bg-[#F5F1EE] flex items-center justify-center">
                    <span className="text-[9px] text-[#4A3935]/30 font-[Inter,sans-serif] uppercase font-bold tracking-wider text-center">
                      Awaiting session…
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Join code */}
            {isReady && (
              <div className="text-center mb-2">
                <span className="text-2xl font-black tracking-[0.4em] text-[#EF8354] font-[Inter,sans-serif]">
                  {code}
                </span>
              </div>
            )}

            {/* URL preview */}
            {isReady && (
              <p className="text-[9px] text-center text-[#4A3935]/40 font-[Inter,sans-serif] mb-4 truncate px-2" title={url}>
                {url}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                disabled={!isReady}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09] transition-all rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <CheckCheck size={12} className="text-green-700" /> : <Copy size={12} />}
                <span className="text-[10px] font-black uppercase tracking-widest font-[Inter,sans-serif]">
                  {copied ? "Copied!" : "Copy Link"}
                </span>
              </button>
              {isReady && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 bg-[#F5F1EE] hover:bg-[#EDE7E3] text-[#120B09]/60 transition-all rounded-sm flex items-center"
                  title="Open join page"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
