import { AmazonAdapter } from "./adapters/amazon";
import { BestBuyAdapter } from "./adapters/bestbuy";
import { EbayBrowseAdapter } from "./adapters/ebay";
import { ManualVerifiedAdapter, type ManualVerifiedEntry } from "./adapters/manual";
import { MicroCenterAdapter } from "./adapters/microcenter";
import { NeweggAdapter } from "./adapters/newegg";
import type { RetailerConfig } from "./config";
import type { RetailerAdapter } from "./types";

export type RegistryOptions = {
  manualEntries?: ManualVerifiedEntry[];
};

/**
 * Build the set of live retailer adapters from configuration. The app uses whatever adapters are
 * configured — no key is required. Adapters without credentials still appear in the registry but
 * report themselves as unavailable so the UI can show their status.
 */
export function buildRetailerRegistry(config: RetailerConfig, options: RegistryOptions = {}): RetailerAdapter[] {
  return [
    new BestBuyAdapter(config.bestBuyApiKey),
    new EbayBrowseAdapter(config.ebayClientId, config.ebayClientSecret),
    new AmazonAdapter(config.amazonCreatorApiKey, config.amazonPartnerTag),
    new NeweggAdapter(config.neweggPartnerKey),
    new MicroCenterAdapter(config.microCenterLocationId),
    new ManualVerifiedAdapter(options.manualEntries ?? []),
  ];
}

export function hasConfiguredLiveAdapter(adapters: RetailerAdapter[]): boolean {
  return adapters.some((adapter) => adapter.isConfigured());
}
