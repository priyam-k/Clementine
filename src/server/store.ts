import type { ServerSession, ServerWorker, ServerJob, ServerTask } from "./types";
import type {
  WireWorker,
  WireTask,
  WireJob,
  FractalJobConfig,
  JobType,
  WorkerTelemetry,
  WorkerLocation,
} from "../lib/shared-types";
import { benchmarkPixelsPerSecond } from "../lib/worker-benchmark";

// ─── In-memory store ──────────────────────────────────────────────────────────

const sessions = new Map<string, ServerSession>();
const workers = new Map<string, ServerWorker>();
const jobs = new Map<string, ServerJob>();
const tasks = new Map<string, ServerTask>();

// socketId → workerId (for disconnect lookup)
const socketToWorker = new Map<string, string>();
// sessionCode → hostSocketId (for quick host lookup)
const sessionToHost = new Map<string, string>();

let jobCounter = 0;
let taskCounter = 0;

// ─── Session ops ─────────────────────────────────────────────────────────────

export function createSession(hostSocketId: string, hostName: string, joinUrl: string): ServerSession {
  const code = generateSessionCode();
  const session: ServerSession = {
    code,
    hostSocketId,
    hostName,
    joinUrl,
    startedAt: Date.now(),
  };
  sessions.set(code, session);
  sessionToHost.set(code, hostSocketId);
  return session;
}

export function getSession(code: string): ServerSession | undefined {
  return sessions.get(code);
}

export function getAllSessions(): ServerSession[] {
  return Array.from(sessions.values());
}

export function getSessionByHostSocket(socketId: string): ServerSession | undefined {
  for (const session of sessions.values()) {
    if (session.hostSocketId === socketId) return session;
  }
  return undefined;
}

export function getHostSocketForSession(code: string): string | undefined {
  return sessionToHost.get(code);
}

// ─── Worker ops ──────────────────────────────────────────────────────────────

