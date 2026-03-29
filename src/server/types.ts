// Server-side full types (may include Node-only fields not sent over wire)
import type {
  WorkerType,
  WorkerStatus,
  TaskStatus,
  JobStatus,
  JobType,
  WireResult,
  FractalJobConfig,
  WorkerTelemetry,
  WorkerBenchmark,
  WorkerLocation,
  WorkerCarbonData,
} from "../lib/shared-types";

export interface ServerWorker {
  id: string;
  socketId: string;
  name: string;
  device: string;
  type: WorkerType;
  status: WorkerStatus;
  capabilities: string[];
  currentTaskId?: string;
  lastSeenAt: number;
  lastHeartbeatAt?: number;
  connectedAt: number;
  tasksCompleted: number;
  sessionCode: string;
  telemetry?: WorkerTelemetry;
  benchmark?: WorkerBenchmark;
  totalBusyMs: number;
  totalTaskDurationMs: number;
  lastTaskDurationMs?: number;
  taskStartedAt?: number;
  tilesCompleted: number;
  pixelsRendered: number;
  totalTileDurationMs: number;
  isHost?: boolean;
  location?: WorkerLocation;
  carbonData?: WorkerCarbonData;
}

export interface ServerTask {
  id: string;
  jobId: string;
  title: string;
  description: string;
  jobType: JobType;
  status: TaskStatus;
  assignedWorkerId?: string;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  progress: number;
  carbonIntensityAtAssignment?: number;
  estimatedCarbonGrams?: number;
}

export interface ServerJob {
  id: string;
  title: string;
  rawPrompt: string;
  normalizedCommand: string;
  jobType: JobType;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  taskIds: string[];
  result?: WireResult;
  sessionCode: string;
  fractalConfig?: FractalJobConfig;
  totalCarbonGrams?: number;
  carbonSavedGrams?: number;
}

export interface ServerSession {
  code: string;
  hostSocketId: string;
  hostName: string;
  joinUrl: string;
  startedAt: number;
}
