import type { NormalizedOffer, RiskTolerance } from "@/lib/deals/types";

import {
  computeBuildPriceHistory,
  formatHistoryDate,
  type BuildHistoryProduct,
  type BuildPriceHistory,
} from "./buildPriceHistory";
import type { DailyPricePoint } from "./priceTrends";
import type { PriceVerdictValue, VerdictReason } from "./verdictReasons";

export type { PriceVerdictValue, VerdictReason } from "./verdictReasons";

export type SelectedOfferForVerdict = {
  productId: string;
  productName: string;
  required: boolean;
  offer: NormalizedOffer | null;
};

export type ProductTrendForVerdict = {
  productId: string;
  productName: string;
  currentPrice: number;
  thirtyDayLow: number;
  thirtyDayAverage: number;
  ninetyDayAverage: number;
  history?: DailyPricePoint[];
};

export type ReleaseRiskSignal = {
  level: "none" | "low" | "medium" | "high";
  confidence: number;
  productName?: string;
  note?: string;
};

export type SaferAlternativeSignal = {
  name: string;
  /** How close (percent) the safer/better build is to the current build's price. */
  withinPercent: number;
  betterPerformance: boolean;
  lowerRisk: boolean;
};

export type ComputeBuildVerdictInput = {
  compatibilityStatus: "PASS" | "WARNING" | "FAIL";
  compatibilityFailReason?: string;
  riskTolerance?: RiskTolerance;
  currentBuildTotal: number;
  selectedOffers: SelectedOfferForVerdict[];
  productTrends: ProductTrendForVerdict[];
  releaseRisk?: ReleaseRiskSignal;
  saferAlternative?: SaferAlternativeSignal;
  /** Allow incomplete history days to count toward lows/averages (e.g. demo fallback). */
  allowIncompleteHistory?: boolean;
  /**
   * Drop the per-day history arrays from the returned verdict. The daily totals are only needed to
   * render the report chart, so candidate-search verdicts skip them to avoid retaining hundreds of
   * day objects per candidate build.
   */
  omitHistoryDays?: boolean;
};

export type PartCause = {
  productId: string;
  name: string;
  currentPrice: number;
  recentLow: number;
  deltaDollars: number;
};

export type BestDealPart = {
  productId: string;
  name: string;
  currentPrice: number;
  averagePrice: number;
  deltaDollars: number;
};

export type BuildPriceVerdict = {
  verdict: PriceVerdictValue;
  primaryReason: VerdictReason;
  reasons: VerdictReason[];

  currentBuildTotal: number;
  build30DayLow: number;
  build30DayAverage: number;
  build90DayLow: number;
  build90DayAverage: number;
  dollarsAbove30DayLow: number;
  dollarsAbove30DayAverage: number;
  percentAbove30DayLow: number;
  percentAbove30DayAverage: number;
  cheapestDayInLast30Days?: string;

  partCausingBiggestOverpay?: PartCause;
  bestDealPart?: BestDealPart;

  /** True when the verdict is backed by enough complete full-build history to be confident. */
  hasEnoughHistory: boolean;
  /** "price" | "compatibility" | "seller-risk" | "release" — what primarily drove the verdict. */
  driver: VerdictDriver;
  summary: string;
  specificJustification: string;
  history: BuildPriceHistory;
};

export type VerdictDriver = "price" | "compatibility" | "seller-risk" | "release";

const CONFIDENCE_FLOOR = 0.65;

