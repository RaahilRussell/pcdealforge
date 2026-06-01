import type { EnhancedGeneratedBuild } from "@/lib/builds/reporting";
import type { mapPrebuiltSystem } from "@/lib/data/catalog";
import type { EvidenceCitation } from "@/lib/evidence/types";
import type { BuildTimingReport, TimingVerdict } from "@/lib/timing/types";

type Prebuilt = ReturnType<typeof mapPrebuiltSystem>;

export type RecommendationCategoryId =
  | "best_overall"
  | "cheapest_safe"
  | "best_performance_per_dollar"
  | "best_for_gaming"
  | "best_for_ai_local_llms"
  | "best_for_streaming"
  | "best_for_content_creation"
  | "best_upgrade_path"
  | "best_prebuilt_alternative"
  | "best_buy_now"
  | "best_wait_for_price_drop"
  | "best_avoid";

export type BuildRecommendationCategory = {
  categoryId: RecommendationCategoryId;
  title: string;
  buildId?: string;
  prebuiltId?: string;
  totalPrice: number;
  compatibilityStatus: string;
  priceVerdict: string;
  timingVerdict: TimingVerdict | string;
  performanceScore: number;
  categoryScore: number;
  shortWhy: string;
  detailedWhy: string;
  positives: string[];
  negatives: string[];
  whoShouldPickThis: string;
  whoShouldAvoidThis: string;
  evidence: EvidenceCitation[];
};

export function generateRecommendationCategories({
  builds,
  prebuilts,
}: {
  builds: EnhancedGeneratedBuild[];
  prebuilts: Prebuilt[];
}): BuildRecommendationCategory[] {
  const categories: BuildRecommendationCategory[] = [];
  const bestOverall = byId(builds, "best_overall") ?? highest(builds, (build) => build.overallScore);
  const cheapestSafe = byId(builds, "cheapest_safe") ?? lowest(builds, (build) => build.totalPrice);
  const bestPerfDollar =
    byId(builds, "best_performance_per_dollar") ?? highest(builds, (build) => build.performanceScore / build.totalPrice);
  const bestGaming = highest(builds, scoreGaming);
  const bestAi = highest(builds, scoreAi);
  const bestStreaming = highest(builds, scoreStreaming);
  const bestContent = highest(builds, scoreContentCreation);
  const bestUpgrade = highest(builds, scoreUpgradePath);
  const bestBuyNow =
    highest(
      builds.filter((build) => build.timingReport?.timingVerdict === "BUY_NOW"),
      scoreBuyNow,
    ) ?? highest(builds, scoreBuyNow);
  const bestWait =
    highest(
      builds.filter((build) =>
        ["WAIT_FOR_PRICE_DROP", "WAIT_FOR_NEW_RELEASE", "BUY_ONLY_IF_NEEDED"].includes(
          build.timingReport?.timingVerdict ?? "",
        ),
      ),
      scoreWait,
    ) ?? highest(builds, scoreWait);
  const bestAvoid =
    highest(
      builds.filter((build) => build.timingReport?.timingVerdict === "AVOID" || build.priceVerdict === "AVOID"),
      scoreAvoid,
    ) ?? highest(builds, scoreAvoid);
  const bestPrebuilt = highest(prebuilts, scorePrebuilt);

  if (bestOverall) categories.push(buildCategory("best_overall", "Best Overall", bestOverall, bestOverall.overallScore));
  if (cheapestSafe) categories.push(buildCategory("cheapest_safe", "Cheapest Safe", cheapestSafe, 100 - cheapestSafe.totalPrice / 40));
  if (bestPerfDollar) {
    categories.push(
      buildCategory(
        "best_performance_per_dollar",
        "Best Performance/$",
        bestPerfDollar,
        bestPerfDollar.performanceScore / Math.max(1, bestPerfDollar.totalPrice / 100),
      ),
    );
  }
  if (bestGaming) categories.push(buildCategory("best_for_gaming", "Best for Gaming", bestGaming, scoreGaming(bestGaming)));
  if (bestAi) categories.push(buildCategory("best_for_ai_local_llms", "Best for AI / Local LLMs", bestAi, scoreAi(bestAi)));
  if (bestStreaming) categories.push(buildCategory("best_for_streaming", "Best for Streaming", bestStreaming, scoreStreaming(bestStreaming)));
  if (bestContent) {
    categories.push(
      buildCategory("best_for_content_creation", "Best for Content Creation", bestContent, scoreContentCreation(bestContent)),
    );
  }
  if (bestUpgrade) categories.push(buildCategory("best_upgrade_path", "Best Upgrade Path", bestUpgrade, scoreUpgradePath(bestUpgrade)));
  if (bestPrebuilt) categories.push(prebuiltCategory(bestPrebuilt));
  if (bestBuyNow) categories.push(buildCategory("best_buy_now", "Best Buy Now", bestBuyNow, scoreBuyNow(bestBuyNow)));
  if (bestWait) categories.push(buildCategory("best_wait_for_price_drop", "Best Wait-and-Watch", bestWait, scoreWait(bestWait)));
  if (bestAvoid) categories.push(buildCategory("best_avoid", "Best Avoid", bestAvoid, scoreAvoid(bestAvoid)));

  return categories;
}

