import { describe, expect, it } from "vitest";

import type { NormalizedOffer } from "@/lib/deals/types";

import { computeBuildPriceVerdict, type ProductTrendForVerdict, type SelectedOfferForVerdict } from "./buildPriceVerdict";
import { computeBuildPriceHistory } from "./buildPriceHistory";
import type { DailyPricePoint } from "./priceTrends";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Build daily points ending "today", index 0 = oldest. */
function dailyHistory(prices: number[]): DailyPricePoint[] {
  const today = Date.UTC(2026, 4, 28); // fixed reference
  const oldest = today - (prices.length - 1) * DAY_MS;
  return prices.map((price, index) => ({
    date: new Date(oldest + index * DAY_MS),
    minNewPrice: price,
    avgNewPrice: price,
    lowestTrustedPrice: price,
    retailerCount: 3,
  }));
}

function trend(overrides: Partial<ProductTrendForVerdict> & { history: DailyPricePoint[] }): ProductTrendForVerdict {
  const prices = overrides.history.map((point) => point.lowestTrustedPrice);
  return {
    productId: "p1",
    productName: "Test Part",
    currentPrice: prices.at(-1) ?? 0,
    thirtyDayLow: Math.min(...prices.slice(-30)),
    thirtyDayAverage: prices.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(30, prices.length),
    ninetyDayAverage: prices.slice(-90).reduce((sum, value) => sum + value, 0) / Math.min(90, prices.length),
    ...overrides,
  };
}

function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    id: "offer-1",
    productId: "p1",
    retailer: "Seeded Retailer",
    title: "Offer",
    url: "https://example.com",
    price: 100,
    shipping: 0,
    taxEstimate: 0,
    condition: "new",
    inStock: true,
    confidenceScore: 0.95,
    ...overrides,
  };
}

function selected(overrides: Partial<SelectedOfferForVerdict> = {}): SelectedOfferForVerdict {
  return {
    productId: "p1",
    productName: "Test Part",
    required: true,
    offer: offer(),
    ...overrides,
  };
}