export function computeBuildPriceVerdict(input: ComputeBuildVerdictInput): BuildPriceVerdict {
  const fullHistory = computeBuildPriceHistory(
    historyProducts(input.productTrends),
    input.currentBuildTotal,
    { allowIncompleteDays: input.allowIncompleteHistory },
  );
  const history: BuildPriceHistory = input.omitHistoryDays
    ? { ...fullHistory, days: [], completeDays: [] }
    : fullHistory;

  const reasons: VerdictReason[] = [];
  const parts = partCauses(input.productTrends);
  const partCausingBiggestOverpay = parts.biggestOverpay;
  const bestDealPart = parts.bestDeal;

  // ---- Step 1: hard safety / compatibility checks. These always win. ----
  const safety = hardSafetyReason(input);
  if (safety) {
    reasons.push(safety);
    appendTrendContextReasons(reasons, history, partCausingBiggestOverpay, bestDealPart);
    return finalize("AVOID", safety, reasons, history, partCausingBiggestOverpay, bestDealPart, driverForReason(safety));
  }

  // ---- Step 2: full-build 30-day trend reason (the primary price story). ----
  const trendReason = buildTrendReason(history, partCausingBiggestOverpay);

  // ---- Step 4: part-level explanation (never overrides the full-build verdict). ----
  appendTrendContextReasons(reasons, history, partCausingBiggestOverpay, bestDealPart);

  // ---- Release / safer-alternative signals (can push to AVOID/WAIT). ----
  const seriousRelease = isSeriousReleaseRisk(input.releaseRisk);
  const releaseReason = releaseRiskReason(input.releaseRisk, history);
  if (releaseReason) reasons.push(releaseReason);

  const saferReason = saferAlternativeReason(input.saferAlternative);

  // ---- Step 2/Phase 2: thresholds. ----
  const pctLow = history.percentAbove30DayLow;
  const pctAvg = history.percentAbove30DayAverage;
  const dollarsLow = history.dollarsAbove30DayLow;
  const current = history.currentBuildTotal;

  const swapSavings = parts.biggestOverpay?.deltaDollars ?? 0;

  // AVOID (price/release/alternative driven — hard-safety already returned above).
  const severelyOverpricedPct = pctLow > 18 && pctAvg > 12;
  const severelyOverpricedDollars = dollarsLow > 200 && current < 1500;
  const releasePlusPoorPrice = seriousRelease && (current > history.build30DayAverage || pctLow > 10);
  const betterSaferExists =
    !!input.saferAlternative &&
    input.saferAlternative.withinPercent <= 5 &&
    (input.saferAlternative.betterPerformance || input.saferAlternative.lowerRisk);

  if (severelyOverpricedPct || severelyOverpricedDollars) {
    const reason = overpricedAvoidReason(history, partCausingBiggestOverpay);
    reasons.unshift(reason);
    return finalize("AVOID", reason, reasons, history, partCausingBiggestOverpay, bestDealPart, "price");
  }
  if (releasePlusPoorPrice && releaseReason) {
    return finalize("AVOID", releaseReason, reasons, history, partCausingBiggestOverpay, bestDealPart, "release");
  }
  if (betterSaferExists && saferReason) {
    reasons.unshift(saferReason);
    return finalize("AVOID", saferReason, reasons, history, partCausingBiggestOverpay, bestDealPart, "seller-risk");
  }

  // BUY_NOW.
  const within5of30Low = current <= history.build30DayLow * 1.05;
  const within8of90Low = current <= history.build90DayLow * 1.08;
  const atOrBelow30Avg = current <= history.build30DayAverage;
  const atOrBelow90Avg = current <= history.build90DayAverage;
  const buyNow = (atOrBelow30Avg || atOrBelow90Avg || within5of30Low || within8of90Low) && !seriousRelease;

  if (buyNow) {
    const reason = buyNowReason(history, bestDealPart);
    reasons.unshift(reason);
    return finalize("BUY_NOW", reason, reasons, history, partCausingBiggestOverpay, bestDealPart, "price");
  }

  // WAIT (most "bad timing" lands here).
  const mildlyOverLow = pctLow >= 5 && pctLow <= 15;
  const fiftyAboveLow = dollarsLow >= 50;
  const seventyFiveAbove90Low = history.dollarsAbove90DayLow >= 75;
  const aboveAvgNotSevere = current > history.build30DayAverage;
  const meaningfulSwap = swapSavings >= 40;
  const mediumRelease = input.releaseRisk?.level === "medium";

  if (
    mildlyOverLow ||
    fiftyAboveLow ||
    seventyFiveAbove90Low ||
    aboveAvgNotSevere ||
    meaningfulSwap ||
    mediumRelease
  ) {
    const reason = trendReason ?? waitReason(history, partCausingBiggestOverpay);
    reasons.unshift(reason);
    return finalize("WAIT", reason, reasons, history, partCausingBiggestOverpay, bestDealPart, "price");
  }

  // Fallback: nothing flagged a problem and price is acceptable -> BUY_NOW.
  const fallback = buyNowReason(history, bestDealPart);
  reasons.unshift(fallback);
  return finalize("BUY_NOW", fallback, reasons, history, partCausingBiggestOverpay, bestDealPart, "price");
}

