import type { CompatibilityReport } from "../compatibility/types";
import type { PriceVerdictValue } from "../pricing/priceTrends";
import type { GeneratedBuild } from "./types";

export function calculateBuildPerformanceScore(build: Pick<GeneratedBuild, "parts">, useCase: string, resolution: string) {
  const cpuScore = specNumber(build.parts.cpu, "performanceScore");
  const gpuScore = specNumber(build.parts.gpu, "performanceScore");
  const ramGb = specNumber(build.parts.ram, "capacityGb");
  const storageGb = specNumber(build.parts.storage, "capacityGb");

  const gpuWeight = useCase === "gaming" ? (resolution === "4k" ? 0.62 : resolution === "1440p" ? 0.56 : 0.48) : 0.35;
  const cpuWeight = useCase === "workstation" ? 0.45 : 0.3;
  const ramScore = Math.min(100, (ramGb / 32) * 80);
  const storageScore = Math.min(100, (storageGb / 1000) * 65);

  return roundScore(gpuScore * gpuWeight + cpuScore * cpuWeight + ramScore * 0.1 + storageScore * 0.05);
}

export function compatibilityConfidence(report: CompatibilityReport) {
  const total = report.passCount + report.warningCount + report.failCount;
  if (total === 0) return 0;
  return roundScore(((report.passCount + report.warningCount * 0.55) / total) * 100);
}

export function budgetEfficiency(totalPrice: number, budget: number) {
  if (totalPrice > budget) return 0;
  const unusedRatio = (budget - totalPrice) / budget;
  return roundScore(100 - Math.min(35, unusedRatio * 100));
}

export function calculateOverallScore(
  performanceScore: number,
  dealScore: number,
  compatibility: CompatibilityReport,
  totalPrice: number,
  budget: number,
) {
  const warningPenalty = compatibility.warningCount * 3;
  return roundScore(
    performanceScore * 0.4 +
      dealScore * 0.25 +
      compatibilityConfidence(compatibility) * 0.2 +
      budgetEfficiency(totalPrice, budget) * 0.15 -
      warningPenalty,
  );
}

export function buildPriceVerdict(
  verdicts: PriceVerdictValue[],
  potentialSavings: number,
  totalPrice: number,
): PriceVerdictValue {
  const avoidCount = verdicts.filter((verdict) => verdict === "AVOID").length;
  if (avoidCount >= 2 && potentialSavings >= Math.max(75, totalPrice * 0.08)) return "AVOID";
  if (avoidCount > 0) return "WAIT";
  if (potentialSavings >= Math.max(50, totalPrice * 0.05) || verdicts.filter((verdict) => verdict === "WAIT").length >= 2) {
    return "WAIT";
  }
  return "BUY_NOW";
}

function specNumber(part: { specs: Record<string, unknown> }, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : 0;
}

function roundScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}
