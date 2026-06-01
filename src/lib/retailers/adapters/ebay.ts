import { errorResult, okResult, unavailableResult } from "../adapter";
import type {
  RawRetailerOffer,
  RetailerAdapter,
  RetailerAdapterContext,
  RetailerAdapterResult,
  RetailerOfferCondition,
  RetailerTargetProduct,
} from "../types";

/**
 * eBay Browse API adapter (sourceType: official_api).
 *
 * Uses the official eBay Browse API with an OAuth client-credentials token when
 * EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are configured. Searches fixed-price listings, prefers NEW
 * condition unless the risk tolerance allows open-box/used, and requires a seller rating for
 * marketplace listings. When credentials are missing the retailer is reported unavailable.
 */
export class EbayBrowseAdapter implements RetailerAdapter {
  readonly retailer = "eBay";
  readonly sourceType = "official_api" as const;

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
  ) {}

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  async fetchOffers(context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    if (!this.isConfigured()) return unavailableResult(this.retailer, this.sourceType);

    try {
      const token = await this.getToken();
      const allowUsed = context.riskTolerance === "used_allowed";
      const allowOpenBox = allowUsed || context.riskTolerance === "open_box_allowed";
      const offers: RawRetailerOffer[] = [];
      for (const product of context.products) {
        const offer = await this.searchProduct(product, token, { allowOpenBox, allowUsed });
        if (offer) offers.push(offer);
      }
      return okResult(this.retailer, this.sourceType, offers);
    } catch (error) {
      return errorResult(this.retailer, this.sourceType, error);
    }
  }

  private async getToken(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });
    if (!response.ok) throw new Error(`eBay OAuth responded ${response.status}`);
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("eBay OAuth returned no access token");
    return data.access_token;
  }

  private async searchProduct(
    product: RetailerTargetProduct,
    token: string,
    conditions: { allowOpenBox: boolean; allowUsed: boolean },
  ): Promise<RawRetailerOffer | null> {
    const allowedFilters = ["NEW"];
    if (conditions.allowOpenBox) allowedFilters.push("OPEN_BOX");
    if (conditions.allowUsed) allowedFilters.push("USED");

    const query = encodeURIComponent(`${product.brand} ${product.model}`);
    const url =
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}` +
      `&filter=buyingOptions:{FIXED_PRICE},conditions:{${allowedFilters.join("|")}}&limit=3`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });
    if (!response.ok) throw new Error(`eBay Browse responded ${response.status}`);
    const data = (await response.json()) as EbayBrowseResponse;

    const item = (data.itemSummaries ?? []).find((summary) => {
      const price = Number(summary.price?.value);
      // Require a seller rating for marketplace listings.
      return Number.isFinite(price) && summary.seller?.feedbackPercentage !== undefined;
    });
    if (!item) return null;

    return {
      sourceRetailer: this.retailer,
      sourceType: this.sourceType,
      sourceUrl: "https://api.ebay.com/buy/browse/v1/item_summary/search",
      productUrl: item.itemWebUrl,
      title: item.title,
      brand: product.brand,
      model: product.model,
      mpn: product.mpn ?? null,
      upc: product.upc ?? null,
      sku: item.itemId,
      price: Number(item.price?.value),
      shipping: shippingCost(item),
      condition: mapCondition(item.condition),
      inStock: true,
      sellerName: item.seller?.username ?? "eBay seller",
      sellerRating: item.seller?.feedbackPercentage ? Number(item.seller.feedbackPercentage) / 20 : null,
      rawSourceId: `ebay-${item.itemId}`,
      fetchedAt: new Date(),
      targetProductId: product.id,
    };
  }
}

function shippingCost(item: EbayItem): number {
  const option = item.shippingOptions?.[0]?.shippingCost?.value;
  return option ? Number(option) : 0;
}

function mapCondition(condition?: string): RetailerOfferCondition {
  const value = (condition ?? "").toLowerCase();
  if (value.includes("open")) return "open_box";
  if (value.includes("refurb")) return "refurbished";
  if (value.includes("used") || value.includes("pre-owned")) return "used";
  return "new";
}

type EbayItem = {
  itemId: string;
  title: string;
  itemWebUrl: string;
  condition?: string;
  price?: { value?: string };
  seller?: { username?: string; feedbackPercentage?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string } }>;
};

type EbayBrowseResponse = {
  itemSummaries?: EbayItem[];
};
