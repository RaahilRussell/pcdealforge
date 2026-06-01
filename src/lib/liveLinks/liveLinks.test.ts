import { describe, expect, it } from "vitest";

import { buildLiveShopping } from "./buildLiveShopping";
import { computeLiveBuildTotal, computeLiveBuildVerdict } from "./buildLiveTotal";
import { buildLiveLinks, buildQuery } from "./linkBuilder";
import { resolveLiveOffersForProduct, InMemoryLiveCache, type LivePageFetcher } from "./liveOfferResolver";
import { extractProductData } from "./priceExtractor";
import { scoreLiveMatch } from "./productMatch";
import { classifyLivePrice } from "./verification";
import type { LiveProduct, ResolvedLiveOffers } from "./types";

function gpu(overrides: Partial<LiveProduct> = {}): LiveProduct {
  return {
    id: "gpu-5070",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 5070",
    normalizedName: "nvidia geforce rtx 5070",
    mpn: "RTX5070-12G",
    upc: "0123456789012",
    msrp: 549,
    specs: { gpuVramGb: 12 },
    ...overrides,
  };
}

function productPageHtml(title: string, price: string, availability = "InStock", condition = "NewCondition"): string {
  return `<!doctype html><html><head><title>${title}</title>
  <script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: title,
    offers: { "@type": "Offer", price, priceCurrency: "USD", availability: `https://schema.org/${availability}`, itemCondition: `https://schema.org/${condition}` },
  })}</script></head><body>${title}</body></html>`;
}

describe("buildLiveLinks", () => {
  it("generates a search link for every supported retailer", () => {
    const links = buildLiveLinks(gpu());
    const ids = links.map((link) => link.retailerId);
    for (const expected of ["amazon", "bestbuy", "newegg", "walmart", "bhphoto", "microcenter", "ebay", "adorama"]) {
      expect(ids).toContain(expected);
    }
  });

  it("encodes the MPN-based query into every search URL", () => {
    const links = buildLiveLinks(gpu());
    const encoded = encodeURIComponent("NVIDIA RTX5070-12G");
    for (const link of links.filter((l) => l.linkType === "search")) {
      expect(link.searchUrl).toContain(encoded);
      expect(link.priceStatus).toBe("unverified_click_to_check");
    }
  });

  it("prefers MPN, then UPC, then brand/model for the query", () => {
    expect(buildQuery(gpu()).basis).toBe("mpn");
    expect(buildQuery(gpu({ mpn: null })).basis).toBe("upc");
    expect(buildQuery(gpu({ mpn: null, upc: null })).basis).toBe("brand_model");
  });
});

describe("scoreLiveMatch", () => {
  it("verifies an exact UPC/title match", () => {
    const result = scoreLiveMatch(gpu(), { title: "NVIDIA GeForce RTX 5070 12GB", upc: "0123456789012" });
    expect(result.tier).toBe("verified");
    expect(result.rejected).toBe(false);
  });

  it("rejects RTX 5070 vs RTX 5070 Ti", () => {
    const result = scoreLiveMatch(gpu(), { title: "NVIDIA GeForce RTX 5070 Ti 16GB" });
    expect(result.rejected).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/5070 TI/i);
  });

  it("rejects 14600K vs 14600KF", () => {
    const cpu: LiveProduct = {
      id: "cpu",
      category: "cpu",
      brand: "Intel",
      model: "Core i5-14600K",
      normalizedName: "intel core i5 14600k",
    };
    const result = scoreLiveMatch(cpu, { title: "Intel Core i5-14600KF Processor" });
    expect(result.rejected).toBe(true);
  });

  it("rejects a RAM capacity mismatch", () => {
    const ram: LiveProduct = {
      id: "ram",
      category: "ram",
      brand: "G.Skill",
      model: "Trident Z5 32GB DDR5",
      normalizedName: "g skill trident z5 32gb ddr5",
      specs: { capacityGb: 32, ramType: "DDR5" },
    };
    const result = scoreLiveMatch(ram, { title: "G.Skill Trident Z5 16GB DDR5-6000" });
    expect(result.rejected).toBe(true);
  });
});

describe("extractProductData", () => {
  it("parses a JSON-LD Product/Offer price", () => {
    const extracted = extractProductData(productPageHtml("NVIDIA GeForce RTX 5070 12GB", "549.99"));
    expect(extracted.price).toBe(549.99);
    expect(extracted.inStock).toBe(true);
    expect(extracted.source).toBe("json_ld");
  });

  it("rejects financing/monthly meta prices", () => {
    const html = `<html><head><meta property="og:title" content="GPU"><meta property="product:price:amount" content="45.99"></head><body>$45.99/mo for 12 months</body></html>`;
    const extracted = extractProductData(html);
    expect(extracted.price).toBeUndefined();
  });
});

describe("classifyLivePrice", () => {
  const productUrl = "https://www.bestbuy.com/site/nvidia-rtx-5070/123.p";

  it("verifies a matching JSON-LD price on a real product page", () => {
    const extracted = extractProductData(productPageHtml("NVIDIA GeForce RTX 5070 12GB", "549.99"));
    const result = classifyLivePrice({ target: gpu(), extracted, productUrl });
    expect(result.priceStatus).toBe("verified_live");
    expect(result.verifiedPrice).toBe(549.99);
  });

  it("does not verify a mismatched GPU title", () => {
    const extracted = extractProductData(productPageHtml("NVIDIA GeForce RTX 5070 Ti 16GB", "749.99"));
    const result = classifyLivePrice({ target: gpu(), extracted, productUrl });
    expect(result.priceStatus).toBe("unverified_click_to_check");
  });

  it("does not verify a price on a search page URL", () => {
    const extracted = extractProductData(productPageHtml("NVIDIA GeForce RTX 5070 12GB", "549.99"));
    const result = classifyLivePrice({
      target: gpu(),
      extracted,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=rtx+5070",
    });
    expect(result.priceStatus).toBe("unverified_click_to_check");
  });

  it("returns unverified when the page was blocked", () => {
    const result = classifyLivePrice({ target: gpu(), extracted: { source: "none" }, productUrl, blocked: true });
    expect(result.priceStatus).toBe("unverified_click_to_check");
  });
});

describe("resolveLiveOffersForProduct", () => {
  it("returns only click-to-verify search links when no fetcher is configured", async () => {
    const resolved = await resolveLiveOffersForProduct(gpu(), { cache: new InMemoryLiveCache() });
    expect(resolved.bestVerified).toBeUndefined();
    expect(resolved.priceStatus).toBe("unverified_click_to_check");
    expect(resolved.links.every((link) => link.priceStatus !== "verified_live")).toBe(true);
  });

  it("upgrades a link to verified_live when a fetcher returns a matching product page", async () => {
    const fetcher: LivePageFetcher = async ({ retailerId }) =>
      retailerId === "bestbuy"
        ? { url: "https://www.bestbuy.com/site/nvidia-rtx-5070/123.p", html: productPageHtml("NVIDIA GeForce RTX 5070 12GB", "529.99") }
        : { url: "https://example.com/blocked", html: "", blocked: true };

    const resolved = await resolveLiveOffersForProduct(gpu(), { fetcher, cache: new InMemoryLiveCache() });
    expect(resolved.priceStatus).toBe("verified_live");
    expect(resolved.bestVerified?.verifiedPrice).toBe(529.99);
    expect(resolved.bestVerified?.directProductUrl).toContain("bestbuy.com");
  });
});

describe("computeLiveBuildTotal", () => {
  function part(id: string, verifiedPrice?: number, msrp?: number): ResolvedLiveOffers {
    return {
      productId: id,
      productName: id,
      links: [],
      bestVerified: verifiedPrice ? ({ effectivePrice: verifiedPrice } as ResolvedLiveOffers["bestVerified"]) : undefined,
      priceStatus: verifiedPrice ? "verified_live" : "unverified_click_to_check",
      msrp: msrp ?? null,
    };
  }

  it("reports verified only when every part has a verified price", () => {
    const total = computeLiveBuildTotal([part("a", 100), part("b", 200)]);
    expect(total.status).toBe("verified");
    expect(total.verifiedTotal).toBe(300);
  });

  it("reports partial when some parts are missing verified prices", () => {
    const total = computeLiveBuildTotal([part("a", 100), part("b", undefined, 200)]);
    expect(total.status).toBe("partial");
    expect(total.verifiedPartCount).toBe(1);
    expect(total.clickToVerifyCount).toBe(1);
    expect(total.label).toContain("Partial live total");
  });

  it("reports estimated when no prices are verified but all have MSRP", () => {
    const total = computeLiveBuildTotal([part("a", undefined, 100), part("b", undefined, 200)]);
    expect(total.status).toBe("estimated");
    expect(total.estimatedTotal).toBe(300);
  });

  it("reports unknown when parts have no price at all", () => {
    const total = computeLiveBuildTotal([part("a"), part("b")]);
    expect(total.status).toBe("unknown");
  });
});

describe("buildLiveShopping", () => {
  it("gives every selected part live links and a click-to-verify status, with no seeded prices", () => {
    const shopping = buildLiveShopping([
      { category: "gpu", product: gpu() },
      { category: "cpu", product: { id: "cpu", category: "cpu", brand: "AMD", model: "Ryzen 7 7800X3D", normalizedName: "amd ryzen 7 7800x3d", msrp: 360 } },
    ]);

    expect(shopping.rows).toHaveLength(2);
    for (const row of shopping.rows) {
      expect(row.resolved.links.length).toBeGreaterThanOrEqual(8);
      expect(row.resolved.bestVerified).toBeUndefined();
      expect(row.resolved.priceStatus).toBe("unverified_click_to_check");
    }
    expect(shopping.total.status).toBe("estimated");
    expect(shopping.verdict.verdict).toBe("VERIFY_PRICES");
  });
});

describe("computeLiveBuildVerdict", () => {
  it("returns VERIFY_PRICES (not AVOID) when there is no live history", () => {
    const total = computeLiveBuildTotal([
      { productId: "a", productName: "a", links: [], priceStatus: "unverified_click_to_check", msrp: 100 },
    ]);
    const verdict = computeLiveBuildVerdict({ total, hasLiveHistory: false });
    expect(verdict.verdict).toBe("VERIFY_PRICES");
    expect(verdict.verdict).not.toBe("AVOID");
    expect(verdict.summary).toContain("VERIFY PRICES");
  });

  it("returns INSUFFICIENT_HISTORY when there is no price data at all", () => {
    const total = computeLiveBuildTotal([
      { productId: "a", productName: "a", links: [], priceStatus: "unverified_click_to_check", msrp: null },
    ]);
    const verdict = computeLiveBuildVerdict({ total, hasLiveHistory: false });
    expect(verdict.verdict).toBe("INSUFFICIENT_HISTORY");
  });
});
