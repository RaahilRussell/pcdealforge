import type { ProductPriceTrend } from "@/lib/pricing/priceTrends";

import type { PriceTimingResult, TimingVerdict } from "./types";

export function calculatePriceTiming(trend: ProductPriceTrend): PriceTimingResult {
  const volatility = calculateVolatility(trend);
  const savingsRatio = trend.currentPrice > 0 ? trend.estimatedSavingsIfWaiting / trend.currentPrice : 0;
  const lowDistance = trend.lowestTrackedPrice > 0 ? trend.currentPrice / trend.lowestTrackedPrice - 1 : 0;
  const averagePenalty =
    trend.currentPrice > trend.ninetyDayAverage
      ? Math.min(35, ((trend.currentPrice - trend.ninetyDayAverage) / trend.ninetyDayAverage) * 120)
      : -8;
  const salePenalty = trend.usuallyCheaper ? 18 : 0;
  const savingsPenalty = Math.min(25, savingsRatio * 180);
  const lowPenalty = Math.min(20, Math.max(0, lowDistance - 0.1) * 80);
  const verdictBase = trend.verdict === "BUY_NOW" ? 84 : trend.verdict === "WAIT" ? 48 : 16;
  const priceTimingScore = clamp(verdictBase - averagePenalty - salePenalty - savingsPenalty - lowPenalty - volatility * 0.2);
  const verdict = priceTimingVerdict(priceTimingScore, trend);

  return {
    priceTimingScore,
    verdict,
    volatility,
    estimatedSavingsIfWaiting: trend.estimatedSavingsIfWaiting,
    usuallyCheaper: trend.usuallyCheaper,
    explanation: explainPriceTiming(trend, priceTimingScore, verdict),
  };
}

export function explainPriceTiming(
  trend: ProductPriceTrend,
  score = calculatePriceTiming(trend).priceTimingScore,
  verdict: TimingVerdict = calculatePriceTiming(trend).verdict,
) {
  if (verdict === "AVOID") {
    return `${trend.productName} is an avoid on price timing because the current seeded price is unusually weak versus the tracked range or listing risk. Current price is ${currency(
      trend.currentPrice,
    )}, 90-day average is ${currency(trend.ninetyDayAverage)}, and estimated wait savings are ${currency(
      trend.estimatedSavingsIfWaiting,
    )}.`;
  }

  if (verdict === "WAIT_FOR_PRICE_DROP") {
    return `${trend.productName} is wait-for-price-drop driven. The current seeded price is ${currency(
      trend.currentPrice,
    )} versus a 90-day average of ${currency(trend.ninetyDayAverage)} and a historical low of ${currency(
      trend.lowestTrackedPrice,
    )}; waiting is estimated to save about ${currency(trend.estimatedSavingsIfWaiting)}.`;
  }

  if (verdict === "BUY_ONLY_IF_NEEDED") {
    return `${trend.productName} is not a clear bargain, but it is not bad enough to avoid. The price timing score is ${Math.round(
      score,
    )}, so buying only makes sense if the user needs the build now.`;
  }

  return `${trend.productName} is a reasonable buy-now price in seeded data because current price ${currency(
    trend.currentPrice,
  )} is below or near the 90-day average of ${currency(trend.ninetyDayAverage)} and close enough to the tracked low.`;
}

function priceTimingVerdict(score: number, trend: ProductPriceTrend): TimingVerdict {
  if (trend.verdict === "AVOID" || score < 25) return "AVOID";
  if (score < 58 || trend.usuallyCheaper) return "WAIT_FOR_PRICE_DROP";
  if (score < 72) return "BUY_ONLY_IF_NEEDED";
  return "BUY_NOW";
}

function calculateVolatility(trend: ProductPriceTrend) {
  const range = trend.usualPriceRange[1] - trend.usualPriceRange[0];
  return trend.currentPrice > 0 ? Math.round((range / trend.currentPrice) * 10000) / 100 : 0;
}

function clamp(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
