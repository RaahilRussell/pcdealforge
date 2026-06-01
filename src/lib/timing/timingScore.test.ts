import { describe, expect, it } from "vitest";

import { calculatePriceTiming } from "./marketTiming";
import { calculateReleaseTiming } from "./releaseTiming";
import { calculateBuildTimingReport } from "./timingScore";
import type { ProductReleaseSignal } from "./types";
import type { GeneratedBuild } from "@/lib/builds/types";
import type { ProductPriceTrend } from "@/lib/pricing/priceTrends";

function trend(overrides: Partial<ProductPriceTrend> = {}): ProductPriceTrend {
  const verdict = overrides.verdict ?? "WAIT";
  return {
    productId: "gpu-test",
    productName: "Test GPU",
    currentPrice: 610,
    thirtyDayLow: 590,
    ninetyDayLow: 570,
    oneEightyDayLow: 540,
    thirtyDayAverage: 605,
    ninetyDayAverage: 590,
    oneEightyDayAverage: 610,
    lowestTrackedPrice: 570,
    usualPriceRange: [570, 620],
    typicalSaleBand: [540, 575],
    currentPricePercentile: 0.74,
    usuallyCheaper: false,
    estimatedSavingsIfWaiting: 40,
    verdict,
    verdictDetails: {
      verdict,
      primaryReason: {
        severity: verdict === "BUY_NOW" ? "positive" : verdict === "AVOID" ? "danger" : "warning",
        code: "test_price_reason",
        title: "Test price reason",
        explanation: "Test price reason with seeded comparison.",
        currentValue: overrides.currentPrice ?? 610,
        comparisonValue: overrides.ninetyDayAverage ?? 590,
        deltaDollars: Math.abs((overrides.currentPrice ?? 610) - (overrides.ninetyDayAverage ?? 590)),
        deltaPercent: 3.39,
        affectedPartId: "gpu-test",
        affectedPartName: "Test GPU",
      },
      reasons: [],
      summary: "Test verdict.",
      specificJustification: "Test price reason with seeded comparison.",
    },
    explanation: "Current price is above the normal sale band.",
    ...overrides,
  };
}

const unknownSignals: ProductReleaseSignal[] = [];
const highConfidenceSeededSignal: ProductReleaseSignal[] = [
  {
    id: "seeded-high-gpu",
    category: "gpu",
    brand: "NVIDIA",
    productFamily: "GeForce RTX",
    currentGeneration: "Seeded current generation",
    expectedNextGeneration: "Seeded next generation",
    signalType: "seeded_demo",
    confidenceScore: 0.9,
    expectedWindowLabel: "Seeded demo high-confidence wait window",
    sourceTitle: "Seeded release source",
    sourceUrl: null,
    notes: "Seeded demo release signal for tests.",
  },
];

