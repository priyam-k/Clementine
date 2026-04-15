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
  FractalTileResultPayload,
  EnterpriseBenchmarkConfig,
} from "@/lib/shared-types";
import { collectTelemetryHeartbeat, collectWorkerProfile } from "@/lib/browser-telemetry";
import { executeAssignedTask } from "@/lib/task-execution";

// ─── Public state shape ───────────────────────────────────────────────────────

export interface HostSessionState {
  isConnected: boolean;
  session: WireSession | null;
  workers: WireWorker[];
  jobs: WireJob[];
  fractalTiles: FractalTileResultPayload[];
  latestResult: WireResult | null;
  schedulerBias: number;
  submitJob: (command: string) => void;
  submitFractalJob: (config: FractalJobConfig) => void;
  submitEnterpriseBenchmark: (
    command: string,
    benchmarkConfig: EnterpriseBenchmarkConfig
  ) => void;
  setSchedulerBias: (bias: number) => void;
  reconnect: () => void;
}

const HOST_SESSION_STORAGE_KEY = "clementine:host-session-code";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHostSession(): HostSessionState {
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return getSocket().connected;
  });
  const [session, setSession] = useState<WireSession | null>(null);
  const [workers, setWorkers] = useState<WireWorker[]>([]);
  const [jobs, setJobs] = useState<WireJob[]>([]);
  const [fractalTiles, setFractalTiles] = useState<FractalTileResultPayload[]>([]);
  const [latestResult, setLatestResult] = useState<WireResult | null>(null);
  const [schedulerBias, setSchedulerBiasState] = useState(0.5);

  // Persist session code across reconnects
  const sessionCodeRef = useRef<string | undefined>(
    typeof window !== "undefined"
      ? window.localStorage.getItem(HOST_SESSION_STORAGE_KEY) ?? undefined
      : undefined
  );
  // Prevent double-executing assigned tasks (Strict Mode)
  const executingTaskRef = useRef<string | null>(null);
  const hostProfileSentRef = useRef<string | null>(null);

  // Execute a task assigned to the host worker
  const executeHostTask = useCallback(async (task: WireTask) => {
    if (executingTaskRef.current === task.id) return;
    executingTaskRef.current = task.id;
    const socket = getSocket();

    try {
      const output = await executeAssignedTask(task, (progress) => {
        socket.emit("task:progress", { taskId: task.id, progress });
      });
      socket.emit("task:complete", { taskId: task.id, output });
    } catch (err) {
      socket.emit("task:failed", {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
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
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HOST_SESSION_STORAGE_KEY, sess.code);
      }
      setSession(sess);
      setSchedulerBiasState(sess.schedulerBias);
      setWorkers(ws);
      setJobs(js);
      setFractalTiles([]);
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

    socket.on("fractal:tile:result", (payload) => {
      setFractalTiles((prev) => {
        const next = prev.filter((tile) => tile.taskId !== payload.taskId);
        next.push(payload);
        return next;
      });
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
      s.off("fractal:tile:result");
      s.off("task:assigned");
      s.off("connect");
      s.off("disconnect");
      s.off("error");
      clearInterval(metricsInterval);
    };
  }, [setupListeners]);

  const submitJob = useCallback((command: string) => {
    if (!command.trim()) return;
    getSocket().emit("job:submit", {
      command: command.trim(),
      sessionCode: sessionCodeRef.current,
    });
  }, []);

  const submitFractalJob = useCallback((config: FractalJobConfig) => {
    getSocket().emit("fractal:submit", {
      config,
      sessionCode: sessionCodeRef.current,
    });
  }, []);

  const submitEnterpriseBenchmark = useCallback(
    (command: string, benchmarkConfig: EnterpriseBenchmarkConfig) => {
      if (!command.trim()) return;
      getSocket().emit("job:submit", {
        command: command.trim(),
        sessionCode: sessionCodeRef.current,
        benchmarkConfig,
      });
    },
    []
  );

  const reconnect = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  const setSchedulerBias = useCallback((bias: number) => {
    const normalizedBias = Math.min(Math.max(bias, 0), 1);
    setSchedulerBiasState(normalizedBias);
    setSession((prev) => (prev ? { ...prev, schedulerBias: normalizedBias } : prev));

    const currentSessionCode = sessionCodeRef.current;
    if (!currentSessionCode) return;

    getSocket().emit("scheduler:bias:set", {
      sessionCode: currentSessionCode,
      bias: normalizedBias,
    });
  }, []);

  return {
    isConnected,
    session,
    workers,
    jobs,
    fractalTiles,
    latestResult,
    schedulerBias,
    submitJob,
    submitFractalJob,
    submitEnterpriseBenchmark,
    setSchedulerBias,
    reconnect,
  };
}
