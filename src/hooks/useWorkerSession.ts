"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./useSocket";
import type { WireTask, FractalTileInput, WorkerLocation } from "@/lib/shared-types";
import { collectTelemetryHeartbeat, collectWorkerProfile } from "@/lib/browser-telemetry";
import { computeFractalTileMaxCpu } from "@/lib/fractal-parallel";

// ─── Mock compute executor ───────────────────────────────────────────────────
// Simulates realistic work in the browser with progress steps

function executeMockTask(
  taskId: string,
  inputPayload: Record<string, unknown>,
  onProgress: (progress: number) => void
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const complexity = typeof inputPayload.complexity === "number"
      ? inputPayload.complexity
      : 2;
    const batchSize = typeof inputPayload.batchSize === "number"
      ? (inputPayload.batchSize as number)
      : 1000;

    // Duration: 2–10s based on complexity
    const durationMs = 2000 + complexity * 1200 + Math.random() * 2000;
    const steps = 8 + Math.floor(Math.random() * 5);
    const intervalMs = durationMs / steps;
    let currentStep = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 99);
      onProgress(progress);

      if (currentStep >= steps) {
        clearInterval(interval);
        const actualDuration = Date.now() - startTime;
        const opsCount = Math.floor(batchSize * (0.5 + Math.random() * 1.5));
        const efficiency = 0.72 + Math.random() * 0.23;
        resolve({
          success: true,
          result: `Processed ${opsCount.toLocaleString()} operations on ${batchSize.toLocaleString()} items`,
          opsCount,
          durationMs: actualDuration,
          efficiency,
        });
      }
    }, intervalMs);
  });
}

// ─── Fractal tile executor ────────────────────────────────────────────────────
// Runs real Mandelbrot computation in the browser, yields briefly so the UI
// can update, then sends pixel data back to the server.

async function executeFractalTileTask(
  task: WireTask,
  onProgress: (p: number) => void
): Promise<Record<string, unknown>> {
  onProgress(5);

  const input = task.inputPayload as unknown as FractalTileInput;
  onProgress(10);

  const output = await computeFractalTileMaxCpu(input, (progress) => {
    onProgress(10 + Math.floor(progress * 0.9));
  });

  onProgress(100);
  return output as unknown as Record<string, unknown>;
}

// ─── Hook state ───────────────────────────────────────────────────────────────

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface WorkerSessionState {
  connectionState: ConnectionState;
  workerStatus: "idle" | "working" | "done" | "offline";
  currentTask: WireTask | null;
  tasksCompleted: number;
  joinSession: (sessionCode: string, name: string, device: string, location?: WorkerLocation) => void;
  leaveSession: () => void;
  sessionCode: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkerSession(): WorkerSessionState {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    if (typeof window === "undefined") return "disconnected";
    return getSocket().connected ? "connected" : "disconnected";
  });
  const [workerStatus, setWorkerStatus] = useState<"idle" | "working" | "done" | "offline">("idle");
  const [currentTask, setCurrentTask] = useState<WireTask | null>(null);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [sessionCode, setSessionCode] = useState("");

  // Prevent double-execution in React Strict Mode
  const executingRef = useRef<string | null>(null);
  const joinProfileRef = useRef<{ code: string; name: string; device: string; location?: WorkerLocation } | null>(null);
  const profileSentRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = connectSocket();

    const publishProfile = async (fallbackDevice: string) => {
      const profileKey = `${socket.id}:${fallbackDevice}`;
      if (profileSentRef.current === profileKey) return;
      profileSentRef.current = profileKey;

      const profile = await collectWorkerProfile(fallbackDevice);
      if (profile.device || profile.telemetry || profile.benchmark) {
        socket.emit("worker:profile", {
          ...profile,
          location: joinProfileRef.current?.location,
        });
      }
    };

    const handleTaskAssigned = async (task: WireTask) => {
      if (executingRef.current === task.id) return; // Dedupe
      executingRef.current = task.id;

      setCurrentTask(task);
      setWorkerStatus("working");

      // Choose executor by job type
      const executor = task.jobType === "fractal-render"
        ? executeFractalTileTask
        : (t: WireTask, onProgress: (p: number) => void) =>
            executeMockTask(t.id, t.inputPayload, onProgress);

      try {
        const output = await executor(
          task,
          (progress) => {
            socket.emit("task:progress", { taskId: task.id, progress });
            setCurrentTask((prev) =>
              prev?.id === task.id ? { ...prev, progress, status: "running" } : prev
            );
          }
        );

        socket.emit("task:complete", { taskId: task.id, output });
        setCurrentTask((prev) =>
          prev?.id === task.id ? { ...prev, progress: 100, status: "completed" } : prev
        );
        setWorkerStatus("done");
        setTasksCompleted((n) => n + 1);
        executingRef.current = null;

        // Brief done state, then back to idle
        setTimeout(() => {
          setWorkerStatus("idle");
          setCurrentTask(null);
        }, 2500);
      } catch (err) {
        console.error("[worker] task execution error:", err);
        executingRef.current = null;
        setWorkerStatus("idle");
        setCurrentTask(null);
      }
    };

    // Named handlers so cleanup removes only these (not the once() from joinSession)
    const handleConnect = () => {
      setConnectionState("connected");
      const pendingJoin = joinProfileRef.current;
      if (pendingJoin) {
        socket.emit("worker:join", {
          sessionCode: pendingJoin.code,
          name: pendingJoin.name,
          device: pendingJoin.device,
          location: pendingJoin.location,
        });
        void publishProfile(pendingJoin.device);
      }
    };

    const handleDisconnect = () => {
      setConnectionState("disconnected");
      setWorkerStatus("offline");
    };

    socket.on("task:assigned", handleTaskAssigned);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // If socket is already connected (Strict Mode re-mount or hot reload),
    // immediately re-join if we have pending join info
    if (socket.connected && joinProfileRef.current) {
      handleConnect();
    }

    // ── Periodic heartbeat telemetry ─────────────────────────────────────────
    const metricsInterval = setInterval(async () => {
      if (!socket.connected) return;
      const metrics = await collectTelemetryHeartbeat();
      socket.emit("metrics:report", metrics);
    }, 5000);

    return () => {
      socket.off("task:assigned", handleTaskAssigned);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      clearInterval(metricsInterval);
    };
  }, []);

  const joinSession = useCallback((code: string, name: string, device: string, location?: WorkerLocation) => {
    setConnectionState("connecting");
    setSessionCode(code);
    joinProfileRef.current = { code, name, device, location };
    profileSentRef.current = null;

    const socket = connectSocket();

    if (socket.connected) {
      // Already connected — join immediately
      socket.emit("worker:join", { sessionCode: code, name, device, location });
      setConnectionState("connected");
      setWorkerStatus("idle");
      void (async () => {
        const profile = await collectWorkerProfile(device);
        if (profile.device || profile.telemetry || profile.benchmark) {
          socket.emit("worker:profile", { ...profile, location });
          profileSentRef.current = `${socket.id}:${device}`;
        }
      })();
    }
    // If not yet connected, the on("connect") handler in useEffect
    // will pick up joinProfileRef.current and emit worker:join
  }, []);

  const leaveSession = useCallback(() => {
    disconnectSocket();
    setConnectionState("disconnected");
    setWorkerStatus("offline");
    setCurrentTask(null);
    setSessionCode("");
    setTasksCompleted(0);
  }, []);

  return {
    connectionState,
    workerStatus,
    currentTask,
    tasksCompleted,
    joinSession,
    leaveSession,
    sessionCode,
  };
}
