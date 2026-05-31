import type { EvidenceCitation } from "@/lib/evidence/types";

export type ProductCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "psu"
  | "case"
  | "cooler";

export type CompatibilityLevel = "PASS" | "WARNING" | "FAIL";

export type ProductForCompatibility = {
  id: string;
  category: ProductCategory;
  brand: string;
  model: string;
  specs: Record<string, unknown>;
};

export type BuildParts = Partial<Record<ProductCategory, ProductForCompatibility>>;

export type CompatibilityCheckInput = {
  parts: BuildParts;
  wifiRequired?: boolean;
};

export type CompatibilityResult = {
  id: string;
  level: CompatibilityLevel;
  title: string;
  explanation: string;
  affectedParts: ProductCategory[];
  confidence: number;
  ruleId: string;
  evidence: EvidenceCitation[];
};

export type CompatibilityReport = {
  overallStatus: CompatibilityLevel;
  passCount: number;
  warningCount: number;
  failCount: number;
  results: CompatibilityResult[];
};
