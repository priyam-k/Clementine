"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./useSocket";
import type { WireTask, WireWorker } from "@/lib/shared-types";
import { collectTelemetryHeartbeat, collectWorkerProfile } from "@/lib/browser-telemetry";
import { executeAssignedTask } from "@/lib/task-execution";

// ─── Hook state ───────────────────────────────────────────────────────────────

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface WorkerSessionState {
  connectionState: ConnectionState;
  workerStatus: "idle" | "working" | "done" | "offline";
  currentTask: WireTask | null;
  tasksCompleted: number;
  selfWorker: WireWorker | null;
  joinSession: (sessionCode: string, name: string, device: string) => void;
  leaveSession: () => void;
  sessionCode: string;
}

async function resolveWorkerCoordinates(): Promise<{ lat: number; lon: number }> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { lat: 0, lon: 0 };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => resolve({ lat: 0, lon: 0 }),
      {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 300000,
      }
    );
  });
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
  const [selfWorker, setSelfWorker] = useState<WireWorker | null>(null);

  // Prevent double-execution in React Strict Mode
  const executingRef = useRef<string | null>(null);
  const joinProfileRef = useRef<{ code: string; name: string; device: string; lat: number; lon: number } | null>(null);
  const profileSentRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = connectSocket();

    const publishProfile = async (fallbackDevice: string) => {
      const profileKey = `${socket.id}:${fallbackDevice}`;
      if (profileSentRef.current === profileKey) return;
      profileSentRef.current = profileKey;

      const profile = await collectWorkerProfile(fallbackDevice);
      if (profile.device || profile.telemetry || profile.benchmark) {
        socket.emit("worker:profile", profile);
      }
    };

    const handleTaskAssigned = async (task: WireTask) => {
      if (executingRef.current === task.id) return; // Dedupe
      executingRef.current = task.id;

      setCurrentTask(task);
      setWorkerStatus("working");

      try {
        const output = await executeAssignedTask(task, (progress) => {
          socket.emit("task:progress", { taskId: task.id, progress });
          setCurrentTask((prev) =>
            prev?.id === task.id ? { ...prev, progress, status: "running" } : prev
          );
        });

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
        socket.emit("task:failed", {
          taskId: task.id,
          error: err instanceof Error ? err.message : String(err),
        });
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
          lat: pendingJoin.lat,
          lon: pendingJoin.lon,
        });
        void publishProfile(pendingJoin.device);
      }
    };

    const handleDisconnect = () => {
      setConnectionState("disconnected");
      setWorkerStatus("offline");
    };

    socket.on("task:assigned", handleTaskAssigned);
    socket.on("worker:self", (worker) => {
      setSelfWorker(worker);
    });
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
      socket.off("worker:self");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      clearInterval(metricsInterval);
    };
  }, []);

  const joinSession = useCallback((code: string, name: string, device: string) => {
    setConnectionState("connecting");
    setSessionCode(code);
    profileSentRef.current = null;

    const socket = connectSocket();

    void (async () => {
      const { lat, lon } = await resolveWorkerCoordinates();
      joinProfileRef.current = { code, name, device, lat, lon };

      if (socket.connected) {
        // Already connected — join immediately
        socket.emit("worker:join", { sessionCode: code, name, device, lat, lon });
        setConnectionState("connected");
        setWorkerStatus("idle");
        const profile = await collectWorkerProfile(device);
        if (profile.device || profile.telemetry || profile.benchmark) {
          socket.emit("worker:profile", profile);
          profileSentRef.current = `${socket.id}:${device}`;
        }
      }
    })();
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
    setSelfWorker(null);
  }, []);

  return {
    connectionState,
    workerStatus,
    currentTask,
    tasksCompleted,
    selfWorker,
    joinSession,
    leaveSession,
    sessionCode,
  };
}
