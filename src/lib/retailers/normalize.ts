import { scoreProductMatch } from "./productMatch";
import { classifyVerification } from "./verification";
import type {
  RawRetailerOffer,
  RetailerOfferCondition,
  RetailerOfferNormalized,
  RetailerTargetProduct,
} from "./types";

/**
 * Normalize a raw adapter offer into the canonical {@link RetailerOfferNormalized} shape,
 * scoring the product match and computing a verification status. This is the single place where
 * source-specific shapes are folded into app-wide offer data.
 */
export function normalizeRetailerOffer(
  raw: RawRetailerOffer,
  target: RetailerTargetProduct,
  now: Date = new Date(),
): RetailerOfferNormalized {
  const match = scoreProductMatch(target, raw);
  const stockKnown = typeof raw.inStock === "boolean";
  const inStock = raw.inStock ?? false;
  const condition = normalizeCondition(raw.condition);

  const verification = classifyVerification({
    sourceType: raw.sourceType,
    fetchedAt: raw.fetchedAt,
    matchConfidence: match.score,
    productUrl: raw.productUrl,
    price: raw.price,
    stockKnown,
    now,
  });

  // Confidence blends product-match strength with the verification outcome and stock knowledge.
  const confidenceScore = computeConfidence(match.score, verification.status, stockKnown, raw.sourceType);

  const reasons = [...match.reasons, ...verification.reasons];
  if (match.rejected) {
    reasons.unshift("Product match rejected — listing does not match the target product");
  }

  return {
    sourceRetailer: raw.sourceRetailer,
    sourceType: raw.sourceType,
    sourceUrl: raw.sourceUrl,
    productUrl: raw.productUrl,
    title: raw.title,
    brand: raw.brand ?? target.brand,
    model: raw.model ?? target.model,
    mpn: raw.mpn ?? target.mpn ?? null,
    upc: raw.upc ?? target.upc ?? null,
    sku: raw.sku ?? null,
    price: round(raw.price),
    shipping: round(raw.shipping ?? 0),
    taxEstimate: round(raw.taxEstimate ?? estimateTax(raw.price)),
    condition,
    inStock,
    stockKnown,
    sellerName: raw.sellerName ?? null,
    sellerRating: raw.sellerRating ?? null,
    lastCheckedAt: new Date(raw.fetchedAt).toISOString(),
    confidenceScore,
    verificationStatus: match.rejected ? "unverified" : verification.status,
    verificationReasons: reasons,
    rawSourceId: raw.rawSourceId,
    fetchedAt: new Date(raw.fetchedAt).toISOString(),
    targetProductId: target.id,
    matchConfidence: round2(match.score),
  };
}

function computeConfidence(
  matchScore: number,
  status: string,
  stockKnown: boolean,
  sourceType: string,
): number {
  if (sourceType === "seeded_demo") return round2(Math.min(0.85, 0.6 + matchScore * 0.25));
  let base = matchScore;
  if (status === "verified_live") base = Math.max(base, 0.9);
  else if (status === "verified_recent") base = Math.max(base, 0.82);
  else if (status === "stale") base = Math.min(base, 0.7);
  else if (status === "unverified") base = Math.min(base, 0.6);
  if (!stockKnown) base -= 0.05;
  return round2(Math.max(0, Math.min(0.99, base)));
}

function normalizeCondition(condition?: RetailerOfferCondition): RetailerOfferCondition {
  if (condition === "open_box" || condition === "used" || condition === "refurbished") return condition;
  return "new";
}

function estimateTax(price: number) {
  return Math.round(price * 0.08 * 100) / 100;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
