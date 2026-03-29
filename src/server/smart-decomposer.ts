/**
 * Smart heuristic decomposer — no LLM required.
 *
 * Classifies the user's command using regex/keyword analysis and returns a
 * pre-built task plan whose taskPrompts are fully self-contained instructions
 * for K2 workers. Falls back to returning null when the request is too
 * ambiguous for heuristic decomposition, letting the caller escalate to LLM.
 *
 * Design goals:
 *  - Zero AI calls for well-understood request types
 *  - Code requests produce actual code sections so synthesis is deterministic
 *  - Prompts are directive: workers return structured output, not prose essays
 */

export type SmartCommandKind =
  | "code"        // implement, write, build a function/class/module/API/etc.
  | "math"        // calculate, optimize, solve, simulate
  | "data"        // parse, transform, aggregate, process, filter datasets
  | "research"    // explain, describe, what is, how does
  | "analysis"    // analyze, compare, evaluate, assess, pros/cons
  | "unknown";

export interface SmartTaskSpec {
  title: string;
  description: string;
  taskPrompt: string;
  complexity: number;
  estimatedSeconds: number;
  dataLabel: string;
}

export interface SmartDecomposition {
  jobTitle: string;
  resultSummaryHint: string;
  kind: SmartCommandKind;
  tasks: SmartTaskSpec[];
}

// ── Command classification ────────────────────────────────────────────────────

const CODE_VERBS = /\b(write|implement|build|create|code|generate|add|make)\b/i;
const CODE_NOUNS = /\b(function|class|module|component|hook|api|endpoint|interface|type|schema|script|program|algorithm|method|util|helper|library|package|service|server|client|route|controller|model)\b/i;
const MATH_PATTERNS = /\b(calculat|comput|solv|optimiz|minimiz|maximiz|simulat|integrat|differentiat|matrix|vector|statistic|probabilit|regression|fourier|gradient|equation|formula)\b/i;
const DATA_PATTERNS = /\b(parse|transform|aggregat|filter|sort|group|join|merge|clean|process|pipelne|csv|json|sql|dataset|dataframe|schema|batch|chunk|shard)\b/i;
const RESEARCH_PATTERNS = /\b(explain|describe|what is|what are|how does|how do|summarize|overview|introduction|background|history|origin|definition|concept|theory)\b/i;
const ANALYSIS_PATTERNS = /\b(analyz|compar|evaluat|assess|review|audit|benchmark|pros and cons|trade.?off|weigh|contrast|rank|prioritiz|recommend|suggest)\b/i;

export function classifyCommand(command: string): SmartCommandKind {
  const lower = command.toLowerCase();

  // Code wins if both a verb and a noun are present
  if (CODE_VERBS.test(lower) && CODE_NOUNS.test(lower)) return "code";

  if (MATH_PATTERNS.test(lower)) return "math";
  if (DATA_PATTERNS.test(lower)) return "data";
  if (RESEARCH_PATTERNS.test(lower)) return "research";
  if (ANALYSIS_PATTERNS.test(lower)) return "analysis";

  // Single-verb code requests without an explicit noun ("write a fibonacci function")
  if (CODE_VERBS.test(lower) && lower.length < 120) return "code";

  return "unknown";
}

// ── Per-kind task builders ────────────────────────────────────────────────────

