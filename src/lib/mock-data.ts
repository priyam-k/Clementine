import type { Worker, Job, CommandEntry, Session } from "./types";

export const mockSession: Session = {
  id: "sess_8f3a2c1b",
  hostName: "Macbook-Pro-John",
  joinCode: "CLMT-4829",
  joinUrl: "http://192.168.1.42:3000/join",
  startedAt: "2026-03-28T09:14:00Z",
  workerCount: 5,
  activeJobId: "job_001",
};

export const mockWorkers: Worker[] = [
  {
    id: "wkr_001",
    nickname: "Satsuma",
    device: "iPad Pro M2",
    status: "working",
    cpu: 74,
    ram: 62,
    tasksCompleted: 14,
    currentTaskId: "sub_003",
    joinedAt: "2026-03-28T09:15:32Z",
    ip: "192.168.1.101",
  },
  {
    id: "wkr_002",
    nickname: "Valencia",
    device: "iPhone 15 Pro",
    status: "working",
    cpu: 88,
    ram: 71,
    tasksCompleted: 9,
    currentTaskId: "sub_007",
    joinedAt: "2026-03-28T09:16:01Z",
    ip: "192.168.1.102",
  },
  {
    id: "wkr_003",
    nickname: "Navel",
    device: "MacBook Air M3",
    status: "idle",
    cpu: 12,
    ram: 34,
    tasksCompleted: 22,
    joinedAt: "2026-03-28T09:14:55Z",
    ip: "192.168.1.103",
  },
  {
    id: "wkr_004",
    nickname: "Tangelo",
    device: "Surface Pro 11",
    status: "working",
    cpu: 91,
    ram: 80,
    tasksCompleted: 7,
    currentTaskId: "sub_011",
    joinedAt: "2026-03-28T09:18:20Z",
    ip: "192.168.1.104",
  },
  {
    id: "wkr_005",
    nickname: "Mandarin",
    device: "Galaxy Tab S9",
    status: "done",
    cpu: 5,
    ram: 18,
    tasksCompleted: 31,
    joinedAt: "2026-03-28T09:13:10Z",
    ip: "192.168.1.105",
  },
  {
    id: "wkr_006",
    nickname: "Clementine",
    device: "Raspberry Pi 5",
    status: "offline",
    cpu: 0,
    ram: 0,
    tasksCompleted: 4,
    joinedAt: "2026-03-28T09:19:40Z",
    ip: "192.168.1.106",
  },
];

export const mockJobs: Job[] = [
  {
    id: "job_001",
    name: "Neural Synthesis Engine v4.2",
    description: "High-fidelity tensor decomposition and manifold learning for distributed neural network optimization.",
    command: "Hey Clementine, run a distributed neural net analysis on dataset ambrosia-v4",
    status: "running",
    progress: 68,
    totalSubtasks: 32,
    completedSubtasks: 21,
    failedSubtasks: 0,
    createdAt: "2026-03-28T09:22:00Z",
    startedAt: "2026-03-28T09:22:14Z",
    subtasks: [
      { id: "sub_001", label: "Data Ingestion & Sanitization", status: "completed", assignedTo: "wkr_005", progress: 100, durationMs: 862000 },
      { id: "sub_002", label: "Tokenization Pass A", status: "completed", assignedTo: "wkr_003", progress: 100, durationMs: 420000 },
      { id: "sub_003", label: "Tensor Decomposition Batch 1", status: "running", assignedTo: "wkr_001", progress: 72 },
      { id: "sub_004", label: "Tensor Decomposition Batch 2", status: "running", assignedTo: "wkr_002", progress: 58 },
      { id: "sub_005", label: "Manifold Learning Phase 1", status: "running", assignedTo: "wkr_004", progress: 41 },
      { id: "sub_006", label: "Manifold Learning Phase 2", status: "assigned", assignedTo: "wkr_001", progress: 0 },
      { id: "sub_007", label: "Gradient Descent Run 1", status: "running", assignedTo: "wkr_002", progress: 23 },
      { id: "sub_008", label: "Gradient Descent Run 2", status: "queued", progress: 0 },
      { id: "sub_009", label: "Validation Check", status: "queued", progress: 0 },
      { id: "sub_010", label: "Result Aggregation", status: "queued", progress: 0 },
      { id: "sub_011", label: "Loss Function Analysis", status: "running", assignedTo: "wkr_004", progress: 67 },
    ],
  },
  {
    id: "job_002",
    name: "Fractal Render — Sequence Bravo",
    description: "Parallel fractal geometry rendering across distributed GPU shaders.",
    command: "Hey Clementine, render fractal sequence B at 4K resolution",
    status: "queued",
    progress: 0,
    totalSubtasks: 16,
    completedSubtasks: 0,
    failedSubtasks: 0,
    createdAt: "2026-03-28T09:38:00Z",
    subtasks: [],
  },
  {
    id: "job_003",
    name: "Dataset Compression — Citrus Archive",
    description: "Lossless compression pipeline for the citrus genomics research dataset.",
    command: "Hey Clementine, compress citrus-archive dataset using optimal LZ codec",
    status: "completed",
    progress: 100,
    totalSubtasks: 8,
    completedSubtasks: 8,
    failedSubtasks: 0,
    createdAt: "2026-03-28T08:55:00Z",
    startedAt: "2026-03-28T08:55:30Z",
    completedAt: "2026-03-28T09:11:44Z",
    subtasks: [],
    result: {
      summary: "8 subtasks completed across 4 workers. 14.2 GB → 3.8 GB (73.2% reduction). No errors.",
      outputLines: [
        "✓ Shard 1/8 — 1.78 GB compressed to 481 MB",
        "✓ Shard 2/8 — 1.82 GB compressed to 489 MB",
        "✓ Shard 3/8 — 1.74 GB compressed to 471 MB",
        "✓ Shard 4/8 — 1.91 GB compressed to 511 MB",
        "✓ Shard 5/8 — 1.69 GB compressed to 462 MB",
        "✓ Shard 6/8 — 1.88 GB compressed to 503 MB",
        "✓ Shard 7/8 — 1.77 GB compressed to 479 MB",
        "✓ Shard 8/8 — 1.59 GB compressed to 427 MB",
        "→ Total: 14.18 GB → 3.82 GB | Ratio: 3.71:1",
      ],
      durationMs: 974000,
      workerCount: 4,
      dataProcessed: "14.2 GB",
    },
  },
];

export const mockCommandHistory: CommandEntry[] = [
  {
    id: "cmd_001",
    text: "Hey Clementine, compress citrus-archive dataset using optimal LZ codec",
    timestamp: "2026-03-28T08:55:00Z",
    status: "completed",
    jobId: "job_003",
  },
  {
    id: "cmd_002",
    text: "Hey Clementine, run a distributed neural net analysis on dataset ambrosia-v4",
    timestamp: "2026-03-28T09:22:00Z",
    status: "dispatched",
    jobId: "job_001",
  },
  {
    id: "cmd_003",
    text: "Hey Clementine, render fractal sequence B at 4K resolution",
    timestamp: "2026-03-28T09:38:00Z",
    status: "pending",
    jobId: "job_002",
  },
];

export function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
