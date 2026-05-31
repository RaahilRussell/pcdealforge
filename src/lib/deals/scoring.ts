import type { DealPriceStats, NormalizedOffer, RiskTolerance, ScoredOffer } from "./types";

export function sellerRiskPenalty(offer: NormalizedOffer) {
  const rating = offer.sellerRating;
  if (!offer.inStock) return 999;
  if (rating === undefined || rating === null) return 8;
  if (rating >= 4.7) return 0;
  if (rating >= 4.3) return 4;
  if (rating >= 4.0) return 10;
  if (rating >= 3.5) return 25;
  return 60;
}

export function conditionRiskPenalty(offer: NormalizedOffer) {
  switch (offer.condition) {
    case "new":
      return 0;
    case "open_box":
      return Math.max(10, offer.price * 0.04);
    case "refurbished":
      return Math.max(22, offer.price * 0.08);
    case "used":
      return Math.max(34, offer.price * 0.12);
  }
}

export function calculateEffectivePrice(offer: NormalizedOffer) {
  return roundMoney(
    offer.price +
      offer.shipping +
      offer.taxEstimate +
      sellerRiskPenalty(offer) +
      conditionRiskPenalty(offer),
  );
}

export function filterOffersByRiskTolerance(offers: NormalizedOffer[], riskTolerance: RiskTolerance) {
  return offers.filter((offer) => {
    if (!offer.inStock) return false;
    if (riskTolerance === "new_only") return offer.condition === "new";
    if (riskTolerance === "open_box_allowed") return offer.condition === "new" || offer.condition === "open_box";
    return true;
  });
}

export function isSafeRecommendation(offer: NormalizedOffer, riskTolerance: RiskTolerance) {
  if (!offer.inStock) return false;
  if (offer.confidenceScore < 0.7) return false;
  if (offer.sellerRating !== undefined && offer.sellerRating !== null && offer.sellerRating < 4.0) {
    return false;
  }
  if (riskTolerance === "new_only") return offer.condition === "new";
  if (riskTolerance === "open_box_allowed") return offer.condition === "new" || offer.condition === "open_box";
  return offer.condition !== "used" || offer.confidenceScore >= 0.88;
}

export function scoreOffer(
  offer: NormalizedOffer,
  stats: DealPriceStats,
  riskTolerance: RiskTolerance,
): ScoredOffer {
  const sellerPenalty = sellerRiskPenalty(offer);
  const conditionPenalty = conditionRiskPenalty(offer);
  const effectivePrice = calculateEffectivePrice(offer);
  const sellerTrustScore = clampScore((offer.sellerRating ?? 4.1) * 20 - Math.max(0, 0.88 - offer.confidenceScore) * 80);
  const conditionScore = conditionToScore(offer.condition);
  const stockShippingScore = offer.inStock ? clampScore(100 - Math.min(35, offer.shipping * 2)) : 0;
  const priceVsAverageScore = clampScore(((stats.ninetyDayAverage - effectivePrice) / stats.ninetyDayAverage) * 160 + 72);
  const priceVsLowScore = clampScore(100 - Math.max(0, (effectivePrice - stats.historicalLow) / stats.historicalLow) * 280);

  const confidenceScore = clampScore(
    offer.confidenceScore * 100 - (sellerPenalty >= 25 ? 10 : 0) - (conditionPenalty >= 34 ? 10 : 0),
  );

  const dealScore = clampScore(
    priceVsAverageScore * 0.4 +
      priceVsLowScore * 0.25 +
      sellerTrustScore * 0.15 +
      conditionScore * 0.1 +
      stockShippingScore * 0.1,
  );

  return {
    offer,
    effectivePrice,
    sellerRiskPenalty: sellerPenalty,
    conditionRiskPenalty: conditionPenalty,
    sellerTrustScore,
    conditionScore,
    stockShippingScore,
    confidenceScore,
    dealScore,
    isSafeRecommendation: isSafeRecommendation(offer, riskTolerance),
    riskNotes: riskNotes(offer),
  };
}

export function rankOffers(
  offers: NormalizedOffer[],
  stats: DealPriceStats,
  riskTolerance: RiskTolerance,
) {
  return filterOffersByRiskTolerance(offers, riskTolerance)
    .map((offer) => scoreOffer(offer, stats, riskTolerance))
    .sort((left, right) => {
      if (left.isSafeRecommendation !== right.isSafeRecommendation) {
        return left.isSafeRecommendation ? -1 : 1;
      }

      if (right.dealScore !== left.dealScore) {
        return right.dealScore - left.dealScore;
      }

      return left.effectivePrice - right.effectivePrice;
    });
}

export function getBestSafeOffer(
  offers: NormalizedOffer[],
  stats: DealPriceStats,
  riskTolerance: RiskTolerance,
) {
  return rankOffers(offers, stats, riskTolerance).find((offer) => offer.isSafeRecommendation) ?? null;
}

function riskNotes(offer: NormalizedOffer) {
  const notes: string[] = [];
  if (offer.confidenceScore < 0.7) notes.push("Low listing confidence");
  if ((offer.sellerRating ?? 5) < 4) notes.push("Seller rating is below safe recommendation threshold");
  if (offer.condition === "used") notes.push("Used condition carries warranty and return risk");
  if (offer.condition === "refurbished") notes.push("Refurbished condition should be checked for warranty terms");
  if (!offer.inStock) notes.push("Offer is not currently in stock");
  return notes;
}

function conditionToScore(condition: NormalizedOffer["condition"]) {
  switch (condition) {
    case "new":
      return 100;
    case "open_box":
      return 82;
    case "refurbished":
      return 65;
    case "used":
      return 45;
  }
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, roundMoney(value)));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
