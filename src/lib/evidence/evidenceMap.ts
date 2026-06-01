import type { GeneratedBuild } from "@/lib/builds/types";
import type { CompatibilityReport, ProductForCompatibility } from "@/lib/compatibility/types";
import type { NormalizedOffer, ScoredOffer } from "@/lib/deals/types";
import type { ProductPriceTrend } from "@/lib/pricing/priceTrends";
import { prisma } from "@/lib/db/prisma";

import { buildClaimRequestsForProducts, compatibilityClaimRequests, type ClaimRequest } from "./claimBuilder";
import { appendCitationMarkers, formatEvidenceCitation } from "./formatEvidence";
import type { EvidenceCitation, ProductEvidenceRecord } from "./types";

export async function getEvidenceForProduct(productId: string) {
  return hydrateProductEvidence(
    await prisma.productEvidence.findMany({
      where: { productId },
      orderBy: [{ claimType: "asc" }, { createdAt: "asc" }],
    }),
  );
}

export async function getEvidenceForClaim(productId: string, claimType: string) {
  return hydrateProductEvidence(
    await prisma.productEvidence.findMany({
      where: { productId, claimType },
      orderBy: { createdAt: "asc" },
    }),
  );
}

export async function getInternalCalculationEvidence(sourceIds: string[]) {
  const sources = await prisma.evidenceSource.findMany({
    where: { id: { in: sourceIds } },
    orderBy: { id: "asc" },
  });

  return sources.map((source, index) => ({
    evidenceId: source.id,
    sourceId: source.id,
    citationNumber: index + 1,
    title: source.title,
    sourceType: source.sourceType,
    publisher: source.publisher,
    url: source.url,
    confidenceScore: source.confidenceScore,
    capturedAt: source.capturedAt.toISOString(),
    claim: source.notes ?? source.title,
    value: source.title,
    unit: null,
    notes: source.notes,
  }));
}

export async function attachEvidenceToCompatibilityReport(
  report: CompatibilityReport,
  productsByCategory: Partial<Record<string, ProductForCompatibility>>,
) {
  const products = Object.values(productsByCategory).filter(Boolean) as ProductForCompatibility[];
  const citationAllocator = await createCitationAllocator(buildClaimRequestsForProducts(products));
  const formulaCitations = await getInternalCalculationEvidence([
    "source-calc-compatibility-rules",
    "source-calc-psu-wattage",
  ]);

  return {
    ...report,
    results: report.results.map((result) => {
      const evidence = renumberCitations([
        ...citationAllocator(compatibilityClaimRequests(result.ruleId, productsByCategory)),
        ...(result.ruleId === "psu-wattage-headroom" ? formulaCitations : []),
        ...(result.ruleId === "wifi-requirement" && result.level === "WARNING"
          ? userConstraintCitation("Wi-Fi was required by the build request.")
          : []),
      ]);

      return {
        ...result,
        evidence,
        explanation: appendCitationMarkers(result.explanation, evidence),
      };
    }),
  };
}

export async function attachEvidenceToDealReport(
  offers: Array<NormalizedOffer | ScoredOffer>,
  priceTrends: ProductPriceTrend[],
) {
  const productIds = unique(
    [
      ...offers.map((offer) => ("offer" in offer ? offer.offer.productId : offer.productId)),
      ...priceTrends.map((trend) => trend.productId),
    ].filter(Boolean) as string[],
  );
  const citationAllocator = await createCitationAllocator(
    productIds.flatMap((productId) => [
      { productId, claimType: "current_price" },
      { productId, claimType: "price_history" },
    ]),
  );
  const calculationCitations = await getInternalCalculationEvidence([
    "source-calc-effective-price",
    "source-calc-deal-score",
    "source-calc-price-verdict",
  ]);

  const trends = priceTrends.map((trend) => {
    const evidence = [
      ...citationAllocator([
        { productId: trend.productId, claimType: "current_price" },
        { productId: trend.productId, claimType: "price_history" },
      ]),
      ...calculationCitations,
    ];

    return {
      ...trend,
      evidence,
      explanation: appendCitationMarkers(trend.explanation, evidence),
    };
  });

  return {
    offers,
    priceTrends: trends,
    citations: uniqueCitations([...trends.flatMap((trend) => trend.evidence), ...calculationCitations]),
  };
}