function buildCategory(
  categoryId: RecommendationCategoryId,
  title: string,
  build: EnhancedGeneratedBuild,
  categoryScore: number,
): BuildRecommendationCategory {
  const timing = build.timingReport;
  return {
    categoryId,
    title,
    buildId: build.id,
    totalPrice: build.totalPrice,
    compatibilityStatus: build.compatibilityReport.overallStatus,
    priceVerdict: build.priceVerdict,
    timingVerdict: timing?.timingVerdict ?? build.priceVerdict,
    performanceScore: build.performanceScore,
    categoryScore: round(categoryScore),
    shortWhy: shortWhy(categoryId, build),
    detailedWhy: detailedWhy(categoryId, build, timing),
    positives: positivesFor(categoryId, build),
    negatives: negativesFor(categoryId, build),
    whoShouldPickThis: whoShouldPick(categoryId),
    whoShouldAvoidThis: whoShouldAvoid(categoryId, build),
    evidence: build.evidence.slice(0, 10),
  };
}

function prebuiltCategory(prebuilt: Prebuilt): BuildRecommendationCategory {
  return {
    categoryId: "best_prebuilt_alternative",
    title: "Best Prebuilt Alternative",
    prebuiltId: prebuilt.id,
    totalPrice: prebuilt.price,
    compatibilityStatus: "PREBUILT",
    priceVerdict: "N/A",
    timingVerdict: prebuilt.timingVerdict,
    performanceScore: prebuilt.valueScore,
    categoryScore: scorePrebuilt(prebuilt),
    shortWhy: `${prebuilt.brand} ${prebuilt.model} is the strongest seeded prebuilt alternative by value, upgradeability, and hidden-risk score.`,
    detailedWhy: `This prebuilt is selected because it combines value score ${Math.round(
      prebuilt.valueScore,
    )}, upgradeability score ${Math.round(prebuilt.upgradeabilityScore)}, and hidden-risk score ${Math.round(
      prebuilt.hiddenRiskScore,
    )}. It may have a warranty/convenience advantage over DIY, but exact PSU, motherboard, cooling, and proprietary-part risks still need verification.`,
    positives: ["Warranty and convenience may be better than DIY.", "Known CPU/GPU/RAM/storage fields are visible in seeded data."],
    negatives: ["Seeded prebuilt data is not a live retailer feed.", "Hidden component details can weaken upgradeability."],
    whoShouldPickThis: "Pick this if convenience, warranty, and one-box purchase matter more than component transparency.",
    whoShouldAvoidThis: "Avoid this if exact PSU, motherboard, cooling, and case details must be known before buying.",
    evidence: [],
  };
}

function shortWhy(categoryId: RecommendationCategoryId, build: EnhancedGeneratedBuild) {
  if (categoryId === "best_for_gaming") {
    return "Chosen because it maximizes GPU performance for the requested resolution while preserving CPU, PSU, and cooling headroom.";
  }
  if (categoryId === "best_for_ai_local_llms") {
    return "Chosen because it prioritizes VRAM, NVIDIA/CUDA tooling where available, system RAM, storage, and PSU headroom over pure FPS-per-dollar.";
  }
  if (categoryId === "best_buy_now") {
    return "Chosen because it has the strongest current timing and no major release-cycle warning in seeded data.";
  }
  if (categoryId === "best_wait_for_price_drop") {
    return "Chosen because it is otherwise attractive, but the timing report says waiting is more rational.";
  }
  return build.whySelected;
}

