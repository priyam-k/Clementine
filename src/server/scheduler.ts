import type { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../lib/shared-types";
import {
  getQueuedTasksForSession,
  getIdleWorkersForSession,
  updateTask,
  updateWorker,
  getJob,
  updateJob,
  toWireTask,
  toWireJob,
  getWorkersForSession,
  toWireWorker,
} from "./store";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

// ─── Scheduler ────────────────────────────────────────────────────────────────
//
// Assigns queued tasks to idle workers for a given session.
// Called after: job decomposition, task completion, worker join.

// ─── Worker scoring ────────────────────────────────────────────────────────────
// Lower score = less loaded = preferred for next task.
// Weights: CPU is dominant, RAM secondary, GPU tertiary.
// Also penalizes workers that already have more tasks completed
// (to spread load across fresh nodes when available).
// Carbon penalty: gCO2/kWh above a 200 gCO2/kWh neutral baseline, weight=30.
// Workers with no carbon data get 0 penalty (treated as neutral).

function workerScore(w: ReturnType<typeof getIdleWorkersForSession>[number]): number {
  const connectedMs = Math.max(Date.now() - w.connectedAt, 1);
  const busyRatio = Math.min(w.totalBusyMs / connectedMs, 1);
  const avgTaskDurationPenalty = (w.totalTaskDurationMs / Math.max(w.tasksCompleted, 1)) / 250;
  const benchmarkBonus = (w.benchmark?.normalizedScore ?? 55) * 0.45;
  const fairnessPenalty = w.tasksCompleted * 1.5;
  // Carbon penalty: normalised to 200 gCO2/kWh baseline, weight 30
  // e.g. 20 gCO2/kWh → -27 (bonus), 500 gCO2/kWh → +75 (penalty)
  const carbonPenalty = w.carbonData
    ? (w.carbonData.gCO2perKWh / 200) * 30
    : 0;

  return busyRatio * 60 + avgTaskDurationPenalty + fairnessPenalty - benchmarkBonus + carbonPenalty;
}

export function runScheduler(io: IO, sessionCode: string, hostSocketId: string) {
  const queuedTasks = getQueuedTasksForSession(sessionCode);
  // Sort idle workers by ascending load score so least-loaded gets work first
  const idleWorkers = getIdleWorkersForSession(sessionCode)
    .sort((a, b) => workerScore(a) - workerScore(b));

  if (queuedTasks.length === 0 || idleWorkers.length === 0) return;

  const assignable = Math.min(queuedTasks.length, idleWorkers.length);

  for (let i = 0; i < assignable; i++) {
    const task = queuedTasks[i];
    const worker = idleWorkers[i];

    // Update task
    updateTask(task.id, {
      status: "assigned",
      assignedWorkerId: worker.id,
      startedAt: Date.now(),
      carbonIntensityAtAssignment: worker.carbonData?.gCO2perKWh,
    });

    // Update worker
    updateWorker(worker.id, {
      status: "working",
      currentTaskId: task.id,
      taskStartedAt: Date.now(),
    });

    // Mark job as running if first task assignment
    const job = getJob(task.jobId);
    if (job && job.status === "decomposing") {
      updateJob(job.id, { status: "running", startedAt: Date.now() });
    }

    // Send task to worker
    const wireTask = toWireTask({ ...task, status: "assigned", assignedWorkerId: worker.id });
    io.to(worker.socketId).emit("task:assigned", wireTask);

    console.log(`[scheduler] Assigned task "${task.title}" → worker "${worker.name}"`);
  }

  // Broadcast updated worker list to host
  const allWorkers = getWorkersForSession(sessionCode).map(toWireWorker);
  io.to(hostSocketId).emit("workers:update", allWorkers);

  // Broadcast job updates for all affected jobs
  const affectedJobIds = new Set(queuedTasks.slice(0, assignable).map((t) => t.jobId));
  for (const jobId of affectedJobIds) {
    const job = getJob(jobId);
    if (job) {
      io.to(hostSocketId).emit("job:update", toWireJob(job));
    }
  }
}
