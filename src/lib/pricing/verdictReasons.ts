import type { NormalizedOffer, RiskTolerance, ScoredOffer } from "@/lib/deals/types";

export type PriceVerdictValue = "BUY_NOW" | "WAIT" | "AVOID";

export type VerdictReason = {
  severity: "positive" | "neutral" | "warning" | "danger";
  code: string;
  title: string;
  explanation: string;
  currentValue?: number;
  comparisonValue?: number;
  deltaDollars?: number;
  deltaPercent?: number;
  affectedPartId?: string;
  affectedPartName?: string;
  evidenceIds?: string[];
};

export type PriceVerdict = {
  verdict: PriceVerdictValue;
  primaryReason: VerdictReason;
  reasons: VerdictReason[];
  summary: string;
  specificJustification: string;
};

export type PriceHistoryPoint = {
  date: Date | string;
  lowestTrustedPrice: number;
  avgNewPrice?: number;
  minNewPrice?: number;
  retailerCount?: number;
};

type ProductLike = {
  id: string;
  brand?: string;
  model?: string;
  productName?: string;
  name?: string;
};

type PartReasonOptions = {
  currentPrice?: number;
  riskTolerance?: RiskTolerance;
  comparisonOffers?: Array<NormalizedOffer | ScoredOffer>;
  evidenceIds?: string[];
};

type BuildLike = {
  id?: string;
  totalPrice: number;
  compatibilityReport?: {
    overallStatus: "PASS" | "WARNING" | "FAIL";
    failCount: number;
  };
  productPriceTrends: Array<{
    productId: string;
    productName: string;
    currentPrice: number;
    thirtyDayLow: number;
    ninetyDayLow: number;
    oneEightyDayLow: number;
    ninetyDayAverage: number;
    estimatedSavingsIfWaiting: number;
    verdict?: PriceVerdictValue;
    verdictDetails?: PriceVerdict;
    evidence?: Array<{ evidenceId?: string }>;
  }>;
};

