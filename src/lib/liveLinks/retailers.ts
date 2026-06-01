import type { RetailerId } from "./types";

export type RetailerDefinition = {
  id: RetailerId;
  name: string;
  /** Build a public search URL for an already-encoded query string. */
  searchUrl: (encodedQuery: string) => string;
  /** Whether public product pages are realistically parseable for structured data without keys. */
  productPagesParseable: boolean;
};

/**
 * Public retailer search URL builders. These are normal public search pages — no API keys, no
 * authentication, no anti-bot bypass. They always produce a clickable link the user can use to buy
 * or verify a price.
 */
export const RETAILERS: Record<Exclude<RetailerId, "manufacturer">, RetailerDefinition> = {
  amazon: {
    id: "amazon",
    name: "Amazon",
    searchUrl: (q) => `https://www.amazon.com/s?k=${q}`,
    productPagesParseable: false, // Amazon aggressively blocks bots; rely on search links.
  },
  bestbuy: {
    id: "bestbuy",
    name: "Best Buy",
    searchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`,
    productPagesParseable: true,
  },
  newegg: {
    id: "newegg",
    name: "Newegg",
    searchUrl: (q) => `https://www.newegg.com/p/pl?d=${q}`,
    productPagesParseable: true,
  },
  walmart: {
    id: "walmart",
    name: "Walmart",
    searchUrl: (q) => `https://www.walmart.com/search?q=${q}`,
    productPagesParseable: true,
  },
  bhphoto: {
    id: "bhphoto",
    name: "B&H Photo",
    searchUrl: (q) => `https://www.bhphotovideo.com/c/search?q=${q}`,
    productPagesParseable: true,
  },
  microcenter: {
    id: "microcenter",
    name: "Micro Center",
    searchUrl: (q) => `https://www.microcenter.com/search/search_results.aspx?Ntt=${q}`,
    productPagesParseable: true,
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}`,
    productPagesParseable: true,
  },
  adorama: {
    id: "adorama",
    name: "Adorama",
    searchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${q}`,
    productPagesParseable: true,
  },
};

/** Ordered list of retailers used for link generation and the build-report table. */
export const RETAILER_ORDER: Array<Exclude<RetailerId, "manufacturer">> = [
  "amazon",
  "bestbuy",
  "newegg",
  "walmart",
  "bhphoto",
  "microcenter",
  "ebay",
  "adorama",
];

/** Manufacturer product/support search, where a known brand maps to a public search. */
export function manufacturerSearchUrl(brand: string, encodedQuery: string): string | null {
  const key = brand.trim().toLowerCase();
  const base = MANUFACTURER_SEARCH[key];
  return base ? base(encodedQuery) : null;
}

const MANUFACTURER_SEARCH: Record<string, (q: string) => string> = {
  nvidia: (q) => `https://www.nvidia.com/en-us/search/?q=${q}`,
  amd: (q) => `https://www.amd.com/en/search.html?searchText=${q}`,
  intel: (q) => `https://www.intel.com/content/www/us/en/search.html?ws=text#q=${q}`,
  asus: (q) => `https://www.asus.com/us/search/?searchType=products&keyword=${q}`,
  msi: (q) => `https://www.msi.com/search/${q}`,
  gigabyte: (q) => `https://www.gigabyte.com/Search?kw=${q}`,
  corsair: (q) => `https://www.corsair.com/us/en/search?q=${q}`,
  "g.skill": (q) => `https://www.gskill.com/search?q=${q}`,
  gskill: (q) => `https://www.gskill.com/search?q=${q}`,
  samsung: (q) => `https://www.samsung.com/us/search/searchMain/?listType=g&searchTerm=${q}`,
  "western digital": (q) => `https://www.westerndigital.com/search?text=${q}`,
  wd: (q) => `https://www.westerndigital.com/search?text=${q}`,
  crucial: (q) => `https://www.crucial.com/catalog/search?searchType=keyword&searchTerm=${q}`,
  fractal: (q) => `https://www.fractal-design.com/?s=${q}`,
  noctua: (q) => `https://noctua.at/en/search?sSearch=${q}`,
  thermalright: (q) => `https://www.thermalright.com/?s=${q}`,
  seasonic: (q) => `https://seasonic.com/?s=${q}`,
};