function finalize(
  verdict: PriceVerdictValue,
  primaryReason: VerdictReason,
  rawReasons: VerdictReason[],
  history: BuildPriceHistory,
  partCausingBiggestOverpay: PartCause | undefined,
  bestDealPart: BestDealPart | undefined,
  driver: VerdictDriver,
): BuildPriceVerdict {
  const reasons = dedupe([primaryReason, ...rawReasons]);
  const summary = `${verdictLabel(verdict)} — ${primaryReason.title}.`;
  return {
    verdict,
    primaryReason,
    reasons,
    currentBuildTotal: history.currentBuildTotal,
    build30DayLow: history.build30DayLow,
    build30DayAverage: history.build30DayAverage,
    build90DayLow: history.build90DayLow,
    build90DayAverage: history.build90DayAverage,
    dollarsAbove30DayLow: history.dollarsAbove30DayLow,
    dollarsAbove30DayAverage: history.dollarsAbove30DayAverage,
    percentAbove30DayLow: history.percentAbove30DayLow,
    percentAbove30DayAverage: history.percentAbove30DayAverage,
    cheapestDayInLast30Days: history.cheapestDayInLast30Days,
    partCausingBiggestOverpay,
    bestDealPart,
    hasEnoughHistory: history.hasEnoughHistory,
    driver,
    summary,
    specificJustification: primaryReason.explanation,
    history,
  };
}

function hardSafetyReason(input: ComputeBuildVerdictInput): VerdictReason | null {
  if (input.compatibilityStatus === "FAIL") {
    return {
      severity: "danger",
      scope: "compatibility",
      code: "compatibility_fail",
      title: "Build has a compatibility failure",
      explanation:
        input.compatibilityFailReason ??
        "This build should be avoided because at least one deterministic compatibility rule failed.",
    };
  }

  const risk = input.riskTolerance ?? "used_allowed";
  for (const selected of input.selectedOffers) {
    if (!selected.required) continue;
    const name = selected.productName;
    if (!selected.offer) {
      return {
        severity: "danger",
        scope: "offer",
        code: "missing_required_offer",
        title: `No valid offer for ${name}`,
        explanation: `This build should be avoided because the required ${name} has no valid selected offer.`,
        affectedPartId: selected.productId,
        affectedPartName: name,
      };
    }
    if (!selected.offer.inStock) {
      return {
        severity: "danger",
        scope: "offer",
        code: "offer_out_of_stock",
        title: `${name} offer is out of stock`,
        explanation: `This build should be avoided because the selected ${name} offer is out of stock.`,
        affectedPartId: selected.productId,
        affectedPartName: name,
      };
    }
    const violation = riskToleranceViolation(selected.offer, risk);
    if (violation) {
      return {
        severity: "danger",
        scope: "offer",
        code: "risk_tolerance_violation",
        title: `${name} offer violates risk tolerance`,
        explanation: `This build should be avoided because the selected ${selected.offer.condition.replaceAll(
          "_",
          " ",
        )} ${name} offer violates the ${risk.replaceAll("_", " ")} risk setting.`,
        affectedPartId: selected.productId,
        affectedPartName: name,
      };
    }
    if (selected.offer.confidenceScore < CONFIDENCE_FLOOR) {
      return {
        severity: "danger",
        scope: "offer",
        code: "offer_low_confidence",
        title: `${name} offer is low-confidence`,
        explanation: `This build should be avoided because the selected ${name} offer confidence is ${Math.round(
          selected.offer.confidenceScore * 100,
        )}%, below the ${Math.round(CONFIDENCE_FLOOR * 100)}% safety floor.`,
        currentValue: selected.offer.confidenceScore,
        comparisonValue: CONFIDENCE_FLOOR,
        affectedPartId: selected.productId,
        affectedPartName: name,
      };
    }
  }

  return null;
}

function buildTrendReason(history: BuildPriceHistory, overpay: PartCause | undefined): VerdictReason | null {
  if (history.currentBuildTotal <= history.build30DayLow) return null;
  return waitReason(history, overpay);
}

