import type { BuildEssay } from "@/lib/builds/buildEssay";
import { explainPartChoices, type PartChoiceExplanation } from "@/lib/builds/partExplanations";
import type { GeneratedBuild } from "@/lib/builds/types";
import type { ProductCategory, ProductForCompatibility } from "@/lib/compatibility/types";
import type { ScoredOffer } from "@/lib/deals/types";
import { getSavedBuild, listPrebuiltSystems } from "@/lib/data/catalog";
import type { EvidenceCitation } from "@/lib/evidence/types";
import type { PriceVerdict, ProductPriceTrend } from "@/lib/pricing/priceTrends";
import { buildShoppingList, type ShoppingList } from "@/lib/shopping/offers";
import type { BuildTimingReport } from "@/lib/timing/types";

export const buildCategories: ProductCategory[] = [
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "storage",
  "psu",
  "case",
  "cooler",
];

export const categoryLabels: Record<ProductCategory, string> = {
  cpu: "CPU",
  gpu: "GPU",
  motherboard: "Motherboard",
  ram: "RAM",
  storage: "Storage",
  psu: "PSU",
  case: "Case",
  cooler: "Cooler",
};

export type ReportBuild = GeneratedBuild & {
  essay: BuildEssay;
  evidence: EvidenceCitation[];
  sourceConfidenceSummary?: {
    totalSources: number;
    averageConfidence: number;
    seededDemoCount: number;
    internalCalculationCount: number;
    compatibilityRuleCount: number;
  };
  timingReport?: BuildTimingReport;
};

export type CostBreakdownRow = {
  category: ProductCategory;
  part: ProductForCompatibility;
  offer: ScoredOffer;
  basePrice: number;
  shipping: number;
  taxEstimate: number;
  riskPenalty: number;
  effectivePrice: number;
};

export type CostBreakdown = {
  rows: CostBreakdownRow[];
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  riskPenaltyTotal: number;
  effectiveTotal: number;
};

export type CompatibilityDeepDiveRow = {
  id: string;
  level: string;
  ruleName: string;
  checkedValues: Array<{ label: string; value: string }>;
  result: string;
  explanation: string;
  evidence: EvidenceCitation[];
};

export type PrebuiltComparison = {
  nearestByPrice: Awaited<ReturnType<typeof listPrebuiltSystems>>[number] | null;
  nearestByGpu: Awaited<ReturnType<typeof listPrebuiltSystems>>[number] | null;
  bestValue: Awaited<ReturnType<typeof listPrebuiltSystems>>[number] | null;
  explanation: string;
};

export type FullBuildReport = {
  saved: NonNullable<Awaited<ReturnType<typeof getSavedBuild>>>;
  build: ReportBuild;
  costBreakdown: CostBreakdown;
  partExplanations: Record<ProductCategory, PartChoiceExplanation>;
  compatibilityDeepDive: CompatibilityDeepDiveRow[];
  markdown: string;
  prebuiltComparison: PrebuiltComparison;
  shoppingList: ShoppingList;
};

export async function getBuildReport(buildId: string): Promise<FullBuildReport | null> {
  const saved = await getSavedBuild(buildId);
  if (!saved) return null;

  const build = savedBuildToReportBuild(saved);
  const costBreakdown = calculateCostBreakdown(build);
  const partExplanations = explainPartChoices(build);
  const shoppingList = buildShoppingList(
    build.parts,
    build.offers,
    Object.fromEntries(
      buildCategories.map((category) => [
        category,
        partExplanations[category].evidence.find((citation) => citation.evidenceId)?.evidenceId
          ? `/evidence/${partExplanations[category].evidence.find((citation) => citation.evidenceId)?.evidenceId}`
          : null,
      ]),
    ),
  );
  const compatibilityDeepDive = buildCompatibilityDeepDive(build, saved.wifiRequired);
  const prebuiltComparison = await compareToPrebuilts(build);
  const markdown = buildMarkdownReport(saved, build, costBreakdown, compatibilityDeepDive, prebuiltComparison);

  return {
    saved,
    build,
    costBreakdown,
    partExplanations,
    compatibilityDeepDive,
    markdown,
    prebuiltComparison,
    shoppingList,
  };
}