function buildCodeTasks(command: string, title: string): SmartTaskSpec[] {
  const ctx = `Original request: "${command}"`;
  return [
    {
      title: "Types & Interfaces",
      description: "Define all data types, interfaces, and type aliases needed.",
      taskPrompt: `${ctx}\n\nYou are implementing the TypeScript types and interfaces section.\nReturn ONLY a TypeScript code block.\nDefine every type, interface, and enum the implementation will need.\nDo not include implementation logic — only type declarations.\nNo explanatory prose. Start immediately with the code.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Types",
    },
    {
      title: "Core Implementation",
      description: "Write the main logic — functions, classes, or modules.",
      taskPrompt: `${ctx}\n\nYou are implementing the core logic section.\nReturn ONLY a TypeScript code block.\nWrite all primary functions, classes, and methods.\nAssume supporting types exist (do not redefine them).\nFocus on correctness and clarity. No explanatory prose.`,
      complexity: 4,
      estimatedSeconds: 10,
      dataLabel: "Core",
    },
    {
      title: "Validation & Error Handling",
      description: "Add input validation, guards, and error handling.",
      taskPrompt: `${ctx}\n\nYou are implementing the validation and error handling section.\nReturn ONLY a TypeScript code block.\nWrite input validators, guard clauses, custom error types, and try/catch wrappers.\nDo not repeat the core logic — only safety/validation layers.\nNo explanatory prose.`,
      complexity: 3,
      estimatedSeconds: 6,
      dataLabel: "Validation",
    },
    {
      title: "Unit Tests",
      description: "Write unit tests covering key behaviours and edge cases.",
      taskPrompt: `${ctx}\n\nYou are implementing the unit tests section using Vitest/Jest syntax.\nReturn ONLY a TypeScript code block.\nWrite describe/it blocks covering: happy path, edge cases, and error conditions.\nMock external dependencies inline. No explanatory prose.`,
      complexity: 3,
      estimatedSeconds: 7,
      dataLabel: "Tests",
    },
  ].map((t) => ({ ...t, complexity: t.complexity, estimatedSeconds: t.estimatedSeconds }));
}

function buildMathTasks(command: string): SmartTaskSpec[] {
  const ctx = `Problem: "${command}"`;
  return [
    {
      title: "Problem Formulation",
      description: "Define variables, constraints, and the mathematical model.",
      taskPrompt: `${ctx}\n\nFormulate this problem mathematically.\nDefine all variables, parameters, and constraints precisely.\nState the objective function or equation to solve.\nReturn structured output: variables list, constraints list, objective.`,
      complexity: 3,
      estimatedSeconds: 5,
      dataLabel: "Formulation",
    },
    {
      title: "Solution Method",
      description: "Describe and apply the algorithm or analytical approach.",
      taskPrompt: `${ctx}\n\nChoose and apply the best algorithm or analytical method.\nExplain the approach in 2–3 sentences, then show step-by-step working.\nReturn the method name, intermediate steps, and final numeric result.`,
      complexity: 4,
      estimatedSeconds: 8,
      dataLabel: "Solution",
    },
    {
      title: "Numerical Computation",
      description: "Produce exact numeric results or pseudocode.",
      taskPrompt: `${ctx}\n\nCompute the numeric answer or write pseudocode that a processor can execute.\nShow each calculation step with numbers.\nReturn a clean result: value, units, and precision.`,
      complexity: 3,
      estimatedSeconds: 6,
      dataLabel: "Computation",
    },
    {
      title: "Edge Cases & Verification",
      description: "Check boundary conditions and verify the solution.",
      taskPrompt: `${ctx}\n\nIdentify edge cases and boundary conditions.\nVerify the solution by substituting values back or using an alternative method.\nReport: which edge cases are handled, verification result (pass/fail), and confidence level.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Verification",
    },
  ];
}

function buildDataTasks(command: string): SmartTaskSpec[] {
  const ctx = `Task: "${command}"`;
  return [
    {
      title: "Schema & Input Analysis",
      description: "Define the expected input shape, field types, and constraints.",
      taskPrompt: `${ctx}\n\nAnalyze the expected data schema.\nReturn a TypeScript interface or JSON Schema describing input structure.\nList each field, its type, whether it's required, and any constraints.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Schema",
    },
    {
      title: "Transformation Logic",
      description: "Write the core data transformation or processing pipeline.",
      taskPrompt: `${ctx}\n\nWrite the core data transformation pipeline as TypeScript code.\nReturn ONLY a code block with functions that take the input type and return the output type.\nHandle missing/null values. No explanatory prose.`,
      complexity: 4,
      estimatedSeconds: 9,
      dataLabel: "Transform",
    },
    {
      title: "Validation & Sanitization",
      description: "Write validators that catch bad input before processing.",
      taskPrompt: `${ctx}\n\nWrite input validation and sanitization logic as TypeScript code.\nCheck required fields, type correctness, range constraints, and format.\nReturn a validate() function that throws descriptive errors on failure.`,
      complexity: 3,
      estimatedSeconds: 5,
      dataLabel: "Validation",
    },
    {
      title: "Output Schema & Sample",
      description: "Define the output shape and produce a representative sample.",
      taskPrompt: `${ctx}\n\nDefine the output data schema as a TypeScript interface.\nThen produce one representative sample output object in JSON.\nDescribe how the output can be consumed downstream.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Output",
    },
  ];
}

