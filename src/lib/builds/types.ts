import type { BuildParts, CompatibilityReport, ProductForCompatibility } from "../compatibility/types";
import type { NormalizedOffer, RiskTolerance, ScoredOffer } from "../deals/types";
import type { BuildPriceVerdict } from "../pricing/buildPriceVerdict";
import type { DailyPricePoint, PriceVerdictValue, ProductPriceTrend } from "../pricing/priceTrends";

export type BuildUseCase = "gaming" | "workstation" | "general";
export type BuildResolution = "1080p" | "1440p" | "4k";
export type GpuPreference = "any" | "nvidia" | "amd";

export type BuildProduct = ProductForCompatibility & {
  normalizedName: string;
  mpn?: string | null;
  upc?: string | null;
};

export type BuildOptimizerInput = {
  budget: number;
  useCase: BuildUseCase;
  resolution: BuildResolution;
  gpuPreference: GpuPreference;
  ramGb: number;
  storageGb: number;
  wifiRequired: boolean;
  riskTolerance: RiskTolerance;
  products: BuildProduct[];
  offersByProductId: Record<string, NormalizedOffer[]>;
  historiesByProductId: Record<string, DailyPricePoint[]>;
};

export type CheaperCompatibleSwap = {
  category: keyof BuildParts;
  fromProductId: string;
  toProductId: string;
  savings: number;
  explanation: string;
};

export type GeneratedBuild = {
  id: string;
  parts: Required<BuildParts>;
  offers: Record<keyof Required<BuildParts>, ScoredOffer>;
  totalPrice: number;
  performanceScore: number;
  compatibilityReport: CompatibilityReport;
  dealScore: number;
  priceVerdict: PriceVerdictValue;
  priceVerdictDetails?: BuildPriceVerdict;
  productPriceTrends: ProductPriceTrend[];
  overallScore: number;
  whySelected: string;
  cheaperCompatibleSwaps: CheaperCompatibleSwap[];
};

export type BuildOptimizerResult = {
  bestOverall: GeneratedBuild | null;
  cheapestSafe: GeneratedBuild | null;
  bestPerformancePerDollar: GeneratedBuild | null;
  candidatesEvaluated: number;
};
