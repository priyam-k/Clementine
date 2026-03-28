"use client";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { WireWorker } from "@/lib/shared-types";
import { WorkerCard } from "./WorkerCard";

interface WorkerGridProps {
  workers: WireWorker[];
}

export function WorkerGrid({ workers }: WorkerGridProps) {
  const activeCount = workers.filter((w) => w.status !== "offline").length;
  const workingCount = workers.filter((w) => w.status === "working").length;

  return (
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

        {/* Add worker slot */}
        <Link href="/join" className="bg-[#F5F1EE]/60 border-2 border-dashed border-[#120B09]/10 rounded-sm p-5 flex flex-col items-center justify-center gap-3 group hover:bg-[#EDE7E3]/60 hover:border-[#EF8354]/20 transition-all">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Plus size={16} className="text-[#EF8354]" />
          </div>
          <div className="text-center">
            <p className="text-xs font-black text-[#120B09]/60 uppercase tracking-wider">Invite Worker</p>
            <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif] mt-0.5">
              Share join link or QR
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}
