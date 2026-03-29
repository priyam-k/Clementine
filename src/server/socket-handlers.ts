import type { Server as IOServer, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  FractalJobConfig,
  FractalTileInput,
  FractalTileOutput,
  EnterpriseBenchmarkConfig,
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
  getWorker,
  deleteTask,
  updateTask,
  updateJob,
  updateWorker,
  toWireWorker,
  toWireJob,
  getTasksForJob,
  getHostSocketForSession,
  createTask,
  updateSessionHostSocket,
  updateSessionSchedulerBias,
  rebindWorkerSocket,
  appendJobArtifact,
} from "./store";
import { decomposeJob, detectJobType, deriveTitle } from "./decomposer";
import { runScheduler } from "./scheduler";
import { reduceJobResults } from "./reducer";
import { networkInterfaces } from "os";
import type { WorkerTelemetry } from "../lib/shared-types";
import { persistJobSnapshot, persistWorkerSnapshots } from "./mongo";
import { decomposeWithLLM, synthesizeResult } from "./llm-decomposer";
import { handleWorkerJoin, type Worker as SchedulerWorker } from "./taskScheduler";
import { estimateTaskCarbonSavedGrams } from "../lib/carbon-metrics";
import {
  buildEnterpriseResultSummary,
  buildEnterpriseTaskPayload,
  createEnterpriseMarkdownArtifact,
  decomposeEnterpriseAnalysis,
  generateVendorProfiles,
  synthesizeEnterpriseMarkdown,
} from "./enterprise-benchmark";
import { createJobResultArtifact } from "./results-writer";

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
  const sessionWorkerState = new Map<string, Map<string, SchedulerWorker>>();

  const getSessionWorkerState = (sessionCode: string): Map<string, SchedulerWorker> => {
    let state = sessionWorkerState.get(sessionCode);
    if (!state) {
      state = new Map<string, SchedulerWorker>();
      sessionWorkerState.set(sessionCode, state);
    }
    return state;
  };

  const persistJobAndWorkers = (jobId: string) => {
    const job = getJob(jobId);
    if (!job) return;
    const wireJob = toWireJob(job);
    void persistJobSnapshot({ ...wireJob, sessionCode: job.sessionCode });
    void persistWorkerSnapshots(
      getWorkersForSession(job.sessionCode).map((worker) => ({
        ...toWireWorker(worker),
        sessionCode: job.sessionCode,
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
        // Update host socket and fast lookup map on re-connect
        session = updateSessionHostSocket(session.code, socket.id) ?? session;
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
      } else {
        rebindWorkerSocket(existingHostWorker.id, socket.id);
      }

      const workers = getWorkersForSession(session.code).map(toWireWorker);
      const jobs = getJobsForSession(session.code).map(toWireJob);

      socket.emit("session:state", {
        session: {
          code: session.code,
          joinUrl: session.joinUrl,
          startedAt: session.startedAt,
          hostName: session.hostName,
          schedulerBias: session.schedulerBias,
        },
        workers,
        jobs,
      });
    });

    socket.on("scheduler:bias:set", ({ sessionCode, bias }) => {
      const session =
        getSessionByHostSocket(socket.id)
        ?? updateSessionHostSocket(sessionCode, socket.id);
      if (!session) {
        socket.emit("error", { message: "Host session not found" });
        return;
      }

      updateSessionSchedulerBias(session.code, bias);
    });

    // ── Worker joins ──────────────────────────────────────────────────────────
    socket.on("worker:join", async ({ sessionCode, name, device, lat, lon }) => {
      const session = getSession(sessionCode);
      if (!session) {
        socket.emit("error", { message: `Session ${sessionCode} not found` });
        return;
      }

      // Idempotent: if this socket already registered as a worker for this session, just re-ack
      const existing = getWorkerBySocket(socket.id);
      if (existing && existing.sessionCode === sessionCode && existing.status !== "offline") {
        const workers = getWorkersForSession(sessionCode).map(toWireWorker);
        socket.emit("worker:self", toWireWorker(existing));
        socket.emit("workers:update", workers);
        const hostSocketId = getHostSocketForSession(sessionCode);
        if (hostSocketId) runScheduler(io, sessionCode, hostSocketId);
        return;
      }

      const registeredWorker = registerWorker(socket.id, {
        name,
        device,
        sessionCode,
        lat,
        lon,
        activeTasks: 0,
      });
      const schedulerWorker = await handleWorkerJoin({
        io,
        socket,
        sessionCode,
        state: getSessionWorkerState(sessionCode),
        workerId: registeredWorker.id,
        lat,
        lon,
      });
      updateWorker(registeredWorker.id, {
        lat: schedulerWorker.lat,
        lon: schedulerWorker.lon,
        carbonIntensity: schedulerWorker.carbonIntensity,
        activeTasks: schedulerWorker.activeTasks,
      });
      console.log(`[worker] "${name}" joined session ${sessionCode}`);

      // Ack the worker
      const workers = getWorkersForSession(sessionCode).map(toWireWorker);
      socket.emit("worker:self", toWireWorker(getWorker(registeredWorker.id) ?? registeredWorker));
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
      const updatedWorker = getWorker(worker.id);
      if (updatedWorker) {
        socket.emit("worker:self", toWireWorker(updatedWorker));
      }

      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      if (hostSocketId) {
        io.to(hostSocketId).emit(
          "workers:update",
          getWorkersForSession(worker.sessionCode).map(toWireWorker)
        );
      }
    });

    // ── Job submitted (text command) ──────────────────────────────────────────
    socket.on("job:submit", ({ command, sessionCode, benchmarkConfig }) => {
      const session =
        getSessionByHostSocket(socket.id)
        ?? (sessionCode ? updateSessionHostSocket(sessionCode, socket.id) : undefined);
      if (!session) {
        socket.emit("error", { message: "Host session not found" });
        return;
      }

      const resolvedBenchmarkConfig = normalizeBenchmarkConfig(benchmarkConfig);
      const jobType = resolvedBenchmarkConfig ? "enterprise-analysis" : detectJobType(command);
      const title = resolvedBenchmarkConfig
        ? `Enterprise Vendor Risk & Selection — ${resolvedBenchmarkConfig.vendorCount} Vendors`
        : deriveTitle(command, jobType);
      const vendorProfiles =
        resolvedBenchmarkConfig
          ? generateVendorProfiles(resolvedBenchmarkConfig, `${session.code}:${command}`)
          : undefined;

      const job = createJob({
        rawPrompt: command,
        normalizedCommand: command.replace(/^(hey\s+)?clementine[,.]?\s*/i, "").trim(),
        jobType,
        title,
        sessionCode: session.code,
        benchmarkConfig: resolvedBenchmarkConfig,
        vendorProfiles,
      });

      console.log(`[job] Created "${title}" (${jobType}) for session ${session.code}`);
      persistJobAndWorkers(job.id);

      // Send initial job to host
      socket.emit("job:created", toWireJob(job));

      (async () => {
        try {
          updateJob(job.id, { status: "decomposing" });
          persistJobAndWorkers(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));

          if (job.jobType === "enterprise-analysis" && resolvedBenchmarkConfig && vendorProfiles) {
            const enterpriseDecomposition = await decomposeEnterpriseAnalysis(
              command,
              vendorProfiles,
              resolvedBenchmarkConfig
            );
            const taskIds = enterpriseDecomposition.tasks.map((spec) =>
              createTask({
                jobId: job.id,
                title: spec.title,
                description: spec.description,
                jobType: "enterprise-analysis",
                status: "queued",
                progress: 0,
                inputPayload: buildEnterpriseTaskPayload(
                  spec,
                  vendorProfiles,
                  resolvedBenchmarkConfig
                ),
              }).id
            );

            updateJob(job.id, {
              title: enterpriseDecomposition.jobTitle,
              taskIds,
              totalTasks: taskIds.length,
              completedTasks: 0,
              failedTasks: 0,
              normalizedCommand: JSON.stringify({
                mode: "enterprise-analysis",
                original: command,
                resultSummaryHint: enterpriseDecomposition.resultSummaryHint,
                benchmarkConfig: resolvedBenchmarkConfig,
              }),
            });

            console.log(
              `[job] Enterprise decomposition created ${taskIds.length} tasks across ${vendorProfiles.length} vendors`
            );
          } else {
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
                totalTasks: taskIds.length,
                completedTasks: 0,
                failedTasks: 0,
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
          }

          updateJob(job.id, { status: "running", startedAt: Date.now() });
          persistJobAndWorkers(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));
          runScheduler(io, session.code, socket.id);
        } catch (err) {
          console.error(`[job] orchestration failed for ${job.id}:`, err);
          updateJob(job.id, { status: "failed" });
          persistJobAndWorkers(job.id);
          socket.emit("job:update", toWireJob(getJob(job.id)!));
        }
      })();
    });

    // ── Fractal job submitted directly ────────────────────────────────────────
    socket.on("fractal:submit", ({ config, sessionCode }) => {
      const session =
        getSessionByHostSocket(socket.id)
        ?? (sessionCode ? updateSessionHostSocket(sessionCode, socket.id) : undefined);
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
      persistJobAndWorkers(job.id);
      socket.emit("job:created", toWireJob(job));

      // Decompose immediately — no text-parsing delay needed
      updateJob(job.id, { status: "decomposing" });
      persistJobAndWorkers(job.id);
      socket.emit("job:update", toWireJob(getJob(job.id)!));

      const tasks = decomposeJob(getJob(job.id)!);
      console.log(`[fractal] ${tasks.length} tile tasks created`);
      persistJobAndWorkers(job.id);

      updateJob(job.id, { status: "running", startedAt: Date.now() });
      persistJobAndWorkers(job.id);
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
      const completedCarbonIntensity = worker.carbonIntensity ?? 250;
      const estimatedCarbonSavedGrams = estimateTaskCarbonSavedGrams(
        taskDurationMs,
        completedCarbonIntensity
      );

      updateTask(taskId, {
        status: "completed",
        progress: 100,
        completedByWorkerId: worker.id,
        completedByWorkerName: worker.name,
        completedCarbonIntensity,
        estimatedCarbonSavedGrams,
        outputPayload: storedOutput,
        completedAt: now,
      });
      const updatedWorker = updateWorker(worker.id, {
        status: "idle",
        currentTaskId: undefined,
        activeTasks: Math.max((worker.activeTasks ?? 1) - 1, 0),
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
      const assignedVendorCount = Array.isArray(task.inputPayload.assignedVendors)
        ? task.inputPayload.assignedVendors.length
        : 0;
      const criteriaCount = Array.isArray(task.inputPayload.criteria)
        ? task.inputPayload.criteria.length
        : 0;
      const opsCount =
        typeof storedOutput?.opsCount === "number"
          ? storedOutput.opsCount
          : task.jobType === "enterprise-analysis"
          ? Math.max(assignedVendorCount * Math.max(criteriaCount, 1) * 12, assignedVendorCount)
          : 0;
      const batchSize =
        typeof task.inputPayload.batchSize === "number"
          ? task.inputPayload.batchSize
          : assignedVendorCount;
      const completionSample = summarizeTaskOutput(task);
      const workerIdsUsed = job.workerIdsUsed.includes(worker.id)
        ? job.workerIdsUsed
        : [...job.workerIdsUsed, worker.id];
      const completionSamples = [...job.completionSamples, completionSample].slice(-24);
      const existingContribution =
        job.workerContributions.find((entry) => entry.workerId === worker.id) ?? null;
      const nextContribution = {
        workerId: worker.id,
        workerName: worker.name,
        tasksCompleted: (existingContribution?.tasksCompleted ?? 0) + 1,
        totalDurationMs: (existingContribution?.totalDurationMs ?? 0) + taskDurationMs,
        opsCount: (existingContribution?.opsCount ?? 0) + opsCount,
        pixelsRendered: (existingContribution?.pixelsRendered ?? 0) + renderedPixels,
        carbonSavedGrams: (existingContribution?.carbonSavedGrams ?? 0) + estimatedCarbonSavedGrams,
      };
      const workerContributions = [
        ...job.workerContributions.filter((entry) => entry.workerId !== worker.id),
        nextContribution,
      ].sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.totalDurationMs - a.totalDurationMs);

      deleteTask(taskId);
      const updatedJob = updateJob(job.id, {
        taskIds: job.taskIds.filter((id) => id !== taskId),
        completedTasks: job.completedTasks + 1,
        totalOps: job.totalOps + opsCount,
        totalDataProcessed: job.totalDataProcessed + batchSize,
        totalCarbonSavedGrams: job.totalCarbonSavedGrams + estimatedCarbonSavedGrams,
        workerIdsUsed,
        completionSamples,
        workerContributions,
      })!;

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
      const allDone = updatedJob.completedTasks + updatedJob.failedTasks >= updatedJob.totalTasks;

      if (allDone) {
        const completedJob = updateJob(updatedJob.id, {
          status: "reducing",
          completedAt: now,
        })!;
        persistJobAndWorkers(completedJob.id);

        if (hostSocketId) io.to(hostSocketId).emit("job:update", toWireJob(completedJob));

        (async () => {
          await new Promise<void>((r) => setTimeout(r, 400));
          const finalJob = getJob(updatedJob.id)!;
          const finalTasks = getTasksForJob(updatedJob.id);
          const result = reduceJobResults(finalJob, finalTasks);

          if (finalJob.jobType === "enterprise-analysis") {
            try {
              const markdown = await synthesizeEnterpriseMarkdown(
                finalJob,
                finalJob.vendorProfiles ?? [],
                finalJob.completionSamples
              );
              const artifact = await createEnterpriseMarkdownArtifact(finalJob, markdown);
              const updatedWithArtifact = appendJobArtifact(finalJob.id, artifact) ?? finalJob;
              result.summary = buildEnterpriseResultSummary(markdown);
              result.outputLines = markdown
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 12);
              result.metrics.artifactType = "markdown";
              result.metrics.vendorCount = finalJob.vendorProfiles?.length ?? 0;
              result.metrics.analysisDepth =
                finalJob.benchmarkConfig?.analysisDepth ?? "standard";
              finalJob.artifacts = updatedWithArtifact.artifacts;
            } catch (err) {
              console.warn(`[reducer] Enterprise markdown synthesis failed for "${finalJob.title}":`, err);
            }
          } else if (finalJob.jobType !== "fractal-render") {
            try {
              const parsedMetadata = safeParseJobMetadata(finalJob.normalizedCommand);
              const taskSummaries = finalJob.completionSamples;

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

            try {
              const artifact = await createJobResultArtifact(finalJob, result);
              const updatedWithArtifact = appendJobArtifact(finalJob.id, artifact) ?? finalJob;
              finalJob.artifacts = updatedWithArtifact.artifacts;
              result.metrics.artifactType = "markdown";
            } catch (err) {
              console.warn(`[results] Markdown artifact write failed for "${finalJob.title}":`, err);
            }
          }

          const finishedJob = updateJob(updatedJob.id, { status: "completed", result, taskIds: [] })!;
          persistJobAndWorkers(finishedJob.id);
          console.log(`[reducer] Job "${updatedJob.title}" completed`);

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
          io.to(hostSocketId).emit("job:update", toWireJob(updatedJob));
        }
        persistJobAndWorkers(updatedJob.id);

        // Try to schedule next queued task to this now-idle worker
        if (hostSocketId) {
          runScheduler(io, worker.sessionCode, hostSocketId);
        }

        // Broadcast updated worker list
        const workers = getWorkersForSession(worker.sessionCode).map(toWireWorker);
        if (hostSocketId) io.to(hostSocketId).emit("workers:update", workers);
      }
    });

    // ── Task failed ───────────────────────────────────────────────────────────
    socket.on("task:failed", ({ taskId, error }) => {
      const worker = getWorkerBySocket(socket.id);
      if (!worker) return;

      const now = Date.now();
      const task = getTask(taskId);
      if (!task) return;

      const job = getJob(task.jobId);
      if (!job) return;

      const taskDurationMs = task.startedAt ? Math.max(now - task.startedAt, 0) : 0;

      updateTask(taskId, { status: "failed", progress: 0 });
      updateWorker(worker.id, {
        status: "idle",
        currentTaskId: undefined,
        activeTasks: Math.max((worker.activeTasks ?? 1) - 1, 0),
        totalBusyMs: worker.totalBusyMs + taskDurationMs,
        lastHeartbeatAt: now,
      });

      console.warn(`[task] "${taskId}" failed on worker "${worker.name}": ${error ?? "unknown error"}`);

      deleteTask(taskId);
      const updatedJob = updateJob(job.id, {
        taskIds: job.taskIds.filter((id) => id !== taskId),
        failedTasks: job.failedTasks + 1,
      })!;

      const hostSocketId = getHostSocketForSession(worker.sessionCode);
      const allDone = updatedJob.completedTasks + updatedJob.failedTasks >= updatedJob.totalTasks;

      if (allDone) {
        const completedJob = updateJob(updatedJob.id, {
          status: "reducing",
          completedAt: now,
        })!;
        persistJobAndWorkers(completedJob.id);
        if (hostSocketId) io.to(hostSocketId).emit("job:update", toWireJob(completedJob));

        (async () => {
          await new Promise<void>((r) => setTimeout(r, 400));
          const finalJob = getJob(updatedJob.id)!;
          const finalTasks = getTasksForJob(updatedJob.id);
          const result = reduceJobResults(finalJob, finalTasks);

          if (finalJob.jobType === "enterprise-analysis") {
            try {
              const markdown = await synthesizeEnterpriseMarkdown(
                finalJob,
                finalJob.vendorProfiles ?? [],
                finalJob.completionSamples
              );
              const artifact = await createEnterpriseMarkdownArtifact(finalJob, markdown);
              const updatedWithArtifact = appendJobArtifact(finalJob.id, artifact) ?? finalJob;
              result.summary = buildEnterpriseResultSummary(markdown);
              result.outputLines = markdown
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 12);
              result.metrics.artifactType = "markdown";
              result.metrics.vendorCount = finalJob.vendorProfiles?.length ?? 0;
              result.metrics.analysisDepth =
                finalJob.benchmarkConfig?.analysisDepth ?? "standard";
              finalJob.artifacts = updatedWithArtifact.artifacts;
            } catch (err) {
              console.warn(`[reducer] Enterprise synthesis failed after task failures:`, err);
            }
          } else if (finalJob.jobType !== "fractal-render") {
            try {
              const artifact = await createJobResultArtifact(finalJob, result);
              const updatedWithArtifact = appendJobArtifact(finalJob.id, artifact) ?? finalJob;
              finalJob.artifacts = updatedWithArtifact.artifacts;
              result.metrics.artifactType = "markdown";
            } catch (err) {
              console.warn(`[results] Markdown artifact write failed after task failures:`, err);
            }
          }

          const finishedJob = updateJob(updatedJob.id, {
            status: "completed",
            result,
            taskIds: [],
          })!;
          persistJobAndWorkers(finishedJob.id);
          console.log(`[reducer] Job "${updatedJob.title}" completed (with ${updatedJob.failedTasks} failed tasks)`);

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
        if (hostSocketId) io.to(hostSocketId).emit("job:update", toWireJob(updatedJob));
        persistJobAndWorkers(updatedJob.id);
        if (hostSocketId) runScheduler(io, worker.sessionCode, hostSocketId);
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
        getSessionWorkerState(offlineWorker.sessionCode).delete(socket.id);
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
          updateWorker(offlineWorker.id, {
            activeTasks: 0,
          });
          const task = getTask(offlineWorker.currentTaskId);
          if (task) persistJobAndWorkers(task.jobId);
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
  const role =
    typeof task.inputPayload.role === "string" ? `${task.inputPayload.role}: ` : "";
  if (!output) return `${task.title}: completed`;

  if (typeof output.markdown === "string") {
    return `${role}${task.title}: ${output.markdown.replace(/\s+/g, " ").slice(0, 320)}`;
  }

  if (typeof output.summary === "string") {
    return `${role}${sanitizeSummaryText(output.summary)}`;
  }

  if (typeof output.result === "string") {
    return `${role}${task.title}: ${sanitizeSummaryText(output.result)}`;
  }

  if (typeof output.durationMs === "number") {
    return `${task.title}: completed in ${Math.round(output.durationMs)}ms`;
  }

  return `${role}${task.title}: ${sanitizeSummaryText(JSON.stringify(output))}`;
}

function normalizeBenchmarkConfig(
  config: EnterpriseBenchmarkConfig | undefined
): EnterpriseBenchmarkConfig | undefined {
  if (!config || config.benchmarkType !== "enterprise-vendor-risk-selection") return undefined;

  return {
    benchmarkType: config.benchmarkType,
    difficulty: Math.min(Math.max(Math.round(config.difficulty), 1), 100),
    vendorCount: Math.max(1, Math.round(config.vendorCount)),
    analysisDepth: config.analysisDepth,
  };
}

function sanitizeSummaryText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/\bThe user says\b[\s\S]*/i, "")
    .replace(/\bWe need to\b[\s\S]*/i, "")
    .replace(/\bLet's parse\b[\s\S]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
