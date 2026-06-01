import type { NormalizedOffer, ScoredOffer } from "../deals/types";
import type { EvidenceCitation } from "../evidence/types";
import {
  classifyPartVerdict,
  getPartPriceReasons,
  type PriceVerdict,
  type PriceVerdictValue,
} from "./verdictReasons";

export type { PriceVerdict, PriceVerdictValue, VerdictReason } from "./verdictReasons";

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
  verdict: PriceVerdictValue;
  verdictDetails: PriceVerdict;
  explanation: string;
  evidence?: EvidenceCitation[];
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

  const trend: Omit<ProductPriceTrend, "verdict" | "verdictDetails" | "explanation"> = {
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

  const verdictDetails = classifyPartVerdict(
    getPartPriceReasons(
      { id: input.productId, productName: input.productName },
      input.bestOffer,
      history,
      { currentPrice },
    ),
  );

  return {
    ...trend,
    verdict: verdictDetails.verdict,
    verdictDetails,
    explanation: verdictDetails.specificJustification,
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