export async function attachEvidenceToBuildAnalysis(build: GeneratedBuild) {
  const products = Object.values(build.parts);
  const compatibilityReport = await attachEvidenceToCompatibilityReport(build.compatibilityReport, build.parts);
  const dealReport = await attachEvidenceToDealReport(Object.values(build.offers), build.productPriceTrends);
  const calculationCitations = await getInternalCalculationEvidence(["source-calc-build-score"]);
  const citationAllocator = await createCitationAllocator(buildClaimRequestsForProducts(products));
  const productCitations = citationAllocator(buildClaimRequestsForProducts(products));
  const citations = uniqueCitations([
    ...compatibilityReport.results.flatMap((result) => result.evidence),
    ...dealReport.citations,
    ...calculationCitations,
    ...productCitations,
  ]);

  return {
    ...build,
    compatibilityReport,
    priceReport: dealReport,
    evidence: citations,
  };
}

async function createCitationAllocator(requests: ClaimRequest[]) {
  if (requests.length === 0) {
    return () => [];
  }

  const evidence = await hydrateProductEvidence(
    await prisma.productEvidence.findMany({
      where: {
        OR: requests.map((request) => ({
          productId: request.productId,
          claimType: request.claimType,
        })),
      },
      orderBy: [{ productId: "asc" }, { claimType: "asc" }],
    }),
  );

  const keyToRecord = new Map(evidence.map((record) => [evidenceKey(record.productId, record.claimType), record]));
  const keyToCitation = new Map<string, EvidenceCitation>();

  return (claimRequests: ClaimRequest[]) =>
    claimRequests.flatMap((request) => {
      const key = evidenceKey(request.productId, request.claimType);
      const existing = keyToCitation.get(key);
      if (existing) return [existing];

      const record = keyToRecord.get(key);
      if (!record) return [];

      const citation = formatEvidenceCitation(record, keyToCitation.size + 1);
      keyToCitation.set(key, citation);
      return [citation];
    });
}

async function hydrateProductEvidence(rows: Array<{
  id: string;
  productId: string;
  evidenceSourceId: string;
  claimType: string;
  claim: string;
  value: string;
  unit: string | null;
  createdAt: Date;
}>): Promise<ProductEvidenceRecord[]> {
  const sources = await prisma.evidenceSource.findMany({
    where: { id: { in: unique(rows.map((row) => row.evidenceSourceId)) } },
  });
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return rows.flatMap((row) => {
    const source = sourceById.get(row.evidenceSourceId);
    if (!source) return [];
    return [
      {
        id: row.id,
        productId: row.productId,
        evidenceSourceId: row.evidenceSourceId,
        claimType: row.claimType,
        claim: row.claim,
        value: row.value,
        unit: row.unit,
        source,
      },
    ];
  });
}

function userConstraintCitation(claim: string): EvidenceCitation[] {
  return [
    {
      evidenceId: undefined,
      sourceId: undefined,
      citationNumber: 0,
      title: "User constraint",
      sourceType: "user_constraint",
      publisher: "PCDealForge request payload",
      confidenceScore: 1,
      capturedAt: new Date().toISOString(),
      claim,
      value: "true",
      notes: "This citation reflects the current build request, not an external source.",
    },
  ];
}

function evidenceKey(productId: string, claimType: string) {
  return `${productId}:${claimType}`;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function uniqueCitations(citations: EvidenceCitation[]) {
  const seen = new Set<string>();
  return citations
    .filter((citation) => {
      const key = `${citation.title}:${citation.claim}:${citation.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((citation, index) => ({ ...citation, citationNumber: index + 1 }));
}

function renumberCitations(citations: EvidenceCitation[]) {
  return uniqueCitations(citations);
}
