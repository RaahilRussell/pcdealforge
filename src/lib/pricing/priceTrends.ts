import type { NormalizedOffer, ScoredOffer } from "../deals/types";

export type PriceVerdict = "BUY_NOW" | "WAIT" | "AVOID";

export type DailyPricePoint = {
  date: Date | string;
  minNewPrice: number;
  minOpenBoxPrice?: number | null;
  avgNewPrice: number;
  lowestTrustedPrice: number;
  retailerCount: number;
};

export type ProductPriceTrendInput = {
  productId: string;
  productName: string;
  history: DailyPricePoint[];
  currentPrice?: number;
  bestOffer?: NormalizedOffer | ScoredOffer | null;
};

export type ProductPriceTrend = {
  productId: string;
  productName: string;
  currentPrice: number;
  thirtyDayLow: number;
  ninetyDayLow: number;
  oneEightyDayLow: number;
  thirtyDayAverage: number;
  ninetyDayAverage: number;
  oneEightyDayAverage: number;
  lowestTrackedPrice: number;
  usualPriceRange: [number, number];
  typicalSaleBand: [number, number];
  currentPricePercentile: number;
  usuallyCheaper: boolean;
  estimatedSavingsIfWaiting: number;
  verdict: PriceVerdict;
  explanation: string;
};

export type BuildPriceTrendInput = {
  buildName: string;
  productTrends: ProductPriceTrend[];
  historiesByProductId: Record<string, DailyPricePoint[]>;
  compatibleCheaperSwaps?: Array<{
    fromProductId: string;
    toProductId: string;
    savings: number;
    explanation: string;
  }>;
};

export type BuildPriceTrend = {
  buildName: string;
  currentFullBuildPrice: number;
  thirtyDayBuildLow: number;
  ninetyDayBuildLow: number;
  oneEightyDayBuildLow: number;
  usualBuildRange: [number, number];
  potentialSavingsFromWaiting: number;
  overpricedParts: ProductPriceTrend[];
  compatibleCheaperSwaps: NonNullable<BuildPriceTrendInput["compatibleCheaperSwaps"]>;
};

export function calculateProductPriceTrend(input: ProductPriceTrendInput): ProductPriceTrend {
  const history = [...input.history].sort((left, right) => toTime(left.date) - toTime(right.date));
  if (history.length === 0) {
    throw new Error(`No price history found for ${input.productName}`);
  }

  const prices = history.map((point) => point.lowestTrustedPrice);
  const lastPoint = history.at(-1);
  const currentPrice = roundMoney(input.currentPrice ?? lastPoint?.lowestTrustedPrice ?? prices.at(-1) ?? 0);
  const thirtyDayPrices = windowPrices(history, 30);
  const ninetyDayPrices = windowPrices(history, 90);
  const oneEightyDayPrices = windowPrices(history, 180);
  const usualPriceRange = [percentile(prices, 0.25), percentile(prices, 0.75)] as [number, number];
  const typicalSaleBand = [percentile(prices, 0.1), percentile(prices, 0.35)] as [number, number];
  const currentPricePercentile = percentileRank(prices, currentPrice);
  const expectedSalePrice = typicalSaleBand[1];
  const estimatedSavingsIfWaiting = roundMoney(Math.max(0, currentPrice - expectedSalePrice));
  const usuallyCheaper =
    currentPrice > expectedSalePrice && estimatedSavingsIfWaiting >= Math.max(15, currentPrice * 0.05);
  const riskAvoid = isRiskyOffer(input.bestOffer);

  const trend: Omit<ProductPriceTrend, "verdict" | "explanation"> = {
    productId: input.productId,
    productName: input.productName,
    currentPrice,
    thirtyDayLow: min(thirtyDayPrices),
    ninetyDayLow: min(ninetyDayPrices),
    oneEightyDayLow: min(oneEightyDayPrices),
    thirtyDayAverage: average(thirtyDayPrices),
    ninetyDayAverage: average(ninetyDayPrices),
    oneEightyDayAverage: average(oneEightyDayPrices),
    lowestTrackedPrice: min(prices),
    usualPriceRange,
    typicalSaleBand,
    currentPricePercentile,
    usuallyCheaper,
    estimatedSavingsIfWaiting,
  };

  const verdict = priceVerdict(trend, riskAvoid);

  return {
    ...trend,
    verdict,
    explanation: explainVerdict(verdict, trend, riskAvoid),
  };
}

