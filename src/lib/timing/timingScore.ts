import type { GeneratedBuild } from "@/lib/builds/types";
import type { ProductCategory } from "@/lib/compatibility/types";

import { calculatePriceTiming } from "./marketTiming";
import { calculateReleaseTiming } from "./releaseTiming";
import type { BuildTimingReport, ProductReleaseSignal, ProductTimingReport, TimingVerdict } from "./types";

export function calculateProductTimingReport(
  build: GeneratedBuild,
  category: ProductCategory,
  signals: ProductReleaseSignal[],
): ProductTimingReport {
  const part = build.parts[category];
  const trend = build.productPriceTrends.find((item) => item.productId === part.id);

  if (!trend) {
    throw new Error(`Missing price trend for ${part.id}`);
  }

  const price = calculatePriceTiming(trend);
  const release = calculateReleaseTiming(category, part.brand, signals);
  const overallTimingScore = round(price.priceTimingScore * 0.62 + release.releaseTimingScore * 0.28 + build.dealScore * 0.1);
  const timingVerdict = combineTimingVerdicts(price.verdict, release.verdict, overallTimingScore);
  const priceDriven = timingVerdict === "WAIT_FOR_PRICE_DROP" || price.verdict === "WAIT_FOR_PRICE_DROP";
  const releaseDriven = timingVerdict === "WAIT_FOR_NEW_RELEASE";

  return {
    productId: part.id,
    productName: `${part.brand} ${part.model}`,
    category,
    priceTimingScore: price.priceTimingScore,
    releaseTimingScore: release.releaseTimingScore,
    overallTimingScore,
    timingVerdict,
    priceDriven,
    releaseDriven,
    priceExplanation: price.explanation,
    releaseExplanation: release.explanation,
    explanation: explainPartTiming(`${part.brand} ${part.model}`, timingVerdict, price.explanation, release.explanation),
    priceTrend: trend,
    releaseSignal: release.signal,
  };
}

export function calculateBuildTimingReport(build: GeneratedBuild, signals: ProductReleaseSignal[]): BuildTimingReport {
  const partReports = (Object.keys(build.parts) as ProductCategory[]).map((category) =>
    calculateProductTimingReport(build, category, signals),
  );
  const priceTimingScore = round(average(partReports.map((report) => report.priceTimingScore)));
  const releaseTimingScore = round(average(partReports.map((report) => report.releaseTimingScore)));
  const overallTimingScore = round(priceTimingScore * 0.55 + releaseTimingScore * 0.25 + build.dealScore * 0.2);
  const priceDrivenPart = [...partReports].sort(
    (left, right) =>
      right.priceTrend.estimatedSavingsIfWaiting - left.priceTrend.estimatedSavingsIfWaiting ||
      left.priceTimingScore - right.priceTimingScore,
  )[0];
  const releaseDrivenPart = [...partReports].sort(
    (left, right) => left.releaseTimingScore - right.releaseTimingScore || right.releaseSignal.confidenceScore - left.releaseSignal.confidenceScore,
  )[0];
  const timingVerdict = buildTimingVerdict(build, partReports, overallTimingScore, priceDrivenPart, releaseDrivenPart);
  const priceDriven = timingVerdict === "WAIT_FOR_PRICE_DROP" || partReports.filter((report) => report.timingVerdict === "WAIT_FOR_PRICE_DROP").length >= 2;
  const releaseDriven = timingVerdict === "WAIT_FOR_NEW_RELEASE";

  return {
    timingVerdict,
    overallTimingScore,
    priceTimingScore,
    releaseTimingScore,
    priceDriven,
    releaseDriven,
    priceDrivenPart,
    releaseDrivenPart,
    partReports,
    explanation: explainBuyNowVsWaitFromFacts(build, timingVerdict, priceDrivenPart, releaseDrivenPart, priceDriven, releaseDriven),
    releaseExplanation: explainReleaseTimingForBuild(releaseDrivenPart, releaseDriven),
    buyNowVsWait: explainBuyNowVsWaitFromFacts(build, timingVerdict, priceDrivenPart, releaseDrivenPart, priceDriven, releaseDriven),
    upgradeCycleRisk: explainUpgradeCycleRisk(build, releaseDrivenPart),
  };
}

export function explainPriceTiming(partOrBuild: ProductTimingReport | BuildTimingReport) {
  if ("priceExplanation" in partOrBuild) return partOrBuild.priceExplanation;
  return partOrBuild.buyNowVsWait;
}

export function explainReleaseTiming(partOrBuild: ProductTimingReport | BuildTimingReport) {
  return partOrBuild.releaseExplanation;
}

export function explainBuyNowVsWait(build: GeneratedBuild, timing: BuildTimingReport) {
  return explainBuyNowVsWaitFromFacts(
    build,
    timing.timingVerdict,
    timing.priceDrivenPart,
    timing.releaseDrivenPart,
    timing.priceDriven,
    timing.releaseDriven,
  );
}

export function explainUpgradeCycleRisk(build: GeneratedBuild, releaseDrivenPart?: ProductTimingReport) {
  const motherboard = build.parts.motherboard;
  const psu = build.parts.psu;
  const pcCase = build.parts.case;
  const modernPlatform = String(motherboard.specs.ramType ?? "").includes("DDR5") || String(motherboard.specs.socket ?? "").includes("AM5");
  const psuHeadroom = typeof psu.specs.wattage === "number" ? psu.specs.wattage : 0;
  const m2Slots = typeof motherboard.specs.m2Slots === "number" ? motherboard.specs.m2Slots : 0;

  return `Upgrade-cycle risk is ${modernPlatform && psuHeadroom >= 750 && m2Slots >= 2 ? "moderate to low" : "meaningful"} in seeded data. The selected platform is ${
    modernPlatform ? "modern enough for a stronger upgrade path" : "more cost-focused and less upgrade-forward"
  }, the PSU is ${psuHeadroom}W, and the case GPU clearance is ${String(
    pcCase.specs.maxGpuLengthMm ?? "unknown",
  )}mm. ${
    releaseDrivenPart?.releaseDriven
      ? `${releaseDrivenPart.productName} has the strongest release-cycle wait signal.`
      : "No high-confidence release signal forces waiting by itself."
  }`;
}

