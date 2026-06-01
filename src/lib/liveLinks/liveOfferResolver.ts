import { buildLiveLinks } from "./linkBuilder";
import { extractProductData } from "./priceExtractor";
import { classifyLivePrice, type RiskTolerance } from "./verification";
import type { LiveProduct, LiveRetailerLink, ResolvedLiveOffers } from "./types";

/**
 * Result of fetching a single retailer product page. Returning `blocked: true` (or `null`) signals
 * an anti-bot/CAPTCHA/login wall or a non-200 response — the resolver then keeps a search link.
 */
export type FetchedPage = {
  url: string;
  html: string;
  blocked?: boolean;
};

export type LivePageFetcher = (input: {
  retailerId: LiveRetailerLink["retailerId"];
  query: string;
  searchUrl: string;
}) => Promise<FetchedPage | null>;

export interface LiveOfferCache {
  get(key: string): ResolvedLiveOffers | undefined;
  set(key: string, value: ResolvedLiveOffers, ttlMs: number): void;
}

export type ResolveOptions = {
  /** Best-effort fetcher for public product pages. When omitted, only search links are produced. */
  fetcher?: LivePageFetcher;
  cache?: LiveOfferCache;
  cacheTtlMs?: number;
  riskTolerance?: RiskTolerance;
  now?: Date;
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** Simple in-memory, TTL-based cache so we never hammer a retailer for the same product. */
export class InMemoryLiveCache implements LiveOfferCache {
  private store = new Map<string, { value: ResolvedLiveOffers; expiresAt: number }>();

  get(key: string): ResolvedLiveOffers | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: ResolvedLiveOffers, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

const defaultCache = new InMemoryLiveCache();

/**
 * Resolve live offers for a single product:
 *  1. Always generate live retailer search links.
 *  2. If a fetcher is configured, best-effort fetch + parse public product pages and upgrade links
 *     to verified_live when a high-confidence price is extracted.
 *  3. Cache the result for at least 6 hours and respect blocked pages.
 */
export async function resolveLiveOffersForProduct(
  product: LiveProduct,
  options: ResolveOptions = {},
): Promise<ResolvedLiveOffers> {
  const cache = options.cache ?? defaultCache;
  const ttl = options.cacheTtlMs ?? SIX_HOURS_MS;
  const cacheKey = `live:${product.id}:${options.riskTolerance ?? "used_allowed"}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const now = options.now ?? new Date();
  const links = buildLiveLinks(product);

  if (options.fetcher) {
    for (const link of links) {
      if (link.linkType === "manufacturer") continue;
      const page = await safeFetch(options.fetcher, {
        retailerId: link.retailerId,
        query: link.queryUsed,
        searchUrl: link.searchUrl,
      });
      if (!page) continue;

      if (page.blocked) {
        link.verificationReasons = ["Live page was blocked or required a CAPTCHA/login; showing search link only."];
        continue;
      }

      const extracted = extractProductData(page.html);
      const verification = classifyLivePrice({
        target: product,
        extracted,
        productUrl: page.url,
        blocked: page.blocked,
        riskTolerance: options.riskTolerance,
      });

      link.priceStatus = verification.priceStatus;
      link.confidenceScore = verification.confidenceScore;
      link.verificationReasons = verification.verificationReasons;
      link.lastCheckedAt = now.toISOString();
      if (verification.priceStatus === "verified_live") {
        link.directProductUrl = page.url;
        link.linkType = "product";
        link.verifiedPrice = verification.verifiedPrice;
        link.shipping = verification.shipping;
        link.taxEstimate = verification.taxEstimate;
        link.effectivePrice = verification.effectivePrice;
        link.condition = verification.condition;
        link.inStock = verification.inStock;
      }
    }
  }

  const verifiedLinks = links
    .filter((link) => link.priceStatus === "verified_live" && typeof link.effectivePrice === "number")
    .sort((a, b) => (a.effectivePrice ?? Infinity) - (b.effectivePrice ?? Infinity));
  const bestVerified = verifiedLinks[0];

  const resolved: ResolvedLiveOffers = {
    productId: product.id,
    productName: `${product.brand} ${product.model}`.trim(),
    links,
    bestVerified,
    priceStatus: bestVerified ? "verified_live" : "unverified_click_to_check",
    msrp: product.msrp ?? null,
  };

  cache.set(cacheKey, resolved, ttl);
  return resolved;
}

async function safeFetch(fetcher: LivePageFetcher, input: Parameters<LivePageFetcher>[0]): Promise<FetchedPage | null> {
  try {
    return await fetcher(input);
  } catch {
    return null;
  }
}
