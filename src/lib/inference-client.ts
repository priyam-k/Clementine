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

  const payload = Object.entries(task.inputPayload)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");

  return [
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    payload ? `Task payload:\n${payload}` : "",
    "Return a concise useful result for this task.",
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
              : "You are Clementine's inference worker. Execute the assigned task directly and return only the useful result.",
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
