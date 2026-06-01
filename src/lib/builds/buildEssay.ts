import type { EvidenceCitation } from "@/lib/evidence/types";
import { citationMarker } from "@/lib/evidence/formatEvidence";

import { explainPartChoices } from "./partExplanations";
import type { GeneratedBuild } from "./types";

export type BuildEssay = {
  executiveSummary: string;
  whyThisBuildExists: string;
  performanceExpectations: string;
  positives: string;
  negatives: string;
  compatibilityReasoning: string;
  dealReasoning: string;
  partByPartJustification: string;
  bestUpgradePath: string;
  whoShouldBuy: string;
  whoShouldAvoid: string;
  suggestedSwaps: string;
  finalVerdict: string;
  finalRecommendation: string;
  citations: EvidenceCitation[];
};

export function generateBuildEssay(build: GeneratedBuild, suppliedCitations: EvidenceCitation[] = []): BuildEssay {
  const citations = collectBuildCitations(build, suppliedCitations);
  const marker = citationMarkers(citations);
  const cpu = build.parts.cpu;
  const gpu = build.parts.gpu;
  const ram = build.parts.ram;
  const storage = build.parts.storage;
  const psu = build.parts.psu;
  const pcCase = build.parts.case;
  const cooler = build.parts.cooler;
  const warningCount = build.compatibilityReport.warningCount;
  const partExplanations = explainPartChoices(build);
  const strongestDeal = [...build.productPriceTrends].sort((left, right) => left.currentPrice - right.currentPrice)[0];
  const weakestPrice = [...build.productPriceTrends].sort(
    (left, right) => right.estimatedSavingsIfWaiting - left.estimatedSavingsIfWaiting,
  )[0];
  const savings = build.productPriceTrends.reduce((sum, trend) => sum + trend.estimatedSavingsIfWaiting, 0);

  const executiveSummary = `This recommendation is optimized as a ${build.performanceScore.toFixed(
    0,
  )}-point seeded demo build centered on the ${gpu.brand} ${gpu.model} and ${cpu.brand} ${
    cpu.model
  }. The total effective price is ${currency(build.totalPrice)}, the compatibility result is ${
    build.compatibilityReport.overallStatus
  }, and the build-level price verdict is ${formatVerdict(
    build.priceVerdict,
  )}. These statements are based on seeded demo product evidence, seeded demo offer/history data, and internal PCDealForge calculations rather than live retailer or manufacturer feeds. ${marker}`;

  const whyThisBuildExists = `Why this build exists: the optimizer searched seeded CPU, GPU, motherboard, memory, storage, PSU, case, and cooler combinations under ${currency(
    build.totalPrice,
  )} effective total and rejected candidates with compatibility failures. This specific build survived because the selected parts satisfy the required memory capacity, storage capacity, Wi-Fi preference, risk tolerance, and budget constraints while producing a stronger overall score than nearby alternatives. The reason is not a black-box opinion: the score combines performance, deal score, compatibility confidence, and budget efficiency, then subtracts compatibility warning penalties. ${marker}`;

  const performanceExpectations = `Performance expectations: the ${gpu.brand} ${gpu.model} carries most of the gaming performance weight, while the ${cpu.brand} ${cpu.model} is selected to keep the platform from becoming an obvious CPU bottleneck in the seeded scoring model. The build includes ${specNumber(
    ram,
    "capacityGb",
  )}GB of RAM and ${specNumber(storage, "capacityGb")}GB of storage, so it is aimed at mainstream gaming and general productivity rather than heavy local AI workloads or uncompromised 4K ultra settings. The ${build.performanceScore.toFixed(
    0,
  )} performance score is seeded demo benchmark architecture, not a live benchmark feed. ${marker}`;

  const positives = `Major positives: the CPU and GPU pairing is balanced for the selected performance target, the ${ram.model} memory kit and ${storage.model} storage meet the requested capacity constraints, and the ${pcCase.model} plus ${cooler.model} combination gives the compatibility engine enough case and cooling data to verify fit. The ${psu.model} is evaluated for wattage headroom and GPU power connector support, while the deal score of ${build.dealScore.toFixed(
    0,
  )} indicates that several selected parts are priced reasonably inside the seeded 180-day history. ${marker}`;

  const negatives = `Major negatives: this is still seeded demo data, so it should be treated as a local MVP proof rather than a verified live-market quote. ${
    warningCount > 0
      ? `The build has ${warningCount} compatibility warning(s), so the buyer should read the cited rule details before purchasing.`
      : "The compatibility engine did not find warnings, but it still cannot replace checking final retailer listings, board revision notes, and physical installation details."
  } ${
    weakestPrice?.estimatedSavingsIfWaiting > 0
      ? `${weakestPrice.productName} is the clearest price-timing concern and may save about ${currency(
          weakestPrice.estimatedSavingsIfWaiting,
        )} if the seeded sale band repeats.`
      : "No single selected part is flagged as a large wait-for-sale item by the seeded trend model."
  } ${marker}`;

  const compatibilityReasoning = `Compatibility reasoning: PCDealForge verifies the CPU socket against the motherboard socket, RAM type and capacity against motherboard support, motherboard form factor against the case, GPU length against case clearance, cooler socket and height or radiator support against the CPU/case, M.2 storage support, front USB-C and Wi-Fi constraints, PSU wattage headroom, and the GPU power connector requirement. For this build, those deterministic checks produce ${build.compatibilityReport.passCount} pass result(s), ${build.compatibilityReport.warningCount} warning(s), and ${build.compatibilityReport.failCount} failure(s). ${marker}`;

  const dealReasoning = `Deal and price reasoning: the selected parts total ${currency(
    build.totalPrice,
  )} after effective price adjustments for shipping, tax estimate, seller risk, and condition risk. The best-valued visible part in the seeded report is ${
    strongestDeal?.productName ?? "the lowest effective-price component"
  }, while the largest estimated waiting opportunity is ${
    weakestPrice?.productName ?? "not material"
  }. The seeded trend model estimates about ${currency(
    savings,
  )} of possible savings from waiting across the full part list, which maps to the build verdict of ${formatVerdict(
    build.priceVerdict,
  )}. ${marker}`;

  const partByPartJustification = `Part-by-part justification: ${Object.values(partExplanations)
    .map((part) => part.shortReason)
    .join(" ")} The selected offer for each part is included in the effective total, so the recommendation is based on the actual seeded offer rows instead of MSRP-only catalog data. ${marker}`;

  const bestUpgradePath = `Best upgrade path: the cleanest first upgrade is usually the GPU if the buyer wants higher frame rates, followed by storage if the chosen drive is under 2TB. The PSU and case are important because they determine how painless those upgrades are; this build's PSU headroom and case clearance are explicitly checked before recommendation. A buyer who wants a longer platform life should inspect the motherboard chipset, M.2 slot count, and Wi-Fi/front USB-C support before trading down to a cheaper board. ${marker}`;

  const whoShouldBuy = `Who should buy this: it is best for a buyer who wants a transparent, compatibility-checked desktop recommendation from seeded demo data and values a strong GPU-first build without manually comparing every offer. It is most appropriate for a mainstream gamer, student, or general enthusiast who wants a clear parts list, visible price risks, and a citation-backed explanation before doing final live retailer checks. ${marker}`;

  const whoShouldAvoid = `Who should avoid this: skip this exact recommendation if you require verified live retailer inventory, real manufacturer source pages, a silence-focused small-form-factor build, heavy AI/ML VRAM capacity, or uncompromised 4K ultra gaming. Buyers who refuse any open-box risk should also keep risk tolerance at new-only and re-run the optimizer. ${marker}`;

  const suggestedSwaps =
    build.cheaperCompatibleSwaps.length > 0
      ? `Suggested swaps: ${build.cheaperCompatibleSwaps
          .map((swap) => `${swap.explanation} It saves ${currency(swap.savings)}.`)
          .join(" ")} Avoid swaps that introduce compatibility failures, remove required Wi-Fi/front I/O, or replace a safe offer with a low-confidence used listing. ${marker}`
      : `Suggested swaps: the optimizer did not find a cheaper compatible swap inside the searched seeded candidate pool. A better performance swap would usually mean spending more on the GPU first, while a safer retailer swap means preferring higher-confidence new listings over low-confidence used listings. ${marker}`;

  const finalVerdict = `${finalVerdictLabel(build.priceVerdict)} The conclusion follows the build-level price verdict, compatibility report, seeded offer data, and deterministic scoring formulas. ${marker}`;
  const finalRecommendation = `${finalVerdictLabel(
    build.priceVerdict,
  )} If this were a real purchase, the next step would be to open each selected offer, verify the live retailer price and exact model, and confirm that seeded demo sources have been replaced with manufacturer, retailer, benchmark, or validated API data. Within the MVP data, this is a traceable recommendation rather than a live-market guarantee. ${marker}`;

  return {
    executiveSummary,
    whyThisBuildExists,
    performanceExpectations,
    positives,
    negatives,
    compatibilityReasoning,
    dealReasoning,
    partByPartJustification,
    bestUpgradePath,
    whoShouldBuy,
    whoShouldAvoid,
    suggestedSwaps,
    finalVerdict,
    finalRecommendation,
    citations,
  };
}

export function collectBuildCitations(build: GeneratedBuild, suppliedCitations: EvidenceCitation[] = []) {
  return dedupeCitations([
    ...suppliedCitations,
    ...build.compatibilityReport.results.flatMap((result) => result.evidence ?? []),
    ...build.productPriceTrends.flatMap((trend) => trend.evidence ?? []),
  ]);
}

function citationMarkers(citations: EvidenceCitation[]) {
  if (citations.length === 0) return "";
  return citations.slice(0, 8).map(citationMarker).join("");
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

function finalVerdictLabel(verdict: GeneratedBuild["priceVerdict"]) {
  if (verdict === "BUY_NOW") return "Buy now.";
  if (verdict === "WAIT") return "Wait for price drop.";
  return "Only buy if you need it immediately.";
}

function formatVerdict(verdict: string) {
  return verdict.replace("_", " ");
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function specNumber(part: { specs: Record<string, unknown> }, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : 0;
}
