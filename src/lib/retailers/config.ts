/**
 * Live retailer configuration, read from environment variables.
 *
 * No key is required. The app uses whatever adapters are configured. When live mode is on but no
 * adapters have credentials, callers must surface "configure credentials or use demo mode" rather
 * than inventing data.
 */

export type RetailerConfig = {
  liveRetailerMode: boolean;
  demoMode: boolean;
  bestBuyApiKey?: string;
  ebayClientId?: string;
  ebayClientSecret?: string;
  amazonCreatorApiKey?: string;
  amazonPartnerTag?: string;
  microCenterLocationId?: string;
  neweggPartnerKey?: string;
};

function flag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true" || value === "1" || value === "yes";
}

function trimmed(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export type RetailerEnv = Record<string, string | undefined>;

export function getRetailerConfig(env: RetailerEnv = process.env): RetailerConfig {
  const live = flag(env.LIVE_RETAILER_MODE) ?? false;
  // Demo mode is on by default unless live mode is explicitly enabled. An explicit DEMO_MODE wins.
  const demo = flag(env.DEMO_MODE) ?? !live;

  return {
    liveRetailerMode: live,
    demoMode: demo,
    bestBuyApiKey: trimmed(env.BESTBUY_API_KEY),
    ebayClientId: trimmed(env.EBAY_CLIENT_ID),
    ebayClientSecret: trimmed(env.EBAY_CLIENT_SECRET),
    amazonCreatorApiKey: trimmed(env.AMAZON_CREATOR_API_KEY),
    amazonPartnerTag: trimmed(env.AMAZON_PARTNER_TAG),
    microCenterLocationId: trimmed(env.MICROCENTER_LOCATION_ID),
    neweggPartnerKey: trimmed(env.NEWEGG_PARTNER_KEY),
  };
}

export function isLiveMode(config: RetailerConfig): boolean {
  return config.liveRetailerMode && !config.demoMode;
}