export function registerWorker(socketId: string, data: {
  name: string;
  device: string;
  sessionCode: string;
  isHost?: boolean;
  telemetry?: WorkerTelemetry;
  location?: WorkerLocation;
}): ServerWorker {
  const id = `wkr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const worker: ServerWorker = {
    id,
    socketId,
    name: data.name,
    device: data.device,
    type: "browser",
    status: "idle",
    capabilities: ["mock-compute", "fractal-render"],
    lastSeenAt: now,
    lastHeartbeatAt: now,
    connectedAt: now,
    tasksCompleted: 0,
    sessionCode: data.sessionCode,
    telemetry: data.telemetry,
    totalBusyMs: 0,
    totalTaskDurationMs: 0,
    tilesCompleted: 0,
    pixelsRendered: 0,
    totalTileDurationMs: 0,
    isHost: data.isHost,
    location: data.location,
  };
  workers.set(id, worker);
  socketToWorker.set(socketId, id);
  return worker;
}

export function getWorker(id: string): ServerWorker | undefined {
  return workers.get(id);
}

export function getWorkerBySocket(socketId: string): ServerWorker | undefined {
  const id = socketToWorker.get(socketId);
  return id ? workers.get(id) : undefined;
}

export function getWorkersForSession(code: string): ServerWorker[] {
  return Array.from(workers.values()).filter((w) => w.sessionCode === code);
}

export function getIdleWorkersForSession(code: string): ServerWorker[] {
  return getWorkersForSession(code).filter((w) => w.status === "idle");
}

export function updateWorker(id: string, updates: Partial<ServerWorker>): ServerWorker | undefined {
  const w = workers.get(id);
  if (!w) return undefined;
  const updated = { ...w, ...updates, lastSeenAt: Date.now() };
  workers.set(id, updated);
  return updated;
}

export function markWorkerOffline(socketId: string): ServerWorker | undefined {
  const workerId = socketToWorker.get(socketId);
  if (!workerId) return undefined;
  socketToWorker.delete(socketId);
  return updateWorker(workerId, { status: "offline", currentTaskId: undefined });
}

// ─── Job ops ─────────────────────────────────────────────────────────────────

export function createJob(data: {
  rawPrompt: string;
  normalizedCommand: string;
  jobType: JobType;
  title: string;
  sessionCode: string;
  fractalConfig?: FractalJobConfig;
}): ServerJob {
  jobCounter++;
  const id = `job_${jobCounter.toString().padStart(3, "0")}_${Date.now().toString(36)}`;
  const job: ServerJob = {
    id,
    title: data.title,
    rawPrompt: data.rawPrompt,
    normalizedCommand: data.normalizedCommand,
    jobType: data.jobType,
    status: "queued",
    createdAt: Date.now(),
    taskIds: [],
    sessionCode: data.sessionCode,
    fractalConfig: data.fractalConfig,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ServerJob | undefined {
  return jobs.get(id);
}

export function getJobsForSession(code: string): ServerJob[] {
  return Array.from(jobs.values()).filter((j) => j.sessionCode === code);
}

export function updateJob(id: string, updates: Partial<ServerJob>): ServerJob | undefined {
  const j = jobs.get(id);
  if (!j) return undefined;
  const updated = { ...j, ...updates };
  jobs.set(id, updated);
  return updated;
}

// ─── Task ops ────────────────────────────────────────────────────────────────

export function createTask(data: Omit<ServerTask, "id">): ServerTask {
  taskCounter++;
  const id = `tsk_${taskCounter.toString().padStart(3, "0")}_${Date.now().toString(36)}`;
  const task: ServerTask = { id, ...data };
  tasks.set(id, task);
  return task;
}

export function getTask(id: string): ServerTask | undefined {
  return tasks.get(id);
}

export function getTasksForJob(jobId: string): ServerTask[] {
  const job = jobs.get(jobId);
  if (!job) return [];
  return job.taskIds.map((tid) => tasks.get(tid)).filter(Boolean) as ServerTask[];
}

export function updateTask(id: string, updates: Partial<ServerTask>): ServerTask | undefined {
  const t = tasks.get(id);
  if (!t) return undefined;
  const updated = { ...t, ...updates };
  tasks.set(id, updated);
  return updated;
}

// ─── Wire serializers ─────────────────────────────────────────────────────────

export function toWireWorker(w: ServerWorker): WireWorker {
  const now = Date.now();
  const totalConnectedMs = Math.max(now - w.connectedAt, 0);
  const inFlightBusyMs =
    w.status === "working" && w.taskStartedAt ? Math.max(now - w.taskStartedAt, 0) : 0;
  const totalBusyMs = w.totalBusyMs + inFlightBusyMs;
  const avgTaskDurationMs =
    w.tasksCompleted > 0 ? Math.round(w.totalTaskDurationMs / w.tasksCompleted) : undefined;
  const tasksPerMinute =
    totalConnectedMs > 0
      ? Math.round((w.tasksCompleted / (totalConnectedMs / 60000)) * 10) / 10
      : undefined;
  const avgTileDurationMs =
    w.tilesCompleted > 0 ? Math.round(w.totalTileDurationMs / w.tilesCompleted) : undefined;
  const renderThroughput =
    totalBusyMs > 0 ? Math.round(w.pixelsRendered / (totalBusyMs / 1000)) : undefined;

  let taskEfficiency: number | undefined;
  if (renderThroughput && w.benchmark?.benchmarkComputeMs) {
    const benchmarkThroughput = benchmarkPixelsPerSecond(w.benchmark.benchmarkComputeMs);
    if (benchmarkThroughput > 0) {
      taskEfficiency = Math.round((renderThroughput / benchmarkThroughput) * 100);
    }
  }

  return {
    id: w.id,
    name: w.name,
    device: w.device,
    type: w.type,
    status: w.status,
    capabilities: w.capabilities,
    currentTaskId: w.currentTaskId,
    lastSeenAt: w.lastSeenAt,
    tasksCompleted: w.tasksCompleted,
    connectedAt: w.connectedAt,
    telemetry: w.telemetry,
    benchmark: w.benchmark,
    metrics: {
      connectedAt: w.connectedAt,
      lastHeartbeatAt: w.lastHeartbeatAt,
      totalConnectedMs,
      totalBusyMs,
      busyRatio: totalConnectedMs > 0 ? Math.min(totalBusyMs / totalConnectedMs, 1) : 0,
      avgTaskDurationMs,
      lastTaskDurationMs: w.lastTaskDurationMs,
      tasksPerMinute,
      tilesCompleted: w.tilesCompleted,
      pixelsRendered: w.pixelsRendered,
      avgTileDurationMs,
      renderThroughput,
      taskEfficiency,
    },
    isHost: w.isHost,
    location: w.location,
    carbonData: w.carbonData,
  };
}

export function toWireTask(t: ServerTask): WireTask {
  return {
    id: t.id,
    jobId: t.jobId,
    title: t.title,
    description: t.description,
    jobType: t.jobType,
    status: t.status,
    assignedWorkerId: t.assignedWorkerId,
    inputPayload: t.inputPayload,
    outputPayload: t.outputPayload,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    progress: t.progress,
  };
}

export function toWireJob(j: ServerJob): WireJob {
  const jobTasks = getTasksForJob(j.id).map(toWireTask);
  const completedCount = jobTasks.filter((t) => t.status === "completed").length;
  const progress =
    jobTasks.length > 0 ? Math.round((completedCount / jobTasks.length) * 100) : 0;

  return {
    id: j.id,
    title: j.title,
    rawPrompt: j.rawPrompt,
    jobType: j.jobType,
    status: j.status,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    tasks: jobTasks,
    result: j.result,
    // Attach computed progress as a non-standard field the client can use
    ...(({ progress } as unknown) as Record<string, unknown>),
  } as WireJob & { progress: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CLMT-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getQueuedTasksForSession(sessionCode: string): ServerTask[] {
  const sessionJobs = getJobsForSession(sessionCode);
  const allTasks: ServerTask[] = [];
  for (const job of sessionJobs) {
    if (job.status === "running" || job.status === "decomposing") {
      for (const tid of job.taskIds) {
        const t = tasks.get(tid);
        if (t && t.status === "queued") allTasks.push(t);
      }
    }
  }
  return allTasks;
}
