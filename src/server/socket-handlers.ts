import type { Server as IOServer, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  FractalJobConfig,
  FractalTileInput,
  FractalTileOutput,
} from "../lib/shared-types";
import {
  createSession,
  getSession,
  getSessionByHostSocket,
  registerWorker,
  getWorkerBySocket,
  markWorkerOffline,
  getWorkersForSession,
  getJobsForSession,
  createJob,
  getJob,
  getTask,
  updateTask,
  updateJob,
  updateWorker,
  toWireWorker,
  toWireJob,
  getTasksForJob,
  getHostSocketForSession,
  createTask,
  releaseJobTasks,
  removeWorker,
} from "./store";
import { decomposeJob, detectJobType, deriveTitle } from "./decomposer";
import { runScheduler } from "./scheduler";
import { reduceJobResults } from "./reducer";
import { networkInterfaces } from "os";
import type { WorkerTelemetry } from "../lib/shared-types";
import { logTaskResult, persistJobSnapshot, persistTaskSnapshots } from "./mongo";
import { decomposeWithLLM, synthesizeResult } from "./llm-decomposer";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

// ─── Local IP detection ───────────────────────────────────────────────────────

export function getLocalIP(): string {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function mergeTelemetry(
  current: WorkerTelemetry | undefined,
  incoming: Partial<WorkerTelemetry> | undefined
): WorkerTelemetry | undefined {
  if (!current && !incoming) return undefined;
  if (!current) return incoming as WorkerTelemetry;
  if (!incoming) return current;

  return {
    ...current,
    ...incoming,
    screen: incoming.screen ? { ...current.screen, ...incoming.screen } : current.screen,
    network: incoming.network ? { ...current.network, ...incoming.network } : current.network,
    battery: incoming.battery ? { ...current.battery, ...incoming.battery } : current.battery,
    storage: incoming.storage ? { ...current.storage, ...incoming.storage } : current.storage,
  };
}

export function setupSocketHandlers(io: IO, port: number) {
  const localIP = getLocalIP();

  // Throttle job:update broadcasts during task:progress — at most once per 150ms per job
  const progressBroadcastTimers = new Map<string, ReturnType<typeof setTimeout>>();
  function scheduleJobUpdate(jobId: string, hostSocketId: string) {
    if (progressBroadcastTimers.has(jobId)) return;
    progressBroadcastTimers.set(jobId, setTimeout(() => {
      progressBroadcastTimers.delete(jobId);
      const j = getJob(jobId);
      if (j) io.to(hostSocketId).emit("job:update", toWireJob(j));
    }, 150));
  }

  const persistJobAndTasks = (jobId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    const wireJob = toWireJob(job);
    void persistJobSnapshot({ ...wireJob, sessionCode: job.sessionCode });
    void persistTaskSnapshots(
      wireJob.tasks.map((task) => ({
        ...task,
        sessionCode: job.sessionCode,
        jobType: wireJob.jobType,
      }))
    );
  };

  io.on("connection", (socket: Sock) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Host registers ────────────────────────────────────────────────────────
    socket.on("host:register", ({ sessionCode } = {}) => {
      let session = sessionCode ? getSession(sessionCode) : undefined;

      if (!session) {
        // Placeholder URL first so we can get the session code, then update it
        session = createSession(socket.id, socket.handshake.headers.host ?? "host", "");
        session.joinUrl = `http://${localIP}:${port}/join?code=${session.code}`;
        console.log(`[host] New session created: ${session.code}`);
      } else {
        // Update host socket (re-connect case)
        session.hostSocketId = socket.id;
        console.log(`[host] Re-registered for session: ${session.code}`);
      }

      // Auto-register the host browser as a worker node
      const existingHostWorker = getWorkersForSession(session.code).find(w => w.isHost);
      if (!existingHostWorker) {
        registerWorker(socket.id, {
          name: "Host Machine",
          device: socket.handshake.headers["user-agent"]?.includes("Mac") ? "macOS" : "Host Browser",
          sessionCode: session.code,
          isHost: true,
        });
      }

      const workers = getWorkersForSession(session.code).map(toWireWorker);
      const jobs = getJobsForSession(session.code).map(toWireJob);

      socket.emit("session:state", {
        session: {
          code: session.code,
          joinUrl: session.joinUrl,
          startedAt: session.startedAt,
          hostName: session.hostName,
        },
        workers,
        jobs,
      });
    });

    // ── Worker joins ──────────────────────────────────────────────────────────
    socket.on("worker:join", ({ sessionCode, name, device }) => {
      const session = getSession(sessionCode);
      if (!session) {
        socket.emit("error", { message: `Session ${sessionCode} not found` });
        return;
      }

      // Idempotent: if this socket already registered as a worker for this session, just re-ack
      const existing = getWorkerBySocket(socket.id);
      if (existing && existing.sessionCode === sessionCode && existing.status !== "offline") {
        const workers = getWorkersForSession(sessionCode).map(toWireWorker);
        socket.emit("workers:update", workers);
        const hostSocketId = getHostSocketForSession(sessionCode);
        if (hostSocketId) runScheduler(io, sessionCode, hostSocketId);
        return;
      }

      registerWorker(socket.id, { name, device, sessionCode });
      console.log(`[worker] "${name}" joined session ${sessionCode}`);

      // Ack the worker
      const workers = getWorkersForSession(sessionCode).map(toWireWorker);
      socket.emit("workers:update", workers);

      // Notify host
      const hostSocketId = getHostSocketForSession(sessionCode);
      if (hostSocketId) {
        io.to(hostSocketId).emit("workers:update", workers);
      }

      // Try to schedule any queued tasks
      if (hostSocketId) {
        runScheduler(io, sessionCode, hostSocketId);
      }
    });

    socket.on("worker:profile", ({ device, telemetry, benchmark }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      updateWorker(worker.id, {
        device: device ?? telemetry?.deviceLabel ?? worker.device,
        telemetry: mergeTelemetry(worker.telemetry, telemetry),
        benchmark: benchmark ?? worker.benchmark,
        lastHeartbeatAt: Date.now(),
      });

      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      if (hostSocketId) {
        io.to(hostSocketId).emit(
          "workers:update",
          getWorkersForSession(worker.sessionCode).map(toWireWorker)
        );
      }
    });

    // ── Job submitted (text command) ──────────────────────────────────────────
    socket.on("job:submit", ({ command }) => {
      const session = getSessionByHostSocket(socket.id);
      if (!session) {
        socket.emit("error", { message: "Host session not found" });
        return;
      }

      const jobType = detectJobType(command);
      const title = deriveTitle(command, jobType);

      const job = createJob({
        rawPrompt: command,
        normalizedCommand: command.replace(/^(hey\s+)?clementine[,.]?\s*/i, "").trim(),
        jobType,
        title,
        sessionCode: session.code,
      });

      console.log(`[job] Created "${title}" (${jobType}) for session ${session.code}`);
      persistJobAndTasks(job.id);

      // Send initial job to host
      socket.emit("job:created", toWireJob(job));

      (async () => {
        try {
          updateJob(job.id, { status: "decomposing" });
          persistJobAndTasks(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));

          const llmDecomposition = await decomposeWithLLM(command);

          if (llmDecomposition?.tasks?.length) {
            const taskIds = llmDecomposition.tasks.map((spec) =>
              createTask({
                jobId: job.id,
                title: spec.title,
                description: spec.description,
                jobType: job.jobType,
                status: "queued",
                progress: 0,
                inputPayload: {
                  batchSize: Math.floor(1000 + spec.complexity * 1500),
                  complexity: spec.complexity,
                  operationType: job.jobType,
                  dataLabel: spec.dataLabel ?? llmDecomposition.jobTitle,
                  estimatedSeconds: spec.estimatedSeconds,
                  seed: Math.floor(Math.random() * 100000),
                },
              }).id
            );

            updateJob(job.id, {
              title: llmDecomposition.jobTitle,
              taskIds,
              normalizedCommand: JSON.stringify({
                original: command,
                resultSummaryHint: llmDecomposition.resultSummaryHint,
              }),
            });

            console.log(
              `[job] LLM produced ${taskIds.length} tasks for "${llmDecomposition.jobTitle}"`
            );
          } else {
            const tasks = decomposeJob(getJob(job.id)!);
            console.log(`[job] Heuristic decomposition created ${tasks.length} tasks`);
          }

          updateJob(job.id, { status: "running", startedAt: Date.now() });
          persistJobAndTasks(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));
          runScheduler(io, session.code, socket.id);
        } catch (err) {
          console.error(`[job] orchestration failed for ${job.id}:`, err);
          updateJob(job.id, { status: "failed" });
          persistJobAndTasks(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));
        }
      })();
    });

    // ── Fractal job submitted directly ────────────────────────────────────────
    socket.on("fractal:submit", (config: FractalJobConfig) => {
      const session = getSessionByHostSocket(socket.id);
      if (!session) {
        socket.emit("error", { message: "Host session not found" });
        return;
      }

      const title = `Mandelbrot Render — ${config.width}×${config.height}`;
      const job = createJob({
        rawPrompt: JSON.stringify(config),
        normalizedCommand: title,
        jobType: "fractal-render",
        title,
        sessionCode: session.code,
        fractalConfig: config,
      });

      console.log(`[fractal] Created job "${title}" for session ${session.code}`);
      persistJobAndTasks(job.id);
      socket.emit("job:created", toWireJob(job));

      // Decompose immediately — no text-parsing delay needed
      updateJob(job.id, { status: "decomposing" });
      persistJobAndTasks(job.id);
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      const tasks = decomposeJob(getJob(job.id)!);
      console.log(`[fractal] ${tasks.length} tile tasks created`);
      persistJobAndTasks(job.id);

      updateJob(job.id, { status: "running", startedAt: Date.now() });
      persistJobAndTasks(job.id);
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      runScheduler(io, session.code, socket.id);
    });

    // ── Task progress ─────────────────────────────────────────────────────────
    socket.on("task:progress", ({ taskId, progress }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      const progressTask = getTask(taskId);
      updateTask(taskId, { status: "running", progress });
      updateWorker(worker.id, {
        status: "working",
        lastHeartbeatAt: Date.now(),
      });
      // Notify host (throttled — no need to persist to DB on every progress tick)
      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      if (hostSocketId && progressTask) {
        scheduleJobUpdate(progressTask.jobId, hostSocketId);
      }
    });

    // ── Task complete ─────────────────────────────────────────────────────────
    socket.on("task:complete", ({ taskId, output }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      const now = Date.now();

      // For fractal tiles: do NOT store the pixel array in outputPayload.
      // The pixel data is forwarded directly to the host below via fractal:tile:result.
      // Storing 40KB pixel arrays per task would blow up every job:update broadcast.
      const taskForType = getTask(taskId);
      const storedOutput = taskForType?.jobType === "fractal-render"
        ? { durationMs: (output as unknown as FractalTileOutput).durationMs, tileRendered: true }
        : output;
      const input = taskForType?.inputPayload as FractalTileInput | undefined;
      const outputDuration =
        typeof output?.durationMs === "number" ? output.durationMs : undefined;
      const taskDurationMs = outputDuration
        ?? (taskForType?.startedAt ? Math.max(now - taskForType.startedAt, 0) : 0);
      const renderedPixels =
        taskForType?.jobType === "fractal-render" && input
          ? input.tileWidth * input.tileHeight
          : 0;

      updateTask(taskId, {
        status: "completed",
        progress: 100,
        completedByWorkerId: worker.id,
        completedByWorkerName: worker.name,
        outputPayload: storedOutput,
        completedAt: now,
      });
      if (taskForType) persistJobAndTasks(taskForType.jobId);
      if (taskForType) {
        void logTaskResult({
          taskId: taskForType.id,
          jobId: taskForType.jobId,
          title: taskForType.title,
          jobType: taskForType.jobType,
          sessionCode: worker.sessionCode,
          workerId: worker.id,
          workerName: worker.name,
          status: "completed",
          durationMs: taskDurationMs,
          output: storedOutput,
        });
      }

      updateWorker(worker.id, {
        status: "idle",
        currentTaskId: undefined,
        tasksCompleted: worker.tasksCompleted + 1,
        lastTaskDurationMs: taskDurationMs,
        totalBusyMs: worker.totalBusyMs + taskDurationMs,
        totalTaskDurationMs: worker.totalTaskDurationMs + taskDurationMs,
        taskStartedAt: undefined,
        tilesCompleted: worker.tilesCompleted + (renderedPixels > 0 ? 1 : 0),
        pixelsRendered: worker.pixelsRendered + renderedPixels,
        totalTileDurationMs: worker.totalTileDurationMs + (renderedPixels > 0 ? taskDurationMs : 0),
        lastHeartbeatAt: Date.now(),
      });

      console.log(`[task] "${taskId}" completed by worker "${worker.name}"`);

      const task = getTask(taskId)!;
      const job = getJob(task.jobId)!;
      const allTasks = getTasksForJob(job.id);

      const hostSocketId = getHostSocketForSession(worker.sessionCode);

      // For fractal tiles, forward pixel data directly to host
      if (task.jobType === "fractal-render" && output?.pixels && hostSocketId) {
        const inp = task.inputPayload as unknown as FractalTileInput;
        const out = output as unknown as FractalTileOutput;
        io.to(hostSocketId).emit("fractal:tile:result", {
          jobId: job.id,
          taskId: task.id,
          tileX: inp.tileX,
          tileY: inp.tileY,
          tileWidth: inp.tileWidth,
          tileHeight: inp.tileHeight,
          imageWidth: inp.imageWidth,
          imageHeight: inp.imageHeight,
          pixels: out.pixels,
          workerName: worker.name,
          durationMs: out.durationMs,
        });
      }

      // Check if job is fully done
      const allDone = allTasks.every(
        (t) => t.status === "completed" || t.status === "failed"
      );

      if (allDone) {
        const completedJob = updateJob(job.id, {
          status: "reducing",
          completedAt: now,
        })!;
        persistJobAndTasks(completedJob.id);

        if (hostSocketId) io.to(hostSocketId).emit("job:update", toWireJob(completedJob));

        (async () => {
          await new Promise<void>((r) => setTimeout(r, 400));
          const finalJob = getJob(job.id)!;
          const finalTasks = getTasksForJob(job.id);
          const result = reduceJobResults(finalJob, finalTasks);

          if (finalJob.jobType !== "fractal-render") {
            try {
              const parsedMetadata = safeParseJobMetadata(finalJob.normalizedCommand);
              const taskSummaries = finalTasks
                .filter((t) => t.status === "completed")
                .map((t) => summarizeTaskOutput(t));

              result.summary = await synthesizeResult(
                finalJob.title,
                parsedMetadata.original ?? finalJob.rawPrompt,
                taskSummaries,
                parsedMetadata.resultSummaryHint ?? result.summary
              );
              result.outputLines = result.summary
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
            } catch (err) {
              console.warn(`[reducer] LLM synthesis failed for "${finalJob.title}":`, err);
            }
          }

          const finishedJob = updateJob(job.id, { status: "completed", result })!;
          persistJobAndTasks(finishedJob.id);
          console.log(`[reducer] Job "${job.title}" completed`);

          if (hostSocketId) {
            io.to(hostSocketId).emit("job:complete", {
              job: toWireJob(finishedJob),
              result,
            });
          }

          const workers = getWorkersForSession(worker.sessionCode).map(toWireWorker);
          if (hostSocketId) io.to(hostSocketId).emit("workers:update", workers);

          // Release task objects from memory after all emits — they're persisted to Mongo
          // and the client has the final snapshot. Job record stays for session history.
          releaseJobTasks(finishedJob.id);
        })();
      } else {
        // Update job progress for host
        if (hostSocketId) {
          io.to(hostSocketId).emit("job:update", toWireJob(job));
        }
        persistJobAndTasks(job.id);

        // Try to schedule next queued task to this now-idle worker
        if (hostSocketId) {
          runScheduler(io, worker.sessionCode, hostSocketId);
        }

        // Broadcast updated worker list
        const workers = getWorkersForSession(worker.sessionCode).map(toWireWorker);
        if (hostSocketId) io.to(hostSocketId).emit("workers:update", workers);
      }
    });

    // ── Browser telemetry heartbeat ───────────────────────────────────────────
    socket.on("metrics:report", ({ telemetry }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      updateWorker(worker.id, {
        lastHeartbeatAt: Date.now(),
        telemetry: mergeTelemetry(worker.telemetry, telemetry),
      });

      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      if (hostSocketId) {
        io.to(hostSocketId).emit(
          "workers:update",
          getWorkersForSession(worker.sessionCode).map(toWireWorker)
        );
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);

      // Worker disconnected
      const offlineWorker = markWorkerOffline(socket.id);
      if (offlineWorker) {
        // Remove from memory after 30s — long enough for the UI to show the offline state
        setTimeout(() => removeWorker(offlineWorker.id), 30_000);

        const hostSocketId = getHostSocketForSession(offlineWorker.sessionCode);
        if (hostSocketId) {
          const workers = getWorkersForSession(offlineWorker.sessionCode).map(toWireWorker);
          io.to(hostSocketId).emit("workers:update", workers);
        }

        // If the worker had an assigned task, requeue it
        if (offlineWorker.currentTaskId) {
          updateTask(offlineWorker.currentTaskId, {
            status: "queued",
            assignedWorkerId: undefined,
            progress: 0,
          });
          const task = getTask(offlineWorker.currentTaskId);
          if (task) persistJobAndTasks(task.jobId);
          if (task) {
            const hostSocketId = getHostSocketForSession(offlineWorker.sessionCode);
            if (hostSocketId) runScheduler(io, offlineWorker.sessionCode, hostSocketId);
          }
        }
      }
    });
  });
}

function safeParseJobMetadata(normalizedCommand: string): {
  original?: string;
  resultSummaryHint?: string;
} {
  try {
    const parsed = JSON.parse(normalizedCommand) as {
      original?: string;
      resultSummaryHint?: string;
    };
    return parsed ?? {};
  } catch {
    return {};
  }
}

function summarizeTaskOutput(task: ReturnType<typeof getTask> extends infer T ? NonNullable<T> : never) {
  const output = task.outputPayload;
  if (!output) return `${task.title}: completed`;

  if (typeof output.summary === "string") {
    return `${task.title}: ${output.summary}`;
  }

  if (typeof output.result === "string") {
    return `${task.title}: ${output.result}`;
  }

  if (typeof output.durationMs === "number") {
    return `${task.title}: completed in ${Math.round(output.durationMs)}ms`;
  }

  return `${task.title}: ${JSON.stringify(output)}`;
}
