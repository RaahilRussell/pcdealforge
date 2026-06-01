/**
 * Live Link Mode.
 *
 * Instead of presenting seeded demo prices as real retailer deals, the app generates real, clickable
 * live retailer search/buy links for every part and only marks a price "verified" when it actually
 * fetched and parsed a live public page (no API key, no CAPTCHA bypass). When a price cannot be
 * verified the link is still provided with a clear "click to verify" status.
 */

export type RetailerId =
  | "amazon"
  | "bestbuy"
  | "newegg"
  | "walmart"
  | "bhphoto"
  | "microcenter"
  | "ebay"
  | "adorama"
  | "manufacturer";

export type LivePriceStatus = "verified_live" | "unverified_click_to_check" | "unavailable" | "stale";

export type LiveCondition = "new" | "open_box" | "used" | "refurbished" | "unknown";

export type LiveRetailerLink = {
  retailerId: RetailerId;
  retailerName: string;
  searchUrl: string;
  directProductUrl?: string;
  queryUsed: string;
  linkType: "search" | "product" | "manufacturer";
  priceStatus: LivePriceStatus;
  verifiedPrice?: number;
  shipping?: number;
  taxEstimate?: number;
  effectivePrice?: number;
  condition?: LiveCondition;
  inStock?: boolean;
  lastCheckedAt?: string;
  confidenceScore: number;
  verificationReasons: string[];
};

/** Product we are generating live links / verifying prices for. */
export type LiveProduct = {
  id: string;
  category: string;
  brand: string;
  model: string;
  normalizedName: string;
  mpn?: string | null;
  upc?: string | null;
  /** Catalog/MSRP estimate used only as a clearly-labelled fallback total. Never shown as a live price. */
  msrp?: number | null;
  specs?: Record<string, unknown>;
};

export type ResolvedLiveOffers = {
  productId: string;
  productName: string;
  links: LiveRetailerLink[];
  /** Best verified-live link, if any price was actually extracted from a live page. */
  bestVerified?: LiveRetailerLink;
  /** Overall coverage status for this single product. */
  priceStatus: LivePriceStatus;
  msrp?: number | null;
};

export type LiveBuildTotalStatus = "verified" | "partial" | "estimated" | "unknown";

export type LiveBuildTotal = {
  status: LiveBuildTotalStatus;
  /** Sum of verified-live effective prices across parts that have them. */
  verifiedTotal: number;
  /** Best available total: verified where possible, MSRP estimate elsewhere. */
  estimatedTotal: number;
  verifiedPartCount: number;
  clickToVerifyCount: number;
  missingPriceCount: number;
  totalParts: number;
  label: string;
};

export type LiveBuildVerdictValue =
  | "BUY_NOW"
  | "WAIT"
  | "AVOID"
  | "VERIFY_PRICES"
  | "INSUFFICIENT_HISTORY";

export type LiveBuildVerdict = {
  verdict: LiveBuildVerdictValue;
  summary: string;
  reasons: string[];
  total: LiveBuildTotal;
  /** True when there is enough verified live 30-day history to make a real timing claim. */
  hasLiveHistory: boolean;
};
