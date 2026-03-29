// ─── LLM-powered job decomposer ──────────────────────────────────────────────
// Uses Claude to intelligently break abstract commands into distributable tasks.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import Anthropic from "@anthropic-ai/sdk";
import { generateGeminiText } from "./gemini";

export interface LLMTaskSpec {
  title: string;
  description: string;
  taskPrompt: string;       // complete, standalone K2 prompt — the actual work this worker runs
  complexity: number;       // 1-5
  estimatedSeconds: number;
  dataLabel?: string;
}

export interface LLMDecomposition {
  jobTitle: string;
  tasks: LLMTaskSpec[];
  resultSummaryHint: string;
}

const SYSTEM_PROMPT = `You are the task orchestrator for Clementine, a distributed computing platform.

Each worker node runs K2-Think (a reasoning LLM) in parallel. Your job: decompose the user's
request into 4–8 independent subtasks so that all workers run simultaneously, producing the
final answer faster than any single device could.

Rules:
- Each task must be entirely self-contained. The worker ONLY sees its own taskPrompt — no other context.
- Each task must produce a real, concrete, useful piece of the answer on its own.
- Tasks must cover distinct aspects so their outputs combine into a complete response.
- taskPrompt must be a direct, complete instruction to K2. Embed all necessary context inline.
- Never reference other tasks ("see task 2") or use placeholders ("[data here]").
- If the request involves data the workers cannot access (URLs, files), include representative
  inline context or instruct the worker to reason from known facts about the domain.

Respond ONLY with valid JSON:
{
  "jobTitle": "concise title under 60 chars",
  "tasks": [
    {
      "title": "short task name",
      "description": "one sentence: what concrete output this task produces",
      "taskPrompt": "Complete standalone prompt for K2. All context inline. Demand specific, concrete output.",
      "complexity": 1-5,
      "estimatedSeconds": 2-15,
      "dataLabel": "optional UI label"
    }
  ],
  "resultSummaryHint": "what the final synthesis should produce by combining all task outputs"
}`;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function decomposeWithLLM(command: string): Promise<LLMDecomposition | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: command }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(jsonStr) as LLMDecomposition;

    // Validate structure
    if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return null;
    }

    // Ensure every task has a real taskPrompt
    for (const task of parsed.tasks) {
      if (!task.taskPrompt || typeof task.taskPrompt !== "string" || task.taskPrompt.trim().length < 20) {
        task.taskPrompt = task.description || task.title;
      }
    }

    return parsed;
  } catch (err) {
    console.warn("[llm-decomposer] Failed:", err);
    return null;
  }
}

// Generate a final report using Claude after all tasks complete
export async function synthesizeResult(
  jobTitle: string,
  command: string,
  taskSummaries: string[],
  resultSummaryHint: string
): Promise<string> {
  try {
    return await generateGeminiText({
      systemInstruction: [
        "You are Clementine's final result synthesizer.",
        "Produce a concise, user-facing answer to the original request — nothing more.",
        "Lead with the direct answer. Include only information the user explicitly asked for.",
        "Do not add introductions, transitions, meta-commentary, or conclusions.",
        "Do not mention prompts, workers, tasks, parsing, or internal analysis.",
        "Use markdown: bullet points or numbered lists for structured data, inline code for values.",
        "Maximum length: 300 words unless the content is inherently longer (e.g. a list of 10+ items).",
      ].join(" "),
      userPrompt: `Original request: "${command}"\n\nTask outputs:\n${taskSummaries
        .map((summary, index) => `${index + 1}. ${summary}`)
        .join("\n")}\n\nHint: ${resultSummaryHint}\n\nReturn only the direct answer to the request.`,
      temperature: 0.15,
    });
  } catch {
    return `${taskSummaries.length} tasks completed. ${resultSummaryHint}`;
  }
}