export function calculateBuildPriceTrend(input: BuildPriceTrendInput): BuildPriceTrend {
  const buildHistory = buildHistoryTotals(input.historiesByProductId);
  const prices = buildHistory.map((point) => point.price);
  const currentFullBuildPrice = roundMoney(
    input.productTrends.reduce((sum, trend) => sum + trend.currentPrice, 0),
  );
  const overpricedParts = input.productTrends.filter((trend) => trend.verdict === "WAIT" || trend.verdict === "AVOID");
  const potentialSavingsFromWaiting = roundMoney(
    input.productTrends.reduce((sum, trend) => sum + trend.estimatedSavingsIfWaiting, 0),
  );

  return {
    buildName: input.buildName,
    currentFullBuildPrice,
    thirtyDayBuildLow: min(buildHistory.slice(-30).map((point) => point.price)),
    ninetyDayBuildLow: min(buildHistory.slice(-90).map((point) => point.price)),
    oneEightyDayBuildLow: min(prices),
    usualBuildRange: [percentile(prices, 0.25), percentile(prices, 0.75)],
    potentialSavingsFromWaiting,
    overpricedParts,
    compatibleCheaperSwaps: input.compatibleCheaperSwaps ?? [],
  };
}

function priceVerdict(
  trend: Omit<ProductPriceTrend, "verdict" | "explanation">,
  riskAvoid: boolean,
): PriceVerdict {
  if (riskAvoid) return "AVOID";

  const withinLowBand = trend.currentPrice <= trend.lowestTrackedPrice * 1.1;
  const belowNinetyAverage = trend.currentPrice < trend.ninetyDayAverage;
  const aboveNormalSaleBand = trend.currentPrice > trend.typicalSaleBand[1];
  const unusuallyHigh = trend.currentPricePercentile >= 0.9 && trend.currentPrice > trend.ninetyDayAverage * 1.25;

  if (unusuallyHigh) return "AVOID";
  if (belowNinetyAverage && withinLowBand) return "BUY_NOW";
  if (aboveNormalSaleBand || trend.usuallyCheaper) return "WAIT";
  return "BUY_NOW";
}

function explainVerdict(
  verdict: PriceVerdict,
  trend: Omit<ProductPriceTrend, "verdict" | "explanation">,
  riskAvoid: boolean,
) {
  if (riskAvoid) {
    return "The best visible listing carries major seller, confidence, or condition risk, so it should not drive a safe purchase.";
  }

  if (verdict === "BUY_NOW") {
    return `Current price is below the 90-day average of ${formatCurrency(
      trend.ninetyDayAverage,
    )} and close to the tracked low of ${formatCurrency(trend.lowestTrackedPrice)}.`;
  }

  if (verdict === "WAIT") {
    return `Current price is above the normal sale band of ${formatCurrency(
      trend.typicalSaleBand[0],
    )}-${formatCurrency(trend.typicalSaleBand[1])}; waiting could save about ${formatCurrency(
      trend.estimatedSavingsIfWaiting,
    )}.`;
  }

  return `Current price is unusually high versus the tracked range and 90-day average of ${formatCurrency(
    trend.ninetyDayAverage,
  )}.`;
}

function isRiskyOffer(offer: ProductPriceTrendInput["bestOffer"]) {
  if (!offer) return false;
  const normalizedOffer: NormalizedOffer = "offer" in offer ? offer.offer : offer;
  if (!normalizedOffer.inStock) return true;
  if (normalizedOffer.confidenceScore < 0.65) return true;
  if ((normalizedOffer.sellerRating ?? 5) < 4) return true;
  return normalizedOffer.condition === "used" && normalizedOffer.confidenceScore < 0.9;
}

function buildHistoryTotals(historiesByProductId: Record<string, DailyPricePoint[]>) {
  const entries = Object.entries(historiesByProductId);
  if (entries.length === 0) return [];

  const shortest = Math.min(...entries.map(([, history]) => history.length));
  const normalizedHistories = entries.map(([, history]) =>
    [...history].sort((left, right) => toTime(left.date) - toTime(right.date)).slice(-shortest),
  );

  return normalizedHistories[0].map((point, index) => ({
    date: point.date,
    price: roundMoney(normalizedHistories.reduce((sum, history) => sum + history[index].lowestTrustedPrice, 0)),
  }));
}

function windowPrices(history: DailyPricePoint[], days: number) {
  return history.slice(-days).map((point) => point.lowestTrustedPrice);
}

function min(values: number[]) {
  return roundMoney(Math.min(...values));
}

function average(values: number[]) {
  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: number[], rank: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * rank)));
  return roundMoney(sorted[index]);
}

function percentileRank(values: number[], value: number) {
  const sorted = [...values].sort((left, right) => left - right);
  const lessOrEqual = sorted.filter((price) => price <= value).length;
  return roundMoney(lessOrEqual / sorted.length);
}

function toTime(value: Date | string) {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