export function savedBuildToReportBuild(saved: NonNullable<Awaited<ReturnType<typeof getSavedBuild>>>): ReportBuild {
  const priceSummary = saved.priceSummary as {
    productPriceTrends?: ProductPriceTrend[];
    sourceConfidenceSummary?: ReportBuild["sourceConfidenceSummary"];
    cheaperCompatibleSwaps?: GeneratedBuild["cheaperCompatibleSwaps"];
    whySelected?: string;
    overallScore?: number;
    timingReport?: BuildTimingReport;
  };

  const build = {
    id: saved.id,
    parts: saved.parts as GeneratedBuild["parts"],
    offers: saved.offers as GeneratedBuild["offers"],
    totalPrice: saved.totalPrice,
    performanceScore: saved.performanceScore,
    compatibilityReport: saved.compatibilityReport as GeneratedBuild["compatibilityReport"],
    dealScore: saved.dealScore,
    priceVerdict: saved.priceVerdict as PriceVerdict,
    productPriceTrends: priceSummary.productPriceTrends ?? [],
    overallScore: priceSummary.overallScore ?? 0,
    whySelected: priceSummary.whySelected ?? String((saved.essay as { executiveSummary?: string }).executiveSummary ?? ""),
    cheaperCompatibleSwaps: priceSummary.cheaperCompatibleSwaps ?? [],
    essay: saved.essay as BuildEssay,
    evidence: saved.evidence as EvidenceCitation[],
    sourceConfidenceSummary: priceSummary.sourceConfidenceSummary,
    timingReport: priceSummary.timingReport as BuildTimingReport | undefined,
  };

  return build;
}

export function calculateCostBreakdown(build: Pick<GeneratedBuild, "parts" | "offers">): CostBreakdown {
  const rows = buildCategories.map((category) => {
    const part = build.parts[category];
    const offer = build.offers[category];
    const basePrice = money(offer.offer.price);
    const shipping = money(offer.offer.shipping);
    const taxEstimate = money(offer.offer.taxEstimate);
    const explicitPenalty = (offer.sellerRiskPenalty ?? 0) + (offer.conditionRiskPenalty ?? 0);
    const fallbackPenalty = offer.effectivePrice - basePrice - shipping - taxEstimate;
    const riskPenalty = money(explicitPenalty || Math.max(0, fallbackPenalty));

    return {
      category,
      part,
      offer,
      basePrice,
      shipping,
      taxEstimate,
      riskPenalty,
      effectivePrice: money(offer.effectivePrice),
    };
  });

  return {
    rows,
    subtotal: money(rows.reduce((sum, row) => sum + row.basePrice, 0)),
    shippingTotal: money(rows.reduce((sum, row) => sum + row.shipping, 0)),
    taxTotal: money(rows.reduce((sum, row) => sum + row.taxEstimate, 0)),
    riskPenaltyTotal: money(rows.reduce((sum, row) => sum + row.riskPenalty, 0)),
    effectiveTotal: money(rows.reduce((sum, row) => sum + row.effectivePrice, 0)),
  };
}

export function buildCompatibilityDeepDive(build: GeneratedBuild, wifiRequired: boolean): CompatibilityDeepDiveRow[] {
  return build.compatibilityReport.results.map((result) => ({
    id: result.id,
    level: result.level,
    ruleName: result.title,
    checkedValues: checkedValuesForRule(build, result.ruleId, wifiRequired),
    result: result.level,
    explanation: result.explanation,
    evidence: result.evidence ?? [],
  }));
}

export function buildTypeLabel(buildType: string) {
  if (buildType === "best_overall") return "Best Overall";
  if (buildType === "cheapest_safe") return "Cheapest Safe";
  if (buildType === "best_performance_per_dollar") return "Best Performance/$";
  return "Custom";
}

export function priceVerdictLabel(verdict: string) {
  return verdict.replaceAll("_", " ");
}

export function isSeededDemoUrl(url?: string | null) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "example.com" || parsed.hostname.endsWith(".example.com");
  } catch {
    return true;
  }
}

export function offerLinkTarget(offer: ScoredOffer["offer"]) {
  if (!offer.id || isSeededDemoUrl(offer.url)) {
    return { href: offer.id ? `/offers/${offer.id}` : "#", external: false, label: "Seeded demo offer" };
  }

  return { href: offer.url, external: true, label: "Retailer listing" };
}

export function evidenceHref(citation: EvidenceCitation) {
  return citation.evidenceId ? `/evidence/${citation.evidenceId}` : null;
}

