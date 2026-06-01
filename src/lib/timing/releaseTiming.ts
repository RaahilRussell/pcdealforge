import type { ProductCategory } from "@/lib/compatibility/types";

import type { ProductReleaseSignal, ReleaseTimingResult, TimingVerdict } from "./types";

const unknownSignal: ProductReleaseSignal = {
  id: "release-signal-unknown",
  category: "prebuilt",
  brand: "Unknown",
  productFamily: "Unknown",
  currentGeneration: "Unknown",
  expectedNextGeneration: null,
  signalType: "unknown",
  confidenceScore: 0,
  expectedWindowLabel: null,
  expectedDate: null,
  sourceTitle: "No release timing source",
  sourceUrl: null,
  notes:
    "No release timing source is available, so PCDealForge should not recommend waiting solely for a new release.",
};

export function selectReleaseSignal(
  category: ProductCategory | "prebuilt",
  brand: string,
  signals: ProductReleaseSignal[],
): ProductReleaseSignal {
  const categorySignals = signals.filter((signal) => signal.category === category);
  const brandNeedle = brand.toLowerCase();
  const exact = categorySignals.find((signal) => brandNeedle.includes(signal.brand.toLowerCase()));
  if (exact) return exact;

  const multiBrand = categorySignals.find((signal) => signal.brand.toLowerCase() === "multi-brand");
  if (multiBrand) return multiBrand;

  return {
    ...unknownSignal,
    category,
  };
}

export function calculateReleaseTiming(
  category: ProductCategory | "prebuilt",
  brand: string,
  signals: ProductReleaseSignal[],
): ReleaseTimingResult {
  const signal = selectReleaseSignal(category, brand, signals);
  const highImpactCategory = category === "gpu" || category === "cpu" || category === "prebuilt";
  const signalStrength = signal.confidenceScore * (highImpactCategory ? 1 : 0.55);
  const official = signal.signalType === "official_release" || signal.signalType === "official_teaser";
  const trusted = signal.signalType === "trusted_report";
  const seeded = signal.signalType === "seeded_demo";
  const imminent = isImminent(signal.expectedDate);
  const releaseTimingScore =
    signal.signalType === "unknown"
      ? 82
      : official && signalStrength >= 0.78 && (imminent || signal.expectedWindowLabel)
        ? 28
        : trusted && signalStrength >= 0.82 && highImpactCategory
          ? 42
          : seeded && signalStrength >= 0.75 && highImpactCategory
            ? 48
            : seeded && highImpactCategory
              ? 64
              : 82;
  const verdict = releaseVerdict(signal, releaseTimingScore, highImpactCategory);

  return {
    releaseTimingScore,
    verdict,
    signal,
    releaseDriven: verdict === "WAIT_FOR_NEW_RELEASE",
    explanation: explainReleaseTiming(signal, verdict, releaseTimingScore),
  };
}

export function explainReleaseTiming(signal: ProductReleaseSignal, verdict: TimingVerdict, score: number) {
  const sourceLabel = signal.signalType === "seeded_demo" ? "seeded demo release-cycle data" : signal.signalType;

  if (signal.signalType === "unknown") {
    return "The release timing signal is unknown, so the app should not recommend waiting solely for a new release.";
  }

  if (verdict === "WAIT_FOR_NEW_RELEASE") {
    return `Release timing is a wait factor based on ${sourceLabel}: ${signal.sourceTitle}. ${
      signal.expectedWindowLabel ?? "No exact date is asserted."
    } This is a timing signal, not an invented launch claim.`;
  }

  if (score < 70) {
    return `Based on ${sourceLabel}, this category has some wait risk, but the signal is not strong enough by itself to delay the build. ${
      signal.notes
    }`;
  }

  return `Release timing is low concern for this selection. ${signal.notes}`;
}

function releaseVerdict(signal: ProductReleaseSignal, score: number, highImpactCategory: boolean): TimingVerdict {
  if (!highImpactCategory) return "BUY_NOW";
  if (signal.signalType === "official_release" && score <= 40) return "WAIT_FOR_NEW_RELEASE";
  if (signal.signalType === "official_teaser" && score <= 40) return "WAIT_FOR_NEW_RELEASE";
  if (signal.signalType === "seeded_demo" && signal.confidenceScore >= 0.82 && score <= 50) return "WAIT_FOR_NEW_RELEASE";
  return score < 60 ? "BUY_ONLY_IF_NEEDED" : "BUY_NOW";
}

function isImminent(value?: Date | string | null) {
  if (!value) return false;
  const date = typeof value === "string" ? new Date(value) : value;
  const now = new Date();
  const diffDays = (date.getTime() - now.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays <= 90;
}
