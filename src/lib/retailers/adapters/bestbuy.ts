import { errorResult, okResult, unavailableResult } from "../adapter";
import type {
  RawRetailerOffer,
  RetailerAdapter,
  RetailerAdapterContext,
  RetailerAdapterResult,
  RetailerTargetProduct,
} from "../types";

/**
 * Best Buy Products API adapter (sourceType: official_api).
 *
 * Uses the official Best Buy Products API when BESTBUY_API_KEY is configured. It searches by
 * UPC/MPN/SKU when available, otherwise by query string, and normalizes price, availability and the
 * canonical product URL. When no key is configured it reports the retailer as unavailable rather
 * than returning fake data.
 */
export class BestBuyAdapter implements RetailerAdapter {
  readonly retailer = "Best Buy";
  readonly sourceType = "official_api" as const;

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchOffers(context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    if (!this.apiKey) return unavailableResult(this.retailer, this.sourceType);

    try {
      const offers: RawRetailerOffer[] = [];
      for (const product of context.products) {
        const item = await this.searchProduct(product);
        if (item) offers.push(item);
      }
      return okResult(this.retailer, this.sourceType, offers);
    } catch (error) {
      return errorResult(this.retailer, this.sourceType, error);
    }
  }

  private async searchProduct(product: RetailerTargetProduct): Promise<RawRetailerOffer | null> {
    const search = product.upc
      ? `upc=${encodeURIComponent(product.upc)}`
      : product.mpn
        ? `manufacturer="*"&modelNumber=${encodeURIComponent(product.mpn)}`
        : `search=${encodeURIComponent(`${product.brand} ${product.model}`)}`;
    const url =
      `https://api.bestbuy.com/v1/products(${search})` +
      `?apiKey=${this.apiKey}&format=json&show=sku,name,salePrice,url,onlineAvailability,manufacturer,modelNumber,upc&pageSize=1`;

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Best Buy API responded ${response.status}`);
    }
    const data = (await response.json()) as BestBuyResponse;
    const item = data.products?.[0];
    if (!item || typeof item.salePrice !== "number") return null;

    return {
      sourceRetailer: this.retailer,
      sourceType: this.sourceType,
      sourceUrl: "https://api.bestbuy.com/v1/products",
      productUrl: item.url,
      title: item.name,
      brand: item.manufacturer,
      model: item.modelNumber ?? product.model,
      mpn: item.modelNumber ?? product.mpn ?? null,
      upc: item.upc ?? product.upc ?? null,
      sku: item.sku ? String(item.sku) : null,
      price: item.salePrice,
      shipping: 0,
      condition: "new",
      inStock: item.onlineAvailability ?? null,
      sellerName: "Best Buy",
      sellerRating: null,
      rawSourceId: `bestbuy-${item.sku}`,
      fetchedAt: new Date(),
      targetProductId: product.id,
    };
  }
}

type BestBuyResponse = {
  products?: Array<{
    sku?: number | string;
    name: string;
    salePrice?: number;
    url: string;
    onlineAvailability?: boolean;
    manufacturer?: string;
    modelNumber?: string;
    upc?: string;
  }>;
};
