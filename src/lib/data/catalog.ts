import { prisma } from "@/lib/db/prisma";
import type { BuildProduct } from "@/lib/builds/types";
import type { ProductCategory, ProductForCompatibility } from "@/lib/compatibility/types";
import type { NormalizedOffer, OfferCondition } from "@/lib/deals/types";
import type { ProductEvidenceRecord } from "@/lib/evidence/types";
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

type SavedBuildRecord = {
  id: string;
  name: string;
  buildType: string;
  targetBudget: number;
  useCase: string;
  resolution: string;
  gpuPreference: string;
  riskTolerance: string;
  ramGb: number;
  storageGb: number;
  wifiRequired: boolean;
  partsJson: string;
  offersJson: string;
  priceSummaryJson: string;
  compatibilityReportJson: string;
  evidenceJson: string;
  essayJson: string;
  totalPrice: number;
  performanceScore: number;
  compatibilityStatus: string;
  priceVerdict: string;
  dealScore: number;
  candidateCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrebuiltRecord = {
  id: string;
  brand: string;
  model: string;
  retailer: string;
  url: string;
  price: number;
  condition: string;
  cpuName: string;
  gpuName: string;
  ramGb: number;
  storageGb: number;
  psuInfo: string | null;
  motherboardInfo: string | null;
  caseInfo: string | null;
  coolingInfo: string | null;
  warrantyInfo: string | null;
  upgradeabilityScore: number;
  valueScore: number;
  confidenceScore: number;
  specsJson: string;
  createdAt: Date;
  updatedAt: Date;
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

export async function getOffer(offerId: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  return offer ? mapOffer(offer) : null;
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

export async function listSavedBuilds(limit = 12) {
  const builds = await prisma.savedBuild.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return builds.map(mapSavedBuild);
}

export async function getSavedBuild(buildId: string) {
  const build = await prisma.savedBuild.findUnique({ where: { id: buildId } });
  return build ? mapSavedBuild(build) : null;
}

export async function listPrebuiltSystems(limit = 12) {
  const prebuilts = await prisma.prebuiltSystem.findMany({
    orderBy: [{ valueScore: "desc" }, { price: "asc" }],
    take: limit,
  });

  return prebuilts.map(mapPrebuiltSystem);
}

export async function getPrebuiltSystem(prebuiltId: string) {
  const prebuilt = await prisma.prebuiltSystem.findUnique({ where: { id: prebuiltId } });
  return prebuilt ? mapPrebuiltSystem(prebuilt) : null;
}

export async function getEvidenceDetail(evidenceId: string) {
  const productEvidence = await prisma.productEvidence.findUnique({ where: { id: evidenceId } });

  if (productEvidence) {
    const [source, product] = await Promise.all([
      prisma.evidenceSource.findUnique({ where: { id: productEvidence.evidenceSourceId } }),
      prisma.product.findUnique({ where: { id: productEvidence.productId } }),
    ]);

    if (!source) return null;

    const record: ProductEvidenceRecord = {
      id: productEvidence.id,
      productId: productEvidence.productId,
      evidenceSourceId: productEvidence.evidenceSourceId,
      claimType: productEvidence.claimType,
      claim: productEvidence.claim,
      value: productEvidence.value,
      unit: productEvidence.unit,
      source,
    };

    return {
      kind: "product_evidence" as const,
      record,
      product: product ? mapProduct(product) : null,
    };
  }

  const source = await prisma.evidenceSource.findUnique({ where: { id: evidenceId } });
  if (!source) return null;

  return {
    kind: "evidence_source" as const,
    source,
    product: null,
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

export function mapSavedBuild(build: SavedBuildRecord) {
  return {
    id: build.id,
    name: build.name,
    buildType: build.buildType,
    targetBudget: build.targetBudget,
    useCase: build.useCase,
    resolution: build.resolution,
    gpuPreference: build.gpuPreference,
    riskTolerance: build.riskTolerance,
    ramGb: build.ramGb,
    storageGb: build.storageGb,
    wifiRequired: build.wifiRequired,
    parts: parseJson<Record<string, unknown>>(build.partsJson, {}),
    offers: parseJson<Record<string, unknown>>(build.offersJson, {}),
    priceSummary: parseJson<Record<string, unknown>>(build.priceSummaryJson, {}),
    compatibilityReport: parseJson<Record<string, unknown>>(build.compatibilityReportJson, {}),
    evidence: parseJson<unknown[]>(build.evidenceJson, []),
    essay: parseJson<Record<string, unknown>>(build.essayJson, {}),
    totalPrice: build.totalPrice,
    performanceScore: build.performanceScore,
    compatibilityStatus: build.compatibilityStatus,
    priceVerdict: build.priceVerdict,
    dealScore: build.dealScore,
    candidateCount: build.candidateCount,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
  };
}

export function mapPrebuiltSystem(prebuilt: PrebuiltRecord) {
  return {
    id: prebuilt.id,
    brand: prebuilt.brand,
    model: prebuilt.model,
    retailer: prebuilt.retailer,
    url: prebuilt.url,
    price: prebuilt.price,
    condition: prebuilt.condition,
    cpuName: prebuilt.cpuName,
    gpuName: prebuilt.gpuName,
    ramGb: prebuilt.ramGb,
    storageGb: prebuilt.storageGb,
    psuInfo: prebuilt.psuInfo,
    motherboardInfo: prebuilt.motherboardInfo,
    caseInfo: prebuilt.caseInfo,
    coolingInfo: prebuilt.coolingInfo,
    warrantyInfo: prebuilt.warrantyInfo,
    upgradeabilityScore: prebuilt.upgradeabilityScore,
    valueScore: prebuilt.valueScore,
    confidenceScore: prebuilt.confidenceScore,
    specs: parseJson<Record<string, unknown>>(prebuilt.specsJson, {}),
    createdAt: prebuilt.createdAt,
    updatedAt: prebuilt.updatedAt,
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

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
