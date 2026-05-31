export type OfferCondition = "new" | "open_box" | "used" | "refurbished";

export type RiskTolerance = "new_only" | "open_box_allowed" | "used_allowed";

export type ProductForDeals = {
  id: string;
  brand: string;
  model: string;
  normalizedName: string;
  mpn?: string | null;
  upc?: string | null;
};

export type NormalizedOffer = {
  id: string;
  productId?: string | null;
  retailer: string;
  title: string;
  url: string;
  price: number;
  shipping: number;
  taxEstimate: number;
  condition: OfferCondition;
  sellerName?: string | null;
  sellerRating?: number | null;
  inStock: boolean;
  confidenceScore: number;
  lastCheckedAt?: Date | string | null;
  mpn?: string | null;
  upc?: string | null;
};

export type DealPriceStats = {
  ninetyDayAverage: number;
  historicalLow: number;
};

export type ScoredOffer = {
  offer: NormalizedOffer;
  effectivePrice: number;
  sellerRiskPenalty: number;
  conditionRiskPenalty: number;
  sellerTrustScore: number;
  conditionScore: number;
  stockShippingScore: number;
  confidenceScore: number;
  dealScore: number;
  isSafeRecommendation: boolean;
  riskNotes: string[];
};

export type OfferMatchMethod = "upc" | "mpn" | "normalized_name" | "title_tokens" | "none";

export type OfferMatch = {
  offer: NormalizedOffer;
  method: OfferMatchMethod;
  confidence: number;
  reasons: string[];
};
