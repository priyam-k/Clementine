import type {
  EnterpriseBenchmarkConfig,
  VendorProfile,
  WireArtifact,
} from "../lib/shared-types";
import type { ServerJob } from "./types";
import { writeMarkdownArtifact } from "./results-writer";

interface EnterpriseTaskSpec {
  title: string;
  description: string;
  role: string;
  vendorIds: string[];
  criteria: string[];
}

interface EnterpriseDecomposition {
  jobTitle: string;
  resultSummaryHint: string;
  tasks: EnterpriseTaskSpec[];
}

const K2_API_URL = "https://api.k2think.ai/v1/chat/completions";
const K2_MODEL = "MBZUAI-IFM/K2-Think-v2";
const DEFAULT_CRITERIA = [
  "risk",
  "reliability",
  "cost efficiency",
  "scalability",
  "compliance",
];

const ROLE_LIBRARY = [
  {
    role: "Risk Analyst",
    focus: ["risk", "reliability"],
    promptFocus: "operational, concentration, resilience, and vendor continuity risk",
  },
  {
    role: "Financial Analyst",
    focus: ["cost efficiency", "scalability"],
    promptFocus: "commercial fit, unit economics, margin pressure, and long-term scalability",
  },
  {
    role: "Compliance Analyst",
    focus: ["compliance", "risk"],
    promptFocus: "regulatory readiness, control maturity, audit exposure, and policy gaps",
  },
  {
    role: "Operations Analyst",
    focus: ["reliability", "scalability"],
    promptFocus: "delivery reliability, implementation friction, support operations, and scale-readiness",
  },
  {
    role: "Market Analyst",
    focus: ["scalability", "cost efficiency", "risk"],
    promptFocus: "market momentum, competitive durability, vendor trajectory, and execution context",
  },
];

const VENDOR_BASES = [
  {
    prefix: "Aster",
    sector: "cloud security orchestration",
    strengths: ["strong incident response automation", "solid enterprise references"],
    weaknesses: ["premium pricing", "slower procurement cycles"],
    notes: "Good fit for regulated buyers that value stability over speed.",
  },
  {
    prefix: "Brassline",
    sector: "logistics visibility",
    strengths: ["fast deployment", "strong analytics dashboards"],
    weaknesses: ["limited multinational support", "younger services team"],
    notes: "Often wins on speed but requires tighter governance support.",
  },
  {
    prefix: "CinderPeak",
    sector: "workflow automation",
    strengths: ["excellent API coverage", "high configurability"],
    weaknesses: ["complex onboarding", "requires technical admins"],
    notes: "Powerful platform with a steeper enablement curve.",
  },
  {
    prefix: "Driftwater",
    sector: "identity and access tooling",
    strengths: ["mature controls library", "predictable release quality"],
    weaknesses: ["higher annual commitments", "less flexible packaging"],
    notes: "Enterprise-ready option with heavier commercial terms.",
  },
  {
    prefix: "Evergrid",
    sector: "data integration",
    strengths: ["low-code connectors", "strong ecosystem partnerships"],
    weaknesses: ["inconsistent documentation", "mixed migration tooling"],
    notes: "Accessible for broad teams but documentation quality varies.",
  },
  {
    prefix: "Forgepath",
    sector: "supply chain risk intelligence",
    strengths: ["rich benchmarking dataset", "rapid scenario modeling"],
    weaknesses: ["limited federal experience", "pricing grows quickly with volume"],
    notes: "Useful for strategy teams that need fast comparative modeling.",
  },
  {
    prefix: "Granite Arc",
    sector: "IT operations analytics",
    strengths: ["reliable alerting", "strong support reputation"],
    weaknesses: ["aging UI", "moderate implementation effort"],
    notes: "Dependable option that trades polish for maturity.",
  },
  {
    prefix: "Harborlight",
    sector: "vendor governance",
    strengths: ["good policy templates", "clear executive reporting"],
    weaknesses: ["limited customization depth", "slower roadmap cadence"],
    notes: "Safe choice for governance-first teams.",
  },
  {
    prefix: "Ionfield",
    sector: "customer operations platform",
    strengths: ["high throughput processing", "strong automation recipes"],
    weaknesses: ["few large-enterprise case studies", "small compliance team"],
    notes: "Efficient and modern, but references are still maturing.",
  },
  {
    prefix: "Juniper North",
    sector: "regulatory operations",
    strengths: ["excellent audit workflows", "proven compliance expertise"],
    weaknesses: ["higher services dependency", "slower innovation pace"],
    notes: "Strong risk posture with heavier implementation support needs.",
  },
];

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function clampScore(score: number): number {
  return Math.min(95, Math.max(35, Math.round(score)));
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function safeJsonParse<T>(text: string): T | null {
  try {
    const stripped = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}

async function callK2(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<string> {
  const apiKey = process.env.K2_API_KEY;
  if (!apiKey) {
    throw new Error("K2_API_KEY is not configured");
  }

  const upstream = await fetch(K2_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: K2_MODEL,
      messages,
      stream: false,
    }),
  });

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
    error?: string;
  };

  if (!upstream.ok) {
    throw new Error(data?.error ?? "K2 request failed");
  }

  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.delta?.content ??
    ""
  ).trim();
}

