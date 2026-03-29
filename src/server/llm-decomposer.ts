// ─── LLM-powered job decomposer ──────────────────────────────────────────────
// Uses Claude to intelligently break abstract commands into distributable tasks.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import Anthropic from "@anthropic-ai/sdk";

export interface LLMTaskSpec {
  title: string;
  description: string;
  complexity: number;       // 1-5
  estimatedSeconds: number; // rough estimate for timing
  dataLabel?: string;
  jobType?: string;                          // one of the compute task types below
  inputPayload?: Record<string, unknown>;    // real data payload matching jobType schema
}

export interface LLMDecomposition {
  jobTitle: string;
  tasks: LLMTaskSpec[];
  resultSummaryHint: string; // hint for the reducer to generate a good result
}

const SYSTEM_PROMPT = `You are the task orchestrator for Clementine, a distributed computing platform where browser workers run real JavaScript computations.

Decompose the user request into 8-12 parallel subtasks. Use ONLY these task types:

TYPE 1: "prime-sieve"
inputPayload: {"rangeStart": <integer>, "rangeEnd": <integer>}
Purpose: count primes in a numeric range. Use for math, cryptography, enumeration.

TYPE 2: "monte-carlo"
inputPayload: {"iterations": <integer 500000-4000000>, "target": "pi"}
Purpose: estimate pi via random sampling. Use for probability, simulation, estimation.

TYPE 3: "sort-benchmark"
inputPayload: {"size": <integer 200000-1500000>, "seed": <integer>}
Purpose: sort N numbers and measure timing. Use for data ordering, benchmarking.

TYPE 4: "number-crunch"
inputPayload: {"numbers": [<20-50 numbers>], "label": "<short string under 40 chars>"}
Purpose: statistics + regression on a number array. Use for data science, finance, metrics.

RULES:
- Output ONLY valid JSON. No markdown, no comments, no trailing commas.
- 8-12 tasks total, at least 2 different task types.
- prime-sieve: non-overlapping ranges each 1-4M wide.
- monte-carlo: vary iterations across tasks (500K, 1M, 2M, 3M, 4M).
- sort-benchmark: vary size and seed across tasks.
- number-crunch: 20-50 realistic numbers; label must be plain ASCII under 40 chars.
- DO NOT use "mock-compute".

Respond with ONLY valid JSON matching this schema exactly:
{"jobTitle":"<title>","tasks":[{"title":"<name>","description":"<purpose>","jobType":"<type>","inputPayload":{<payload>},"complexity":<1-5>,"estimatedSeconds":<2-12>}],"resultSummaryHint":"<what results contain>"}`;

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
