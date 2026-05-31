import { describe, expect, it } from "vitest";

import { getBestSafeOffer, rankOffers } from "./scoring";
import type { NormalizedOffer } from "./types";

const trustedNewOffer: NormalizedOffer = {
  id: "new",
  retailer: "Best Buy",
  title: "AMD Ryzen 7 7800X3D",
  url: "https://example.com/new",
  price: 349,
  shipping: 0,
  taxEstimate: 23,
  condition: "new",
  sellerName: "Best Buy",
  sellerRating: 4.8,
  inStock: true,
  confidenceScore: 0.96,
};

const suspiciousUsedOffer: NormalizedOffer = {
  id: "used-risky",
  retailer: "eBay",
  title: "7800X3D used no box untested",
  url: "https://example.com/used",
  price: 229,
  shipping: 14,
  taxEstimate: 15,
  condition: "used",
  sellerName: "parts-bin-direct",
  sellerRating: 3.5,
  inStock: true,
  confidenceScore: 0.48,
};

describe("deal scoring", () => {
  it("keeps suspicious used listings out of the top safe recommendation", () => {
    const stats = { ninetyDayAverage: 380, historicalLow: 329 };
    const ranked = rankOffers([suspiciousUsedOffer, trustedNewOffer], stats, "used_allowed");
    const bestSafe = getBestSafeOffer([suspiciousUsedOffer, trustedNewOffer], stats, "used_allowed");

    expect(ranked[0]?.offer.id).toBe("new");
    expect(bestSafe?.offer.id).toBe("new");
    expect(ranked.find((offer) => offer.offer.id === "used-risky")?.isSafeRecommendation).toBe(false);
  });
});
