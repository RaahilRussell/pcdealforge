import { okResult } from "../adapter";
import type { NormalizedOffer } from "../../deals/types";
import type {
  RawRetailerOffer,
  RetailerAdapter,
  RetailerAdapterContext,
  RetailerAdapterResult,
  RetailerOfferCondition,
} from "../types";

/**
 * Seeded demo adapter (sourceType: seeded_demo).
 *
 * Wraps the existing seeded offer fixtures so demo mode (and explicit demo fallback) can flow through
 * the same normalization/verification pipeline as live data. Every offer it emits is clearly labelled
 * `seeded_demo` and will verify as `demo` — it must never be presented as a live retailer price.
 */
export class SeededDemoAdapter implements RetailerAdapter {
  readonly retailer = "Seeded demo";
  readonly sourceType = "seeded_demo" as const;

  constructor(private readonly seededOffers: NormalizedOffer[] = []) {}

  isConfigured(): boolean {
    return true;
  }

  async fetchOffers(context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    const targetIds = new Set(context.products.map((product) => product.id));
    const offers: RawRetailerOffer[] = this.seededOffers
      .filter((offer) => offer.productId && targetIds.has(offer.productId))
      .map((offer) => ({
        sourceRetailer: offer.retailer,
        sourceType: this.sourceType,
        sourceUrl: offer.url,
        productUrl: offer.url,
        title: offer.title,
        mpn: offer.mpn ?? null,
        upc: offer.upc ?? null,
        sku: null,
        price: offer.price,
        shipping: offer.shipping,
        taxEstimate: offer.taxEstimate,
        condition: offer.condition as RetailerOfferCondition,
        inStock: offer.inStock,
        sellerName: offer.sellerName ?? offer.retailer,
        sellerRating: offer.sellerRating ?? null,
        rawSourceId: `seeded-${offer.id}`,
        fetchedAt: offer.lastCheckedAt ?? new Date(),
        targetProductId: offer.productId as string,
      }));

    return okResult(this.retailer, this.sourceType, offers, "Seeded demo offers — not live retailer prices.");
  }
}