function detailedWhy(categoryId: RecommendationCategoryId, build: EnhancedGeneratedBuild, timing?: BuildTimingReport) {
  const gpu = build.parts.gpu;
  if (categoryId === "best_for_ai_local_llms") {
    return `AI/local LLM builds care more about VRAM and CUDA compatibility than pure gaming FPS. This category weighs ${gpu.model} VRAM, GPU brand/tooling, system RAM, storage, PSU headroom, and cooling. ${
      gpu.brand.toLowerCase().includes("amd")
        ? "AMD can be strong for gaming/value, but local AI tooling is often smoother on NVIDIA/CUDA. Treat that as a tooling consideration, not a universal performance rule."
        : "The selected NVIDIA GPU receives a CUDA/tooling preference in this deterministic category score."
    }`;
  }
  if (categoryId === "best_wait_for_price_drop") {
    return timing?.buyNowVsWait ?? build.whySelected;
  }
  if (categoryId === "best_buy_now") {
    return timing?.buyNowVsWait ?? build.whySelected;
  }
  return `${build.whySelected} Timing verdict: ${timing?.timingVerdict ?? build.priceVerdict}.`;
}

function positivesFor(categoryId: RecommendationCategoryId, build: EnhancedGeneratedBuild) {
  const gpu = build.parts.gpu;
  const motherboard = build.parts.motherboard;
  const psu = build.parts.psu;
  if (categoryId === "best_upgrade_path") {
    return [
      `${String(motherboard.specs.socket ?? "Unknown")} platform`,
      `${String(motherboard.specs.ramType ?? "Unknown")} memory support`,
      `${String(motherboard.specs.m2Slots ?? "Unknown")} M.2 slot data`,
      `${String(psu.specs.wattage ?? "Unknown")}W PSU headroom`,
    ];
  }
  return [
    `${gpu.model} drives most of the performance score.`,
    `Compatibility status is ${build.compatibilityReport.overallStatus}.`,
    `Timing verdict is ${build.timingReport?.timingVerdict ?? build.priceVerdict}.`,
  ];
}

function negativesFor(categoryId: RecommendationCategoryId, build: EnhancedGeneratedBuild) {
  if (categoryId === "best_avoid") {
    return ["This category exists to show what not to buy right now.", build.timingReport?.buyNowVsWait ?? "Timing is weak."];
  }
  return [
    build.timingReport?.priceDrivenPart
      ? `${build.timingReport.priceDrivenPart.productName} is the main price-timing risk.`
      : "Seeded demo data still requires live retailer verification.",
  ];
}

function whoShouldPick(categoryId: RecommendationCategoryId) {
  if (categoryId === "best_for_gaming") return "Pick this for GPU-prioritized gaming performance at the selected resolution.";
  if (categoryId === "best_for_ai_local_llms") return "Pick this for local AI experimentation where VRAM and tooling matter.";
  if (categoryId === "best_for_content_creation") return "Pick this for CPU/GPU/RAM/storage balance in creative workloads.";
  if (categoryId === "best_buy_now") return "Pick this if buying today matters and timing is favorable.";
  if (categoryId === "best_wait_for_price_drop") return "Track this if the build is good but the current price timing is weak.";
  if (categoryId === "best_avoid") return "Use this as a warning category, not a purchase recommendation.";
  return "Pick this if its stated tradeoff matches your budget and use case.";
}

function whoShouldAvoid(categoryId: RecommendationCategoryId, build: EnhancedGeneratedBuild) {
  if (categoryId === "best_for_ai_local_llms" && build.parts.gpu.brand.toLowerCase().includes("amd")) {
    return "Avoid this for local AI if your toolchain depends on CUDA-first workflows.";
  }
  if (categoryId === "best_wait_for_price_drop") return "Avoid buying immediately unless you need the system now.";
  if (categoryId === "best_avoid") return "Anyone trying to buy immediately should avoid this category.";
  return "Avoid this if you need live retailer guarantees rather than seeded demo evidence.";
}

function scoreGaming(build: EnhancedGeneratedBuild) {
  return (
    num(build.parts.gpu, "performanceScore") * 0.48 +
    num(build.parts.gpu, "vramGb") * 2.4 +
    num(build.parts.cpu, "performanceScore") * 0.18 +
    num(build.parts.case, "airflowScore") * 0.12 +
    build.dealScore * 0.12 +
    timingBonus(build)
  );
}