export function generateVendorProfiles(config: EnterpriseBenchmarkConfig, seedSource: string): VendorProfile[] {
  const seed = hashString(`${seedSource}:${config.vendorCount}:${config.analysisDepth}`);
  const random = mulberry32(seed);

  return Array.from({ length: config.vendorCount }, (_, index) => {
    const base = VENDOR_BASES[index % VENDOR_BASES.length];
    const tierRoll = random();
    const size =
      tierRoll < 0.25 ? "startup" : tierRoll < 0.7 ? "mid-market" : "enterprise";
    const costProfile =
      size === "enterprise" ? "high" : size === "startup" && random() > 0.6 ? "low" : "medium";
    const complianceMaturity =
      size === "enterprise" ? (random() > 0.3 ? "advanced" : "mature") : random() > 0.55 ? "mature" : "emerging";
    const reliabilityBase = size === "enterprise" ? 78 : size === "mid-market" ? 68 : 56;
    const scalabilityBase = size === "enterprise" ? 80 : size === "mid-market" ? 70 : 60;
    const riskBase = size === "startup" ? 66 : size === "mid-market" ? 54 : 43;

    return {
      id: `vendor_${String(index + 1).padStart(2, "0")}`,
      name: `${base.prefix} ${index + 1}`,
      size,
      strengths: [
        base.strengths[0],
        base.strengths[1],
        `${base.sector} specialization`,
      ],
      weaknesses: [
        base.weaknesses[0],
        base.weaknesses[1],
      ],
      costProfile,
      complianceMaturity,
      reliability: clampScore(reliabilityBase + random() * 18 - 6),
      scalability: clampScore(scalabilityBase + random() * 18 - 5),
      risk: clampScore(riskBase + random() * 18 - 4),
      notes: `${base.notes} Focus area: ${base.sector}.`,
    };
  });
}

function buildFallbackDecomposition(vendors: VendorProfile[], config: EnterpriseBenchmarkConfig): EnterpriseDecomposition {
  const vendorsPerAssignment =
    config.analysisDepth === "light"
      ? Math.max(1, Math.ceil(vendors.length / 5))
      : config.analysisDepth === "standard"
      ? Math.max(2, Math.ceil(vendors.length / 6))
      : config.analysisDepth === "deep"
      ? Math.max(3, Math.ceil(vendors.length / 7))
      : Math.max(4, Math.ceil(vendors.length / 8));

  const vendorChunks = chunkArray(vendors, vendorsPerAssignment);
  const tasks = vendorChunks.flatMap((chunk, chunkIndex) =>
    ROLE_LIBRARY.map((roleTemplate) => ({
      title: `${roleTemplate.role} — Group ${chunkIndex + 1}`,
      description: `${roleTemplate.role}: assess ${roleTemplate.promptFocus} for ${chunk.map((vendor) => vendor.name).join(", ")}. Return concise structured findings, notable risks, and a numeric recommendation score out of 100 for each vendor.`,
      role: roleTemplate.role,
      vendorIds: chunk.map((vendor) => vendor.id),
      criteria: roleTemplate.focus,
    }))
  );

  return {
    jobTitle: `Enterprise Vendor Risk & Selection — ${vendors.length} Vendors`,
    resultSummaryHint:
      "Deliver an executive-ready recommendation that ranks vendors and names the top 2 choices with explicit tradeoffs.",
    tasks,
  };
}

