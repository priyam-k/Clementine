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

  if (jobType === "prime-sieve") {
    return [
      { label: "Range start", value: str(input.rangeStart) },
      { label: "Range end", value: str(input.rangeEnd) },
      {
        label: "Range size",
        value: typeof input.rangeEnd === "number" && typeof input.rangeStart === "number"
          ? `${((input.rangeEnd - input.rangeStart) / 1_000_000).toFixed(2)}M numbers`
          : "—",
      },
    ];
  }

  if (jobType === "text-analysis") {
    const text = typeof input.text === "string" ? input.text : "";
    return [
      { label: "Label", value: str(input.label) },
      { label: "Text length", value: `${text.length} chars` },
      { label: "Top N", value: str(input.topN) },
      { label: "Sample", value: text.slice(0, 80) + (text.length > 80 ? "…" : "") },
    ];
  }

  if (jobType === "monte-carlo") {
    return [
      { label: "Target", value: str(input.target) },
      {
        label: "Iterations",
        value: typeof input.iterations === "number"
          ? `${(input.iterations / 1_000_000).toFixed(1)}M samples`
          : "—",
      },
    ];
  }

  if (jobType === "sort-benchmark") {
    return [
      {
        label: "Array size",
        value: typeof input.size === "number"
          ? `${(input.size / 1000).toFixed(0)}K elements`
          : "—",
      },
      { label: "Seed", value: str(input.seed) },
    ];
  }

  if (jobType === "number-crunch") {
    const nums = Array.isArray(input.numbers) ? (input.numbers as number[]) : [];
    return [
      { label: "Label", value: str(input.label) },
      { label: "Count", value: `${nums.length} values` },
      { label: "Operation", value: str(input.operation) },
      {
        label: "Preview",
        value: nums.slice(0, 6).map((n) => (typeof n === "number" ? n.toFixed(2) : n)).join(", ")
          + (nums.length > 6 ? "…" : ""),
      },
    ];
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

  if (jobType === "prime-sieve") {
    return [
      { label: "Prime count", value: output.primeCount != null ? (output.primeCount as number).toLocaleString() : "—" },
      { label: "Largest prime", value: output.largestPrime != null ? (output.largestPrime as number).toLocaleString() : "—" },
      { label: "Density", value: output.density != null ? String(output.density) : "—" },
      { label: "Duration", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
    ];
  }

  if (jobType === "text-analysis") {
    return [
      { label: "Total words", value: output.totalWords != null ? String(output.totalWords) : "—" },
      { label: "Unique words", value: output.uniqueWords != null ? String(output.uniqueWords) : "—" },
      { label: "Lex. diversity", value: output.lexicalDiversity != null ? String(output.lexicalDiversity) : "—" },
      { label: "Avg word len", value: output.avgWordLength != null ? String(output.avgWordLength) : "—" },
      { label: "Top words", value: typeof output.topWords === "string" ? output.topWords.slice(0, 100) : "—" },
      { label: "Duration", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
    ];
  }

  if (jobType === "monte-carlo") {
    return [
      { label: "π estimate", value: output.estimate != null ? String(output.estimate) : "—" },
      { label: "Error", value: output.piError != null ? String(output.piError) : "—" },
      { label: "Accuracy", value: output.accuracy != null ? `${output.accuracy}%` : "—" },
      { label: "Iterations", value: output.iterations != null ? (output.iterations as number).toLocaleString() : "—" },
      { label: "Duration", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
    ];
  }

  if (jobType === "sort-benchmark") {
    return [
      { label: "Sort time", value: output.sortMs != null ? `${output.sortMs}ms` : "—" },
      { label: "Throughput", value: output.itemsPerSecond != null ? `${(output.itemsPerSecond as number).toLocaleString()} items/s` : "—" },
      { label: "Median", value: output.median != null ? String(output.median) : "—" },
      { label: "P10–P90", value: output.p10 != null && output.p90 != null ? `${output.p10} – ${output.p90}` : "—" },
      { label: "Duration", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
    ];
  }

  if (jobType === "number-crunch") {
    return [
      { label: "Count", value: output.count != null ? String(output.count) : "—" },
      { label: "Mean", value: output.mean != null ? String(output.mean) : "—" },
      { label: "Std dev", value: output.stdDev != null ? String(output.stdDev) : "—" },
      { label: "Trend", value: output.trend != null ? String(output.trend) : "—" },
      { label: "R²", value: output.r2 != null ? String(output.r2) : "—" },
      { label: "Duration", value: output.durationMs != null ? `${output.durationMs}ms` : "—" },
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
