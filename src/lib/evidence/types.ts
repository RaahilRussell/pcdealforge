export type EvidenceSourceType =
  | "manufacturer_spec"
  | "retailer_offer"
  | "benchmark_reference"
  | "compatibility_rule"
  | "price_snapshot"
  | "seeded_demo"
  | "user_constraint"
  | "internal_calculation";

export type EvidenceCitation = {
  evidenceId?: string;
  sourceId?: string;
  citationNumber: number;
  title: string;
  sourceType: EvidenceSourceType | string;
  publisher: string;
  url?: string | null;
  confidenceScore: number;
  capturedAt: string;
  claim: string;
  value: string;
  unit?: string | null;
  notes?: string | null;
};

export type ProductEvidenceRecord = {
  id: string;
  productId: string;
  evidenceSourceId: string;
  claimType: string;
  claim: string;
  value: string;
  unit?: string | null;
  source: {
    id: string;
    sourceType: EvidenceSourceType | string;
    title: string;
    publisher: string;
    url?: string | null;
    capturedAt: Date | string;
    confidenceScore: number;
    notes?: string | null;
  };
};

export type EvidenceBundle = {
  citations: EvidenceCitation[];
  byKey: Record<string, EvidenceCitation>;
};
