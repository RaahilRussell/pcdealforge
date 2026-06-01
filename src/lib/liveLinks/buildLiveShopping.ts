import { computeLiveBuildTotal, computeLiveBuildVerdict } from "./buildLiveTotal";
import { buildLiveLinks } from "./linkBuilder";
import type { LiveBuildTotal, LiveBuildVerdict, LiveProduct, ResolvedLiveOffers } from "./types";

export type LiveShoppingRow = {
  category: string;
  product: LiveProduct;
  resolved: ResolvedLiveOffers;
};

export type LiveShopping = {
  rows: LiveShoppingRow[];
  total: LiveBuildTotal;
  verdict: LiveBuildVerdict;
};

/**
 * Assemble Live Link Mode shopping data for a build, synchronously and without any network calls.
 *
 * This is the default no-key experience: every part gets real retailer search links and an
 * MSRP/catalog estimate, but no price is marked verified (that only happens when a live page is
 * actually fetched and parsed). A best-effort resolver can later upgrade individual links.
 */
export function buildLiveShopping(
  inputs: Array<{ category: string; product: LiveProduct }>,
  options: { hasLiveHistory?: boolean } = {},
): LiveShopping {
  const rows: LiveShoppingRow[] = inputs.map(({ category, product }) => ({
    category,
    product,
    resolved: {
      productId: product.id,
      productName: `${product.brand} ${product.model}`.trim(),
      links: buildLiveLinks(product),
      bestVerified: undefined,
      priceStatus: "unverified_click_to_check",
      msrp: product.msrp ?? null,
    },
  }));

  const total = computeLiveBuildTotal(rows.map((row) => row.resolved));
  const verdict = computeLiveBuildVerdict({ total, hasLiveHistory: options.hasLiveHistory ?? false });

  return { rows, total, verdict };
}
