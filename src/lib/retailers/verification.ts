import type { RetailerSourceType, RetailerVerificationStatus } from "./types";

/**
 * Verification rules — decide how much to trust a normalized offer.
 *
 * verified_live: configured official/affiliate/partner adapter, fetched < 6h ago,
 *   match confidence >= 0.85, valid product URL, valid price, stock status known.
 * verified_recent: fetched < 24h ago, match confidence >= 0.8.
 * stale: older than 24h.
 * demo: seeded data.
 * unverified: low confidence or missing required fields.
 *
 * Only verified_live or verified_recent offers are eligible for top recommendations in live mode.
 */

export type VerificationInput = {
  sourceType: RetailerSourceType;
  fetchedAt: Date | string;
  matchConfidence: number;
  productUrl?: string | null;
  price?: number | null;
  stockKnown: boolean;
  now?: Date;
};

export type VerificationResult = {
  status: RetailerVerificationStatus;
  reasons: string[];
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function classifyVerification(input: VerificationInput): VerificationResult {
  const reasons: string[] = [];

  if (input.sourceType === "seeded_demo") {
    return { status: "demo", reasons: ["Seeded demo data — not a live retailer price"] };
  }

  const now = input.now ?? new Date();
  const fetched = new Date(input.fetchedAt).getTime();
  const ageMs = now.getTime() - fetched;
  const hasValidUrl = isValidHttpUrl(input.productUrl);
  const hasValidPrice = typeof input.price === "number" && Number.isFinite(input.price) && input.price > 0;

  if (!hasValidUrl) reasons.push("Missing or invalid product URL");
  if (!hasValidPrice) reasons.push("Missing or invalid price");

  if (!hasValidUrl || !hasValidPrice) {
    return { status: "unverified", reasons };
  }

  if (ageMs > TWENTY_FOUR_HOURS_MS) {
    reasons.push("Last checked more than 24 hours ago");
    return { status: "stale", reasons };
  }

  const fromLiveAdapter =
    input.sourceType === "official_api" ||
    input.sourceType === "affiliate_api" ||
    input.sourceType === "partner_feed" ||
    input.sourceType === "manual_verified";

  if (
    fromLiveAdapter &&
    ageMs <= SIX_HOURS_MS &&
    input.matchConfidence >= 0.85 &&
    input.stockKnown
  ) {
    reasons.push("Fetched within 6h from a configured adapter with a high-confidence product match");
    return { status: "verified_live", reasons };
  }

  if (ageMs <= TWENTY_FOUR_HOURS_MS && input.matchConfidence >= 0.8) {
    reasons.push("Fetched within 24h with a confident product match");
    return { status: "verified_recent", reasons };
  }

  reasons.push(`Product match confidence ${Math.round(input.matchConfidence * 100)}% is below the verification floor`);
  return { status: "unverified", reasons };
}

/** Offers eligible to drive top recommendations in live mode. */
export function isRecommendableLive(status: RetailerVerificationStatus): boolean {
  return status === "verified_live" || status === "verified_recent";
}

export function verificationLabel(status: RetailerVerificationStatus): string {
  switch (status) {
    case "verified_live":
      return "Verified live";
    case "verified_recent":
      return "Verified recent";
    case "stale":
      return "Stale";
    case "demo":
      return "Demo";
    case "unverified":
      return "Unverified";
  }
}

function isValidHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
