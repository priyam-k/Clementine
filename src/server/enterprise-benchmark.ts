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
    name: "Microsoft",
    sector: "cloud security orchestration",
    strengths: ["broad enterprise footprint", "deep platform ecosystem"],
    weaknesses: ["premium commercial terms", "complex licensing structure"],
    notes: "Large incumbent benchmark profile for regulated enterprise deployments.",
  },
  {
    name: "Amazon Web Services",
    sector: "logistics visibility",
    strengths: ["high service breadth", "strong global infrastructure reach"],
    weaknesses: ["cost sprawl risk", "governance complexity"],
    notes: "Large-scale cloud benchmark profile with strong operating leverage.",
  },
  {
    name: "Google Cloud",
    sector: "workflow automation",
    strengths: ["strong data platform reputation", "modern developer tooling"],
    weaknesses: ["enterprise standardization gaps", "premium advanced services"],
    notes: "Benchmark profile oriented around analytics-forward deployments.",
  },
  {
    name: "Oracle",
    sector: "identity and access tooling",
    strengths: ["deep enterprise account coverage", "mature controls posture"],
    weaknesses: ["heavier contracting motion", "higher implementation friction"],
    notes: "Benchmark profile for legacy-heavy enterprise environments.",
  },
  {
    name: "SAP",
    sector: "data integration",
    strengths: ["strong global enterprise presence", "broad operational footprint"],
    weaknesses: ["complex rollout programs", "higher services dependency"],
    notes: "Benchmark profile for operations-heavy enterprise transformation.",
  },
  {
    name: "Salesforce",
    sector: "supply chain risk intelligence",
    strengths: ["large partner ecosystem", "strong workflow extensibility"],
    weaknesses: ["cost growth at scale", "administrative overhead"],
    notes: "Benchmark profile for ecosystem-driven enterprise rollouts.",
  },
  {
    name: "ServiceNow",
    sector: "IT operations analytics",
    strengths: ["strong workflow standardization", "good executive visibility"],
    weaknesses: ["platform complexity", "premium enterprise pricing"],
    notes: "Benchmark profile for service operations standardization.",
  },
  {
    name: "Workday",
    sector: "vendor governance",
    strengths: ["mature enterprise delivery model", "predictable product motion"],
    weaknesses: ["less flexible customization", "heavier procurement process"],
    notes: "Benchmark profile for process-centric enterprise buyers.",
  },
  {
    name: "Okta",
    sector: "customer operations platform",
    strengths: ["strong identity focus", "good ecosystem interoperability"],
    weaknesses: ["concentration risk in core category", "security scrutiny sensitivity"],
    notes: "Benchmark profile for identity-centric deployments.",
  },
  {
    name: "Cloudflare",
    sector: "regulatory operations",
    strengths: ["strong edge network profile", "good performance narrative"],
    weaknesses: ["portfolio breadth can complicate evaluation", "premium advanced packages"],
    notes: "Benchmark profile for edge and network-performance scenarios.",
  },
  {
    name: "CrowdStrike",
    sector: "endpoint security",
    strengths: ["strong security specialization", "clear platform positioning"],
    weaknesses: ["category concentration risk", "premium pricing"],
    notes: "Benchmark profile for security-focused buying decisions.",
  },
  {
    name: "Palo Alto Networks",
    sector: "network security",
    strengths: ["broad security portfolio", "strong enterprise penetration"],
    weaknesses: ["integration complexity", "higher commercial overhead"],
    notes: "Benchmark profile for large-scale security consolidation.",
  },
  {
    name: "Cisco",
    sector: "enterprise networking",
    strengths: ["strong installed base", "broad infrastructure footprint"],
    weaknesses: ["legacy estate complexity", "slower procurement cycles"],
    notes: "Benchmark profile for large networking and infrastructure programs.",
  },
  {
    name: "IBM",
    sector: "enterprise technology services",
    strengths: ["deep enterprise relationships", "strong governance posture"],
    weaknesses: ["heavier delivery model", "slower product velocity"],
    notes: "Benchmark profile for governance-heavy enterprise transformation.",
  },
  {
    name: "Snowflake",
    sector: "data cloud platform",
    strengths: ["strong analytics reputation", "clear data-platform focus"],
    weaknesses: ["usage-cost variability", "platform standardization demands"],
    notes: "Benchmark profile for data-intensive operating models.",
  },
  {
    name: "Datadog",
    sector: "observability platform",
    strengths: ["modern tooling footprint", "strong developer affinity"],
    weaknesses: ["cost expansion risk", "tool sprawl concerns"],
    notes: "Benchmark profile for modern engineering organizations.",
  },
  {
    name: "MongoDB",
    sector: "developer data platform",
    strengths: ["developer adoption", "flexible application support"],
    weaknesses: ["governance tuning needs", "cost management complexity"],
    notes: "Benchmark profile for application-centric platform decisions.",
  },
  {
    name: "Atlassian",
    sector: "team collaboration software",
    strengths: ["strong team workflow usage", "good ecosystem extensions"],
    weaknesses: ["administration sprawl", "enterprise control standardization gaps"],
    notes: "Benchmark profile for collaboration-heavy knowledge teams.",
  },
  {
    name: "Adobe",
    sector: "digital experience software",
    strengths: ["strong brand footprint", "broad product ecosystem"],
    weaknesses: ["premium pricing", "portfolio complexity"],
    notes: "Benchmark profile for customer-experience and content operations.",
  },
  {
    name: "Zoom",
    sector: "communications platform",
    strengths: ["strong ease-of-use profile", "broad end-user familiarity"],
    weaknesses: ["category competition pressure", "feature overlap risk"],
    notes: "Benchmark profile for communications-centric deployments.",
  },
  {
    name: "Twilio",
    sector: "communications APIs",
    strengths: ["developer-friendly platform", "broad messaging reach"],
    weaknesses: ["usage-cost sensitivity", "reliance on communications volumes"],
    notes: "Benchmark profile for API-led communications programs.",
  },
  {
    name: "Shopify",
    sector: "commerce platform",
    strengths: ["clear product focus", "strong ecosystem momentum"],
    weaknesses: ["category scope limits", "enterprise customization tradeoffs"],
    notes: "Benchmark profile for commerce-led platform evaluations.",
  },
  {
    name: "Stripe",
    sector: "payments infrastructure",
    strengths: ["strong developer reputation", "clean platform integration story"],
    weaknesses: ["pricing sensitivity at scale", "regulatory workload in payments contexts"],
    notes: "Benchmark profile for payments and monetization decisions.",
  },
  {
    name: "Dell Technologies",
    sector: "enterprise infrastructure",
    strengths: ["broad enterprise infrastructure footprint", "strong channel presence"],
    weaknesses: ["portfolio overlap", "heavier procurement cycles"],
    notes: "Benchmark profile for infrastructure-heavy transformation plans.",
  },
  {
    name: "HPE",
    sector: "enterprise compute infrastructure",
    strengths: ["strong infrastructure heritage", "good enterprise services attachment"],
    weaknesses: ["complex portfolio positioning", "slower contracting motion"],
    notes: "Benchmark profile for on-prem and hybrid infrastructure programs.",
  },
  {
    name: "NVIDIA",
    sector: "accelerated computing",
    strengths: ["strong AI platform demand", "clear performance leadership perception"],
    weaknesses: ["cost intensity", "supply sensitivity"],
    notes: "Benchmark profile for AI-infrastructure focused procurement.",
  },
  {
    name: "Intel",
    sector: "enterprise compute hardware",
    strengths: ["broad enterprise install base", "familiar platform standards"],
    weaknesses: ["performance perception pressure", "execution scrutiny"],
    notes: "Benchmark profile for mainstream enterprise compute decisions.",
  },
  {
    name: "Akamai",
    sector: "content delivery and security",
    strengths: ["strong network heritage", "global delivery reach"],
    weaknesses: ["portfolio complexity", "premium advanced services"],
    notes: "Benchmark profile for network delivery and edge security tradeoffs.",
  },
  {
    name: "VMware",
    sector: "virtualization and cloud infrastructure",
    strengths: ["deep enterprise footprint", "strong infrastructure standardization story"],
    weaknesses: ["licensing sensitivity", "platform transition complexity"],
    notes: "Benchmark profile for virtualization-centric estates.",
  },
  {
    name: "Red Hat",
    sector: "enterprise open source platform",
    strengths: ["strong enterprise Linux credibility", "good platform consistency"],
    weaknesses: ["skills dependency", "implementation expertise needs"],
    notes: "Benchmark profile for open-source aligned enterprise platforms.",
  },
  {
    name: "Splunk",
    sector: "security and observability analytics",
    strengths: ["strong analytics reputation", "broad operational visibility story"],
    weaknesses: ["cost expansion at scale", "administrative tuning needs"],
    notes: "Benchmark profile for operational analytics deployments.",
  },
  {
    name: "Fortinet",
    sector: "network security",
    strengths: ["strong security appliance position", "broad mid-market reach"],
    weaknesses: ["portfolio standardization effort", "integration tuning needs"],
    notes: "Benchmark profile for network-security focused buyers.",
  },
  {
    name: "Zscaler",
    sector: "cloud security platform",
    strengths: ["clear cloud-security positioning", "strong zero-trust narrative"],
    weaknesses: ["architecture transition demands", "premium pricing"],
    notes: "Benchmark profile for cloud-first security transformation.",
  },
  {
    name: "HubSpot",
    sector: "customer platform software",
    strengths: ["strong ease-of-use reputation", "good go-to-market workflow alignment"],
    weaknesses: ["enterprise depth questions", "platform sprawl risk"],
    notes: "Benchmark profile for growth-oriented business operations.",
  },
  {
    name: "Box",
    sector: "content management",
    strengths: ["strong document governance story", "enterprise-friendly collaboration stance"],
    weaknesses: ["feature overlap pressure", "category competition"],
    notes: "Benchmark profile for content-governance programs.",
  },
  {
    name: "DocuSign",
    sector: "digital agreements",
    strengths: ["clear workflow focus", "strong user familiarity"],
    weaknesses: ["category concentration", "cost scrutiny in broad rollouts"],
    notes: "Benchmark profile for digital agreement workflows.",
  },
  {
    name: "Slack",
    sector: "enterprise collaboration",
    strengths: ["strong user adoption", "broad workflow integrations"],
    weaknesses: ["tool overlap risk", "governance standardization needs"],
    notes: "Benchmark profile for collaboration and knowledge-work programs.",
  },
  {
    name: "Asana",
    sector: "work management software",
    strengths: ["clear workflow organization", "good user-level adoption profile"],
    weaknesses: ["enterprise control maturity questions", "platform overlap risk"],
    notes: "Benchmark profile for work-management standardization.",
  },
  {
    name: "UiPath",
    sector: "automation software",
    strengths: ["strong automation category focus", "good process-scale narrative"],
    weaknesses: ["automation governance needs", "services dependence in complex rollouts"],
    notes: "Benchmark profile for enterprise automation programs.",
  },
  {
    name: "Samsara",
    sector: "connected operations platform",
    strengths: ["strong operations visibility positioning", "clear use-case alignment"],
    weaknesses: ["vertical concentration", "expansion proof points needed"],
    notes: "Benchmark profile for operational visibility deployments.",
  },
  {
    name: "Oracle NetSuite",
    sector: "business operations software",
    strengths: ["strong ERP standardization story", "good mid-market enterprise fit"],
    weaknesses: ["customization tradeoffs", "implementation effort"],
    notes: "Benchmark profile for finance and operations standardization.",
  },
  {
    name: "ZoomInfo",
    sector: "go-to-market intelligence",
    strengths: ["strong data-utility narrative", "good sales workflow alignment"],
    weaknesses: ["data freshness scrutiny", "category competition pressure"],
    notes: "Benchmark profile for revenue-operations workflows.",
  },
  {
    name: "Confluent",
    sector: "data streaming platform",
    strengths: ["strong streaming specialization", "good platform extensibility"],
    weaknesses: ["skills intensity", "operational complexity at scale"],
    notes: "Benchmark profile for event-driven architecture programs.",
  },
  {
    name: "Elastic",
    sector: "search and observability platform",
    strengths: ["broad use-case flexibility", "strong search reputation"],
    weaknesses: ["tuning overhead", "portfolio sprawl risk"],
    notes: "Benchmark profile for search and observability use cases.",
  },
  {
    name: "SentinelOne",
    sector: "endpoint security",
    strengths: ["modern security platform perception", "strong automation narrative"],
    weaknesses: ["category competition", "large-enterprise proof depth questions"],
    notes: "Benchmark profile for endpoint security decisions.",
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
    const stripped = sanitizeModelText(text)
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}

