import { disabledResult } from "../adapter";
import type { RetailerAdapter, RetailerAdapterContext, RetailerAdapterResult } from "../types";

/**
 * Micro Center adapter (sourceType: manual_verified).
 *
 * Micro Center has no compliant public API/feed and is location-specific. This adapter stays
 * disabled unless a MICROCENTER_LOCATION_ID is configured AND a compliant data source is wired.
 * It never scrapes or fabricates inventory.
 */
export class MicroCenterAdapter implements RetailerAdapter {
  readonly retailer = "Micro Center";
  readonly sourceType = "manual_verified" as const;

  constructor(private readonly locationId?: string) {}

  isConfigured(): boolean {
    // No compliant API exists, so the adapter is never "enabled" purely from a location id.
    return false;
  }

  async fetchOffers(_context: RetailerAdapterContext): Promise<RetailerAdapterResult> {
    void _context;
    const detail = this.locationId
      ? `Location ${this.locationId} is set, but Micro Center has no compliant API/feed configured.`
      : "Set MICROCENTER_LOCATION_ID and wire a compliant feed to enable Micro Center.";
    return disabledResult(
      this.retailer,
      this.sourceType,
      `${detail} Micro Center stays disabled to avoid scraping or fabricating local inventory.`,
    );
  }
}
