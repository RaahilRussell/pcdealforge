import { beforeAll, describe, expect, it } from "vitest";

import type { EnhancedBuildResult } from "./reporting";
import { generateSourceBackedBuilds } from "./reporting";
import { buildCategories, calculateCostBreakdown, getBuildReport } from "./reportDetails";
import { getEvidenceDetail, getOffer, getPrebuiltSystem, getProduct, listPrebuiltSystems } from "@/lib/data/catalog";

let result: EnhancedBuildResult;

beforeAll(async () => {
  result = await generateSourceBackedBuilds({
    budget: 1500,
    useCase: "gaming",
    resolution: "1440p",
    gpuPreference: "any",
    ramGb: 32,
    storageGb: 1000,
    wifiRequired: true,
    riskTolerance: "open_box_allowed",
  });
}, 30_000);

describe("build essays", () => {
  it("returns every essay section for a recommended build", () => {
    const essay = result.bestOverall?.essay;

    expect(essay).toBeTruthy();
    expect(essay?.executiveSummary).toBeTruthy();
    expect(essay?.whyThisBuildExists).toBeTruthy();
    expect(essay?.performanceExpectations).toBeTruthy();
    expect(essay?.positives).toBeTruthy();
    expect(essay?.negatives).toBeTruthy();
    expect(essay?.compatibilityReasoning).toBeTruthy();
    expect(essay?.dealReasoning).toBeTruthy();
    expect(essay?.partByPartJustification).toBeTruthy();
    expect(essay?.bestUpgradePath).toBeTruthy();
    expect(essay?.whoShouldBuy).toBeTruthy();
    expect(essay?.whoShouldAvoid).toBeTruthy();
    expect(essay?.suggestedSwaps).toBeTruthy();
    expect(essay?.finalVerdict).toBeTruthy();
    expect(essay?.finalRecommendation).toBeTruthy();
  });

  it("mentions positives and negatives without claiming live pricing", () => {
    const essay = result.bestOverall!.essay;
    const fullText = Object.values(essay).join(" ").toLowerCase();

    expect(essay.positives.toLowerCase()).toContain("major positives");
    expect(essay.negatives.toLowerCase()).toContain("major negatives");
    expect(fullText).toContain("seeded demo data");
    expect(fullText).not.toContain("live pricing");
  });

  it("matches final verdict text to the build price verdict and includes citations", () => {
    const build = result.bestOverall!;
    const finalVerdict = build.essay.finalVerdict;

    if (build.priceVerdict === "BUY_NOW") expect(finalVerdict).toContain("Buy now");
    if (build.priceVerdict === "WAIT") expect(finalVerdict).toContain("Wait for price drop");
    if (build.priceVerdict === "AVOID") expect(finalVerdict).toContain("Only buy if you need it immediately");
    expect(build.essay.citations.length).toBeGreaterThan(0);
    expect(finalVerdict).toContain("[");
  });
});