function scoreAi(build: EnhancedGeneratedBuild) {
  const nvidiaBonus = build.parts.gpu.brand.toLowerCase().includes("nvidia") ? 24 : -8;
  return (
    num(build.parts.gpu, "vramGb") * 5.2 +
    nvidiaBonus +
    num(build.parts.ram, "capacityGb") * 0.8 +
    num(build.parts.storage, "capacityGb") / 100 +
    num(build.parts.psu, "wattage") / 25 +
    timingBonus(build)
  );
}

function scoreStreaming(build: EnhancedGeneratedBuild) {
  const encoderBonus = build.parts.gpu.brand.toLowerCase().includes("nvidia") ? 14 : 6;
  return num(build.parts.gpu, "performanceScore") * 0.32 + num(build.parts.cpu, "performanceScore") * 0.34 + encoderBonus + num(build.parts.ram, "capacityGb") * 0.5 + timingBonus(build);
}

function scoreContentCreation(build: EnhancedGeneratedBuild) {
  return (
    num(build.parts.cpu, "performanceScore") * 0.38 +
    num(build.parts.gpu, "performanceScore") * 0.25 +
    num(build.parts.ram, "capacityGb") * 0.65 +
    num(build.parts.storage, "capacityGb") / 75 +
    num(build.parts.cooler, "tdpRating") / 10 +
    timingBonus(build)
  );
}

function scoreUpgradePath(build: EnhancedGeneratedBuild) {
  const motherboard = build.parts.motherboard;
  const psu = build.parts.psu;
  const pcCase = build.parts.case;
  const ddr5Bonus = String(motherboard.specs.ramType ?? "").includes("DDR5") ? 20 : 0;
  const am5Bonus = String(motherboard.specs.socket ?? "").includes("AM5") ? 18 : 0;
  return ddr5Bonus + am5Bonus + num(motherboard, "m2Slots") * 5 + num(psu, "wattage") / 18 + num(pcCase, "maxGpuLengthMm") / 20 + timingBonus(build);
}

function scoreBuyNow(build: EnhancedGeneratedBuild) {
  return (build.timingReport?.overallTimingScore ?? 50) + (build.priceVerdict === "BUY_NOW" ? 25 : 0) - build.compatibilityReport.warningCount * 6;
}

function scoreWait(build: EnhancedGeneratedBuild) {
  const timing = build.timingReport;
  return (timing?.timingVerdict === "WAIT_FOR_PRICE_DROP" || timing?.timingVerdict === "WAIT_FOR_NEW_RELEASE" ? 80 : 35) + build.performanceScore * 0.2;
}

function scoreAvoid(build: EnhancedGeneratedBuild) {
  return (build.timingReport?.timingVerdict === "AVOID" || build.priceVerdict === "AVOID" ? 90 : 10) + build.performanceScore * 0.05;
}

function scorePrebuilt(prebuilt: Prebuilt) {
  return Math.round((prebuilt.valueScore * 0.45 + prebuilt.upgradeabilityScore * 0.25 + prebuilt.confidenceScore * 100 * 0.2 - prebuilt.hiddenRiskScore * 0.25) * 100) / 100;
}

function timingBonus(build: EnhancedGeneratedBuild) {
  const verdict = build.timingReport?.timingVerdict;
  if (verdict === "BUY_NOW") return 12;
  if (verdict === "BUY_ONLY_IF_NEEDED") return 2;
  if (verdict === "WAIT_FOR_PRICE_DROP") return -5;
  if (verdict === "WAIT_FOR_NEW_RELEASE") return -8;
  if (verdict === "AVOID") return -20;
  return 0;
}

function byId(builds: EnhancedGeneratedBuild[], buildType: string) {
  return builds.find((build) => build.id.includes(buildType));
}

function highest<T>(items: T[], score: (item: T) => number): T | null {
  return [...items].sort((left, right) => score(right) - score(left))[0] ?? null;
}

function lowest<T>(items: T[], score: (item: T) => number): T | null {
  return [...items].sort((left, right) => score(left) - score(right))[0] ?? null;
}

function num(part: { specs: Record<string, unknown> }, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
