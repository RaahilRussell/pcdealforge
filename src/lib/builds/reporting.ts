import { generateBuilds } from "@/lib/builds/generateBuilds";
import { generateBuildEssay } from "@/lib/builds/buildEssay";
import { compareBuilds } from "@/lib/builds/compareBuilds";
import type { BuildEssay } from "@/lib/builds/buildEssay";
import type { BuildComparisonReport } from "@/lib/builds/compareBuilds";
import type { BuildOptimizerInput, BuildOptimizerResult, GeneratedBuild } from "@/lib/builds/types";
import { getOptimizerCatalog } from "@/lib/data/catalog";
import { attachEvidenceToBuildAnalysis } from "@/lib/evidence/evidenceMap";
import { summarizeEvidence } from "@/lib/evidence/formatEvidence";
import type { EvidenceCitation } from "@/lib/evidence/types";

export type BuildVariantKey = "bestOverall" | "cheapestSafe" | "bestPerformancePerDollar";

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
  input: Omit<BuildOptimizerInput, "products" | "offersByProductId" | "historiesByProductId">,
): Promise<EnhancedBuildResult> {
  const catalog = await getOptimizerCatalog();
  const result = generateBuilds({
    ...input,
    ...catalog,
  });

  const bestOverall = await enhanceBuild(result.bestOverall);
  const cheapestSafe = await enhanceBuild(result.cheapestSafe);
  const bestPerformancePerDollar = await enhanceBuild(result.bestPerformancePerDollar);
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
