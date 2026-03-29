export type WorkerStatus = "idle" | "working" | "done" | "offline";

export type TaskStatus = "queued" | "assigned" | "running" | "completed" | "failed";

export interface Worker {
  id: string;
  nickname: string;
  device: string;
  status: WorkerStatus;
  cpu: number;
  ram: number;
  tasksCompleted: number;
  currentTaskId?: string;
  joinedAt: string;
  ip: string;
}

export interface SubTask {
  id: string;
  label: string;
  status: TaskStatus;
  assignedTo?: string; // worker id
  progress: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  name: string;
  description: string;
  command: string;
  status: JobStatus;
  progress: number;
  totalSubtasks: number;
  completedSubtasks: number;
  failedSubtasks: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCarbonSavedGrams?: number;
  subtasks: SubTask[];
  workerContributions?: Array<{
    workerId: string;
    workerName: string;
    tasksCompleted: number;
    totalDurationMs: number;
    opsCount: number;
    pixelsRendered: number;
    carbonSavedGrams: number;
  }>;
  result?: JobResult;
}

export interface JobResult {
  summary: string;
  outputLines: string[];
  durationMs: number;
  workerCount: number;
  dataProcessed: string;
  estimatedCarbonSavedGrams?: number;
}

export interface CommandEntry {
  id: string;
  text: string;
  timestamp: string;
  status: "pending" | "dispatched" | "completed" | "failed";
  jobId?: string;
}

export interface Session {
  id: string;
  hostName: string;
  joinCode: string;
  joinUrl: string;
  startedAt: string;
  workerCount: number;
  activeJobId?: string;
}