describe("computeBuildPriceVerdict", () => {
  it("returns WAIT when the full build is $54 above its 30-day low", () => {
    // mostly $889, dipped to $835 fourteen days ago, deeper $820 low ~50 days ago.
    const prices = Array.from({ length: 90 }, (_, index) => {
      if (index === 75) return 835; // within last 30 days
      if (index === 40) return 820; // older 90-day low
      return 889;
    });
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "PASS",
      currentBuildTotal: 889,
      selectedOffers: [selected()],
      productTrends: [trend({ history: dailyHistory(prices), currentPrice: 889 })],
    });

    expect(verdict.verdict).toBe("WAIT");
    expect(verdict.primaryReason.scope).toBe("build");
    expect(verdict.primaryReason.code).toBe("build_above_30_day_low");
    expect(verdict.dollarsAbove30DayLow).toBe(54);
    expect(verdict.build30DayLow).toBe(835);
    expect(verdict.summary).toContain("WAIT");
    expect(verdict.specificJustification).toContain("$54");
    expect(verdict.specificJustification).toContain("$889");
  });

  it("returns BUY_NOW when the full build is below its 30-day average", () => {
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "PASS",
      currentBuildTotal: 850,
      selectedOffers: [selected()],
      productTrends: [trend({ history: dailyHistory(Array.from({ length: 60 }, () => 880)), currentPrice: 850 })],
    });

    expect(verdict.verdict).toBe("BUY_NOW");
    expect(verdict.primaryReason.code).toBe("build_below_30_day_average");
    expect(verdict.dollarsAbove30DayAverage).toBe(-30);
  });

  it("does not force AVOID when a single part is mildly overpriced but the full build trend is acceptable", () => {
    const overpricedPart = trend({
      productId: "gpu",
      productName: "Overpriced GPU",
      history: dailyHistory(Array.from({ length: 60 }, () => 880)),
      currentPrice: 600,
      thirtyDayLow: 540,
      ninetyDayAverage: 560,
    });
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "PASS",
      currentBuildTotal: 880,
      selectedOffers: [selected({ productId: "gpu", productName: "Overpriced GPU", offer: offer({ productId: "gpu" }) })],
      productTrends: [overpricedPart],
    });

    expect(verdict.verdict).not.toBe("AVOID");
  });

  it("returns AVOID for a compatibility failure", () => {
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "FAIL",
      compatibilityFailReason: "Selected GPU requires a 12V-2x6 connector the PSU does not provide.",
      currentBuildTotal: 850,
      selectedOffers: [selected()],
      productTrends: [trend({ history: dailyHistory(Array.from({ length: 30 }, () => 880)) })],
    });

    expect(verdict.verdict).toBe("AVOID");
    expect(verdict.primaryReason.code).toBe("compatibility_fail");
    expect(verdict.primaryReason.scope).toBe("compatibility");
    expect(verdict.driver).toBe("compatibility");
  });

  it("returns AVOID for a low-confidence selected offer", () => {
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "PASS",
      currentBuildTotal: 850,
      selectedOffers: [selected({ offer: offer({ confidenceScore: 0.5, condition: "used" }) })],
      productTrends: [trend({ history: dailyHistory(Array.from({ length: 30 }, () => 880)) })],
    });

    expect(verdict.verdict).toBe("AVOID");
    expect(verdict.primaryReason.code).toBe("offer_low_confidence");
    expect(verdict.driver).toBe("seller-risk");
  });

  it("returns AVOID when a required offer is out of stock", () => {
    const verdict = computeBuildPriceVerdict({
      compatibilityStatus: "PASS",
      currentBuildTotal: 850,
      selectedOffers: [selected({ offer: offer({ inStock: false }) })],
      productTrends: [trend({ history: dailyHistory(Array.from({ length: 30 }, () => 880)) })],
    });

    expect(verdict.verdict).toBe("AVOID");
    expect(verdict.primaryReason.code).toBe("offer_out_of_stock");
  });

  it("always provides a primaryReason and quantified price deltas for price-driven verdicts", () => {
    const waitPrices = Array.from({ length: 90 }, (_, index) => (index === 75 ? 835 : index === 40 ? 820 : 889));
    const verdicts = [
      computeBuildPriceVerdict({
        compatibilityStatus: "PASS",
        currentBuildTotal: 889,
        selectedOffers: [selected()],
        productTrends: [trend({ history: dailyHistory(waitPrices), currentPrice: 889 })],
      }),
      computeBuildPriceVerdict({
        compatibilityStatus: "PASS",
        currentBuildTotal: 850,
        selectedOffers: [selected()],
        productTrends: [trend({ history: dailyHistory(Array.from({ length: 60 }, () => 880)), currentPrice: 850 })],
      }),
    ];

    for (const verdict of verdicts) {
      expect(verdict.primaryReason).toBeTruthy();
      expect(verdict.primaryReason.explanation).toBeTruthy();
      expect(verdict.primaryReason.deltaDollars).toBeGreaterThan(0);
      expect(verdict.primaryReason.deltaPercent).toBeGreaterThanOrEqual(0);
      expect(verdict.driver).toBe("price");
    }
  });
});

describe("computeBuildPriceHistory", () => {
  it("ignores incomplete days where a part is missing data", () => {
    const historyA = dailyHistory([900, 800, 850]); // 3 days
    const historyB = dailyHistory([100, 100]); // only 2 days -> oldest day incomplete for B

    const result = computeBuildPriceHistory(
      [
        { productId: "a", productName: "A", history: historyA },
        { productId: "b", productName: "B", history: historyB },
      ],
      950,
    );

    // historyB lacks the oldest date, so that day must be incomplete and excluded from lows.
    const incompleteDays = result.days.filter((day) => !day.complete);
    expect(incompleteDays.length).toBeGreaterThan(0);
    expect(result.completeDayCount).toBe(2);
    // complete-day totals: 800+100=900 and 850+100=950 -> low 900, not the incomplete 900-only day.
    expect(result.build30DayLow).toBe(900);
  });
});