const INTERNAL_MONOLOGUE_PATTERNS = [
  /^\s*we need to\b/i,
  /^\s*we must\b/i,
  /^\s*let'?s\b/i,
  /^\s*given the data\b/i,
  /^\s*given we have\b/i,
  /^\s*thus we\b/i,
  /^\s*now (produce|write)\b/i,
  /^\s*the user says\b/i,
  /^\s*the user has provided\b/i,
  /^\s*we have been given\b/i,
  /^\s*we only have\b/i,
  /^\s*but we must\b/i,
  /^\s*however,? the\b/i,
  /^\s*role assignment:\b/i,
  /^\s*task description:\b/i,
  /^\s*instructions:\b/i,
  /^\s*return valid json\b/i,
  /^\s*json schema\b/i,
  /^\s*original prompt:?/i,
];

function stripInternalMonologueLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !INTERNAL_MONOLOGUE_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .join("\n");
}

function extractMarkdownReport(text: string): string {
  const headingMatch = text.match(/(^|\n)(#{1,6}\s.+)/);
  if (!headingMatch || headingMatch.index === undefined) {
    return text.trim();
  }

  const headingStart =
    headingMatch[1] === "\n" ? headingMatch.index + 1 : headingMatch.index;
  return text.slice(headingStart).trim();
}

function sanitizeModelText(text: string): string {
  const sanitized = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*The user has provided[\s\S]*?(?=#{1,6}\s|[\[{])/i, "")
    .replace(/```(?:markdown|md)?/gi, "```")
    .trim();

  return stripInternalMonologueLines(extractMarkdownReport(sanitized)).trim();
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
      name: base.name,
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
          [
            "You are Clementine's enterprise workflow orchestrator.",
            "Create role-based parallel assignments for a distributed vendor evaluation benchmark.",
            "Use only the supplied vendor fields and evaluation criteria.",
            "Do not invent external facts, browsing steps, or hidden reasoning.",
            "Respond only as valid JSON.",
          ].join(" "),
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

  const executiveSummary =
    topTwo.length >= 2
      ? `Clementine evaluated ${vendors.length} vendors for ${job.title.toLowerCase()} and recommends **${topTwo.map((vendor) => vendor.name).join("** and **")}** as the top two options based on the provided vendor profile data.`
      : `Clementine evaluated ${vendors.length} vendor for ${job.title.toLowerCase()} and recommends **${topTwo[0]?.name ?? "the available vendor"}** as the strongest option based on the provided vendor profile data. A second recommendation is not available because only one vendor was supplied.`;

  return [
    "# Clementine Vendor Evaluation Report",
    "",
    `## Executive Summary`,
    executiveSummary,
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
    topTwo.length >= 2
      ? `${topTwo[0]?.name ?? "Top vendor"} is the strongest overall choice for a production deployment, while ${topTwo[1]?.name ?? "the second-ranked vendor"} is the strongest alternative when balancing speed and governance.`
      : `${topTwo[0]?.name ?? "The available vendor"} is the strongest available choice for a production deployment based on the provided vendor profile. An additional vendor is required before naming a second recommendation.`,
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
          [
            "You are Clementine's executive synthesis model.",
            "Produce a polished markdown report only.",
            "Use only the provided vendor profile data and analyst task summaries as evidence.",
            "Do not mention prompts, parsing, instructions, JSON schemas, hidden reasoning, or <think> content.",
            "Do not fabricate external facts, market claims, or compliance assertions that are not supported by the supplied data.",
            "If only one vendor is available, say that no second recommendation is available rather than inventing one.",
            "Use headings, ordered lists, unordered lists, emphasis, and concise business language.",
          ].join(" "),
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

    const sanitizedMarkdown = sanitizeMarkdownArtifact(markdown);
    return sanitizedMarkdown || fallback;
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
  const sanitizedMarkdown = sanitizeMarkdownArtifact(markdown);
  const filenameBase = `${job.id}-vendor-evaluation`;
  const filePath = await writeMarkdownArtifact(filenameBase, sanitizedMarkdown);

  return {
    id: `artifact_${job.id}_markdown`,
    jobId: job.id,
    artifactType: "markdown",
    title: `${job.title} Report`,
    filename: `${filenameBase}.md`,
    content: sanitizedMarkdown,
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
      [
        task.description,
        "Use only the provided vendor profile fields as evidence.",
        "Do not invent outside facts, citations, or market data.",
        'Return compact JSON with fields: summary, vendorFindings, rankedVendorIds, recommendationScore, notableRisks.',
      ].join(" "),
  };
}

export function buildEnterpriseResultSummary(markdown: string): string {
  return extractArtifactSummary(markdown);
}

export function sanitizeMarkdownArtifact(markdown: string): string {
  const cleaned = sanitizeModelText(markdown);
  if (!cleaned.startsWith("#")) {
    return "";
  }

  const forbiddenFragments = [
    "The user says",
    "We need to",
    "Let's parse",
    "Return valid JSON",
    "Role assignment:",
    "Task description:",
    "Instructions:",
    "Original prompt:",
  ];

  if (forbiddenFragments.some((fragment) => cleaned.includes(fragment))) {
    return stripInternalMonologueLines(cleaned)
      .split("\n")
      .filter((line) => !forbiddenFragments.some((fragment) => line.includes(fragment)))
      .join("\n")
      .trim();
  }

  return cleaned;
}
