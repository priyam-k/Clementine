"use client";

import type { WireTask } from "@/lib/shared-types";

function sanitizeModelText(content: string): string {
  const withoutDanglingClosingTag =
    content.includes("</think>") && !content.includes("<think>")
      ? content.slice(content.indexOf("</think>") + "</think>".length)
      : content;

  return withoutDanglingClosingTag
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
}

function safeJsonParse<T>(text: string): T | null {
  try {
    const stripped = sanitizeModelText(text)
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}

function buildInferencePrompt(task: WireTask): string {
  if (task.jobType === "enterprise-analysis") {
    return [
      `Role assignment: ${String(task.inputPayload.role ?? task.title)}`,
      `Task description: ${task.description}`,
      `Assigned vendors: ${JSON.stringify(task.inputPayload.assignedVendors ?? [])}`,
      `Criteria: ${JSON.stringify(task.inputPayload.criteria ?? [])}`,
      `Instructions: ${String(task.inputPayload.instructions ?? "")}`,
      "Use only the provided vendor fields as evidence. Do not invent external facts, market data, citations, hidden reasoning, or placeholders.",
      'Return valid JSON only with fields "summary", "vendorFindings", "rankedVendorIds", "recommendationScore", and "notableRisks".',
    ].join("\n\n");
  }

  // Use the pre-built taskPrompt when available — the decomposer wrote this as
  // a complete, self-contained instruction. Use it verbatim so the worker
  // answers exactly the sub-problem it was assigned.
  if (typeof task.inputPayload.taskPrompt === "string" && task.inputPayload.taskPrompt.trim().length > 0) {
    return task.inputPayload.taskPrompt;
  }

  // Fallback for tasks that pre-date taskPrompt
  return [
    task.inputPayload.jobContext ? `Context: ${String(task.inputPayload.jobContext)}` : null,
    `Task: ${task.title}`,
    task.description,
    "Provide a specific, concrete, useful result.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function executeK2InferenceTask(task: WireTask): Promise<Record<string, unknown>> {
  const startedAt = performance.now();

  const response = await fetch("/api/inference/k2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            task.jobType === "enterprise-analysis"
              ? [
                  "You are Clementine's enterprise analyst worker.",
                  "Analyze only the supplied vendor profile data.",
                  "Do not reveal chain-of-thought, do not include <think> tags, and do not restate the prompt or instructions.",
                  "Do not fabricate external facts or real-world claims that are not present in the provided vendor fields.",
                  "Return only compact valid JSON.",
                ].join(" ")
              : "You are Clementine's distributed inference worker. Execute the assigned task completely and return a specific, concrete, useful result. Do not include preamble, do not re-state the prompt, do not reveal chain-of-thought. Just produce the output.",
        },
        {
          role: "user",
          content: buildInferencePrompt(task),
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? "K2 inference request failed");
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const sanitizedContent =
    typeof data.content === "string" ? sanitizeModelText(data.content) : "";

  if (task.jobType === "enterprise-analysis") {
    const parsed = safeJsonParse<{
      summary?: string;
      vendorFindings?: unknown;
      rankedVendorIds?: unknown;
      recommendationScore?: number;
      notableRisks?: unknown;
    }>(sanitizedContent);

    return {
      success: true,
      provider: "k2",
      model: data.model,
      result: parsed?.summary ?? sanitizedContent,
      summary: parsed?.summary ?? sanitizedContent,
      vendorFindings: parsed?.vendorFindings,
      rankedVendorIds: Array.isArray(parsed?.rankedVendorIds) ? parsed?.rankedVendorIds : [],
      recommendationScore:
        typeof parsed?.recommendationScore === "number" ? parsed.recommendationScore : undefined,
      notableRisks: Array.isArray(parsed?.notableRisks) ? parsed?.notableRisks : [],
      durationMs,
      raw: data.raw,
    };
  }

  return {
    success: true,
    provider: "k2",
    model: data.model,
    result: sanitizedContent,
    durationMs,
    raw: data.raw,
  };
}
