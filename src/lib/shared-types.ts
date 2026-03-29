// ─── Wire types: shared between server and client (no Node.js deps) ─────────

export type WorkerType = "browser" | "desktop" | "gpu" | "native";
export type WorkerStatus = "idle" | "working" | "done" | "offline";
export type TaskStatus = "queued" | "assigned" | "running" | "completed" | "failed";
export type WorkerPerformanceTier = "fast" | "medium" | "slow";
export type JobStatus =
  | "queued"
  | "decomposing"
  | "running"
  | "reducing"
  | "completed"
  | "failed";
export type JobType =
  | "mock-compute"
  | "llm-analysis"
  | "batch-inference"
  | "blender-render"
  | "fractal-render"
  | "prime-sieve"
  | "text-analysis"
  | "monte-carlo"
  | "sort-benchmark"
  | "number-crunch";

// ─── Wire shapes (sent over socket) ──────────────────────────────────────────

export interface WorkerTelemetry {
  cores?: number;
  deviceMemoryGb?: number;
  userAgent?: string;
  platform?: string;
  language?: string;
  online?: boolean;
  isMobile?: boolean;
  browserName?: string;
  deviceLabel?: string;
  screen?: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  network?: {
    effectiveType?: string;
    downlinkMbps?: number;
    rttMs?: number;
  };
  battery?: {
    level?: number;
    charging?: boolean;
  };
  storage?: {
    usageBytes?: number;
    quotaBytes?: number;
    usagePercent?: number;
  };
}

export interface WorkerBenchmark {
  benchmarkComputeMs: number;
  benchmarkRoundTripMs?: number;
  normalizedScore: number;
  performanceTier: WorkerPerformanceTier;
  benchmarkCompletedAt: number;
}

export interface WorkerRuntimeMetrics {
  connectedAt: number;
  lastHeartbeatAt?: number;
  totalConnectedMs: number;
  totalBusyMs: number;
  busyRatio: number;
  avgTaskDurationMs?: number;
  lastTaskDurationMs?: number;
  tasksPerMinute?: number;
  tilesCompleted: number;
  pixelsRendered: number;
  avgTileDurationMs?: number;
  renderThroughput?: number;
  taskEfficiency?: number;
}

export interface WireWorker {
  id: string;
  name: string;
  device: string;
  carbonIntensity?: number;
  type: WorkerType;
  status: WorkerStatus;
  capabilities: string[];
  currentTaskId?: string;
  lastSeenAt: number;
  tasksCompleted: number;
  connectedAt: number;
  telemetry?: WorkerTelemetry;
  benchmark?: WorkerBenchmark;
  metrics: WorkerRuntimeMetrics;
  isHost?: boolean;
}

export interface WireTask {
  id: string;
  jobId: string;
  title: string;
  description: string;
  jobType: JobType;
  status: TaskStatus;
  assignedWorkerId?: string;
  completedByWorkerId?: string;
  completedByWorkerName?: string;
  completedCarbonIntensity?: number;
  estimatedCarbonSavedGrams?: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  progress: number;
}

export interface WorkerContribution {
  workerId: string;
  workerName: string;
  tasksCompleted: number;
  totalDurationMs: number;
  opsCount: number;
  pixelsRendered: number;
  carbonSavedGrams: number;
}

export interface WireJob {
  id: string;
  title: string;
  rawPrompt: string;
  jobType: JobType;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  tasks: WireTask[];
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  workerContributions: WorkerContribution[];
  result?: WireResult;
}

export interface WireResult {
  id: string;
  jobId: string;
  summary: string;
  outputLines: string[];
  durationMs: number;
  workerCount: number;
  dataProcessed: string;
  metrics: Record<string, number | string>;
}

export interface WireSession {
  code: string;
  joinUrl: string;
  startedAt: number;
  hostName: string;
  schedulerBias: number;
}

// ─── Socket event maps ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  "session:state": (data: {
    session: WireSession;
    workers: WireWorker[];
    jobs: WireJob[];
  }) => void;
  "worker:self": (worker: WireWorker) => void;
  "workers:update": (workers: WireWorker[]) => void;
  "job:created": (job: WireJob) => void;
  "job:update": (job: WireJob) => void;
  "job:complete": (data: { job: WireJob; result: WireResult }) => void;
  "task:assigned": (task: WireTask) => void;
  "fractal:tile:result": (payload: FractalTileResultPayload) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "host:register": (data: { sessionCode?: string }) => void;
  "scheduler:bias:set": (data: { sessionCode: string; bias: number }) => void;
  "worker:join": (data: {
    sessionCode: string;
    name: string;
    device: string;
    lat: number;
    lon: number;
  }) => void;
  "worker:profile": (data: {
    device?: string;
    telemetry?: WorkerTelemetry;
    benchmark?: WorkerBenchmark;
  }) => void;
  "job:submit": (data: { command: string; sessionCode?: string }) => void;
  "fractal:submit": (data: { config: FractalJobConfig; sessionCode?: string }) => void;
  "task:progress": (data: { taskId: string; progress: number }) => void;
  "task:complete": (data: {
    taskId: string;
    output: Record<string, unknown>;
  }) => void;
  "metrics:report": (data: {
    sentAt: number;
    telemetry?: Partial<WorkerTelemetry>;
  }) => void;
}

// ─── Fractal render types ─────────────────────────────────────────────────────

export interface FractalJobConfig {
  fractalType: "mandelbrot";
  width: number;
  height: number;
  maxIterations: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  tileSize: number;
}

export interface FractalTileInput {
  fractalType: "mandelbrot";
  tileX: number;
  tileY: number;
  tileWidth: number;
  tileHeight: number;
  imageWidth: number;
  imageHeight: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  maxIterations: number;
}

export interface FractalTileOutput {
  pixels: number[];   // flat RGBA array: tileWidth * tileHeight * 4
  durationMs: number;
}

export interface FractalTileResultPayload {
  jobId: string;
  taskId: string;
  tileX: number;
  tileY: number;
  tileWidth: number;
  tileHeight: number;
  imageWidth: number;
  imageHeight: number;
  pixels: number[];
  workerName: string;
  durationMs: number;
}

// ─── Task execution payload shapes ───────────────────────────────────────────

export interface MockComputeInput {
  batchSize: number;
  operationType: string;
  complexity: number;
  dataLabel: string;
}

export interface MockComputeOutput {
  success: boolean;
  result: string;
  opsCount: number;
  durationMs: number;
  efficiency: number;
}