describe("clickable build reports", () => {
  it("persists generated builds with stable report ids", async () => {
    const build = result.bestOverall!;
    const report = await getBuildReport(build.id);

    expect(build.id).toMatch(/^build-best_overall-/);
    expect(report?.saved.id).toBe(build.id);
    expect(report?.saved.parts.cpu).toBeTruthy();
    expect(report?.saved.offers.gpu).toBeTruthy();
  });

  it("cost breakdown total equals the sum of effective prices", () => {
    const build = result.bestOverall!;
    const breakdown = calculateCostBreakdown(build);
    const sum = breakdown.rows.reduce((total, row) => total + row.effectivePrice, 0);

    expect(breakdown.rows).toHaveLength(buildCategories.length);
    expect(Math.round(sum * 100) / 100).toBe(breakdown.effectiveTotal);
    expect(Math.round(build.totalPrice * 100) / 100).toBe(breakdown.effectiveTotal);
  });

  it("shopping list has selected offers, buy/view routes, and demo labels", async () => {
    const report = await getBuildReport(result.bestOverall!.id);

    expect(report?.shoppingList.rows).toHaveLength(buildCategories.length);
    expect(report?.shoppingList.finalEffectiveTotal).toBe(report?.costBreakdown.effectiveTotal);
    expect(report?.shoppingList.rows.every((row) => row.offerId && row.href)).toBe(true);
    expect(report?.shoppingList.rows.every((row) => row.isDemoOffer && row.actionLabel === "View Demo Offer")).toBe(true);
  });

  it("each part row has product and selected offer records", async () => {
    const build = result.bestOverall!;

    for (const category of buildCategories) {
      const product = await getProduct(build.parts[category].id);
      const offer = await getOffer(build.offers[category].offer.id);

      expect(product, category).toBeTruthy();
      expect(offer, category).toBeTruthy();
    }
  });

  it("full report includes part explanations and exact compatibility values", async () => {
    const report = await getBuildReport(result.bestOverall!.id);

    expect(report).toBeTruthy();
    for (const category of buildCategories) {
      expect(report!.partExplanations[category].shortReason).toBeTruthy();
      expect(report!.partExplanations[category].detailedReason).toBeTruthy();
    }

    expect(report!.compatibilityDeepDive.every((row) => row.checkedValues.length > 0)).toBe(true);
    expect(report!.compatibilityDeepDive.find((row) => row.id === "psu-wattage-headroom")?.checkedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "CPU TDP" }),
        expect.objectContaining({ label: "GPU TDP" }),
        expect.objectContaining({ label: "Selected PSU" }),
      ]),
    );
  });

  it("evidence and prebuilt detail records resolve for clickable pages", async () => {
    const build = result.bestOverall!;
    const citationWithId = build.evidence.find((citation) => citation.evidenceId);
    expect(citationWithId?.evidenceId).toBeTruthy();

    const evidence = await getEvidenceDetail(citationWithId!.evidenceId!);
    const prebuilt = await getPrebuiltSystem("prebuilt-cyberpower-ryzen-7600-rx-7800xt");

    expect(evidence).toBeTruthy();
    expect(prebuilt).toBeTruthy();
  });

  it("returns expanded recommendation categories", () => {
    const categories = result.recommendationCategories ?? [];

    expect(categories.find((category) => category.categoryId === "best_for_gaming")).toBeTruthy();
    expect(categories.find((category) => category.categoryId === "best_for_ai_local_llms")).toBeTruthy();
    expect(categories.find((category) => category.categoryId === "best_upgrade_path")).toBeTruthy();
    expect(categories.find((category) => category.categoryId === "best_buy_now")).toBeTruthy();
    expect(categories.find((category) => category.categoryId === "best_wait_for_price_drop")).toBeTruthy();
    expect(categories.find((category) => category.categoryId === "best_prebuilt_alternative")?.prebuiltId).toBeTruthy();
  });

  it("seeded prebuilts expose demo and hidden-risk fields", async () => {
    const prebuilts = await listPrebuiltSystems();

    expect(prebuilts.length).toBeGreaterThan(0);
    expect(prebuilts.every((prebuilt) => prebuilt.isDemoPrebuilt)).toBe(true);
    expect(prebuilts.some((prebuilt) => prebuilt.hiddenRiskScore > 0)).toBe(true);
  });
});

describe("build comparison", () => {
  it("includes all three builds and explains tradeoffs", () => {
    expect(result.bestOverall).toBeTruthy();
    expect(result.cheapestSafe).toBeTruthy();
    expect(result.bestPerformancePerDollar).toBeTruthy();
    expect(result.comparison?.bestOverallVsCheapestSafe).toContain("costs");
    expect(result.comparison?.bestOverallVsBestPerformancePerDollar).toContain("performance-per-dollar");
    expect(result.comparison?.cheapestSafeVsBestPerformancePerDollar).toContain("performance");
  });

  it("includes citations", () => {
    expect(result.comparison?.citations.length).toBeGreaterThan(0);
    expect(result.comparison?.quickRecommendation).toContain("[");
  });
});