export async function decomposeEnterpriseAnalysis(
  prompt: string,
  vendors: VendorProfile[],
  config: EnterpriseBenchmarkConfig
): Promise<EnterpriseDecomposition> {
  const fallback = buildFallbackDecomposition(vendors, config);

  try {
    const responseText = await callK2([
      {
        role: "system",
        content:
          "You are Clementine's enterprise workflow orchestrator. Create role-based parallel assignments for a distributed vendor evaluation benchmark. Respond only as valid JSON.",
      },
      {
        role: "user",
        content: JSON.stringify({
          prompt,
          benchmarkType: config.benchmarkType,
          analysisDepth: config.analysisDepth,
          criteria: DEFAULT_CRITERIA,
          availableRoles: ROLE_LIBRARY.map((role) => ({
            role: role.role,
            focus: role.focus,
            promptFocus: role.promptFocus,
          })),
          vendors: vendors.map((vendor) => ({
            id: vendor.id,
            name: vendor.name,
            size: vendor.size,
            costProfile: vendor.costProfile,
            complianceMaturity: vendor.complianceMaturity,
            reliability: vendor.reliability,
            scalability: vendor.scalability,
            risk: vendor.risk,
            strengths: vendor.strengths,
            weaknesses: vendor.weaknesses,
            notes: vendor.notes,
          })),
          targetSchema: {
            jobTitle: "string",
            resultSummaryHint: "string",
            tasks: [
              {
                title: "string",
                description: "string",
                role: "string",
                vendorIds: ["vendor_01"],
                criteria: ["risk", "reliability"],
              },
            ],
          },
        }),
      },
    ]);

    const parsed = safeJsonParse<EnterpriseDecomposition>(responseText);
    if (!parsed?.tasks?.length) return fallback;

    const validTasks = parsed.tasks
      .map((task) => ({
        title: task.title,
        description: task.description,
        role: task.role,
        vendorIds: task.vendorIds.filter((vendorId) => vendors.some((vendor) => vendor.id === vendorId)),
        criteria: task.criteria.length > 0 ? task.criteria : DEFAULT_CRITERIA,
      }))
      .filter((task) => task.vendorIds.length > 0);

    if (validTasks.length === 0) return fallback;

    return {
      jobTitle: parsed.jobTitle || fallback.jobTitle,
      resultSummaryHint: parsed.resultSummaryHint || fallback.resultSummaryHint,
      tasks: validTasks,
    };
  } catch {
    return fallback;
  }
}