export function getPartPriceReasons(
  product: ProductLike,
  offer: NormalizedOffer | ScoredOffer | null | undefined,
  priceHistory: PriceHistoryPoint[],
  options: PartReasonOptions = {},
): VerdictReason[] {
  const sortedHistory = [...priceHistory].sort((left, right) => toTime(left.date) - toTime(right.date));
  const prices = sortedHistory.map((point) => point.lowestTrustedPrice).filter(Number.isFinite);
  const normalizedOffer = offer ? unwrapOffer(offer) : null;
  const currentPrice = money(
    options.currentPrice ??
      (offer && "effectivePrice" in offer ? offer.effectivePrice : undefined) ??
      normalizedOffer?.price ??
      prices.at(-1) ??
      0,
  );
  const productName = displayProductName(product);
  const evidenceIds = options.evidenceIds;
  const reasons: VerdictReason[] = [];

  if (normalizedOffer && !normalizedOffer.inStock) {
    reasons.push({
      severity: "danger",
      code: "offer_out_of_stock",
      title: "Selected offer is out of stock",
      explanation: `${productName} should be avoided because the selected offer is not in stock.`,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  if (normalizedOffer && normalizedOffer.confidenceScore < 0.65) {
    reasons.push({
      severity: "danger",
      code: "offer_low_confidence",
      title: "Selected offer confidence is too low",
      explanation: `${productName} should be avoided because the selected offer confidence is ${formatPercentValue(
        normalizedOffer.confidenceScore * 100,
      )}, below the 65% safety floor.`,
      currentValue: normalizedOffer.confidenceScore,
      comparisonValue: 0.65,
      deltaPercent: percent(normalizedOffer.confidenceScore - 0.65),
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  const riskViolation = normalizedOffer
    ? riskToleranceViolation(normalizedOffer, options.riskTolerance ?? "used_allowed")
    : null;
  if (riskViolation) {
    reasons.push({
      severity: "danger",
      code: "risk_tolerance_violation",
      title: "Offer violates risk tolerance",
      explanation: `${productName} should be avoided because the selected ${normalizedOffer?.condition.replaceAll(
        "_",
        " ",
      )} offer violates the user's ${riskViolation.replaceAll("_", " ")} risk setting.`,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  const cheapestNewComparison = normalizedOffer
    ? cheapestNewEffectivePrice(options.comparisonOffers ?? [])
    : null;
  if (
    normalizedOffer &&
    normalizedOffer.condition !== "new" &&
    cheapestNewComparison !== null &&
    cheapestNewComparison - currentPrice <= Math.max(20, currentPrice * 0.03)
  ) {
    const delta = money(cheapestNewComparison - currentPrice);
    reasons.push({
      severity: "danger",
      code: "risky_condition_small_savings",
      title: "Risky condition is not saving enough",
      explanation: `${productName} uses a ${normalizedOffer.condition.replaceAll(
        "_",
        " ",
      )} listing that saves only ${currency(delta)} versus the cheapest new listing, so the condition risk is not justified.`,
      currentValue: currentPrice,
      comparisonValue: cheapestNewComparison,
      deltaDollars: delta,
      deltaPercent: percent(delta / Math.max(1, cheapestNewComparison)),
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  if (prices.length === 0 || currentPrice <= 0) {
    reasons.push({
      severity: "neutral",
      code: "missing_price_history",
      title: "No price history available",
      explanation: `${productName} does not have enough price history to make a quantified price-timing claim.`,
      currentValue: currentPrice,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
    return reasons;
  }

  const thirtyDayPrices = windowPrices(sortedHistory, 30);
  const ninetyDayPrices = windowPrices(sortedHistory, 90);
  const oneEightyDayPrices = windowPrices(sortedHistory, 180);
  const thirtyDayAverage = average(thirtyDayPrices);
  const ninetyDayAverage = average(ninetyDayPrices);
  const oneEightyDayAverage = average(oneEightyDayPrices);
  const thirtyDayLow = min(thirtyDayPrices);
  const ninetyDayLow = min(ninetyDayPrices);
  const oneEightyDayLow = min(oneEightyDayPrices);

  if (currentPrice < ninetyDayAverage) {
    const delta = money(ninetyDayAverage - currentPrice);
    reasons.push({
      severity: "positive",
      code: "below_90_day_average",
      title: "Below 90-day average",
      explanation: `${productName} is ${currency(delta)} below its 90-day average of ${currency(
        ninetyDayAverage,
      )}.`,
      currentValue: currentPrice,
      comparisonValue: ninetyDayAverage,
      deltaDollars: delta,
      deltaPercent: percent(delta / ninetyDayAverage),
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  if (currentPrice <= oneEightyDayLow * 1.08) {
    const delta = money(Math.abs(currentPrice - oneEightyDayLow));
    const relation = currentPrice < oneEightyDayLow ? "below" : "above";
    reasons.push({
      severity: "positive",
      code: "within_8_percent_180_day_low",
      title: "Near 180-day low",
      explanation: `${productName} is only ${currency(delta)} ${relation} its 180-day low of ${currency(
        oneEightyDayLow,
      )}, which is within the 8% buy-now band.`,
      currentValue: currentPrice,
      comparisonValue: oneEightyDayLow,
      deltaDollars: delta,
      deltaPercent: percent(delta / oneEightyDayLow),
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  const ninetyDayDelta = money(currentPrice - ninetyDayAverage);
  const ninetyDayDeltaPercent = percent(ninetyDayDelta / ninetyDayAverage);
  if (ninetyDayDeltaPercent >= 20) {
    reasons.push({
      severity: "danger",
      code: "price_20_above_90_day_average",
      title: "More than 20% above 90-day average",
      explanation: `${productName} is ${currency(ninetyDayDelta)} above its 90-day average of ${currency(
        ninetyDayAverage,
      )}, a ${formatPercentValue(ninetyDayDeltaPercent)} overpay signal.`,
      currentValue: currentPrice,
      comparisonValue: ninetyDayAverage,
      deltaDollars: ninetyDayDelta,
      deltaPercent: ninetyDayDeltaPercent,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  } else if (ninetyDayDeltaPercent >= 5) {
    reasons.push({
      severity: "warning",
      code: "price_5_to_15_above_90_day_average",
      title: "Above 90-day average",
      explanation: `${productName} is ${currency(ninetyDayDelta)} above its 90-day average of ${currency(
        ninetyDayAverage,
      )}, so this is a wait signal rather than an avoid signal.`,
      currentValue: currentPrice,
      comparisonValue: ninetyDayAverage,
      deltaDollars: ninetyDayDelta,
      deltaPercent: ninetyDayDeltaPercent,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  const lowDelta = money(currentPrice - oneEightyDayLow);
  const lowDeltaPercent = percent(lowDelta / oneEightyDayLow);
  if (lowDeltaPercent > 25 && ninetyDayDeltaPercent >= 15) {
    reasons.push({
      severity: "danger",
      code: "price_25_above_180_day_low",
      title: "Far above 180-day low",
      explanation: `${productName} is ${currency(lowDelta)} above its 180-day low of ${currency(
        oneEightyDayLow,
      )}, or ${formatPercentValue(lowDeltaPercent)} above that low, while also sitting at least 15% above its 90-day average.`,
      currentValue: currentPrice,
      comparisonValue: oneEightyDayLow,
      deltaDollars: lowDelta,
      deltaPercent: lowDeltaPercent,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  addRecentCheaperReason(reasons, product, productName, currentPrice, thirtyDayLow, 30, evidenceIds);
  addRecentCheaperReason(reasons, product, productName, currentPrice, ninetyDayLow, 90, evidenceIds);

  const expectedSalePrice = Math.min(ninetyDayLow, thirtyDayAverage, oneEightyDayAverage * 0.95);
  const estimatedSavings = money(Math.max(0, currentPrice - expectedSalePrice));
  if (estimatedSavings >= 20) {
    reasons.push({
      severity: "warning",
      code: "estimated_part_savings",
      title: "Meaningful estimated savings if waiting",
      explanation: `${productName} has an estimated wait savings of ${currency(
        estimatedSavings,
      )} based on its recent low and average price bands.`,
      currentValue: currentPrice,
      comparisonValue: expectedSalePrice,
      deltaDollars: estimatedSavings,
      deltaPercent: percent(estimatedSavings / currentPrice),
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  if (!reasons.some((reason) => reason.severity === "positive" || reason.severity === "warning" || reason.severity === "danger")) {
    reasons.push({
      severity: "neutral",
      code: "fair_current_price",
      title: "Fair current price",
      explanation: `${productName} is not a standout bargain, but it is not meaningfully overpriced versus the seeded 90-day average.`,
      currentValue: currentPrice,
      comparisonValue: ninetyDayAverage,
      deltaDollars: money(currentPrice - ninetyDayAverage),
      deltaPercent: ninetyDayDeltaPercent,
      affectedPartId: product.id,
      affectedPartName: productName,
      evidenceIds,
    });
  }

  return dedupeReasons(reasons);
}

export function getBuildPriceReasons(build: BuildLike, partVerdicts: PriceVerdict[] = []): VerdictReason[] {
  const reasons: VerdictReason[] = [];
  const trends = build.productPriceTrends;
  const currentTotal = money(build.totalPrice);
  const ninetyDayAverage = money(sum(trends.map((trend) => trend.ninetyDayAverage)));
  const thirtyDayLow = money(sum(trends.map((trend) => trend.thirtyDayLow)));
  const ninetyDayLow = money(sum(trends.map((trend) => trend.ninetyDayLow)));
  const oneEightyDayLow = money(sum(trends.map((trend) => trend.oneEightyDayLow)));
  const savings = money(sum(trends.map((trend) => trend.estimatedSavingsIfWaiting)));
  const biggestWait = [...trends].sort(
    (left, right) => right.estimatedSavingsIfWaiting - left.estimatedSavingsIfWaiting,
  )[0];

  if (build.compatibilityReport?.overallStatus === "FAIL" || (build.compatibilityReport?.failCount ?? 0) > 0) {
    reasons.push({
      severity: "danger",
      code: "compatibility_fail",
      title: "Build has a compatibility failure",
      explanation: "This build should be avoided because at least one deterministic compatibility rule failed.",
    });
  }

  for (const partVerdict of partVerdicts) {
    const primary = partVerdict.primaryReason;
    if (primary.severity === "danger") {
      reasons.push({
        ...primary,
        code: `part_${primary.code}`,
        title: `Part issue: ${primary.title}`,
      });
    }
  }

  if (currentTotal < ninetyDayAverage) {
    const delta = money(ninetyDayAverage - currentTotal);
    reasons.push({
      severity: "positive",
      code: "build_below_90_day_average",
      title: "Build below 90-day average",
      explanation: `The full build is ${currency(delta)} below its seeded 90-day average of ${currency(
        ninetyDayAverage,
      )}.`,
      currentValue: currentTotal,
      comparisonValue: ninetyDayAverage,
      deltaDollars: delta,
      deltaPercent: percent(delta / ninetyDayAverage),
    });
  }

  const averageDelta = money(currentTotal - ninetyDayAverage);
  const averageDeltaPercent = percent(averageDelta / ninetyDayAverage);
  if (averageDeltaPercent >= 20) {
    reasons.push({
      severity: "danger",
      code: "build_20_above_90_day_average",
      title: "Build more than 20% above 90-day average",
      explanation: `The full build is ${currency(averageDelta)} above its seeded 90-day average of ${currency(
        ninetyDayAverage,
      )}, a ${formatPercentValue(averageDeltaPercent)} overpay signal.`,
      currentValue: currentTotal,
      comparisonValue: ninetyDayAverage,
      deltaDollars: averageDelta,
      deltaPercent: averageDeltaPercent,
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  } else if (averageDeltaPercent >= 5) {
    reasons.push({
      severity: "warning",
      code: "build_above_90_day_average",
      title: "Build above 90-day average",
      explanation: `The full build is ${currency(averageDelta)} above its seeded 90-day average of ${currency(
        ninetyDayAverage,
      )}, so waiting is more appropriate than avoiding.`,
      currentValue: currentTotal,
      comparisonValue: ninetyDayAverage,
      deltaDollars: averageDelta,
      deltaPercent: averageDeltaPercent,
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  }

  const lowDelta = money(currentTotal - oneEightyDayLow);
  const lowDeltaPercent = percent(lowDelta / oneEightyDayLow);
  if (lowDeltaPercent > 25 && averageDeltaPercent >= 15) {
    reasons.push({
      severity: "danger",
      code: "build_25_above_180_day_low",
      title: "Build far above 180-day low",
      explanation: `The full build is ${currency(lowDelta)} above its seeded 180-day low of ${currency(
        oneEightyDayLow,
      )}, or ${formatPercentValue(lowDeltaPercent)} above that low, while also at least 15% above its 90-day average.`,
      currentValue: currentTotal,
      comparisonValue: oneEightyDayLow,
      deltaDollars: lowDelta,
      deltaPercent: lowDeltaPercent,
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  }

  if (currentTotal > thirtyDayLow) {
    const delta = money(currentTotal - thirtyDayLow);
    reasons.push({
      severity: delta >= 50 ? "warning" : "neutral",
      code: "build_recent_30_day_cheaper",
      title: "Build was cheaper within 30 days",
      explanation: `The full build was ${currency(delta)} cheaper within the seeded last 30 days.`,
      currentValue: currentTotal,
      comparisonValue: thirtyDayLow,
      deltaDollars: delta,
      deltaPercent: percent(delta / currentTotal),
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  }

  if (currentTotal > ninetyDayLow) {
    const delta = money(currentTotal - ninetyDayLow);
    reasons.push({
      severity: delta >= 50 ? "warning" : "neutral",
      code: "build_recent_90_day_cheaper",
      title: "Build was cheaper within 90 days",
      explanation: `The full build was ${currency(delta)} cheaper within the seeded last 90 days.`,
      currentValue: currentTotal,
      comparisonValue: ninetyDayLow,
      deltaDollars: delta,
      deltaPercent: percent(delta / currentTotal),
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  }

  if (savings >= 50) {
    reasons.push({
      severity: "warning",
      code: "estimated_build_savings",
      title: "Meaningful build savings if waiting",
      explanation: `Waiting is estimated to save about ${currency(savings)} across the selected parts. The largest driver is ${
        biggestWait?.productName ?? "the selected part mix"
      }.`,
      currentValue: currentTotal,
      comparisonValue: money(currentTotal - savings),
      deltaDollars: savings,
      deltaPercent: percent(savings / currentTotal),
      affectedPartId: biggestWait?.productId,
      affectedPartName: biggestWait?.productName,
    });
  }

  if (!reasons.some((reason) => reason.severity === "positive" || reason.severity === "warning" || reason.severity === "danger")) {
    reasons.push({
      severity: "neutral",
      code: "build_fair_price",
      title: "Build price is fair",
      explanation: "The full build is not a standout bargain, but it is not meaningfully overpriced in the seeded price history.",
      currentValue: currentTotal,
      comparisonValue: ninetyDayAverage,
      deltaDollars: money(currentTotal - ninetyDayAverage),
      deltaPercent: averageDeltaPercent,
    });
  }

  return dedupeReasons(reasons);
}

export function classifyPartVerdict(reasons: VerdictReason[]): PriceVerdict {
  const primaryReason = primaryReasonFor(reasons);
  const hasDanger = reasons.some((reason) => reason.severity === "danger" && partAvoidCodes.has(reason.code));
  const hasWarning = reasons.some((reason) => reason.severity === "warning");
  const hasPositive = reasons.some((reason) => reason.severity === "positive");
  const verdict: PriceVerdictValue = hasDanger ? "AVOID" : hasWarning ? "WAIT" : hasPositive ? "BUY_NOW" : "BUY_NOW";

  return buildVerdict(verdict, primaryReason, reasons);
}

export function classifyBuildVerdict(reasons: VerdictReason[]): PriceVerdict {
  const primaryReason = primaryReasonFor(reasons);
  const hasAvoidDanger = reasons.some((reason) => reason.severity === "danger" && isBuildAvoidCode(reason.code));
  const hasWarning = reasons.some((reason) => reason.severity === "warning");
  const hasPositive = reasons.some((reason) => reason.severity === "positive");
  const verdict: PriceVerdictValue = hasAvoidDanger ? "AVOID" : hasWarning ? "WAIT" : hasPositive ? "BUY_NOW" : "BUY_NOW";

  return buildVerdict(verdict, primaryReason, reasons);
}

export function formatVerdictExplanation(verdict: PriceVerdict) {
  return `${formatVerdictLabel(verdict.verdict)}: ${verdict.specificJustification}`;
}

export function attachEvidenceIdsToPriceVerdict(verdict: PriceVerdict, evidenceIds: string[]): PriceVerdict {
  const ids = evidenceIds.filter(Boolean);
  if (ids.length === 0) return verdict;

  return {
    ...verdict,
    primaryReason: {
      ...verdict.primaryReason,
      evidenceIds: unique([...(verdict.primaryReason.evidenceIds ?? []), ...ids]),
    },
    reasons: verdict.reasons.map((reason) => ({
      ...reason,
      evidenceIds: unique([...(reason.evidenceIds ?? []), ...ids]),
    })),
  };
}

function buildVerdict(verdict: PriceVerdictValue, primaryReason: VerdictReason, reasons: VerdictReason[]): PriceVerdict {
  const cleanReasons = dedupeReasons(reasons);
  const reason = cleanReasons.find((item) => item.code === primaryReason.code) ?? primaryReason;
  const summary = `${formatVerdictLabel(verdict)} because ${lowercaseFirst(reason.title)}.`;

  return {
    verdict,
    primaryReason: reason,
    reasons: cleanReasons,
    summary,
    specificJustification: reason.explanation,
  };
}

function primaryReasonFor(reasons: VerdictReason[]) {
  const priority = ["danger", "warning", "positive", "neutral"] as const;
  for (const severity of priority) {
    const reason = reasons.find((item) => item.severity === severity);
    if (reason) return reason;
  }

  return {
    severity: "neutral",
    code: "no_price_signal",
    title: "No price signal",
    explanation: "No price signal was available for this verdict.",
  } satisfies VerdictReason;
}

function addRecentCheaperReason(
  reasons: VerdictReason[],
  product: ProductLike,
  productName: string,
  currentPrice: number,
  recentLow: number,
  days: 30 | 90,
  evidenceIds?: string[],
) {
  if (currentPrice <= recentLow) return;

  const delta = money(currentPrice - recentLow);
  const severity = delta >= 20 || delta / currentPrice >= 0.05 ? "warning" : "neutral";
  reasons.push({
    severity,
    code: `recent_${days}_day_cheaper`,
    title: `Cheaper within ${days} days`,
    explanation: `${productName} was ${currency(delta)} cheaper within the seeded last ${days} days.`,
    currentValue: currentPrice,
    comparisonValue: recentLow,
    deltaDollars: delta,
    deltaPercent: percent(delta / currentPrice),
    affectedPartId: product.id,
    affectedPartName: productName,
    evidenceIds,
  });
}

function riskToleranceViolation(offer: NormalizedOffer, riskTolerance: RiskTolerance) {
  if (riskTolerance === "new_only" && offer.condition !== "new") return riskTolerance;
  if (riskTolerance === "open_box_allowed" && (offer.condition === "used" || offer.condition === "refurbished")) {
    return riskTolerance;
  }
  return null;
}

function cheapestNewEffectivePrice(offers: Array<NormalizedOffer | ScoredOffer>) {
  const newOffers = offers
    .map((offer) =>
      "offer" in offer
        ? { condition: offer.offer.condition, effectivePrice: offer.effectivePrice }
        : {
            condition: offer.condition,
            effectivePrice: offer.price + offer.shipping + offer.taxEstimate,
          },
    )
    .filter((offer) => offer.condition === "new");
  if (newOffers.length === 0) return null;
  return money(Math.min(...newOffers.map((offer) => offer.effectivePrice)));
}

function unwrapOffer(offer: NormalizedOffer | ScoredOffer): NormalizedOffer {
  return "offer" in offer ? offer.offer : offer;
}

function isBuildAvoidCode(code: string) {
  if (buildAvoidCodes.has(code)) return true;
  if (!code.startsWith("part_")) return false;
  return partAvoidCodes.has(code.replace(/^part_/, ""));
}

const partAvoidCodes = new Set([
  "offer_out_of_stock",
  "offer_low_confidence",
  "risk_tolerance_violation",
  "risky_condition_small_savings",
  "price_20_above_90_day_average",
  "price_25_above_180_day_low",
  "high_confidence_release_poor_price",
  "safer_alternative_within_5_percent",
]);

const buildAvoidCodes = new Set([
  "compatibility_fail",
  "build_20_above_90_day_average",
  "build_25_above_180_day_low",
  "high_confidence_release_poor_price",
  "badly_unbalanced_build",
  "safer_alternative_within_5_percent",
]);

function displayProductName(product: ProductLike) {
  if (product.productName) return product.productName;
  if (product.name) return product.name;
  return `${product.brand ?? ""} ${product.model ?? product.id}`.trim();
}

function windowPrices(history: PriceHistoryPoint[], days: number) {
  return history.slice(-days).map((point) => point.lowestTrustedPrice).filter(Number.isFinite);
}

function min(values: number[]) {
  if (values.length === 0) return 0;
  return money(Math.min(...values));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return money(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function toTime(value: Date | string) {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(value: number) {
  return Math.round(value * 10000) / 100;
}

function currency(value: number) {
  return `$${money(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPercentValue(value: number) {
  return `${money(value)}%`;
}

function formatVerdictLabel(verdict: PriceVerdictValue) {
  return verdict.replaceAll("_", " ");
}

function lowercaseFirst(value: string) {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

function dedupeReasons(reasons: VerdictReason[]) {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.code}:${reason.affectedPartId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