function buildResearchTasks(command: string): SmartTaskSpec[] {
  const ctx = `Topic: "${command}"`;
  return [
    {
      title: "Core Concepts",
      description: "Explain the fundamental concepts, definitions, and principles.",
      taskPrompt: `${ctx}\n\nExplain the core concepts and key definitions.\nBe precise and concrete. Use bullet points for each concept.\nInclude only established facts — do not speculate.`,
      complexity: 2,
      estimatedSeconds: 5,
      dataLabel: "Concepts",
    },
    {
      title: "How It Works",
      description: "Describe the mechanism, process, or system in detail.",
      taskPrompt: `${ctx}\n\nDescribe exactly how this works mechanistically, step by step.\nExplain the underlying process, algorithm, or system.\nUse numbered steps. Be specific and technical.`,
      complexity: 3,
      estimatedSeconds: 6,
      dataLabel: "Mechanism",
    },
    {
      title: "Real-World Applications",
      description: "List concrete examples and current use cases.",
      taskPrompt: `${ctx}\n\nList 4–6 concrete real-world applications or use cases.\nFor each: name, one-sentence description, and why this topic is relevant to it.\nFocus on specific, named examples rather than vague categories.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Applications",
    },
    {
      title: "Limitations & Trade-offs",
      description: "Identify known limitations, failure modes, and open problems.",
      taskPrompt: `${ctx}\n\nIdentify the key limitations, failure modes, and unsolved problems.\nFor each limitation: describe it, explain why it exists, and note any known mitigations.\nBe precise — quantify where possible.`,
      complexity: 3,
      estimatedSeconds: 5,
      dataLabel: "Limitations",
    },
  ];
}

function buildAnalysisTasks(command: string): SmartTaskSpec[] {
  const ctx = `Request: "${command}"`;
  return [
    {
      title: "Scope & Context",
      description: "Define what is being analyzed and establish baseline context.",
      taskPrompt: `${ctx}\n\nDefine the exact scope of this analysis.\nIdentify: what is being compared/evaluated, from whose perspective, and under what constraints.\nReturn: scope statement, key dimensions of comparison, and any assumptions.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Scope",
    },
    {
      title: "Strengths & Advantages",
      description: "Identify the positives, benefits, and best-case scenarios.",
      taskPrompt: `${ctx}\n\nIdentify all significant strengths, benefits, and advantages.\nFor each: state it clearly, explain the mechanism, and give a concrete example or evidence.\nReturn as a structured bullet list.`,
      complexity: 3,
      estimatedSeconds: 6,
      dataLabel: "Strengths",
    },
    {
      title: "Weaknesses & Risks",
      description: "Identify downsides, failure modes, and risks.",
      taskPrompt: `${ctx}\n\nIdentify all significant weaknesses, downsides, and risks.\nFor each: state it clearly, quantify severity (high/medium/low), and suggest a mitigation if one exists.\nReturn as a structured bullet list.`,
      complexity: 3,
      estimatedSeconds: 6,
      dataLabel: "Risks",
    },
    {
      title: "Recommendation",
      description: "Synthesize findings into a concrete, actionable recommendation.",
      taskPrompt: `${ctx}\n\nProvide a concrete, actionable recommendation based on a balanced analysis.\nState: overall verdict, primary reasoning, conditions under which this recommendation changes, and one immediate next step.\nBe direct and specific.`,
      complexity: 2,
      estimatedSeconds: 4,
      dataLabel: "Recommendation",
    },
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt heuristic decomposition. Returns null if the command is too
 * ambiguous — callers should fall through to LLM decomposition in that case.
 */
export function smartDecompose(command: string): SmartDecomposition | null {
  const kind = classifyCommand(command);
  if (kind === "unknown") return null;

  const title = deriveSmartTitle(command, kind);
  let tasks: SmartTaskSpec[];
  let hint: string;

  switch (kind) {
    case "code":
      tasks = buildCodeTasks(command, title);
      hint = "Assemble the code sections in order: Types, Core Implementation, Validation, Tests. Combine into one coherent file.";
      break;
    case "math":
      tasks = buildMathTasks(command);
      hint = "Combine the formulation, solution method, numeric result, and verification into one concise answer.";
      break;
    case "data":
      tasks = buildDataTasks(command);
      hint = "Assemble the schema, transformation logic, validation, and output definition into a complete data pipeline spec.";
      break;
    case "research":
      tasks = buildResearchTasks(command);
      hint = "Combine core concepts, mechanism, applications, and limitations into a comprehensive but concise answer.";
      break;
    case "analysis":
      tasks = buildAnalysisTasks(command);
      hint = "Combine scope, strengths, risks, and recommendation into a balanced analysis with a clear final recommendation.";
      break;
  }

  return { jobTitle: title, resultSummaryHint: hint, kind, tasks };
}

function deriveSmartTitle(command: string, kind: SmartCommandKind): string {
  const cleaned = command
    .replace(/^(hey\s+)?clementine[,.]?\s*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const kindLabel: Record<SmartCommandKind, string> = {
    code: "Implement",
    math: "Compute",
    data: "Process",
    research: "Research",
    analysis: "Analysis",
    unknown: "Task",
  };
  const prefix = kindLabel[kind];
  const body = cleaned.length > 45 ? cleaned.slice(0, 42) + "…" : cleaned;
  return `${prefix}: ${body}`;
}

/**
 * True if all completed task outputs look like code (heuristic).
 * Used by the reduce node to skip Gemini synthesis for code jobs.
 */
export function outputsAreCode(samples: string[]): boolean {
  if (samples.length === 0) return false;
  const CODE_SIGNAL = /```|^\s*(function|class|const|let|var|import|export|interface|type|def |public |private )/m;
  return samples.every((s) => CODE_SIGNAL.test(s));
}

/**
 * Deterministic synthesis for code jobs — no LLM needed.
 * Sections are labelled and concatenated in order.
 */
export function assembleCodeResult(jobTitle: string, taskTitles: string[], samples: string[]): string {
  const sections = samples.map((src, i) => {
    const label = taskTitles[i] ?? `Section ${i + 1}`;
    // Strip outer markdown fences so we can rewrap uniformly
    const code = src
      .replace(/^```[a-z]*\n?/im, "")
      .replace(/\n?```$/im, "")
      .trim();
    return `### ${label}\n\`\`\`typescript\n${code}\n\`\`\``;
  });

  return `# ${jobTitle}\n\n${sections.join("\n\n")}`;
}
