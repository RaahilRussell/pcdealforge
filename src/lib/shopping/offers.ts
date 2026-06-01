import type { ProductCategory, ProductForCompatibility } from "@/lib/compatibility/types";
import type { ScoredOffer } from "@/lib/deals/types";

export type OfferActionState = "buy_view_deal" | "view_demo_offer" | "unavailable" | "low_confidence";

export type ActionableOffer = {
  productId: string;
  offerId: string;
  retailer: string;
  title: string;
  condition: string;
  basePrice: number;
  shipping: number;
  taxEstimate: number;
  riskPenalty: number;
  conditionPenalty: number;
  effectivePrice: number;
  url: string;
  href: string;
  isExternalUrl: boolean;
  isDemoOffer: boolean;
  lastCheckedAt?: string | null;
  confidenceScore: number;
  inStock: boolean;
  sellerName?: string | null;
  sellerRating?: number | null;
  actionState: OfferActionState;
  actionLabel: string;
};

export type ShoppingListRow = ActionableOffer & {
  category: ProductCategory;
  productName: string;
  productUrl: string;
  evidenceUrl?: string | null;
};

export type ShoppingList = {
  rows: ShoppingListRow[];
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  riskPenaltyTotal: number;
  conditionPenaltyTotal: number;
  finalEffectiveTotal: number;
  realExternalLinks: string[];
  markdown: string;
};

export function toActionableOffer(scoredOffer: ScoredOffer): ActionableOffer {
  const offer = scoredOffer.offer;
  const isDemoOffer = isDemoUrl(offer.url);
  const isExternalUrl = !isDemoOffer && isHttpUrl(offer.url);
  const href = isExternalUrl ? offer.url : `/offers/${offer.id}`;
  const actionState: OfferActionState = !offer.inStock
    ? "unavailable"
    : offer.confidenceScore < 0.65
      ? "low_confidence"
      : isDemoOffer
        ? "view_demo_offer"
        : "buy_view_deal";

  return {
    productId: offer.productId ?? "",
    offerId: offer.id,
    retailer: offer.retailer,
    title: offer.title,
    condition: offer.condition,
    basePrice: money(offer.price),
    shipping: money(offer.shipping),
    taxEstimate: money(offer.taxEstimate),
    riskPenalty: money(scoredOffer.sellerRiskPenalty),
    conditionPenalty: money(scoredOffer.conditionRiskPenalty),
    effectivePrice: money(scoredOffer.effectivePrice),
    url: offer.url,
    href,
    isExternalUrl,
    isDemoOffer,
    lastCheckedAt: offer.lastCheckedAt ? new Date(offer.lastCheckedAt).toISOString() : null,
    confidenceScore: offer.confidenceScore,
    inStock: offer.inStock,
    sellerName: offer.sellerName,
    sellerRating: offer.sellerRating,
    actionState,
    actionLabel: actionLabel(actionState),
  };
}

export function buildShoppingList(
  parts: Record<ProductCategory, ProductForCompatibility>,
  offers: Record<ProductCategory, ScoredOffer>,
  evidenceByCategory: Partial<Record<ProductCategory, string | null>> = {},
): ShoppingList {
  const rows = (Object.keys(parts) as ProductCategory[]).map((category) => {
    const part = parts[category];
    const offer = toActionableOffer(offers[category]);

    return {
      ...offer,
      category,
      productName: `${part.brand} ${part.model}`,
      productUrl: `/products/${part.id}`,
      evidenceUrl: evidenceByCategory[category] ?? null,
    };
  });

  const subtotal = money(rows.reduce((sum, row) => sum + row.basePrice, 0));
  const shippingTotal = money(rows.reduce((sum, row) => sum + row.shipping, 0));
  const taxTotal = money(rows.reduce((sum, row) => sum + row.taxEstimate, 0));
  const riskPenaltyTotal = money(rows.reduce((sum, row) => sum + row.riskPenalty, 0));
  const conditionPenaltyTotal = money(rows.reduce((sum, row) => sum + row.conditionPenalty, 0));
  const finalEffectiveTotal = money(rows.reduce((sum, row) => sum + row.effectivePrice, 0));

  return {
    rows,
    subtotal,
    shippingTotal,
    taxTotal,
    riskPenaltyTotal,
    conditionPenaltyTotal,
    finalEffectiveTotal,
    realExternalLinks: rows.filter((row) => row.isExternalUrl && row.inStock).map((row) => row.href),
    markdown: shoppingListMarkdown(rows, finalEffectiveTotal),
  };
}

export function isDemoUrl(url?: string | null) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "example.com" || parsed.hostname.endsWith(".example.com");
  } catch {
    return true;
  }
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function actionLabel(actionState: OfferActionState) {
  if (actionState === "buy_view_deal") return "Buy / View Deal";
  if (actionState === "view_demo_offer") return "View Demo Offer";
  if (actionState === "low_confidence") return "Low Confidence Listing";
  return "Unavailable";
}

function shoppingListMarkdown(rows: ShoppingListRow[], total: number) {
  return [
    "# PCDealForge Shopping List",
    `Total: ${currency(total)}`,
    "",
    ...rows.map(
      (row) =>
        `- ${row.category.toUpperCase()}: ${row.productName} - ${currency(row.effectivePrice)} - ${row.retailer} - ${row.href}`,
    ),
    "",
    "Seeded demo offer links are internal PCDealForge offer pages, not live retailer listings.",
  ].join("\n");
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
