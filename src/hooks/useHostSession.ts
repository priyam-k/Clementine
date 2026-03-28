"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { connectSocket, getSocket } from "./useSocket";
import type {
  WireWorker,
  WireJob,
  WireResult,
  WireSession,
  FractalJobConfig,
  WireTask,
  FractalTileInput,
} from "@/lib/shared-types";
import { computeFractalTileAsync } from "@/lib/fractal-compute";
import { collectTelemetryHeartbeat, collectWorkerProfile } from "@/lib/browser-telemetry";

// ─── Public state shape ───────────────────────────────────────────────────────

export interface HostSessionState {
  isConnected: boolean;
  session: WireSession | null;
  workers: WireWorker[];
  jobs: WireJob[];
  latestResult: WireResult | null;
  submitJob: (command: string) => void;
  submitFractalJob: (config: FractalJobConfig) => void;
  reconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHostSession(): HostSessionState {
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return getSocket().connected;
  });
  const [session, setSession] = useState<WireSession | null>(null);
  const [workers, setWorkers] = useState<WireWorker[]>([]);
  const [jobs, setJobs] = useState<WireJob[]>([]);
  const [latestResult, setLatestResult] = useState<WireResult | null>(null);

  // Persist session code across reconnects
  const sessionCodeRef = useRef<string | undefined>(undefined);
  // Prevent double-executing assigned tasks (Strict Mode)
  const executingTaskRef = useRef<string | null>(null);
  const hostProfileSentRef = useRef<string | null>(null);

  // Execute a task assigned to the host worker
  const executeHostTask = useCallback(async (task: WireTask) => {
    if (executingTaskRef.current === task.id) return;
    executingTaskRef.current = task.id;
    const socket = getSocket();

    try {
      if (task.jobType === "fractal-render") {
        socket.emit("task:progress", { taskId: task.id, progress: 5 });
        const input = task.inputPayload as unknown as FractalTileInput;
        const output = await computeFractalTileAsync(input, (pct) => {
          socket.emit("task:progress", { taskId: task.id, progress: 10 + Math.floor(pct * 0.89) });
        });
        socket.emit("task:progress", { taskId: task.id, progress: 100 });
        socket.emit("task:complete", { taskId: task.id, output: output as unknown as Record<string, unknown> });
      } else {
        // Mock compute for other job types
        const complexity = typeof task.inputPayload.complexity === "number" ? task.inputPayload.complexity : 2;
        const durationMs = 1500 + complexity * 800 + Math.random() * 1500;
        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          await new Promise<void>((r) => setTimeout(r, durationMs / steps));
          socket.emit("task:progress", { taskId: task.id, progress: Math.round((i / steps) * 99) });
        }
        const batchSize = typeof task.inputPayload.batchSize === "number" ? task.inputPayload.batchSize : 1000;
        socket.emit("task:complete", {
          taskId: task.id,
          output: {
            success: true,
            result: `Processed by host`,
            opsCount: Math.floor(batchSize * (0.8 + Math.random())),
            durationMs,
            efficiency: 0.85 + Math.random() * 0.1,
          },
        });
      }
    } catch {
      executingTaskRef.current = null;
    }
    executingTaskRef.current = null;
  }, []);

  const setupListeners = useCallback(() => {
    const socket = getSocket();

    const publishHostProfile = async () => {
      const profileKey = socket.id || "host";
      if (hostProfileSentRef.current === profileKey) return;
      hostProfileSentRef.current = profileKey;

      const profile = await collectWorkerProfile("Host Browser");
      if (profile.device || profile.telemetry || profile.benchmark) {
        socket.emit("worker:profile", profile);
      }
    };

    // Initial state snapshot
    socket.on("session:state", ({ session: sess, workers: ws, jobs: js }) => {
      sessionCodeRef.current = sess.code;
      setSession(sess);
      setWorkers(ws);
      setJobs(js);
    });

    // Live worker list
    socket.on("workers:update", (ws) => {
      setWorkers(ws);
    });

    // New job created
    socket.on("job:created", (job) => {
      setJobs((prev) => {
        const exists = prev.some((j) => j.id === job.id);
        return exists ? prev : [job, ...prev];
      });
    });

    // Job progress update
    socket.on("job:update", (job) => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
    });

    // Job complete with result
    socket.on("job:complete", ({ job, result }) => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
      setLatestResult(result);
    });

    // Host also executes tasks assigned to it (it's also a worker node)
    socket.on("task:assigned", (task: WireTask) => {
      executeHostTask(task);
    });

    socket.on("connect", () => {
      setIsConnected(true);
      // Re-register with existing session code if any
      socket.emit("host:register", { sessionCode: sessionCodeRef.current });
      void publishHostProfile();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("error", ({ message }) => {
      console.error("[host] socket error:", message);
    });
  }, [executeHostTask]);

  useEffect(() => {
    const socket = connectSocket();
    setupListeners();

    // If already connected (hot reload / Strict Mode second mount)
    if (socket.connected) {
      socket.emit("host:register", { sessionCode: sessionCodeRef.current });
      void (async () => {
        const profile = await collectWorkerProfile("Host Browser");
        if (profile.device || profile.telemetry || profile.benchmark) {
          socket.emit("worker:profile", profile);
          hostProfileSentRef.current = socket.id || "host";
        }
      })();
    }

    // Periodic heartbeat telemetry for host-as-worker node
    const metricsInterval = setInterval(async () => {
      if (!socket.connected) return;
      const metrics = await collectTelemetryHeartbeat();
      socket.emit("metrics:report", metrics);
    }, 5000);

    return () => {
      const s = getSocket();
      s.off("session:state");
      s.off("workers:update");
      s.off("job:created");
      s.off("job:update");
      s.off("job:complete");
      s.off("task:assigned");
      s.off("connect");
      s.off("disconnect");
      s.off("error");
      clearInterval(metricsInterval);
    };
  }, [setupListeners]);

  const submitJob = useCallback((command: string) => {
    if (!command.trim()) return;
    getSocket().emit("job:submit", { command: command.trim() });
  }, []);

  const submitFractalJob = useCallback((config: FractalJobConfig) => {
    getSocket().emit("fractal:submit", config);
  }, []);

  const reconnect = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  return { isConnected, session, workers, jobs, latestResult, submitJob, submitFractalJob, reconnect };
}