function build(priceTrend: ProductPriceTrend): GeneratedBuild {
  const part = (id: string, category: GeneratedBuild["parts"]["cpu"]["category"], specs: Record<string, unknown>) => ({
    id,
    category,
    brand: category === "gpu" ? "NVIDIA" : "Test",
    model: category === "gpu" ? "GeForce Test 16GB" : `${category} part`,
    normalizedName: id,
    specs,
  });
  const parts = {
    cpu: part("cpu-test", "cpu", { socket: "AM5", tdp: 65, performanceScore: 75 }),
    gpu: part("gpu-test", "gpu", { lengthMm: 280, tdp: 250, vramGb: 16, performanceScore: 95 }),
    motherboard: part("mobo-test", "motherboard", { socket: "AM5", ramType: "DDR5", m2Slots: 2 }),
    ram: part("ram-test", "ram", { ramType: "DDR5", capacityGb: 32 }),
    storage: part("storage-test", "storage", { capacityGb: 1000 }),
    psu: part("psu-test", "psu", { wattage: 750 }),
    case: part("case-test", "case", { maxGpuLengthMm: 360, airflowScore: 80 }),
    cooler: part("cooler-test", "cooler", { tdpRating: 220 }),
  };
  const offer = (productId: string) => ({
    offer: {
      id: `offer-${productId}`,
      productId,
      retailer: "Seeded",
      title: productId,
      url: `https://example.com/${productId}`,
      price: 100,
      shipping: 0,
      taxEstimate: 0,
      condition: "new" as const,
      inStock: true,
      confidenceScore: 0.95,
    },
    effectivePrice: 100,
    sellerRiskPenalty: 0,
    conditionRiskPenalty: 0,
    sellerTrustScore: 100,
    conditionScore: 100,
    stockShippingScore: 100,
    confidenceScore: 0.95,
    dealScore: 80,
    isSafeRecommendation: true,
    riskNotes: [],
  });

  return {
    id: "test-build",
    parts,
    offers: {
      cpu: offer("cpu-test"),
      gpu: offer("gpu-test"),
      motherboard: offer("mobo-test"),
      ram: offer("ram-test"),
      storage: offer("storage-test"),
      psu: offer("psu-test"),
      case: offer("case-test"),
      cooler: offer("cooler-test"),
    },
    totalPrice: 800,
    performanceScore: 88,
    compatibilityReport: { overallStatus: "PASS", passCount: 1, warningCount: 0, failCount: 0, results: [] },
    dealScore: 80,
    priceVerdict: "WAIT",
    productPriceTrends: [
      priceTrend,
      ...Object.values(parts)
        .filter((item) => item.id !== "gpu-test")
        .map((item) =>
          trend({
            productId: item.id,
            productName: item.model,
            currentPrice: 100,
            ninetyDayAverage: 120,
            lowestTrackedPrice: 90,
            usualPriceRange: [95, 115],
            typicalSaleBand: [90, 105],
            currentPricePercentile: 0.3,
            usuallyCheaper: false,
            estimatedSavingsIfWaiting: 0,
            verdict: "BUY_NOW",
          }),
        ),
    ],
    overallScore: 80,
    whySelected: "Test build",
    cheaperCompatibleSwaps: [],
  };
}

describe("timing advisor", () => {
  it("returns WAIT_FOR_PRICE_DROP for overpriced price timing", () => {
    expect(calculatePriceTiming(trend()).verdict).toBe("WAIT_FOR_PRICE_DROP");
    expect(calculateBuildTimingReport(build(trend()), unknownSignals).timingVerdict).toBe("WAIT_FOR_PRICE_DROP");
  });

  it("returns BUY_NOW for good historical price timing", () => {
    const good = calculatePriceTiming(
      trend({
        currentPrice: 520,
        ninetyDayAverage: 600,
        lowestTrackedPrice: 510,
        usualPriceRange: [540, 610],
        typicalSaleBand: [510, 545],
        currentPricePercentile: 0.12,
        usuallyCheaper: false,
        estimatedSavingsIfWaiting: 0,
        verdict: "BUY_NOW",
      }),
    );

    expect(good.verdict).toBe("BUY_NOW");
  });

  it("does not let unknown release timing force WAIT_FOR_NEW_RELEASE", () => {
    const release = calculateReleaseTiming("gpu", "NVIDIA", unknownSignals);

    expect(release.verdict).not.toBe("WAIT_FOR_NEW_RELEASE");
    expect(release.explanation).toContain("unknown");
  });

  it("allows high-confidence seeded release signal to produce WAIT_FOR_NEW_RELEASE", () => {
    const release = calculateReleaseTiming("gpu", "NVIDIA", highConfidenceSeededSignal);

    expect(release.verdict).toBe("WAIT_FOR_NEW_RELEASE");
    expect(release.explanation).toContain("seeded demo");
  });

  it("timing explanation states whether wait is price-driven or release-driven", () => {
    const report = calculateBuildTimingReport(build(trend()), unknownSignals);

    expect(report.buyNowVsWait.toLowerCase()).toContain("price-driven");
    expect(report.releaseExplanation.toLowerCase()).toContain("release signal");
  });
});