export function formatCurrency(value: number) {
  return `$${money(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatSpecValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "Unknown";
  return String(value);
}

async function compareToPrebuilts(build: GeneratedBuild): Promise<PrebuiltComparison> {
  const prebuilts = await listPrebuiltSystems(20);
  const nearestByPrice =
    [...prebuilts].sort((left, right) => Math.abs(left.price - build.totalPrice) - Math.abs(right.price - build.totalPrice))[0] ??
    null;
  const gpuNeedle = build.parts.gpu.model.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nearestByGpu =
    prebuilts.find((prebuilt) => prebuilt.gpuName.toLowerCase().includes(gpuNeedle.split(" ").slice(-3).join(" "))) ??
    null;
  const bestValue = prebuilts[0] ?? null;

  const explanation = `Compared with seeded prebuilt alternatives, the DIY build costs ${formatCurrency(
    build.totalPrice,
  )} and exposes every component choice. The nearest seeded prebuilt by price is ${
    nearestByPrice ? `${nearestByPrice.brand} ${nearestByPrice.model} at ${formatCurrency(nearestByPrice.price)}` : "not available"
  }. Prebuilts can have warranty and convenience advantages, but the hidden risks are unknown PSU quality, unknown motherboard model, proprietary parts, weaker cooling, or memory configuration details that are not always visible in a listing.`;

  return {
    nearestByPrice,
    nearestByGpu,
    bestValue,
    explanation,
  };
}

function buildMarkdownReport(
  saved: NonNullable<Awaited<ReturnType<typeof getSavedBuild>>>,
  build: ReportBuild,
  costBreakdown: CostBreakdown,
  compatibilityDeepDive: CompatibilityDeepDiveRow[],
  prebuiltComparison: PrebuiltComparison,
) {
  const partLines = costBreakdown.rows.map(
    (row) =>
      `- ${categoryLabels[row.category]}: ${row.part.brand} ${row.part.model} - ${formatCurrency(
        row.effectivePrice,
      )} - ${row.offer.offer.retailer}`,
  );
  const ruleLines = compatibilityDeepDive.map(
    (row) => `- ${row.ruleName}: ${row.result} - ${row.checkedValues.map((value) => `${value.label}: ${value.value}`).join("; ")}`,
  );
  const sourceLines = build.evidence.map(
    (citation) =>
      `- [${citation.citationNumber}] ${citation.title} (${citation.sourceType}) - ${citation.claim}: ${citation.value}${
        citation.unit ? ` ${citation.unit}` : ""
      }`,
  );

  return [
    `# PCDealForge Build`,
    ``,
    `Name: ${saved.name}`,
    `Type: ${buildTypeLabel(saved.buildType)}`,
    `Total: ${formatCurrency(build.totalPrice)}`,
    `Compatibility: ${build.compatibilityReport.overallStatus}`,
    `Price verdict: ${priceVerdictLabel(build.priceVerdict)}`,
    `Data status: Seeded demo data unless a linked source says otherwise.`,
    ``,
    `## Cost Breakdown`,
    `Subtotal: ${formatCurrency(costBreakdown.subtotal)}`,
    `Shipping: ${formatCurrency(costBreakdown.shippingTotal)}`,
    `Estimated tax: ${formatCurrency(costBreakdown.taxTotal)}`,
    `Risk/condition penalties: ${formatCurrency(costBreakdown.riskPenaltyTotal)}`,
    `Effective total: ${formatCurrency(costBreakdown.effectiveTotal)}`,
    ``,
    `## Parts`,
    ...partLines,
    ``,
    `## Compatibility`,
    ...ruleLines,
    ``,
    `## Essay`,
    build.essay.executiveSummary,
    ``,
    build.essay.positives,
    ``,
    build.essay.negatives,
    ``,
    build.essay.finalRecommendation ?? build.essay.finalVerdict,
    ``,
    `## DIY vs Prebuilt`,
    prebuiltComparison.explanation,
    ``,
    `## Sources`,
    ...sourceLines,
    ``,
  ].join("\n");
}

