import { generateBuilds } from "@/lib/builds/generateBuilds";
import { generateBuildEssay } from "@/lib/builds/buildEssay";
import { compareBuilds } from "@/lib/builds/compareBuilds";
import type { BuildEssay } from "@/lib/builds/buildEssay";
import type { BuildComparisonReport } from "@/lib/builds/compareBuilds";
import type { BuildOptimizerInput, BuildOptimizerResult, GeneratedBuild } from "@/lib/builds/types";
import { getOptimizerCatalog } from "@/lib/data/catalog";
import { prisma } from "@/lib/db/prisma";
import { attachEvidenceToBuildAnalysis } from "@/lib/evidence/evidenceMap";
import { summarizeEvidence } from "@/lib/evidence/formatEvidence";
import type { EvidenceCitation } from "@/lib/evidence/types";

export type BuildVariantKey = "bestOverall" | "cheapestSafe" | "bestPerformancePerDollar";
type BuildRequestInput = Omit<BuildOptimizerInput, "products" | "offersByProductId" | "historiesByProductId">;

export type EnhancedGeneratedBuild = GeneratedBuild & {
  essay: BuildEssay;
  evidence: EvidenceCitation[];
  sourceConfidenceSummary: ReturnType<typeof summarizeEvidence>;
};

export type EnhancedBuildResult = Omit<BuildOptimizerResult, BuildVariantKey> & {
  bestOverall: EnhancedGeneratedBuild | null;
  cheapestSafe: EnhancedGeneratedBuild | null;
  bestPerformancePerDollar: EnhancedGeneratedBuild | null;
  comparison: BuildComparisonReport | null;
};

export async function generateSourceBackedBuilds(
  input: BuildRequestInput,
): Promise<EnhancedBuildResult> {
  const catalog = await getOptimizerCatalog();
  const result = generateBuilds({
    ...input,
    ...catalog,
  });

  const bestOverall = await persistBuildVariant(
    await enhanceBuild(applySpecificReason(result.bestOverall, "bestOverall", input)),
    "bestOverall",
    input,
    result.candidatesEvaluated,
  );
  const cheapestSafe = await persistBuildVariant(
    await enhanceBuild(applySpecificReason(result.cheapestSafe, "cheapestSafe", input)),
    "cheapestSafe",
    input,
    result.candidatesEvaluated,
  );
  const bestPerformancePerDollar = await persistBuildVariant(
    await enhanceBuild(applySpecificReason(result.bestPerformancePerDollar, "bestPerformancePerDollar", input)),
    "bestPerformancePerDollar",
    input,
    result.candidatesEvaluated,
  );
  const comparison =
    bestOverall && cheapestSafe && bestPerformancePerDollar
      ? compareBuilds({ bestOverall, cheapestSafe, bestPerformancePerDollar })
      : null;

  return {
    bestOverall,
    cheapestSafe,
    bestPerformancePerDollar,
    candidatesEvaluated: result.candidatesEvaluated,
    comparison,
  };
}

export async function enhanceBuild(build: GeneratedBuild | null): Promise<EnhancedGeneratedBuild | null> {
  if (!build) return null;

  const sourceBacked = await attachEvidenceToBuildAnalysis(build);
  const enhancedBuild = {
    ...build,
    compatibilityReport: sourceBacked.compatibilityReport,
    productPriceTrends: sourceBacked.priceReport.priceTrends,
    evidence: sourceBacked.evidence,
  };
  const essay = generateBuildEssay(enhancedBuild, sourceBacked.evidence);
  const evidence = essay.citations;

  return {
    ...enhancedBuild,
    essay,
    evidence,
    sourceConfidenceSummary: summarizeEvidence(evidence),
  };
}

export function selectBuildVariant(result: EnhancedBuildResult, variant: BuildVariantKey) {
  return result[variant];
}