function combineTimingVerdicts(priceVerdict: TimingVerdict, releaseVerdict: TimingVerdict, score: number): TimingVerdict {
  if (priceVerdict === "AVOID") return "AVOID";
  if (releaseVerdict === "WAIT_FOR_NEW_RELEASE") return "WAIT_FOR_NEW_RELEASE";
  if (priceVerdict === "WAIT_FOR_PRICE_DROP") return "WAIT_FOR_PRICE_DROP";
  if (score < 60) return "BUY_ONLY_IF_NEEDED";
  if (priceVerdict === "BUY_ONLY_IF_NEEDED" || releaseVerdict === "BUY_ONLY_IF_NEEDED") return "BUY_ONLY_IF_NEEDED";
  return "BUY_NOW";
}

function buildTimingVerdict(
  build: GeneratedBuild,
  partReports: ProductTimingReport[],
  score: number,
  priceDrivenPart?: ProductTimingReport,
  releaseDrivenPart?: ProductTimingReport,
): TimingVerdict {
  if (build.priceVerdict === "AVOID" || partReports.some((report) => report.timingVerdict === "AVOID")) return "AVOID";
  if (releaseDrivenPart?.timingVerdict === "WAIT_FOR_NEW_RELEASE") return "WAIT_FOR_NEW_RELEASE";
  const waitCount = partReports.filter((report) => report.timingVerdict === "WAIT_FOR_PRICE_DROP").length;
  if (waitCount >= 2 || (priceDrivenPart?.priceTrend.estimatedSavingsIfWaiting ?? 0) >= Math.max(40, build.totalPrice * 0.03)) {
    return "WAIT_FOR_PRICE_DROP";
  }
  if (score < 68) return "BUY_ONLY_IF_NEEDED";
  return "BUY_NOW";
}

function explainPartTiming(name: string, verdict: TimingVerdict, priceExplanation: string, releaseExplanation: string) {
  if (verdict === "WAIT_FOR_NEW_RELEASE") {
    return `${name} is wait-for-new-release driven. ${releaseExplanation} Price context: ${priceExplanation}`;
  }
  if (verdict === "WAIT_FOR_PRICE_DROP") {
    return `${name} is wait-for-price-drop driven. ${priceExplanation} Release context: ${releaseExplanation}`;
  }
  if (verdict === "AVOID") {
    return `${name} should be avoided at the current seeded timing. ${priceExplanation} ${releaseExplanation}`;
  }
  if (verdict === "BUY_ONLY_IF_NEEDED") {
    return `${name} is acceptable only if needed now. ${priceExplanation} ${releaseExplanation}`;
  }
  return `${name} is a reasonable buy-now timing pick. ${priceExplanation} ${releaseExplanation}`;
}

function explainBuyNowVsWaitFromFacts(
  build: GeneratedBuild,
  verdict: TimingVerdict,
  priceDrivenPart?: ProductTimingReport,
  releaseDrivenPart?: ProductTimingReport,
  priceDriven = false,
  releaseDriven = false,
) {
  if (verdict === "BUY_NOW") {
    return `This build is a reasonable buy now in seeded data because the selected parts are compatible, current deal quality is acceptable, and no high-confidence release signal suggests an imminent replacement that should dominate the purchase decision.`;
  }

  if (verdict === "WAIT_FOR_NEW_RELEASE") {
    return `This build is a wait-for-new-release candidate. The strongest release-cycle concern is ${
      releaseDrivenPart?.productName ?? "a high-impact part"
    }. The recommendation is release-driven, not a rumor: it comes from the stored release signal type ${
      releaseDrivenPart?.releaseSignal.signalType ?? "unknown"
    }.`;
  }

  if (verdict === "WAIT_FOR_PRICE_DROP") {
    return `This build is not a strong buy today. The compatibility result is ${build.compatibilityReport.overallStatus}, but the timing verdict is WAIT_FOR_PRICE_DROP because ${
      priceDrivenPart?.productName ?? "one or more parts"
    } is above its seeded normal sale band or has meaningful estimated wait savings. The wait recommendation is mainly price-driven rather than launch-driven.`;
  }

  if (verdict === "AVOID") {
    return `This build should be avoided at the current seeded timing because price, listing risk, or part-level timing creates a poor value signal. The main concern is ${
      priceDrivenPart?.productName ?? releaseDrivenPart?.productName ?? "the selected offer mix"
    }.`;
  }

  return `This build is buy-only-if-needed. It is compatible, but ${
    priceDriven ? "price timing is not strong" : "deal quality is only moderate"
  }${releaseDriven ? " and release timing adds risk" : ""}. Waiting may be rational unless the user needs the system now.`;
}

function explainReleaseTimingForBuild(releaseDrivenPart?: ProductTimingReport, releaseDriven = false) {
  if (!releaseDriven) {
    return "The app does not have a high-confidence official release signal that requires waiting for a new generation. Any wait recommendation is mainly price-driven unless a cited release signal says otherwise.";
  }

  return `The release-cycle wait concern is driven by ${releaseDrivenPart?.productName ?? "a selected high-impact part"}. ${
    releaseDrivenPart?.releaseExplanation ?? ""
  }`;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}