function buildFallbackMarkdown(
  job: ServerJob,
  vendors: VendorProfile[],
  taskSummaries: string[]
): string {
  const ranked = [...vendors].sort((a, b) => {
    const aScore = a.reliability + a.scalability + (100 - a.risk);
    const bScore = b.reliability + b.scalability + (100 - b.risk);
    return bScore - aScore;
  });
  const topTwo = ranked.slice(0, 2);

  return [
    "# Clementine Vendor Evaluation Report",
    "",
    `## Executive Summary`,
    `Clementine evaluated ${vendors.length} vendors for ${job.title.toLowerCase()} and recommends **${topTwo.map((vendor) => vendor.name).join("** and **")}** as the top two options based on reliability, scalability, cost efficiency, and compliance readiness.`,
    "",
    "## Evaluation Criteria",
    "- Risk",
    "- Reliability",
    "- Cost Efficiency",
    "- Scalability",
    "- Compliance",
    "",
    "## Vendor Rankings",
    ...ranked.slice(0, 10).map((vendor, index) => `${index + 1}. ${vendor.name}`),
    "",
    "## Role-Based Findings",
    ...taskSummaries.map((summary) => `- ${summary}`),
    "",
    "## Recommendation",
    `${topTwo[0]?.name ?? "Top vendor"} is the strongest overall choice for a production deployment, while ${topTwo[1]?.name ?? "the second-ranked vendor"} is the strongest alternative when balancing speed and governance.`,
    "",
    "## Risks / Tradeoffs",
    `- Higher-ranked vendors tend to cost more but reduce operational and compliance uncertainty.`,
    `- Lower-cost vendors show more delivery variance and weaker control maturity.`,
    "",
    "---",
    `Generated by Clementine for session \`${job.sessionCode}\`.`,
  ].join("\n");
}

export async function synthesizeEnterpriseMarkdown(
  job: ServerJob,
  vendors: VendorProfile[],
  taskSummaries: string[]
): Promise<string> {
  const fallback = buildFallbackMarkdown(job, vendors, taskSummaries);

  try {
    const markdown = await callK2([
      {
        role: "system",
        content:
          "You are Clementine's executive synthesis model. Produce a polished markdown report only. Use headings, ordered lists, unordered lists, emphasis, and concise business language.",
      },
      {
        role: "user",
        content: JSON.stringify({
          jobTitle: job.title,
          originalPrompt: job.rawPrompt,
          criteria: DEFAULT_CRITERIA,
          vendors: vendors.map((vendor) => ({
            name: vendor.name,
            size: vendor.size,
            costProfile: vendor.costProfile,
            complianceMaturity: vendor.complianceMaturity,
            reliability: vendor.reliability,
            scalability: vendor.scalability,
            risk: vendor.risk,
            strengths: vendor.strengths,
            weaknesses: vendor.weaknesses,
            notes: vendor.notes,
          })),
          taskSummaries,
          sections: [
            "Title",
            "Executive Summary",
            "Evaluation Criteria",
            "Vendor Overview",
            "Role-Based Findings",
            "Ranked Recommendations",
            "Top 2 Recommendation",
            "Risks / Tradeoffs",
          ],
        }),
      },
    ]);

    return markdown || fallback;
  } catch {
    return fallback;
  }
}

function extractArtifactSummary(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => !line.startsWith("#"))?.replace(/^[-*]\s*/, "") ?? "Enterprise benchmark report generated.";
}

export async function createEnterpriseMarkdownArtifact(job: ServerJob, markdown: string): Promise<WireArtifact> {
  const filenameBase = `${job.id}-vendor-evaluation`;
  const filePath = await writeMarkdownArtifact(filenameBase, markdown);

  return {
    id: `artifact_${job.id}_markdown`,
    jobId: job.id,
    artifactType: "markdown",
    title: `${job.title} Report`,
    filename: `${filenameBase}.md`,
    content: markdown,
    createdAt: Date.now(),
    filePath,
  };
}

export function buildEnterpriseTaskPayload(
  task: EnterpriseTaskSpec,
  vendors: VendorProfile[],
  config: EnterpriseBenchmarkConfig
): Record<string, unknown> {
  const assignedVendors = vendors.filter((vendor) => task.vendorIds.includes(vendor.id));
  return {
    benchmarkType: config.benchmarkType,
    analysisDepth: config.analysisDepth,
    role: task.role,
    criteria: task.criteria,
    assignedVendors,
    instructions:
      `${task.description}\nReturn JSON with fields: summary, vendorFindings, rankedVendorIds, recommendationScore, notableRisks.`,
  };
}

export function buildEnterpriseResultSummary(markdown: string): string {
  return extractArtifactSummary(markdown);
}
