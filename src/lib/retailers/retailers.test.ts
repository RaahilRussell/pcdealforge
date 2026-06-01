import { describe, expect, it } from "vitest";

import type { NormalizedOffer } from "../deals/types";
import { getRetailerConfig } from "./config";
import { runRetailerRefresh } from "./refresh";
import { scoreProductMatch } from "./productMatch";
import { classifyVerification } from "./verification";
import type { ManualVerifiedEntry } from "./adapters/manual";
import type { RetailerTargetProduct } from "./types";

const NOW = new Date("2026-06-01T12:00:00Z");

function gpuTarget(overrides: Partial<RetailerTargetProduct> = {}): RetailerTargetProduct {
  return {
    id: "gpu-5070",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 5070",
    normalizedName: "nvidia geforce rtx 5070",
    mpn: "RTX5070-12G",
    upc: "0123456789012",
    specs: { gpuVramGb: 12, gpuChipset: "rtx 5070" },
    ...overrides,
  };
}

function seededOffer(): NormalizedOffer {
  return {
    id: "seed-1",
    productId: "gpu-5070",
    retailer: "Seeded Retailer",
    title: "NVIDIA GeForce RTX 5070 12GB",
    url: "https://example.com/rtx-5070",
    price: 549,
    shipping: 0,
    taxEstimate: 40,
    condition: "new",
    inStock: true,
    confidenceScore: 0.9,
    lastCheckedAt: NOW,
  };
}

describe("classifyVerification", () => {
  it("returns verified_live for a fresh, high-confidence official offer", () => {
    const result = classifyVerification({
      sourceType: "official_api",
      fetchedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      matchConfidence: 0.9,
      productUrl: "https://bestbuy.com/x",
      price: 549,
      stockKnown: true,
      now: NOW,
    });
    expect(result.status).toBe("verified_live");
  });

  it("does not treat offers older than 24h as verified live", () => {
    const result = classifyVerification({
      sourceType: "official_api",
      fetchedAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000),
      matchConfidence: 0.95,
      productUrl: "https://bestbuy.com/x",
      price: 549,
      stockKnown: true,
      now: NOW,
    });
    expect(result.status).toBe("stale");
  });

  it("requires confidence >= 0.85 for verified_live", () => {
    const result = classifyVerification({
      sourceType: "official_api",
      fetchedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      matchConfidence: 0.82,
      productUrl: "https://bestbuy.com/x",
      price: 549,
      stockKnown: true,
      now: NOW,
    });
    expect(result.status).toBe("verified_recent");
  });

  it("labels seeded data as demo", () => {
    const result = classifyVerification({
      sourceType: "seeded_demo",
      fetchedAt: NOW,
      matchConfidence: 0.9,
      productUrl: "https://example.com/x",
      price: 549,
      stockKnown: true,
      now: NOW,
    });
    expect(result.status).toBe("demo");
  });
});

describe("scoreProductMatch", () => {
  it("matches on UPC", () => {
    const result = scoreProductMatch(gpuTarget(), {
      title: "NVIDIA GeForce RTX 5070 12GB",
      brand: "NVIDIA",
      model: "RTX 5070",
      mpn: null,
      upc: "0123456789012",
      sku: null,
      sourceRetailer: "Best Buy",
    });
    expect(result.reasons).toContain("UPC matched");
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.rejected).toBe(false);
  });

  it("rejects a listing for a different GPU model", () => {
    const result = scoreProductMatch(gpuTarget(), {
      // Same 12GB VRAM as the target so the chipset-model conflict is what triggers the rejection.
      title: "NVIDIA GeForce RTX 5060 12GB",
      brand: "NVIDIA",
      model: "RTX 5060",
      mpn: null,
      upc: null,
      sku: null,
      sourceRetailer: "eBay",
    });
    expect(result.rejected).toBe(true);
    expect(result.reasons.join(" ")).toContain("5060");
  });
});

describe("runRetailerRefresh", () => {
  const products = [gpuTarget()];

  it("labels seeded offers as demo in demo mode", async () => {
    const config = getRetailerConfig({});
    const summary = await runRetailerRefresh({
      products,
      config,
      seededOffers: [seededOffer()],
      now: NOW,
    });

    expect(summary.mode).toBe("demo");
    expect(summary.demoCount).toBe(1);
    expect(summary.verifiedLiveCount).toBe(0);
    expect(summary.offers[0].verificationStatus).toBe("demo");
    expect(summary.message).toContain("Demo mode");
  });

  it("returns the no-adapters message and no demo offers in live mode without credentials", async () => {
    const config = getRetailerConfig({ LIVE_RETAILER_MODE: "true", DEMO_MODE: "false" });
    const summary = await runRetailerRefresh({
      products,
      config,
      seededOffers: [seededOffer()],
      now: NOW,
    });

    expect(summary.mode).toBe("live");
    expect(summary.message).toContain("No live retailer adapters are configured");
    // Seeded demo offers must NOT leak into a live refresh without explicit fallback.
    expect(summary.offers.some((offer) => offer.sourceType === "seeded_demo")).toBe(false);
  });

  it("verifies a fresh manual entry as live without recommending demo data", async () => {
    const config = getRetailerConfig({ LIVE_RETAILER_MODE: "true", DEMO_MODE: "false" });
    const manualEntries: ManualVerifiedEntry[] = [
      {
        productId: "gpu-5070",
        retailer: "Verified Store",
        productUrl: "https://verifiedstore.com/rtx-5070",
        title: "NVIDIA GeForce RTX 5070 12GB",
        price: 559,
        capturedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        confidence: 0.95,
        upc: "0123456789012",
        inStock: true,
      },
    ];
    const summary = await runRetailerRefresh({
      products,
      config,
      seededOffers: [seededOffer()],
      manualEntries,
      now: NOW,
    });

    expect(summary.verifiedLiveCount).toBe(1);
    expect(summary.offers.some((offer) => offer.sourceType === "seeded_demo")).toBe(false);
  });
});
