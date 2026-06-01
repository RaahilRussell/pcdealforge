/**
 * Live retailer data layer.
 *
 * The MVP shipped with seeded demo offers. This module defines the contract for *real* retailer
 * data: official APIs, affiliate APIs, partner feeds, and manually verified listings. Seeded demo
 * data is still allowed, but it is always labelled `seeded_demo` / `demo` and is never presented as
 * live retailer data. When a retailer has no working credentials configured it is reported as
 * unavailable instead of silently falling back to fake data.
 */

export type RetailerSourceType =
  | "official_api"
  | "affiliate_api"
  | "partner_feed"
  | "manual_verified"
  | "seeded_demo";

export type RetailerVerificationStatus =
  | "verified_live"
  | "verified_recent"
  | "stale"
  | "demo"
  | "unverified";

export type RetailerOfferCondition = "new" | "open_box" | "used" | "refurbished";

/** Product we are trying to price, used for match verification. */
export type RetailerTargetProduct = {
  id: string;
  category: string;
  brand: string;
  model: string;
  normalizedName: string;
  mpn?: string | null;
  upc?: string | null;
  /** Category-relevant specs used to reject mismatched listings (e.g. gpuVramGb, cpuModel). */
  specs?: Record<string, unknown>;
};

/** Raw, source-shaped offer returned by an adapter before normalization/verification. */
export type RawRetailerOffer = {
  sourceRetailer: string;
  sourceType: RetailerSourceType;
  sourceUrl: string;
  productUrl: string;
  title: string;
  brand?: string;
  model?: string;
  mpn?: string | null;
  upc?: string | null;
  sku?: string | null;
  price: number;
  shipping?: number;
  taxEstimate?: number;
  condition?: RetailerOfferCondition;
  inStock?: boolean | null;
  sellerName?: string | null;
  sellerRating?: number | null;
  rawSourceId: string;
  fetchedAt: Date | string;
  /** The product this raw offer was fetched for. */
  targetProductId: string;
};

export type RetailerOfferNormalized = {
  sourceRetailer: string;
  sourceType: RetailerSourceType;
  sourceUrl: string;
  productUrl: string;
  title: string;
  brand: string;
  model: string;
  mpn?: string | null;
  upc?: string | null;
  sku?: string | null;
  price: number;
  shipping: number;
  taxEstimate: number;
  condition: RetailerOfferCondition;
  inStock: boolean;
  /** Whether stock status was actually reported by the source (vs assumed). */
  stockKnown: boolean;
  sellerName?: string | null;
  sellerRating?: number | null;
  lastCheckedAt: string;
  confidenceScore: number;
  verificationStatus: RetailerVerificationStatus;
  verificationReasons: string[];
  rawSourceId: string;
  fetchedAt: string;
  /** Product this offer was matched to, and the match confidence (0-1). */
  targetProductId: string;
  matchConfidence: number;
};

export type RetailerAdapterStatus = "enabled" | "unavailable" | "disabled";

export type RetailerAdapterContext = {
  products: RetailerTargetProduct[];
  /** Honour the user's risk tolerance when an adapter chooses conditions (e.g. eBay used listings). */
  riskTolerance?: "new_only" | "open_box_allowed" | "used_allowed";
};

export type RetailerAdapterResult = {
  retailer: string;
  sourceType: RetailerSourceType;
  status: RetailerAdapterStatus;
  /** Raw offers (already matched to a target product id). Empty when unavailable/disabled. */
  offers: RawRetailerOffer[];
  /** Human-readable message, e.g. the "configure credentials" notice. */
  message?: string;
  error?: string;
};

export interface RetailerAdapter {
  readonly retailer: string;
  readonly sourceType: RetailerSourceType;
  /** True only when the adapter has the credentials/feed it needs to return live data. */
  isConfigured(): boolean;
  fetchOffers(context: RetailerAdapterContext): Promise<RetailerAdapterResult>;
}

export type RetailerRefreshResult = {
  retailersChecked: number;
  offersFetched: number;
  offersVerified: number;
  offersRejected: number;
  verifiedLiveCount: number;
  verifiedRecentCount: number;
  staleCount: number;
  demoCount: number;
  unverifiedCount: number;
  errorsByRetailer: Record<string, string>;
  adapterStatus: Array<{
    retailer: string;
    sourceType: RetailerSourceType;
    status: RetailerAdapterStatus;
    message?: string;
  }>;
  offers: RetailerOfferNormalized[];
  rejected: Array<{ retailer: string; title: string; reason: string }>;
  mode: "live" | "demo";
  lastCheckedAt: string;
  message: string;
};