function waitReason(history: BuildPriceHistory, overpay: PartCause | undefined): VerdictReason {
  const cheapestDay = formatHistoryDate(history.cheapestDayInLast30Days);
  const dayClause = cheapestDay
    ? ` but the same selected build reached ${currency(history.build30DayLow)} on ${cheapestDay} based on verified offer history`
    : ` but it reached ${currency(history.build30DayLow)} within the last 30 days`;
  return {
    severity: "warning",
    scope: "build",
    code: "build_above_30_day_low",
    title: `This full build is ${currency(history.dollarsAbove30DayLow)} above its 30-day low`,
    explanation: `This full build is ${currency(history.dollarsAbove30DayLow)} above its 30-day low. The current effective total is ${currency(
      history.currentBuildTotal,
    )},${dayClause}.`,
    currentValue: history.currentBuildTotal,
    comparisonValue: history.build30DayLow,
    deltaDollars: history.dollarsAbove30DayLow,
    deltaPercent: history.percentAbove30DayLow,
    affectedPartId: overpay?.productId,
    affectedPartName: overpay?.name,
    date: history.cheapestDayInLast30Days,
  };
}

function buyNowReason(history: BuildPriceHistory, bestDeal: BestDealPart | undefined): VerdictReason {
  if (history.currentBuildTotal <= history.build30DayAverage) {
    const below = round(history.build30DayAverage - history.currentBuildTotal);
    const pctOfLow = history.build30DayLow > 0
      ? Math.round(((history.currentBuildTotal - history.build30DayLow) / history.build30DayLow) * 100)
      : 0;
    return {
      severity: "positive",
      scope: "build",
      code: "build_below_30_day_average",
      title: `This full build is ${currency(below)} below its 30-day average`,
      explanation: `This full build is ${currency(below)} below its 30-day average of ${currency(
        history.build30DayAverage,
      )}${pctOfLow >= 0 ? ` and within ${pctOfLow}% of its 30-day low` : ""}.`,
      currentValue: history.currentBuildTotal,
      comparisonValue: history.build30DayAverage,
      deltaDollars: below,
      deltaPercent: Math.abs(history.percentAbove30DayAverage),
      affectedPartId: bestDeal?.productId,
      affectedPartName: bestDeal?.name,
    };
  }
  return {
    severity: "positive",
    scope: "build",
    code: "build_near_30_day_low",
    title: `This full build is within reach of its 30-day low`,
    explanation: `This full build is only ${currency(history.dollarsAbove30DayLow)} (${history.percentAbove30DayLow}%) above its 30-day low of ${currency(
      history.build30DayLow,
    )}, inside the buy-now band.`,
    currentValue: history.currentBuildTotal,
    comparisonValue: history.build30DayLow,
    deltaDollars: history.dollarsAbove30DayLow,
    deltaPercent: history.percentAbove30DayLow,
    affectedPartId: bestDeal?.productId,
    affectedPartName: bestDeal?.name,
  };
}

function overpricedAvoidReason(history: BuildPriceHistory, overpay: PartCause | undefined): VerdictReason {
  return {
    severity: "danger",
    scope: "build",
    code: "build_severely_overpriced",
    title: `This full build is severely overpriced`,
    explanation: `This full build is ${currency(history.dollarsAbove30DayLow)} (${history.percentAbove30DayLow}%) above its 30-day low and ${history.percentAbove30DayAverage}% above its 30-day average of ${currency(
      history.build30DayAverage,
    )}.${overpay ? ` The biggest driver is ${overpay.name}.` : ""}`,
    currentValue: history.currentBuildTotal,
    comparisonValue: history.build30DayLow,
    deltaDollars: history.dollarsAbove30DayLow,
    deltaPercent: history.percentAbove30DayLow,
    affectedPartId: overpay?.productId,
    affectedPartName: overpay?.name,
  };
}

function releaseRiskReason(release: ReleaseRiskSignal | undefined, history: BuildPriceHistory): VerdictReason | null {
  if (!release || release.level === "none" || release.level === "low") return null;
  const severity = release.level === "high" && release.confidence >= 0.7 ? "danger" : "warning";
  return {
    severity,
    scope: "release",
    code: "release_cycle_risk",
    title: `Release-cycle risk on ${release.productName ?? "a selected part"}`,
    explanation:
      release.note ??
      `${release.productName ?? "A selected part"} carries ${release.level} release-cycle risk (${Math.round(
        release.confidence * 100,
      )}% confidence), so paying ${currency(history.currentBuildTotal)} now may not age well.`,
    affectedPartName: release.productName,
  };
}

