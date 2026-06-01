import type { NormalizedOffer } from "../deals/types";
import { SeededDemoAdapter } from "./adapters/seededDemo";
import type { ManualVerifiedEntry } from "./adapters/manual";
import { getRetailerConfig, isLiveMode, type RetailerConfig } from "./config";
import { normalizeRetailerOffer } from "./normalize";
import { buildRetailerRegistry, hasConfiguredLiveAdapter } from "./registry";
import type {
  RetailerAdapter,
  RetailerOfferNormalized,
  RetailerRefreshResult,
  RetailerTargetProduct,
} from "./types";

export type RunRefreshInput = {
  products: RetailerTargetProduct[];
  config?: RetailerConfig;
  seededOffers?: NormalizedOffer[];
  manualEntries?: ManualVerifiedEntry[];
  riskTolerance?: "new_only" | "open_box_allowed" | "used_allowed";
  /** In live mode, also include clearly-labelled seeded demo offers as a fallback. */
  allowDemoFallback?: boolean;
  now?: Date;
};

const NO_ADAPTERS_MESSAGE =
  "No live retailer adapters are configured yet. Add API keys or switch to demo mode.";

export async function runRetailerRefresh(input: RunRefreshInput): Promise<RetailerRefreshResult> {
  const config = input.config ?? getRetailerConfig();
  const now = input.now ?? new Date();
  const live = isLiveMode(config);
  const productsById = new Map(input.products.map((product) => [product.id, product]));

  const liveAdapters = buildRetailerRegistry(config, { manualEntries: input.manualEntries });
  const demoAdapter = new SeededDemoAdapter(input.seededOffers ?? []);

  const adapters: RetailerAdapter[] = live
    ? input.allowDemoFallback
      ? [...liveAdapters, demoAdapter]
      : liveAdapters
    : [demoAdapter];

  const summary = emptySummary(live ? "live" : "demo", now);
  const normalized: RetailerOfferNormalized[] = [];

  for (const adapter of adapters) {
    const result = await adapter.fetchOffers({ products: input.products, riskTolerance: input.riskTolerance });
    summary.retailersChecked += 1;
    summary.adapterStatus.push({
      retailer: result.retailer,
      sourceType: result.sourceType,
      status: result.status,
      message: result.message,
    });
    if (result.error) summary.errorsByRetailer[result.retailer] = result.error;

    for (const raw of result.offers) {
      const target = productsById.get(raw.targetProductId);
      if (!target) continue;
      summary.offersFetched += 1;
      const offer = normalizeRetailerOffer(raw, target, now);

      switch (offer.verificationStatus) {
        case "verified_live":
          summary.verifiedLiveCount += 1;
          summary.offersVerified += 1;
          break;
        case "verified_recent":
          summary.verifiedRecentCount += 1;
          summary.offersVerified += 1;
          break;
        case "stale":
          summary.staleCount += 1;
          break;
        case "demo":
          summary.demoCount += 1;
          break;
        case "unverified":
          summary.unverifiedCount += 1;
          summary.offersRejected += 1;
          summary.rejected.push({
            retailer: offer.sourceRetailer,
            title: offer.title,
            reason: offer.verificationReasons[0] ?? "Unverified offer",
          });
          break;
      }

      normalized.push(offer);
    }
  }

  summary.offers = normalized;

  if (live && !hasConfiguredLiveAdapter(liveAdapters) && !input.allowDemoFallback) {
    summary.message = NO_ADAPTERS_MESSAGE;
  } else if (live) {
    summary.message = `Live refresh checked ${summary.retailersChecked} retailers and verified ${summary.offersVerified} offers.`;
  } else {
    summary.message =
      "Demo mode: using seeded PC parts, offers, and price history. Prices are not live.";
  }

  return summary;
}

function emptySummary(mode: "live" | "demo", now: Date): RetailerRefreshResult {
  return {
    retailersChecked: 0,
    offersFetched: 0,
    offersVerified: 0,
    offersRejected: 0,
    verifiedLiveCount: 0,
    verifiedRecentCount: 0,
    staleCount: 0,
    demoCount: 0,
    unverifiedCount: 0,
    errorsByRetailer: {},
    adapterStatus: [],
    offers: [],
    rejected: [],
    mode,
    lastCheckedAt: now.toISOString(),
    message: "",
  };
}
