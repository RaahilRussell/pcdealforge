import { disabledResult, unavailableResult } from "../adapter";
import type { RetailerAdapter, RetailerAdapterContext, RetailerAdapterResult } from "../types";

/**
 * Amazon adapter (sourceType: affiliate_api).
 *
 * The legacy Product Advertising API (PA-API) is intentionally NOT used as the default — Amazon's
 * docs point affiliates toward the newer Creators API. This adapter is a configured placeholder:
 * it requires AMAZON_CREATOR_API_KEY and AMAZON_PARTNER_TAG, and until the Creators API integration
 * is wired it returns no offers rather than inventing prices or affiliate links.
 */
export class AmazonAdapter implements RetailerAdapter {
  readonly retailer = "Amazon";
  readonly sourceType = "affiliate_api" as const;

  constructor(
    private readonly creatorApiKey?: string,
    private readonly partnerTag?: string,
  ) {}

  isConfigured(): boolean {
    return !!this.creatorApiKey && !!this.partnerTag;
  }

  async fetchOffers(_context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    void _context;
    if (!this.isConfigured()) {
      return unavailableResult(
        this.retailer,
        this.sourceType,
        "Amazon needs AMAZON_CREATOR_API_KEY and AMAZON_PARTNER_TAG. " +
          "Live retailer data unavailable for this retailer. Configure API credentials or use demo mode.",
      );
    }
    return disabledResult(
      this.retailer,
      this.sourceType,
      "Amazon Creators API integration is pending. Credentials are configured but no live offers are returned yet — " +
        "the adapter will not fall back to demo data while claiming to be live.",
    );
  }
}
