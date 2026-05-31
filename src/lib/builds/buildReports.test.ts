import { beforeAll, describe, expect, it } from "vitest";

import type { EnhancedBuildResult } from "./reporting";
import { generateSourceBackedBuilds } from "./reporting";

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
    expect(essay?.positives).toBeTruthy();
    expect(essay?.negatives).toBeTruthy();
    expect(essay?.compatibilityReasoning).toBeTruthy();
    expect(essay?.dealReasoning).toBeTruthy();
    expect(essay?.whoShouldBuy).toBeTruthy();
    expect(essay?.whoShouldAvoid).toBeTruthy();
    expect(essay?.suggestedSwaps).toBeTruthy();
    expect(essay?.finalVerdict).toBeTruthy();
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
