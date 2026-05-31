import type { NormalizedOffer, ProductForDeals } from "../types";

export type DealAdapterContext = {
  products: ProductForDeals[];
};

export type DealAdapter = {
  name: string;
  refreshOffers(context: DealAdapterContext): Promise<NormalizedOffer[]>;
};

// Future adapters should implement this narrow interface and return NormalizedOffer[]:
// - eBay Browse API for marketplace listings with seller metadata.
// - Amazon affiliate/creator API for compliant product links and prices.
// - Newegg API or approved partner feeds for component retail prices.
// - Best Buy APIs or partner feeds where available.
// - Micro Center feeds or approved local inventory integration.
//
// Do not make direct scraping the default path; live sources should stay replaceable.
