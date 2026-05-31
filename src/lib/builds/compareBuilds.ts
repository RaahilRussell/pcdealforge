import type { EvidenceCitation } from "@/lib/evidence/types";
import { citationMarker } from "@/lib/evidence/formatEvidence";

import type { GeneratedBuild } from "./types";
import { collectBuildCitations } from "./buildEssay";

export type BuildComparisonReport = {
  quickRecommendation: string;
  bestOverallVsCheapestSafe: string;
  bestOverallVsBestPerformancePerDollar: string;
  cheapestSafeVsBestPerformancePerDollar: string;
  whichOneIWouldBuyAndWhy: string;
  whatIWouldWaitOn: string;
  biggestRiskInEachBuild: string;
  bestUpgradePath: string;
  citations: EvidenceCitation[];
};

export function compareBuilds(input: {
  bestOverall: GeneratedBuild;
  cheapestSafe: GeneratedBuild;
  bestPerformancePerDollar: GeneratedBuild;
  citations?: EvidenceCitation[];
}): BuildComparisonReport {
  const citations = dedupeCitations([
    ...(input.citations ?? []),
    ...collectBuildCitations(input.bestOverall),
    ...collectBuildCitations(input.cheapestSafe),
    ...collectBuildCitations(input.bestPerformancePerDollar),
  ]);
  const marker = citations.slice(0, 10).map(citationMarker).join("");
  const overall = input.bestOverall;
  const cheap = input.cheapestSafe;
  const value = input.bestPerformancePerDollar;

  const quickRecommendation = `Quick recommendation: choose Best Overall if you want the strongest balance of compatibility confidence, performance, and deal quality. Choose Cheapest Safe if total cost matters most. Choose Best Performance/$ if you are optimizing value efficiency and can accept its specific part tradeoffs. This comparison uses seeded demo data and internal deterministic calculations, not live market claims. ${marker}`;

  const bestOverallVsCheapestSafe = `Best Overall costs ${currencyDelta(
    overall.totalPrice - cheap.totalPrice,
  )} versus Cheapest Safe and scores ${scoreDelta(overall.performanceScore - cheap.performanceScore)} performance points. The extra money mainly buys the selected GPU/CPU balance, deal score, and any additional headroom surfaced by the compatibility rules. Cheapest Safe is better when the budget ceiling is the main constraint; Best Overall is better when the buyer wants the stronger all-around recommendation. ${marker}`;

  const bestOverallVsBestPerformancePerDollar = `Best Overall and Best Performance/$ differ by ${currencyDelta(
    overall.totalPrice - value.totalPrice,
  )}. Best Performance/$ has the better performance-per-dollar ratio at ${ratio(
    value,
  )}, while Best Overall ranks higher when compatibility confidence, budget efficiency, and deal score are combined. ${marker}`;

  const cheapestSafeVsBestPerformancePerDollar = `Cheapest Safe is ${currencyDelta(
    cheap.totalPrice - value.totalPrice,
  )} compared with Best Performance/$ and scores ${scoreDelta(
    cheap.performanceScore - value.performanceScore,
  )} performance points. If both are close in total cost, the performance-per-dollar build is usually the better gaming choice; if the price gap is material, Cheapest Safe is the disciplined budget pick. ${marker}`;

  const whichOneIWouldBuyAndWhy = `Which one I would buy and why: I would buy the Best Overall build when its verdict is BUY NOW, because it has the highest blended score and no compatibility failures. If Best Overall is WAIT, I would use Cheapest Safe as the fallback only when the cheaper build has fewer price-timing concerns and still satisfies the user's performance target. ${marker}`;

  const whatIWouldWaitOn = `What I would wait on: the most important wait signal is any selected part with a WAIT or AVOID verdict, especially GPU or CPU price trends because those dominate total build value. Across these three builds, the largest seeded savings estimate is ${currency(
    Math.max(potentialSavings(overall), potentialSavings(cheap), potentialSavings(value)),
  )}. ${marker}`;

  const biggestRiskInEachBuild = `Biggest risk in each build: Best Overall risk is ${riskSummary(
    overall,
  )}; Cheapest Safe risk is ${riskSummary(cheap)}; Best Performance/$ risk is ${riskSummary(
    value,
  )}. These risks are generated from compatibility warnings, price verdicts, and offer-confidence rules. ${marker}`;

  const bestUpgradePath = `Best upgrade path: prefer the build with the strongest PSU headroom, case clearance, RAM capacity, and motherboard feature set. In the seeded recommendations, that is usually the build with the fewest compatibility warnings and the least aggressive cost cutting on PSU, case, and motherboard. ${marker}`;

  return {
    quickRecommendation,
    bestOverallVsCheapestSafe,
    bestOverallVsBestPerformancePerDollar,
    cheapestSafeVsBestPerformancePerDollar,
    whichOneIWouldBuyAndWhy,
    whatIWouldWaitOn,
    biggestRiskInEachBuild,
    bestUpgradePath,
    citations,
  };
}

function riskSummary(build: GeneratedBuild) {
  if (build.compatibilityReport.failCount > 0) return "compatibility failure, so it should not be recommended";
  if (build.priceVerdict === "AVOID") return "an avoid price verdict or major listing risk";
  if (build.compatibilityReport.warningCount > 0) return `${build.compatibilityReport.warningCount} compatibility warning(s)`;
  if (build.priceVerdict === "WAIT") return "price timing, because the seeded trend model says waiting may save money";
  return "low inside the seeded MVP because no failures are present";
}

function potentialSavings(build: GeneratedBuild) {
  return build.productPriceTrends.reduce((sum, trend) => sum + trend.estimatedSavingsIfWaiting, 0);
}

function ratio(build: GeneratedBuild) {
  return `${(build.performanceScore / build.totalPrice).toFixed(3)} points per dollar`;
}

function currencyDelta(delta: number) {
  if (delta === 0) return "$0 more";
  return delta > 0 ? `${currency(delta)} more` : `${currency(Math.abs(delta))} less`;
}

function scoreDelta(delta: number) {
  if (delta === 0) return "equal";
  return delta > 0 ? `${delta.toFixed(1)} higher` : `${Math.abs(delta).toFixed(1)} lower`;
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function dedupeCitations(citations: EvidenceCitation[]) {
  const seen = new Set<string>();
  return citations
    .filter((citation) => {
      const key = `${citation.sourceType}:${citation.title}:${citation.claim}:${citation.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((citation, index) => ({ ...citation, citationNumber: index + 1 }));
}
