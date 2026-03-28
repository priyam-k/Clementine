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
} from "./store";
import { decomposeJob, detectJobType, deriveTitle } from "./decomposer";
import { runScheduler } from "./scheduler";
import { reduceJobResults } from "./reducer";
import { decomposeWithLLM, synthesizeResult } from "./llm-decomposer";
import { networkInterfaces } from "os";
import type { WorkerTelemetry } from "../lib/shared-types";

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
  };
}

export function setupSocketHandlers(io: IO, port: number) {
  const localIP = getLocalIP();

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
      const jobs = [] as ReturnType<typeof toWireJob>[];

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

      // Send initial job to host
      socket.emit("job:created", toWireJob(job));

      // Decompose — try LLM first, fall back to keyword heuristics
      updateJob(job.id, { status: "decomposing" });
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      (async () => {
        const llmResult = await decomposeWithLLM(command);

        if (llmResult) {
          console.log(`[llm-decomposer] ${llmResult.tasks.length} tasks for "${llmResult.jobTitle}"`);
          // Update title to LLM-generated one
          updateJob(job.id, {
            title: llmResult.jobTitle,
            // Store hint for result synthesis
            normalizedCommand: JSON.stringify({ hint: llmResult.resultSummaryHint, original: command }),
          });

          // Create tasks from LLM spec
          const { createTask, updateJob: upJob } = await import("./store");
          const createdIds: string[] = [];
          for (const spec of llmResult.tasks) {
            const t = createTask({
              jobId: job.id,
              title: spec.title,
              description: spec.description,
              jobType: jobType,
              status: "queued",
              progress: 0,
              inputPayload: {
                batchSize: Math.floor(1000 + spec.complexity * 1500),
                complexity: spec.complexity,
                operationType: jobType,
                dataLabel: spec.dataLabel ?? llmResult.jobTitle,
                estimatedSeconds: spec.estimatedSeconds,
                seed: Math.floor(Math.random() * 100000),
              },
            });
            createdIds.push(t.id);
          }
          upJob(job.id, { taskIds: createdIds });
        } else {
          // Fallback: keyword-based decomposition
          await new Promise<void>((r) => setTimeout(r, 200));
          const tasks = decomposeJob(getJob(job.id)!);
          console.log(`[decomposer] ${tasks.length} tasks for job "${title}" (heuristic)`);
        }

        updateJob(job.id, { status: "running", startedAt: Date.now() });
        socket.emit("job:update", toWireJob(getJob(job.id)!));
        runScheduler(io, session.code, socket.id);
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
      socket.emit("job:created", toWireJob(job));

      // Decompose immediately — no text-parsing delay needed
      updateJob(job.id, { status: "decomposing" });
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      const tasks = decomposeJob(getJob(job.id)!);
      console.log(`[fractal] ${tasks.length} tile tasks created`);

      updateJob(job.id, { status: "running", startedAt: Date.now() });
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      runScheduler(io, session.code, socket.id);
    });

    // ── Task progress ─────────────────────────────────────────────────────────
    socket.on("task:progress", ({ taskId, progress }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      updateTask(taskId, { status: "running", progress });
      updateWorker(worker.id, {
        status: "working",
        lastHeartbeatAt: Date.now(),
      });

      // Notify host
      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      if (hostSocketId) {
        const task = getTask(taskId);
        if (task) {
          const job = getJob(task.jobId);
          if (job) io.to(hostSocketId).emit("job:update", toWireJob(job));
        }
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
        outputPayload: storedOutput,
        completedAt: now,
      });

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

        if (hostSocketId) io.to(hostSocketId).emit("job:update", toWireJob(completedJob));

        // Reduction — use LLM synthesis for text jobs, heuristic for others
        (async () => {
          await new Promise<void>((r) => setTimeout(r, 400));
          const finalJob = getJob(job.id)!;
          const finalTasks = getTasksForJob(job.id);
          const result = reduceJobResults(finalJob, finalTasks);

          // For non-fractal jobs, enrich the summary with LLM synthesis
          if (finalJob.jobType !== "fractal-render") {
            try {
              let hint = "Distributed computation completed.";
              let originalCommand = finalJob.rawPrompt;
              try {
                const parsed = JSON.parse(finalJob.normalizedCommand ?? "{}");
                if (parsed.hint) { hint = parsed.hint; originalCommand = parsed.original ?? originalCommand; }
              } catch { /* not JSON, use raw command */ }

              const taskSummaries = finalTasks
                .filter(t => t.status === "completed")
                .map(t => `${t.title}: ${t.description}`);

              const llmSummary = await synthesizeResult(finalJob.title, originalCommand, taskSummaries, hint);
              result.summary = llmSummary;
              result.outputLines = llmSummary.split("\n").filter(l => l.trim());
            } catch { /* keep heuristic result */ }
          }

          const finishedJob = updateJob(job.id, { status: "completed", result })!;
          console.log(`[reducer] Job "${job.title}" completed`);

          if (hostSocketId) {
            io.to(hostSocketId).emit("job:complete", {
              job: toWireJob(finishedJob),
              result,
            });
          }

          const workers = getWorkersForSession(worker.sessionCode).map(toWireWorker);
          if (hostSocketId) io.to(hostSocketId).emit("workers:update", workers);
        })();
      } else {
        // Update job progress for host
        if (hostSocketId) {
          io.to(hostSocketId).emit("job:update", toWireJob(job));
        }

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
          if (task) {
            const hostSocketId = getHostSocketForSession(offlineWorker.sessionCode);
            if (hostSocketId) runScheduler(io, offlineWorker.sessionCode, hostSocketId);
          }
        }
      }
    });
  });
}
