import { disabledResult, unavailableResult } from "../adapter";
import type { RetailerAdapter, RetailerAdapterContext, RetailerAdapterResult } from "../types";

/**
 * Newegg adapter (sourceType: partner_feed).
 *
 * Newegg has no public live shopper API. This adapter only activates with an approved partner feed
 * key (NEWEGG_PARTNER_KEY). Without it the retailer is unavailable; with it but no feed wired yet it
 * is reported disabled instead of fabricating prices.
 */
export class NeweggAdapter implements RetailerAdapter {
  readonly retailer = "Newegg";
  readonly sourceType = "partner_feed" as const;

  constructor(private readonly partnerKey?: string) {}

  isConfigured(): boolean {
    return !!this.partnerKey;
  }

  async fetchOffers(_context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    void _context;
    if (!this.partnerKey) {
      return unavailableResult(
        this.retailer,
        this.sourceType,
        "Newegg requires an approved partner feed key (NEWEGG_PARTNER_KEY). " +
          "Live retailer data unavailable for this retailer. Configure API credentials or use demo mode.",
      );
    }
    return disabledResult(
      this.retailer,
      this.sourceType,
      "Newegg partner feed is configured but not yet wired. No live offers are returned (no fake fallback).",
    );
  }
}
