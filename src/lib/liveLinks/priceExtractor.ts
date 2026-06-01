import type { LiveCondition } from "./types";

/**
 * Best-effort structured-data extraction from a public retailer product page.
 *
 * Parses JSON-LD Product/Offer, OpenGraph/product price meta tags, and itemprop price markup. This
 * is dependency-free regex parsing of already-fetched HTML — it never bypasses CAPTCHAs or login
 * walls. Financing/monthly-payment prices are rejected. It returns whatever it could confidently
 * extract; callers decide whether the result is good enough to verify.
 */

export type ExtractedProduct = {
  title?: string;
  price?: number;
  currency?: string;
  condition?: LiveCondition;
  inStock?: boolean;
  source: "json_ld" | "og_meta" | "itemprop" | "none";
};

export function extractProductData(html: string): ExtractedProduct {
  const fromJsonLd = extractFromJsonLd(html);
  if (fromJsonLd) return fromJsonLd;

  const fromMeta = extractFromMeta(html);
  if (fromMeta) return fromMeta;

  return { source: "none" };
}

function extractFromJsonLd(html: string): ExtractedProduct | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    const json = safeJson(block[1]);
    if (!json) continue;
    for (const node of flattenGraph(json)) {
      if (!isProductNode(node)) continue;
      const offer = pickOffer(node.offers);
      const price = offer ? parsePrice(offer.price ?? offer.lowPrice) : undefined;
      if (price === undefined) continue;
      return {
        title: typeof node.name === "string" ? node.name : undefined,
        price,
        currency: offer?.priceCurrency,
        condition: mapCondition(offer?.itemCondition),
        inStock: mapAvailability(offer?.availability),
        source: "json_ld",
      };
    }
  }
  return null;
}

function extractFromMeta(html: string): ExtractedProduct | null {
  const priceRaw =
    metaContent(html, "product:price:amount") ??
    metaContent(html, "og:price:amount") ??
    itempropContent(html, "price");
  const price = priceRaw ? parsePrice(priceRaw) : undefined;
  if (price === undefined) return null;

  // Reject financing/monthly-payment prices.
  if (looksLikeFinancing(html, priceRaw)) return null;

  return {
    title: metaContent(html, "og:title") ?? titleTag(html),
    price,
    currency: metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency") ?? undefined,
    condition: undefined,
    inStock: undefined,
    source: "og_meta",
  };
}

function looksLikeFinancing(html: string, priceRaw?: string): boolean {
  if (!priceRaw) return false;
  const index = html.indexOf(priceRaw);
  if (index === -1) return false;
  const around = html.slice(Math.max(0, index - 40), index + 40).toLowerCase();
  return /\/mo|per month|a month|month\b|as low as|installment/.test(around);
}

type LdOffer = { price?: unknown; lowPrice?: unknown; priceCurrency?: string; availability?: string; itemCondition?: string };
type LdNode = { "@type"?: unknown; name?: unknown; offers?: unknown };

function isProductNode(node: LdNode): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type.toLowerCase().includes("product");
  if (Array.isArray(type)) return type.some((value) => typeof value === "string" && value.toLowerCase().includes("product"));
  return false;
}

function pickOffer(offers: unknown): LdOffer | undefined {
  if (!offers) return undefined;
  const list = Array.isArray(offers) ? offers : [offers];
  // Prefer a concrete Offer with a price; AggregateOffer exposes lowPrice.
  for (const offer of list) {
    if (offer && typeof offer === "object") {
      const candidate = offer as LdOffer;
      if (candidate.price !== undefined || candidate.lowPrice !== undefined) return candidate;
    }
  }
  return undefined;
}

function flattenGraph(json: unknown): LdNode[] {
  if (Array.isArray(json)) return json.flatMap(flattenGraph);
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) return obj["@graph"].flatMap(flattenGraph);
    return [obj as LdNode];
  }
  return [];
}

function mapCondition(condition?: string): LiveCondition | undefined {
  if (!condition) return undefined;
  const value = condition.toLowerCase();
  if (value.includes("new")) return "new";
  if (value.includes("refurb")) return "refurbished";
  if (value.includes("used")) return "used";
  if (value.includes("open")) return "open_box";
  return "unknown";
}

function mapAvailability(availability?: string): boolean | undefined {
  if (!availability) return undefined;
  const value = availability.toLowerCase();
  if (value.includes("instock") || value.includes("in_stock")) return true;
  if (value.includes("outofstock") || value.includes("soldout")) return false;
  return undefined;
}

export function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? round(value) : undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? round(parsed) : undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

function metaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`,
    "i",
  );
  return html.match(pattern)?.[1] ?? html.match(alt)?.[1];
}

function itempropContent(html: string, prop: string): string | undefined {
  const meta = new RegExp(`<meta[^>]+itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const span = new RegExp(`itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  return html.match(meta)?.[1] ?? html.match(span)?.[1];
}

function titleTag(html: string): string | undefined {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
