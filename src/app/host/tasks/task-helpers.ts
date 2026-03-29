import type { WireJob, WireTask, JobType } from "@/lib/shared-types";

// ─── Duration formatting ──────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Input payload formatting ─────────────────────────────────────────────────

export function formatInputPayload(
  jobType: JobType,
  input: Record<string, unknown>
): Array<{ label: string; value: string }> {
  const str = (v: unknown, fallback = "—") =>
    v != null && v !== "" ? String(v) : fallback;
  const num = (v: unknown, fallback = "—") =>
    typeof v === "number" ? v : fallback;

  if (jobType === "fractal-render") {
    const xMin = num(input.xMin);
    const xMax = num(input.xMax);
    const yMin = num(input.yMin);
    const yMax = num(input.yMax);
    return [
      { label: "Fractal type", value: str(input.fractalType) },
      { label: "Tile position", value: `(${str(input.tileX)}, ${str(input.tileY)})` },
      { label: "Tile size", value: `${str(input.tileWidth)} × ${str(input.tileHeight)} px` },
      { label: "Image canvas", value: `${str(input.imageWidth)} × ${str(input.imageHeight)} px` },
      {
        label: "X range",
        value: typeof xMin === "number" && typeof xMax === "number"
          ? `${xMin.toFixed(4)} → ${xMax.toFixed(4)}` : "—",
      },
      {
        label: "Y range",
        value: typeof yMin === "number" && typeof yMax === "number"
          ? `${yMin.toFixed(4)} → ${yMax.toFixed(4)}` : "—",
      },
      { label: "Max iterations", value: str(input.maxIterations) },
    ];
  }

  if (jobType === "blender-render") {
    const rows: Array<{ label: string; value: string }> = [
      { label: "Operation", value: str(input.operationType) },
    ];
    if (input.startFrame != null && input.endFrame != null) {
      rows.push({ label: "Frame range", value: `${input.startFrame}–${input.endFrame}` });
    }
    rows.push(
      { label: "Batch size", value: `${str(input.batchSize)} items` },
      { label: "Complexity", value: `${str(input.complexity)}/10` },
      { label: "Data label", value: str(input.dataLabel) },
    );
    return rows;
  }

  if (
    jobType === "mock-compute" ||
    jobType === "llm-analysis" ||
    jobType === "batch-inference"
  ) {
    const rows: Array<{ label: string; value: string }> = [
      { label: "Operation", value: str(input.operationType) },
      { label: "Batch size", value: `${str(input.batchSize)} items` },
      { label: "Complexity", value: `${str(input.complexity)}/10` },
      { label: "Data label", value: str(input.dataLabel) },
    ];
    if (input.estimatedSeconds != null) {
      rows.push({ label: "Est. time", value: `~${input.estimatedSeconds}s` });
    }
    return rows;
  }

  // Fallback
  return [{ label: "Raw", value: JSON.stringify(input, null, 2) }];
}

// ─── Output payload formatting ────────────────────────────────────────────────

