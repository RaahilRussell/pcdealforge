import { okResult } from "../adapter";
import type {
  RawRetailerOffer,
  RetailerAdapter,
  RetailerAdapterContext,
  RetailerAdapterResult,
  RetailerOfferCondition,
} from "../types";

/**
 * Manually verified entry — an admin-maintained live URL/price captured by a human.
 * Must include capturedAt and a confidence so it can be verified like any other live source.
 */
export type ManualVerifiedEntry = {
  productId: string;
  retailer: string;
  productUrl: string;
  title: string;
  price: number;
  shipping?: number;
  condition?: RetailerOfferCondition;
  inStock?: boolean;
  sellerName?: string;
  capturedAt: Date | string;
  confidence: number;
  mpn?: string | null;
  upc?: string | null;
  sku?: string | null;
};

/**
 * Manually verified adapter (sourceType: manual_verified). Lets an admin maintain a small set of
 * hand-checked live listings. Always enabled (even with zero entries) because it does not depend on
 * external credentials; it simply emits whatever verified entries exist.
 */
export class ManualVerifiedAdapter implements RetailerAdapter {
  readonly retailer = "Manually verified";
  readonly sourceType = "manual_verified" as const;

  constructor(private readonly entries: ManualVerifiedEntry[] = []) {}

  isConfigured(): boolean {
    // "Configured" means an admin has actually entered verified listings to serve.
    return this.entries.length > 0;
  }

  async fetchOffers(context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    const targetIds = new Set(context.products.map((product) => product.id));
    const offers: RawRetailerOffer[] = this.entries
      .filter((entry) => targetIds.has(entry.productId))
      .map((entry) => ({
        sourceRetailer: entry.retailer,
        sourceType: this.sourceType,
        sourceUrl: entry.productUrl,
        productUrl: entry.productUrl,
        title: entry.title,
        mpn: entry.mpn ?? null,
        upc: entry.upc ?? null,
        sku: entry.sku ?? null,
        price: entry.price,
        shipping: entry.shipping ?? 0,
        condition: entry.condition ?? "new",
        inStock: entry.inStock ?? true,
        sellerName: entry.sellerName ?? entry.retailer,
        sellerRating: null,
        rawSourceId: `manual-${entry.retailer}-${entry.productId}`,
        fetchedAt: entry.capturedAt,
        targetProductId: entry.productId,
      }));

    return okResult(
      this.retailer,
      this.sourceType,
      offers,
      offers.length === 0 ? "No manually verified live listings have been entered yet." : undefined,
    );
  }
}
