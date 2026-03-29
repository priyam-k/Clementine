"use client";

import type { WireTask } from "@/lib/shared-types";

function buildInferencePrompt(task: WireTask): string {
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
          content: "You are Clementine's inference worker. Execute the assigned task directly and return only the useful result.",
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

  return {
    success: true,
    provider: "k2",
    model: data.model,
    result: data.content,
    durationMs,
    raw: data.raw,
  };
}
