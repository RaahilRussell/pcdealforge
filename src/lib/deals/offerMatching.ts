import type { NormalizedOffer, OfferMatch, ProductForDeals } from "./types";

export function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchOfferToProduct(product: ProductForDeals, offer: NormalizedOffer): OfferMatch {
  const reasons: string[] = [];
  const productName = normalizeForMatch(`${product.brand} ${product.model}`);
  const title = normalizeForMatch(offer.title);

  if (product.upc && offer.upc && product.upc === offer.upc) {
    return { offer, method: "upc", confidence: 1, reasons: ["Exact UPC match"] };
  }

  if (product.mpn && offer.mpn && product.mpn.toLowerCase() === offer.mpn.toLowerCase()) {
    return { offer, method: "mpn", confidence: 0.97, reasons: ["Exact MPN match"] };
  }

  if (title.includes(productName) || title.includes(product.normalizedName)) {
    return {
      offer,
      method: "normalized_name",
      confidence: Math.max(0.86, offer.confidenceScore),
      reasons: ["Normalized brand and model appear in listing title"],
    };
  }

  const productTokens = new Set(productName.split(" ").filter((token) => token.length > 1));
  const titleTokens = new Set(title.split(" ").filter((token) => token.length > 1));
  const matchingTokens = [...productTokens].filter((token) => titleTokens.has(token));
  const tokenRatio = productTokens.size > 0 ? matchingTokens.length / productTokens.size : 0;

  if (tokenRatio >= 0.7) {
    reasons.push(`${matchingTokens.length} of ${productTokens.size} product tokens matched listing title`);
    return {
      offer,
      method: "title_tokens",
      confidence: Math.min(0.82, Math.max(0.45, tokenRatio * offer.confidenceScore)),
      reasons,
    };
  }

  return {
    offer,
    method: "none",
    confidence: 0,
    reasons: ["Listing title does not confidently match product identity"],
  };
}

export function matchOffersToProduct(product: ProductForDeals, offers: NormalizedOffer[]) {
  return offers
    .map((offer) => matchOfferToProduct(product, offer))
    .filter((match) => match.confidence >= 0.45)
    .sort((left, right) => right.confidence - left.confidence);
}