export function formatOutputPayload(
  jobType: JobType,
  output: Record<string, unknown> | undefined,
  progress: number,
  status?: WireTask["status"]
): Array<{ label: string; value: string }> | "in-progress" {
  const isEmpty = !output || Object.keys(output).length === 0;

  if (isEmpty) {
    if (status === "failed") return [{ label: "Status", value: "Task failed" }];
    if (progress < 100) return "in-progress";
    return [{ label: "Status", value: "Awaiting output…" }];
  }

  if (jobType === "fractal-render") {
    return [
      { label: "Render time", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
      { label: "Tile rendered", value: output.tileRendered ? "Yes" : "—" },
    ];
  }

  // Compute-type jobs
  const result = typeof output.result === "string"
    ? (output.result.length > 120 ? output.result.slice(0, 120) + "…" : output.result)
    : null;
  const rows: Array<{ label: string; value: string }> = [];
  if (result) rows.push({ label: "Result", value: result });
  if (output.opsCount != null) rows.push({ label: "Ops completed", value: `${(output.opsCount as number).toLocaleString()} ops` });
  if (output.durationMs != null) rows.push({ label: "Duration", value: `${output.durationMs}ms` });
  if (output.efficiency != null) rows.push({ label: "Efficiency", value: `${((output.efficiency as number) * 100).toFixed(1)}%` });
  if (output.success != null) rows.push({ label: "Success", value: output.success ? "Yes" : "No" });
  if (rows.length === 0) rows.push({ label: "Raw", value: JSON.stringify(output) });
  return rows;
}

// ─── Full process dump (for copy/export) ─────────────────────────────────────

export function buildJobProcessDump(job: WireJob): string {
  const ts = (ms: number | undefined) =>
    ms ? new Date(ms).toISOString() : "—";
  const dur =
    job.completedAt && job.startedAt
      ? formatDuration(job.completedAt - job.startedAt)
      : "—";

  const lines: string[] = [
    "=== JOB PROCESS DUMP ===",
    `ID:         ${job.id}`,
    `Title:      ${job.title}`,
    `Type:       ${job.jobType}`,
    `Status:     ${job.status}`,
    `Prompt:     "${job.rawPrompt}"`,
    `Created:    ${ts(job.createdAt)}`,
    `Started:    ${ts(job.startedAt)}`,
    `Completed:  ${ts(job.completedAt)}`,
    `Duration:   ${dur}`,
    "",
    "=== DECOMPOSE PHASE ===",
    `Tasks created: ${job.totalTasks || "pending"}`,
    `Completed: ${job.completedTasks}  Failed: ${job.failedTasks}`,
    "",
  ];

  if (job.tasks.length === 0) {
    lines.push("=== SCHEDULE PHASE ===", "Tasks not yet created.", "");
    lines.push("=== EXECUTE PHASE ===", "Tasks not yet created.", "");
  } else {
    lines.push("=== SCHEDULE PHASE ===");
    job.tasks.forEach((task, i) => {
      lines.push(`Task ${i + 1}: ${task.title}`);
      if (task.description) lines.push(`  Description: ${task.description}`);
      for (const { label, value } of formatInputPayload(task.jobType, task.inputPayload)) {
        lines.push(`  ${label}: ${value}`);
      }
    });
    lines.push("");

    lines.push("=== EXECUTE PHASE ===");
    job.tasks.forEach((task, i) => {
      lines.push(`Task ${i + 1}: ${task.title} [${task.status}]`);
      lines.push(`  Worker:   ${task.completedByWorkerName ?? task.assignedWorkerId ?? "unassigned"}`);
      lines.push(`  Started:  ${ts(task.startedAt)}`);
      if (task.completedAt && task.startedAt) {
        lines.push(`  Duration: ${formatDuration(task.completedAt - task.startedAt)}`);
      }
      const outRows = formatOutputPayload(task.jobType, task.outputPayload, task.progress, task.status);
      if (outRows === "in-progress") {
        lines.push(`  Output:   in progress (${task.progress}%)`);
      } else {
        for (const { label, value } of outRows) {
          lines.push(`  ${label}: ${value}`);
        }
      }
    });
    lines.push("");
  }

  lines.push("=== REDUCE PHASE ===");
  if (job.result) {
    lines.push(`Summary:      ${job.result.summary}`);
    lines.push(`Duration:     ${formatDuration(job.result.durationMs)}`);
    lines.push(`Workers used: ${job.result.workerCount}`);
    lines.push(`Data:         ${job.result.dataProcessed}`);
    if (job.result.outputLines.length > 0) {
      lines.push("Output lines:");
      for (const l of job.result.outputLines) lines.push(`  > ${l}`);
    }
    const metricEntries = Object.entries(job.result.metrics);
    if (metricEntries.length > 0) {
      lines.push("Metrics:");
      for (const [k, v] of metricEntries) lines.push(`  ${k}: ${v}`);
    }
  } else if (job.status === "reducing") {
    lines.push("LLM synthesizing results…");
  } else {
    lines.push("Pending.");
  }

  return lines.join("\n");
}
