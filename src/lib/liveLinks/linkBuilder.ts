import { manufacturerSearchUrl, RETAILER_ORDER, RETAILERS } from "./retailers";
import type { LiveProduct, LiveRetailerLink } from "./types";

/**
 * Choose the best query string for a product. MPN is the most precise, then UPC, then brand+model,
 * then the normalized product name as a fallback.
 */
export function buildQuery(product: LiveProduct): { query: string; basis: string } {
  if (product.mpn && product.mpn.trim()) return { query: `${product.brand} ${product.mpn}`.trim(), basis: "mpn" };
  if (product.upc && product.upc.trim()) return { query: product.upc.trim(), basis: "upc" };
  if (product.brand && product.model) return { query: `${product.brand} ${product.model}`.trim(), basis: "brand_model" };
  return { query: product.normalizedName, basis: "normalized_name" };
}

const SEARCH_LINK_REASON =
  "Retailer search link generated, but no verified product price could be extracted without API access.";

/**
 * Generate live search links for a product across all supported retailers plus the manufacturer.
 * Every link defaults to `unverified_click_to_check`; a resolver may later upgrade a link to
 * `verified_live` if it actually extracts a price from a live page.
 */
export function buildLiveLinks(product: LiveProduct): LiveRetailerLink[] {
  const { query, basis } = buildQuery(product);
  const encoded = encodeURIComponent(query);

  const links: LiveRetailerLink[] = RETAILER_ORDER.map((retailerId) => {
    const retailer = RETAILERS[retailerId];
    return {
      retailerId,
      retailerName: retailer.name,
      searchUrl: retailer.searchUrl(encoded),
      queryUsed: query,
      linkType: "search" as const,
      priceStatus: "unverified_click_to_check" as const,
      confidenceScore: 0,
      verificationReasons: [`${SEARCH_LINK_REASON} (query basis: ${basis})`],
    };
  });

  const manufacturerUrl = manufacturerSearchUrl(product.brand, encoded);
  if (manufacturerUrl) {
    links.push({
      retailerId: "manufacturer",
      retailerName: `${product.brand} (manufacturer)`,
      searchUrl: manufacturerUrl,
      queryUsed: query,
      linkType: "manufacturer",
      priceStatus: "unverified_click_to_check",
      confidenceScore: 0,
      verificationReasons: ["Manufacturer product/support search link."],
    });
  }

  return links;
}
