import { describe, expect, it } from "vitest";

import type { NormalizedOffer } from "@/lib/deals/types";

import {
  classifyBuildVerdict,
  classifyPartVerdict,
  getBuildPriceReasons,
  getPartPriceReasons,
  type PriceHistoryPoint,
  type PriceVerdict,
} from "./verdictReasons";

function flatHistory(price: number, days = 180): PriceHistoryPoint[] {
  return Array.from({ length: days }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    lowestTrustedPrice: price,
    avgNewPrice: price + 5,
    minNewPrice: price,
    retailerCount: 3,
  }));
}

function historyWithRecentLow(current: number, normal: number, recentLow: number): PriceHistoryPoint[] {
  return Array.from({ length: 180 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    lowestTrustedPrice: index === 179 ? current : index > 150 ? recentLow : normal,
    avgNewPrice: index === 179 ? current + 5 : normal + 5,
    minNewPrice: index === 179 ? current : recentLow,
    retailerCount: 3,
  }));
}

function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    id: "offer-gpu",
    productId: "gpu",
    retailer: "Seeded Retailer",
    title: "Seeded GPU offer",
    url: "https://example.com/gpu",
    price: 100,
    shipping: 0,
    taxEstimate: 0,
    condition: "new",
    inStock: true,
    confidenceScore: 0.95,
    ...overrides,
  };
}

function partVerdict(current: number, history: PriceHistoryPoint[], selectedOffer: NormalizedOffer = offer({ price: current })) {
  return classifyPartVerdict(
    getPartPriceReasons({ id: "gpu", brand: "Test", model: "GPU" }, selectedOffer, history, {
      currentPrice: current,
      riskTolerance: "open_box_allowed",
    }),
  );
}

describe("structured price verdict reasons", () => {
  it("returns WAIT, not AVOID, for a part 6% above the 90-day average", () => {
    const verdict = partVerdict(106, flatHistory(100));

    expect(verdict.verdict).toBe("WAIT");
    expect(verdict.primaryReason).toEqual(
      expect.objectContaining({
        severity: "warning",
        code: "price_5_to_15_above_90_day_average",
        deltaDollars: 6,
      }),
    );
  });

  it("returns AVOID for a part 20% above the 90-day average", () => {
    const verdict = partVerdict(120, flatHistory(100));

    expect(verdict.verdict).toBe("AVOID");
    expect(verdict.primaryReason.code).toBe("price_20_above_90_day_average");
    expect(verdict.primaryReason.deltaPercent).toBe(20);
  });

  it("returns WAIT with a recent-cheaper reason when a part was $30 cheaper last month", () => {
    const verdict = partVerdict(130, historyWithRecentLow(130, 130, 100));

    expect(verdict.verdict).toBe("WAIT");
    expect(verdict.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "recent_30_day_cheaper",
          deltaDollars: 30,
        }),
      ]),
    );
  });

  it("returns AVOID for a low-confidence used offer", () => {
    const verdict = partVerdict(
      100,
      flatHistory(100),
      offer({
        condition: "used",
        confidenceScore: 0.5,
        price: 100,
      }),
    );

    expect(verdict.verdict).toBe("AVOID");
    expect(verdict.primaryReason.code).toBe("offer_low_confidence");
  });

  it("returns WAIT for a compatible build with mildly weak pricing", () => {
    const mildWait = partVerdict(106, flatHistory(100));
    const buildVerdict = classifyBuildVerdict(getBuildPriceReasons(build([mildWait], "PASS"), [mildWait]));

    expect(buildVerdict.verdict).toBe("WAIT");
    expect(buildVerdict.primaryReason).toBeTruthy();
  });

  it("returns AVOID for a build with compatibility FAIL", () => {
    const goodPart = partVerdict(95, flatHistory(100));
    const buildVerdict = classifyBuildVerdict(getBuildPriceReasons(build([goodPart], "FAIL"), [goodPart]));

    expect(buildVerdict.verdict).toBe("AVOID");
    expect(buildVerdict.primaryReason.code).toBe("compatibility_fail");
  });

  it("returns BUY_NOW for a build below its 90-day average", () => {
    const goodPart = partVerdict(90, flatHistory(100));
    const buildVerdict = classifyBuildVerdict(getBuildPriceReasons(build([goodPart], "PASS"), [goodPart]));

    expect(buildVerdict.verdict).toBe("BUY_NOW");
    expect(buildVerdict.primaryReason.code).toBe("build_below_90_day_average");
  });

  it("always includes primary reasons and quantified price comparisons for WAIT or AVOID price-driven verdicts", () => {
    const verdicts = [partVerdict(106, flatHistory(100)), partVerdict(120, flatHistory(100))];

    for (const verdict of verdicts) {
      expect(verdict.primaryReason).toBeTruthy();
      expect(verdict.primaryReason.explanation).toBeTruthy();
      expect(verdict.primaryReason.deltaDollars).toBeGreaterThan(0);
      expect(verdict.primaryReason.deltaPercent).toBeGreaterThan(0);
    }
  });
});

function build(partVerdicts: PriceVerdict[], compatibilityStatus: "PASS" | "WARNING" | "FAIL") {
  const trends = partVerdicts.map((verdict, index) => {
    const reason = verdict.primaryReason;
    return {
      productId: reason.affectedPartId ?? `part-${index}`,
      productName: reason.affectedPartName ?? `Part ${index}`,
      currentPrice: reason.currentValue ?? 100,
      thirtyDayLow: 100,
      ninetyDayLow: 100,
      oneEightyDayLow: 100,
      ninetyDayAverage: reason.comparisonValue ?? 100,
      estimatedSavingsIfWaiting: verdict.verdict === "WAIT" ? Math.max(20, reason.deltaDollars ?? 20) : 0,
      verdict: verdict.verdict,
      verdictDetails: verdict,
    };
  });

  return {
    totalPrice: trends.reduce((sum, trend) => sum + trend.currentPrice, 0),
    compatibilityReport: {
      overallStatus: compatibilityStatus,
      failCount: compatibilityStatus === "FAIL" ? 1 : 0,
    },
    productPriceTrends: trends,
  };
}
