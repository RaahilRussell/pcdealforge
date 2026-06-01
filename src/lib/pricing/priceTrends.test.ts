import { describe, expect, it } from "vitest";

import { calculateProductPriceTrend, type DailyPricePoint } from "./priceTrends";

function historyWithCurrent(currentPrice: number, basePrice: number): DailyPricePoint[] {
  return Array.from({ length: 180 }, (_, index) => {
    const price = index === 179 ? currentPrice : basePrice + Math.sin(index / 8) * 3;
    return {
      date: new Date(Date.UTC(2026, 0, index + 1)),
      minNewPrice: price,
      avgNewPrice: price + 6,
      lowestTrustedPrice: price,
      retailerCount: 4,
    };
  });
}

describe("price intelligence", () => {
  it("returns BUY_NOW when the current price is below the 90-day average and near tracked low", () => {
    const trend = calculateProductPriceTrend({
      productId: "gpu",
      productName: "Test GPU",
      history: historyWithCurrent(91, 99),
    });

    expect(trend.verdict).toBe("BUY_NOW");
    expect(trend.verdictDetails.primaryReason).toBeTruthy();
    expect(trend.currentPrice).toBe(91);
    expect(trend.ninetyDayAverage).toBeGreaterThan(91);
  });

  it("returns WAIT when the current price is above the normal sale band", () => {
    const trend = calculateProductPriceTrend({
      productId: "cpu",
      productName: "Test CPU",
      history: historyWithCurrent(116, 100),
    });

    expect(trend.verdict).toBe("WAIT");
    expect(trend.verdictDetails.primaryReason.explanation).toContain("$");
    expect(trend.estimatedSavingsIfWaiting).toBeGreaterThan(0);
  });

  it("detects products that are usually cheaper", () => {
    const trend = calculateProductPriceTrend({
      productId: "ssd",
      productName: "Test SSD",
      history: historyWithCurrent(128, 100),
    });

    expect(trend.usuallyCheaper).toBe(true);
    expect(trend.verdict).not.toBe("BUY_NOW");
  });
});