function saferAlternativeReason(alt: SaferAlternativeSignal | undefined): VerdictReason | null {
  if (!alt) return null;
  const benefit = alt.betterPerformance && alt.lowerRisk
    ? "more performance and lower risk"
    : alt.betterPerformance
    ? "meaningfully higher performance"
    : "lower listing risk";
  return {
    severity: "danger",
    scope: "build",
    code: "safer_alternative_within_5_percent",
    title: `A safer compatible build exists for nearly the same price`,
    explanation: `${alt.name} is within ${alt.withinPercent}% of this build's price but offers ${benefit}, so this build is hard to justify.`,
  };
}

function appendTrendContextReasons(
  reasons: VerdictReason[],
  history: BuildPriceHistory,
  overpay: PartCause | undefined,
  bestDeal: BestDealPart | undefined,
) {
  if (overpay && overpay.deltaDollars > 0) {
    reasons.push({
      severity: "neutral",
      scope: "part",
      code: "part_biggest_overpay",
      title: `${overpay.name} is the biggest reason the build is above its low`,
      explanation: `${overpay.name} is currently ${currency(overpay.deltaDollars)} above its recent low of ${currency(
        overpay.recentLow,
      )}, the largest single contributor to the build's price gap.`,
      currentValue: overpay.currentPrice,
      comparisonValue: overpay.recentLow,
      deltaDollars: overpay.deltaDollars,
      affectedPartId: overpay.productId,
      affectedPartName: overpay.name,
    });
  }
  if (bestDeal && bestDeal.deltaDollars > 0) {
    reasons.push({
      severity: "positive",
      scope: "part",
      code: "part_best_deal",
      title: `${bestDeal.name} is the best-priced part right now`,
      explanation: `${bestDeal.name} is ${currency(bestDeal.deltaDollars)} below its average of ${currency(
        bestDeal.averagePrice,
      )}, the strongest single deal in the build.`,
      currentValue: bestDeal.currentPrice,
      comparisonValue: bestDeal.averagePrice,
      deltaDollars: bestDeal.deltaDollars,
      affectedPartId: bestDeal.productId,
      affectedPartName: bestDeal.name,
    });
  }
}

function partCauses(trends: ProductTrendForVerdict[]): { biggestOverpay?: PartCause; bestDeal?: BestDealPart } {
  let biggestOverpay: PartCause | undefined;
  let bestDeal: BestDealPart | undefined;

  for (const trend of trends) {
    const overpay = round(trend.currentPrice - trend.thirtyDayLow);
    if (overpay > 0 && (!biggestOverpay || overpay > biggestOverpay.deltaDollars)) {
      biggestOverpay = {
        productId: trend.productId,
        name: trend.productName,
        currentPrice: round(trend.currentPrice),
        recentLow: round(trend.thirtyDayLow),
        deltaDollars: overpay,
      };
    }
    const below = round(trend.ninetyDayAverage - trend.currentPrice);
    if (below > 0 && (!bestDeal || below > bestDeal.deltaDollars)) {
      bestDeal = {
        productId: trend.productId,
        name: trend.productName,
        currentPrice: round(trend.currentPrice),
        averagePrice: round(trend.ninetyDayAverage),
        deltaDollars: below,
      };
    }
  }

  return { biggestOverpay, bestDeal };
}

function historyProducts(trends: ProductTrendForVerdict[]): BuildHistoryProduct[] {
  return trends
    .filter((trend) => (trend.history?.length ?? 0) > 0)
    .map((trend) => ({
      productId: trend.productId,
      productName: trend.productName,
      history: trend.history ?? [],
    }));
}

function isSeriousReleaseRisk(release: ReleaseRiskSignal | undefined) {
  return !!release && release.level === "high" && release.confidence >= 0.7;
}

function driverForReason(reason: VerdictReason): VerdictDriver {
  if (reason.scope === "compatibility") return "compatibility";
  if (reason.scope === "offer") return "seller-risk";
  if (reason.scope === "release") return "release";
  return "price";
}

function riskToleranceViolation(offer: NormalizedOffer, riskTolerance: RiskTolerance) {
  if (riskTolerance === "new_only" && offer.condition !== "new") return true;
  if (riskTolerance === "open_box_allowed" && (offer.condition === "used" || offer.condition === "refurbished")) {
    return true;
  }
  return false;
}

function dedupe(reasons: VerdictReason[]) {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.code}:${reason.affectedPartId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function verdictLabel(verdict: PriceVerdictValue) {
  return verdict.replaceAll("_", " ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function currency(value: number) {
  return `$${round(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