function checkedValuesForRule(build: GeneratedBuild, ruleId: string, wifiRequired: boolean) {
  const { cpu, gpu, motherboard, ram, storage, psu, case: pcCase, cooler } = build.parts;

  switch (ruleId) {
    case "cpu-socket-match":
      return [
        { label: "CPU socket", value: spec(cpu, "socket") },
        { label: "Motherboard socket", value: spec(motherboard, "socket") },
      ];
    case "cpu-generation-support":
      return [
        { label: "CPU model", value: cpu.model },
        { label: "Motherboard BIOS support", value: spec(motherboard, "biosSupportJson") },
      ];
    case "ram-type-match":
      return [
        { label: "RAM type", value: spec(ram, "ramType") },
        { label: "Motherboard RAM type", value: spec(motherboard, "ramType") },
      ];
    case "ram-capacity-limit":
      return [
        { label: "RAM capacity", value: `${num(ram, "capacityGb")}GB` },
        { label: "Motherboard max RAM", value: `${num(motherboard, "maxRamGb")}GB` },
      ];
    case "case-motherboard-form-factor":
      return [
        { label: "Motherboard form factor", value: spec(motherboard, "formFactor") },
        { label: "Case support", value: spec(pcCase, "formFactorSupport") },
      ];
    case "gpu-length-clearance":
      return [
        { label: "GPU length", value: `${num(gpu, "lengthMm")}mm` },
        { label: "Case max GPU length", value: `${num(pcCase, "maxGpuLengthMm")}mm` },
        { label: "Clearance remaining", value: `${num(pcCase, "maxGpuLengthMm") - num(gpu, "lengthMm")}mm` },
      ];
    case "cooler-socket-support":
      return [
        { label: "CPU socket", value: spec(cpu, "socket") },
        { label: "Cooler supported sockets", value: spec(cooler, "supportedSockets") },
      ];
    case "air-cooler-height":
      return [
        { label: "Cooler height", value: `${num(cooler, "heightMm")}mm` },
        { label: "Case max cooler height", value: `${num(pcCase, "maxCpuCoolerHeightMm")}mm` },
      ];
    case "aio-radiator-support":
      return [
        { label: "Radiator size", value: `${num(cooler, "radiatorSizeMm")}mm` },
        { label: "Case radiator support", value: spec(pcCase, "radiatorSupport") },
      ];
    case "psu-wattage-headroom": {
      const estimatedLoad = num(cpu, "tdp") + num(gpu, "tdp") + 100;
      return [
        { label: "CPU TDP", value: `${num(cpu, "tdp")}W` },
        { label: "GPU TDP", value: `${num(gpu, "tdp")}W` },
        { label: "System overhead", value: "100W" },
        { label: "Estimated load", value: `${estimatedLoad}W` },
        { label: "Recommended PSU", value: `${Math.ceil(estimatedLoad * 1.35)}W` },
        { label: "Selected PSU", value: `${num(psu, "wattage")}W` },
      ];
    }
    case "psu-gpu-power-connector":
      return [
        { label: "GPU required connector", value: spec(gpu, "powerConnector") },
        { label: "PSU 12VHPWR", value: spec(psu, "has12vhpwr") },
        { label: "PSU 12V-2x6", value: spec(psu, "has12v2x6") },
        { label: "PSU PCIe 8-pin count", value: String(num(psu, "pcie8PinCount")) },
      ];
    case "psu-quality-high-end-gpu":
      return [
        { label: "GPU TDP", value: `${num(gpu, "tdp")}W` },
        { label: "GPU performance score", value: String(num(gpu, "performanceScore")) },
        { label: "PSU quality tier", value: spec(psu, "qualityTier") },
      ];
    case "front-usb-c-header":
      return [
        { label: "Case front USB-C", value: spec(pcCase, "hasFrontUsbC") },
        { label: "Motherboard front USB-C header", value: spec(motherboard, "hasFrontUsbCHeader") },
      ];
    case "wifi-requirement":
      return [
        { label: "User requires Wi-Fi", value: wifiRequired ? "yes" : "no" },
        { label: "Motherboard Wi-Fi", value: spec(motherboard, "hasWifi") },
      ];
    case "storage-m2-slot":
      return [
        { label: "Storage form factor", value: spec(storage, "formFactor") },
        { label: "Motherboard M.2 slots", value: String(num(motherboard, "m2Slots")) },
      ];
    case "gpu-slot-thickness":
      return [{ label: "GPU slot thickness", value: `${num(gpu, "slots")} slots` }];
    case "ram-cooler-clearance":
      return [
        { label: "RAM height", value: `${num(ram, "heightMm")}mm` },
        { label: "Cooler type", value: spec(cooler, "type") },
        { label: "Cooler RAM clearance issue", value: spec(cooler, "ramClearanceIssue") },
      ];
    default:
      return [{ label: "Rule", value: ruleId }];
  }
}

function spec(part: ProductForCompatibility, key: string) {
  return formatSpecValue(part.specs[key]);
}

function num(part: ProductForCompatibility, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : 0;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}