async function persistBuildVariant(
  build: EnhancedGeneratedBuild | null,
  variant: BuildVariantKey,
  input: BuildRequestInput,
  candidatesEvaluated: number,
): Promise<EnhancedGeneratedBuild | null> {
  if (!build) return null;

  const savedId = savedBuildId(build, variant, input);
  const buildType = buildTypeForVariant(variant);
  const name = `${buildLabel(variant)}: ${build.parts.cpu.model} + ${build.parts.gpu.model}`;
  const priceSummary = {
    productPriceTrends: build.productPriceTrends,
    sourceConfidenceSummary: build.sourceConfidenceSummary,
    cheaperCompatibleSwaps: build.cheaperCompatibleSwaps,
    whySelected: build.whySelected,
    overallScore: build.overallScore,
  };

  await prisma.savedBuild.upsert({
    where: { id: savedId },
    create: {
      id: savedId,
      name,
      buildType,
      targetBudget: input.budget,
      useCase: input.useCase,
      resolution: input.resolution,
      gpuPreference: input.gpuPreference,
      riskTolerance: input.riskTolerance,
      ramGb: input.ramGb,
      storageGb: input.storageGb,
      wifiRequired: input.wifiRequired,
      partsJson: stringifyForStorage(build.parts),
      offersJson: stringifyForStorage(build.offers),
      priceSummaryJson: stringifyForStorage(priceSummary),
      compatibilityReportJson: stringifyForStorage(build.compatibilityReport),
      evidenceJson: stringifyForStorage(build.evidence),
      essayJson: stringifyForStorage(build.essay),
      totalPrice: build.totalPrice,
      performanceScore: build.performanceScore,
      compatibilityStatus: build.compatibilityReport.overallStatus,
      priceVerdict: build.priceVerdict,
      dealScore: build.dealScore,
      candidateCount: candidatesEvaluated,
    },
    update: {
      name,
      buildType,
      targetBudget: input.budget,
      useCase: input.useCase,
      resolution: input.resolution,
      gpuPreference: input.gpuPreference,
      riskTolerance: input.riskTolerance,
      ramGb: input.ramGb,
      storageGb: input.storageGb,
      wifiRequired: input.wifiRequired,
      partsJson: stringifyForStorage(build.parts),
      offersJson: stringifyForStorage(build.offers),
      priceSummaryJson: stringifyForStorage(priceSummary),
      compatibilityReportJson: stringifyForStorage(build.compatibilityReport),
      evidenceJson: stringifyForStorage(build.evidence),
      essayJson: stringifyForStorage(build.essay),
      totalPrice: build.totalPrice,
      performanceScore: build.performanceScore,
      compatibilityStatus: build.compatibilityReport.overallStatus,
      priceVerdict: build.priceVerdict,
      dealScore: build.dealScore,
      candidateCount: candidatesEvaluated,
    },
  });

  return {
    ...build,
    id: savedId,
  };
}

function applySpecificReason(
  build: GeneratedBuild | null,
  variant: BuildVariantKey,
  input: BuildRequestInput,
): GeneratedBuild | null {
  if (!build) return null;
  const gpu = build.parts.gpu;
  const cpu = build.parts.cpu;
  const priceConcern = [...build.productPriceTrends].sort(
    (left, right) => right.estimatedSavingsIfWaiting - left.estimatedSavingsIfWaiting,
  )[0];
  const budgetRemaining = Math.max(0, input.budget - build.totalPrice);

  if (variant === "bestOverall") {
    return {
      ...build,
      whySelected: `This build spends most of the ${currency(input.budget)} target on the ${gpu.model} while keeping the ${cpu.model}, platform, memory, PSU, and case strong enough to avoid compatibility blockers. It is the highest-scoring compatible build found under budget with ${currency(budgetRemaining)} remaining, and the ${build.priceVerdict.replace("_", " ")} verdict is driven mainly by ${
        priceConcern?.productName ?? "the seeded price history"
      }.`,
    };
  }

  if (variant === "cheapestSafe") {
    return {
      ...build,
      whySelected: `This is the cheapest build found that still satisfies the requested ${input.ramGb}GB RAM, ${input.storageGb}GB storage, Wi-Fi, risk, budget, and deterministic compatibility constraints. Its tradeoff is performance headroom: it saves money with the ${cpu.model} and ${gpu.model}, so it fits budget-focused ${input.resolution} buyers better than maximum-FPS shoppers.`,
    };
  }

  return {
    ...build,
    whySelected: `This build has the strongest performance per dollar in the compatible candidate pool because it pairs the ${cpu.model} with the ${gpu.model} at an effective total of ${currency(build.totalPrice)}. It is efficient, but the ${build.priceVerdict.replace("_", " ")} verdict still means the selected offers should be weighed against the seeded 180-day price history before buying.`,
  };
}

function savedBuildId(build: GeneratedBuild, variant: BuildVariantKey, input: BuildRequestInput) {
  const categoryIds = Object.entries(build.parts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, part]) => `${category}:${part.id}`)
    .join("|");
  const constraints = JSON.stringify({
    budget: input.budget,
    useCase: input.useCase,
    resolution: input.resolution,
    gpuPreference: input.gpuPreference,
    ramGb: input.ramGb,
    storageGb: input.storageGb,
    wifiRequired: input.wifiRequired,
    riskTolerance: input.riskTolerance,
  });

  return `build-${buildTypeForVariant(variant)}-${hashString(`${constraints}|${categoryIds}`)}`;
}

function buildTypeForVariant(variant: BuildVariantKey) {
  if (variant === "bestOverall") return "best_overall";
  if (variant === "cheapestSafe") return "cheapest_safe";
  return "best_performance_per_dollar";
}

function buildLabel(variant: BuildVariantKey) {
  if (variant === "bestOverall") return "Best Overall";
  if (variant === "cheapestSafe") return "Cheapest Safe";
  return "Best Performance/$";
}

function stringifyForStorage(value: unknown) {
  return JSON.stringify(value);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
