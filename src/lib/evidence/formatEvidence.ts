import type { EvidenceCitation, ProductEvidenceRecord } from "./types";

export function formatEvidenceCitation(record: ProductEvidenceRecord, citationNumber: number): EvidenceCitation {
  return {
    citationNumber,
    title: record.source.sourceType === "seeded_demo" ? "Seeded demo source" : record.source.title,
    sourceType: record.source.sourceType,
    publisher: record.source.publisher,
    url: record.source.url,
    confidenceScore: record.source.confidenceScore,
    capturedAt:
      typeof record.source.capturedAt === "string"
        ? record.source.capturedAt
        : record.source.capturedAt.toISOString(),
    claim: record.claim,
    value: record.value,
    unit: record.unit,
    notes: record.source.notes,
  };
}

export function citationMarker(citation: EvidenceCitation) {
  return `[${citation.citationNumber}]`;
}

export function appendCitationMarkers(text: string, citations: EvidenceCitation[]) {
  if (citations.length === 0) return text;
  return `${text} ${citations.map(citationMarker).join("")}`;
}

export function sourceTypeLabel(sourceType: string) {
  return sourceType
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function summarizeEvidence(citations: EvidenceCitation[]) {
  const totalSources = citations.length;
  const averageConfidence =
    totalSources === 0
      ? 0
      : Math.round(
          (citations.reduce((sum, citation) => sum + citation.confidenceScore, 0) / totalSources) * 100,
        ) / 100;
  const seededDemoCount = citations.filter((citation) => citation.sourceType === "seeded_demo").length;
  const internalCalculationCount = citations.filter((citation) => citation.sourceType === "internal_calculation").length;
  const compatibilityRuleCount = citations.filter((citation) => citation.sourceType === "compatibility_rule").length;

  return {
    totalSources,
    averageConfidence,
    seededDemoCount,
    internalCalculationCount,
    compatibilityRuleCount,
  };
}
