import type { DailyPricePoint } from "./priceTrends";

/**
 * Full-build price history.
 *
 * The core idea behind the verdict redesign: a build's BUY/WAIT/AVOID decision should be
 * driven by the historical total price of the *whole* build, not by whether any single part
 * is currently above its own average. This module reconstructs the daily full-build total
 * from per-product daily price points and derives the 30/90/180-day metrics the verdict
 * engine consumes.
 */

export type BuildHistoryProduct = {
  productId: string;
  productName: string;
  /** Daily price points for the product. `lowestTrustedPrice` already folds in shipping, tax and condition penalties. */
  history: DailyPricePoint[];
};

export type BuildHistoryDay = {
  /** ISO calendar date (yyyy-mm-dd). */
  date: string;
  /** Sum of the lowest verified price for every selected product on that day. */
  total: number;
  /** True when every selected product had a verified price on that day. */
  complete: boolean;
  missingProductIds: string[];
};

export type BuildPriceHistory = {
  /** Every reconstructed day (complete and incomplete), chronological. */
  days: BuildHistoryDay[];
  /** Only the days where every selected product had data. */
  completeDays: BuildHistoryDay[];
  completeDayCount: number;
  /** True when there is enough complete history (>= 7 days) to make a confident trend claim. */
  hasEnoughHistory: boolean;

  currentBuildTotal: number;

  build30DayLow: number;
  build30DayAverage: number;
  build30DayMedian: number;
  build30DayHigh: number;

  build90DayLow: number;
  build90DayAverage: number;

  build180DayLow: number;
  build180DayAverage: number;

  dollarsAbove30DayLow: number;
  percentAbove30DayLow: number;
  dollarsAbove30DayAverage: number;
  percentAbove30DayAverage: number;

  dollarsAbove90DayLow: number;
  dollarsAbove180DayLow: number;

  cheapestDayInLast30Days?: string;
};

export type ComputeBuildPriceHistoryOptions = {
  /** Allow incomplete days (missing data for some parts) to count toward lows/averages. Off by default. */
  allowIncompleteDays?: boolean;
};

export function computeBuildPriceHistory(
  products: BuildHistoryProduct[],
  currentBuildTotal: number,
  options: ComputeBuildPriceHistoryOptions = {},
): BuildPriceHistory {
  const current = roundMoney(currentBuildTotal);
  const productCount = products.length;

  // date -> { productId -> lowest price that day }
  const byDate = new Map<string, Map<string, number>>();
  for (const product of products) {
    for (const point of product.history) {
      const key = dateKey(point.date);
      if (!key || !Number.isFinite(point.lowestTrustedPrice)) continue;
      const dayPrices = byDate.get(key) ?? new Map<string, number>();
      const existing = dayPrices.get(product.productId);
      const price = point.lowestTrustedPrice;
      dayPrices.set(product.productId, existing === undefined ? price : Math.min(existing, price));
      byDate.set(key, dayPrices);
    }
  }

  const days: BuildHistoryDay[] = [...byDate.entries()]
    .map(([date, dayPrices]) => {
      const missingProductIds = products
        .filter((product) => !dayPrices.has(product.productId))
        .map((product) => product.productId);
      const total = roundMoney([...dayPrices.values()].reduce((sum, value) => sum + value, 0));
      return {
        date,
        total,
        complete: productCount > 0 && missingProductIds.length === 0,
        missingProductIds,
      } satisfies BuildHistoryDay;
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const completeDays = days.filter((day) => day.complete);
  const usableDays = options.allowIncompleteDays ? days : completeDays;

  const latestDate = days.at(-1)?.date;
  const window = (windowDays: number) =>
    latestDate ? usableDays.filter((day) => withinWindow(day.date, latestDate, windowDays)) : [];

  const thirty = window(30);
  const ninety = window(90);
  const oneEighty = window(180);

  const thirtyTotals = thirty.map((day) => day.total);
  const ninetyTotals = ninety.map((day) => day.total);
  const oneEightyTotals = oneEighty.map((day) => day.total);

  const build30DayLow = min(thirtyTotals, current);
  const build30DayAverage = average(thirtyTotals, current);
  const build30DayMedian = median(thirtyTotals, current);
  const build30DayHigh = max(thirtyTotals, current);
  const build90DayLow = min(ninetyTotals, current);
  const build90DayAverage = average(ninetyTotals, current);
  const build180DayLow = min(oneEightyTotals, current);
  const build180DayAverage = average(oneEightyTotals, current);

  const cheapestDay = [...thirty].sort((left, right) => left.total - right.total)[0];

  return {
    days,
    completeDays,
    completeDayCount: completeDays.length,
    hasEnoughHistory: completeDays.length >= 7,
    currentBuildTotal: current,
    build30DayLow,
    build30DayAverage,
    build30DayMedian,
    build30DayHigh,
    build90DayLow,
    build90DayAverage,
    build180DayLow,
    build180DayAverage,
    dollarsAbove30DayLow: roundMoney(current - build30DayLow),
    percentAbove30DayLow: percentAbove(current, build30DayLow),
    dollarsAbove30DayAverage: roundMoney(current - build30DayAverage),
    percentAbove30DayAverage: percentAbove(current, build30DayAverage),
    dollarsAbove90DayLow: roundMoney(current - build90DayLow),
    dollarsAbove180DayLow: roundMoney(current - build180DayLow),
    cheapestDayInLast30Days: cheapestDay?.date,
  };
}

export function formatHistoryDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function dateKey(value: Date | string): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function withinWindow(dayDate: string, latestDate: string, windowDays: number) {
  const day = new Date(`${dayDate}T00:00:00Z`).getTime();
  const latest = new Date(`${latestDate}T00:00:00Z`).getTime();
  const diffDays = (latest - day) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < windowDays;
}

function min(values: number[], fallback: number) {
  return values.length === 0 ? roundMoney(fallback) : roundMoney(Math.min(...values));
}

function max(values: number[], fallback: number) {
  return values.length === 0 ? roundMoney(fallback) : roundMoney(Math.max(...values));
}

function average(values: number[], fallback: number) {
  if (values.length === 0) return roundMoney(fallback);
  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[], fallback: number) {
  if (values.length === 0) return roundMoney(fallback);
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return roundMoney(value);
}

function percentAbove(current: number, baseline: number) {
  if (baseline <= 0) return 0;
  return roundMoney(((current - baseline) / baseline) * 100);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
