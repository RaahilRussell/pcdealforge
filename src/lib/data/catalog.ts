import { prisma } from "@/lib/db/prisma";
import type { BuildProduct } from "@/lib/builds/types";
import type { ProductCategory, ProductForCompatibility } from "@/lib/compatibility/types";
import type { NormalizedOffer, OfferCondition } from "@/lib/deals/types";
import type { DailyPricePoint } from "@/lib/pricing/priceTrends";

type ProductRecord = {
  id: string;
  category: string;
  brand: string;
  model: string;
  normalizedName: string;
  mpn: string | null;
  upc: string | null;
  specsJson: string;
};

type OfferRecord = {
  id: string;
  productId: string;
  retailer: string;
  title: string;
  url: string;
  price: number;
  shipping: number;
  taxEstimate: number;
  condition: string;
  sellerName: string | null;
  sellerRating: number | null;
  inStock: boolean;
  confidenceScore: number;
  lastCheckedAt: Date;
};

type DailyPriceRecord = {
  date: Date;
  minNewPrice: number;
  minOpenBoxPrice: number | null;
  avgNewPrice: number;
  lowestTrustedPrice: number;
  retailerCount: number;
};

export async function listProducts(category?: string | null) {
  const products = await prisma.product.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { brand: "asc" }, { model: "asc" }],
  });

  return products.map(mapProduct);
}

export async function getProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  return product ? mapProduct(product) : null;
}

export async function getProductsByIds(productIds: string[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  return products.map(mapProduct);
}

export async function getCurrentOffers(productIds?: string[]) {
  const offers = await prisma.offer.findMany({
    where: productIds ? { productId: { in: productIds } } : undefined,
    orderBy: [{ inStock: "desc" }, { price: "asc" }],
  });

  return offers.map(mapOffer);
}

export async function getPriceHistory(productIds: string[]) {
  const rows = await prisma.dailyProductPrice.findMany({
    where: { productId: { in: productIds } },
    orderBy: { date: "asc" },
  });

  return rows.reduce<Record<string, DailyPricePoint[]>>((grouped, row) => {
    grouped[row.productId] ??= [];
    grouped[row.productId].push(mapDailyPrice(row));
    return grouped;
  }, {});
}

export async function getOptimizerCatalog() {
  const [products, offers] = await Promise.all([listProducts(), getCurrentOffers()]);
  const historiesByProductId = await getPriceHistory(products.map((product) => product.id));

  return {
    products: products.map(toBuildProduct),
    offersByProductId: groupOffers(offers),
    historiesByProductId,
  };
}

export function toCompatibilityProduct(product: ReturnType<typeof mapProduct>): ProductForCompatibility {
  return {
    id: product.id,
    category: product.category,
    brand: product.brand,
    model: product.model,
    specs: product.specs,
  };
}

export function toBuildProduct(product: ReturnType<typeof mapProduct>): BuildProduct {
  return {
    ...toCompatibilityProduct(product),
    normalizedName: product.normalizedName,
    mpn: product.mpn,
    upc: product.upc,
  };
}

export function groupOffers(offers: NormalizedOffer[]) {
  return offers.reduce<Record<string, NormalizedOffer[]>>((grouped, offer) => {
    if (!offer.productId) return grouped;
    grouped[offer.productId] ??= [];
    grouped[offer.productId].push(offer);
    return grouped;
  }, {});
}

export function mapProduct(product: ProductRecord) {
  return {
    id: product.id,
    category: product.category as ProductCategory,
    brand: product.brand,
    model: product.model,
    normalizedName: product.normalizedName,
    mpn: product.mpn,
    upc: product.upc,
    specs: parseSpecs(product.specsJson),
  };
}

export function mapOffer(offer: OfferRecord): NormalizedOffer {
  return {
    id: offer.id,
    productId: offer.productId,
    retailer: offer.retailer,
    title: offer.title,
    url: offer.url,
    price: offer.price,
    shipping: offer.shipping,
    taxEstimate: offer.taxEstimate,
    condition: offer.condition as OfferCondition,
    sellerName: offer.sellerName,
    sellerRating: offer.sellerRating,
    inStock: offer.inStock,
    confidenceScore: offer.confidenceScore,
    lastCheckedAt: offer.lastCheckedAt,
  };
}

function mapDailyPrice(row: DailyPriceRecord): DailyPricePoint {
  return {
    date: row.date,
    minNewPrice: row.minNewPrice,
    minOpenBoxPrice: row.minOpenBoxPrice,
    avgNewPrice: row.avgNewPrice,
    lowestTrustedPrice: row.lowestTrustedPrice,
    retailerCount: row.retailerCount,
  };
}

function parseSpecs(specsJson: string) {
  try {
    return JSON.parse(specsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}
