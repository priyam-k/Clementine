"use client";
import { useEffect, useRef, useState } from "react";
import type { FractalTileResultPayload, WireJob } from "@/lib/shared-types";
import { Cpu, Clock, CheckCircle2, Zap } from "lucide-react";

interface FractalCanvasProps {
  /** The active fractal-render WireJob (null if none) */
  job: WireJob | null;
  tiles: FractalTileResultPayload[];
}

export function FractalCanvas({ job, tiles }: FractalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [lastWorker, setLastWorker] = useState<string>("");
  const [avgTileMs, setAvgTileMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tileMsAccRef = useRef<number[]>([]);
  const paintedTaskIdsRef = useRef<Set<string>>(new Set());
  const activeJobId = job?.id ?? null;

  useEffect(() => {
    if (!activeJobId) return;

    const nextTiles = tiles.filter(
      (payload) =>
        payload.jobId === activeJobId && !paintedTaskIdsRef.current.has(payload.taskId)
    );

    if (nextTiles.length === 0) return;

    for (const payload of nextTiles) {
      paintedTaskIdsRef.current.add(payload.taskId);

      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        setImageDims({ w: payload.imageWidth, h: payload.imageHeight });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== payload.imageWidth || canvas.height !== payload.imageHeight) {
          canvas.width = payload.imageWidth;
          canvas.height = payload.imageHeight;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = new ImageData(
            new Uint8ClampedArray(payload.pixels),
            payload.tileWidth,
            payload.tileHeight
          );
          ctx.putImageData(imgData, payload.tileX, payload.tileY);
        }
      }

      tileMsAccRef.current.push(payload.durationMs);
      setLastWorker(payload.workerName);
    }

    const acc = tileMsAccRef.current;
    setAvgTileMs(Math.round(acc.reduce((sum, value) => sum + value, 0) / acc.length));
    setTotalMs(Date.now() - (startTimeRef.current ?? Date.now()));
  }, [activeJobId, tiles]);

  const totalTiles = job?.totalTasks ?? 0;
  const completedTiles = job?.completedTasks ?? 0;
  const progress = totalTiles > 0 ? Math.round((completedTiles / totalTiles) * 100) : 0;
  const isComplete = job?.status === "completed" || job?.status === "reducing";

  if (!job) return null;

  return (
    <div className="bg-white border border-[#120B09]/5 shadow-sm rounded-sm overflow-hidden hover:border-[#EF8354]/20 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#120B09]/5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3935]/50 font-[Inter,sans-serif] mb-0.5">
            Distributed Fractal Render
          </p>
          <h3 className="text-sm font-black text-[#120B09] tracking-tight uppercase">
            {job.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-sm font-[Inter,sans-serif]">
              <CheckCircle2 size={11} />
              Complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF8354]/10 border border-[#EF8354]/20 text-[#EF8354] text-[10px] font-black uppercase tracking-widest rounded-sm font-[Inter,sans-serif] animate-pulse">
              <Zap size={11} />
              Rendering
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-[#120B09]">
        <canvas
          ref={canvasRef}
          width={imageDims?.w ?? 1200}
          height={imageDims?.h ?? 800}
          className="w-full h-auto block"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Progress overlay — visible while rendering */}
        {!isComplete && totalTiles > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#120B09]/40">
            <div
              className="h-full bg-[#EF8354] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 divide-x divide-[#120B09]/5 border-t border-[#120B09]/5">
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">Tiles</p>
          <p className="text-base font-black text-[#120B09] tracking-tighter">
            {completedTiles}<span className="text-[#4A3935]/30">/{totalTiles}</span>
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">Progress</p>
          <p className="text-base font-black text-[#EF8354] tracking-tighter">{progress}%</p>
        </div>
        <div className="px-4 py-3 flex items-start gap-1.5">
          <Cpu size={11} className="text-[#4A3935]/30 mt-1 flex-shrink-0" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">Avg tile</p>
            <p className="text-base font-black text-[#120B09] tracking-tighter">
              {avgTileMs > 0 ? `${avgTileMs}ms` : "—"}
            </p>
          </div>
        </div>
        <div className="px-4 py-3 flex items-start gap-1.5">
          <Clock size={11} className="text-[#4A3935]/30 mt-1 flex-shrink-0" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#4A3935]/40 font-[Inter,sans-serif]">
              {isComplete ? "Total time" : "Elapsed"}
            </p>
            <p className="text-base font-black text-[#120B09] tracking-tighter">
              {totalMs > 0 ? `${(totalMs / 1000).toFixed(1)}s` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Last worker activity */}
      {lastWorker && (
        <div className="px-6 py-2.5 border-t border-[#120B09]/5 bg-[#FAFAF9]">
          <p className="text-[9px] text-[#4A3935]/40 font-[Inter,sans-serif]">
            Last tile painted by <span className="font-black text-[#EF8354]">{lastWorker}</span>
            {isComplete && totalMs > 0 && (
              <> · rendered in <span className="font-black text-[#120B09]">{(totalMs / 1000).toFixed(2)}s</span></>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
