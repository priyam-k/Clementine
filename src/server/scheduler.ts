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
  getSession,
} from "./store";
import { scheduleTasks, type Worker as SchedulerWorker, type Task as SchedulerTask } from "./taskScheduler";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

export function runScheduler(io: IO, sessionCode: string, hostSocketId: string) {
  const queuedTasks = getQueuedTasksForSession(sessionCode);
  const session = getSession(sessionCode);
  const schedulerBias = session?.schedulerBias ?? 0.5;
  const idleWorkers = getIdleWorkersForSession(sessionCode);

  if (queuedTasks.length === 0 || idleWorkers.length === 0) return;

  const maxBenchmarkScore = Math.max(
    1,
    ...idleWorkers.map((worker) => worker.benchmark?.normalizedScore ?? 50)
  );
  const schedulerWorkers: SchedulerWorker[] = idleWorkers.map((worker) => {
    const benchmarkScore = worker.benchmark?.normalizedScore ?? 50;
    const normalizedPerformance = 1 - benchmarkScore / maxBenchmarkScore;
    const effectiveCarbonIntensity =
      (worker.carbonIntensity ?? 250) * (1 - schedulerBias) +
      normalizedPerformance * 250 * schedulerBias;

    return {
      id: worker.id,
      socketId: worker.socketId,
      lat: worker.lat ?? 0,
      lon: worker.lon ?? 0,
      carbonIntensity: effectiveCarbonIntensity,
      activeTasks: worker.activeTasks ?? (worker.currentTaskId ? 1 : 0),
    };
  });
  const schedulerTasks: SchedulerTask[] = queuedTasks.map((task) => ({
    id: task.id,
    payload: task,
  }));
  const assignments = scheduleTasks(schedulerTasks, schedulerWorkers);

  if (assignments.length === 0) return;

  for (const assignment of assignments) {
    const task = assignment.task.payload;
    if (!isQueuedTask(task)) continue;

    const worker = idleWorkers.find((candidate) => candidate.id === assignment.worker.id);
    if (!worker) continue;

    const startedAt = Date.now();
    // Update task
    updateTask(task.id, {
      status: "assigned",
      assignedWorkerId: worker.id,
      startedAt,
    });

    // Update worker
    updateWorker(worker.id, {
      status: "working",
      currentTaskId: task.id,
      taskStartedAt: startedAt,
      activeTasks: (worker.activeTasks ?? 0) + 1,
    });

    // Mark job as running if first task assignment
    const job = getJob(task.jobId);
    if (job && job.status === "decomposing") {
      updateJob(job.id, { status: "running", startedAt: Date.now() });
    }

    // Send task to worker
    const wireTask = toWireTask({ ...task, status: "assigned", assignedWorkerId: worker.id });
    io.to(worker.socketId).emit("task:assigned", wireTask);

    console.log(
      `[scheduler] Assigned task "${task.title}" → worker "${worker.name}" (score ${assignment.suitabilityScore.toFixed(3)})`
    );
  }

  // Broadcast updated worker list to host
  const allWorkers = getWorkersForSession(sessionCode).map(toWireWorker);
  io.to(hostSocketId).emit("workers:update", allWorkers);

  // Broadcast job updates for all affected jobs
  const affectedJobIds = new Set(
    assignments
      .map((assignment) => assignment.task.payload)
      .filter(isQueuedTask)
      .map((task) => task.jobId)
  );
  for (const jobId of affectedJobIds) {
    const job = getJob(jobId);
    if (job) {
      io.to(hostSocketId).emit("job:update", toWireJob(job));
    }
  }
}

function isQueuedTask(task: unknown): task is ReturnType<typeof getQueuedTasksForSession>[number] {
  return (
    typeof task === "object" &&
    task !== null &&
    "id" in task &&
    "jobId" in task &&
    "title" in task &&
    "status" in task
  );
}
