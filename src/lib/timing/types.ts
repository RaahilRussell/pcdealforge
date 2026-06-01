import type { ProductCategory } from "@/lib/compatibility/types";
import type { ProductPriceTrend } from "@/lib/pricing/priceTrends";

export type TimingVerdict =
  | "BUY_NOW"
  | "WAIT_FOR_PRICE_DROP"
  | "WAIT_FOR_NEW_RELEASE"
  | "BUY_ONLY_IF_NEEDED"
  | "AVOID";

export type ReleaseSignalType =
  | "official_release"
  | "official_teaser"
  | "trusted_report"
  | "seeded_demo"
  | "unknown";

export type ProductReleaseSignal = {
  id: string;
  category: ProductCategory | "prebuilt";
  brand: string;
  productFamily: string;
  currentGeneration: string;
  expectedNextGeneration?: string | null;
  signalType: ReleaseSignalType | string;
  confidenceScore: number;
  expectedWindowLabel?: string | null;
  expectedDate?: Date | string | null;
  sourceTitle: string;
  sourceUrl?: string | null;
  notes: string;
};

export type PriceTimingInput = {
  trend: ProductPriceTrend;
};

export type ReleaseTimingInput = {
  category: ProductCategory | "prebuilt";
  brand: string;
  productFamily?: string;
  signals: ProductReleaseSignal[];
};

export type PriceTimingResult = {
  priceTimingScore: number;
  verdict: TimingVerdict;
  volatility: number;
  estimatedSavingsIfWaiting: number;
  usuallyCheaper: boolean;
  explanation: string;
};

export type ReleaseTimingResult = {
  releaseTimingScore: number;
  verdict: TimingVerdict;
  signal: ProductReleaseSignal;
  releaseDriven: boolean;
  explanation: string;
};

export type ProductTimingReport = {
  productId: string;
  productName: string;
  category: ProductCategory;
  priceTimingScore: number;
  releaseTimingScore: number;
  overallTimingScore: number;
  timingVerdict: TimingVerdict;
  priceDriven: boolean;
  releaseDriven: boolean;
  priceExplanation: string;
  releaseExplanation: string;
  explanation: string;
  priceTrend: ProductPriceTrend;
  releaseSignal: ProductReleaseSignal;
};

export type BuildTimingReport = {
  timingVerdict: TimingVerdict;
  overallTimingScore: number;
  priceTimingScore: number;
  releaseTimingScore: number;
  priceDriven: boolean;
  releaseDriven: boolean;
  priceDrivenPart?: ProductTimingReport;
  releaseDrivenPart?: ProductTimingReport;
  partReports: ProductTimingReport[];
  explanation: string;
  releaseExplanation: string;
  buyNowVsWait: string;
  upgradeCycleRisk: string;
};
