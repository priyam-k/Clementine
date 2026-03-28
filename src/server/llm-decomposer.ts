// ─── LLM-powered job decomposer ──────────────────────────────────────────────
// Uses Claude to intelligently break abstract commands into distributable tasks.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import Anthropic from "@anthropic-ai/sdk";

export interface LLMTaskSpec {
  title: string;
  description: string;
  complexity: number;       // 1-5
  estimatedSeconds: number; // rough estimate for mock timing
  dataLabel?: string;
}

export interface LLMDecomposition {
  jobTitle: string;
  tasks: LLMTaskSpec[];
  resultSummaryHint: string; // hint for the reducer to generate a good result
}

const SYSTEM_PROMPT = `You are the intelligent task orchestrator for Clementine, a distributed computing platform.

When given a user's request, decompose it into 5–10 concrete parallel subtasks that can be
distributed across browser-based worker nodes. Each worker is a CPU capable of running
computation, data analysis, or inference tasks.

Think like a senior data engineer: identify the stages of the pipeline (fetch, process, analyze,
aggregate), estimate complexity, and break the work into independent chunks that can run in
parallel.

IMPORTANT: For tasks involving external data (YouTube, URLs, APIs), include realistic data
in the task descriptions so workers can simulate meaningful processing. Generate plausible
mock data summaries inline.

Respond ONLY with valid JSON matching this exact schema:
{
  "jobTitle": "short title under 60 chars",
  "tasks": [
    {
      "title": "short task name",
      "description": "detailed description of what this worker should do, including any mock data",
      "complexity": 1-5,
      "estimatedSeconds": 2-15,
      "dataLabel": "optional data label shown in UI"
    }
  ],
  "resultSummaryHint": "1-2 sentences describing what the final aggregate result should contain"
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
  const anthropic = getClient();
  if (!anthropic) return `${taskSummaries.length} tasks completed. ${resultSummaryHint}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `You are a data analyst synthesizing results from a distributed computation job.
Given the original request and completed task outputs, produce a clear, quantitative report.
Be specific: include numbers, percentages, key findings. Format with bullet points.
Keep it under 300 words.`,
      messages: [{
        role: "user",
        content: `Original request: "${command}"\n\nCompleted tasks:\n${taskSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nHint: ${resultSummaryHint}\n\nGenerate the final report:`,
      }],
    });

    return response.content[0].type === "text" ? response.content[0].text : resultSummaryHint;
  } catch {
    return `${taskSummaries.length} tasks completed. ${resultSummaryHint}`;
  }
}
