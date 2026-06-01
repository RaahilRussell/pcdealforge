import type { LiveProduct } from "./types";

/**
 * Product matching for live retailer listings.
 *
 * Thresholds (per spec):
 *  - >= 0.90  -> verified (eligible to become a verified_live price)
 *  - 0.75..0.89 -> possible match (NOT auto-used for totals)
 *  - < 0.75 -> reject
 *
 * Category-specific checks prevent confusing close-but-different products, e.g. RTX 5070 vs
 * RTX 5070 Ti, or 14600K vs 14600KF.
 */

export type LiveMatchTier = "verified" | "possible" | "reject";

export type LiveMatchResult = {
  score: number;
  tier: LiveMatchTier;
  rejected: boolean;
  reasons: string[];
};

export type LiveCandidate = {
  title: string;
  brand?: string;
  mpn?: string | null;
  upc?: string | null;
};

export function scoreLiveMatch(target: LiveProduct, candidate: LiveCandidate): LiveMatchResult {
  const reasons: string[] = [];
  const title = normalize(candidate.title);
  let score = 0;

  if (target.upc && candidate.upc && digits(target.upc) === digits(candidate.upc)) {
    score = Math.max(score, 0.97);
    reasons.push("UPC matched");
  }
  if (target.mpn && candidate.mpn && normalize(target.mpn) === normalize(candidate.mpn)) {
    score = Math.max(score, 0.95);
    reasons.push("MPN matched");
  }
  if (target.mpn && title.includes(normalize(target.mpn))) {
    score = Math.max(score, 0.92);
    reasons.push("MPN found in title");
  }

  const brandMatch = !!target.brand && (title.includes(normalize(target.brand)) || normalize(candidate.brand ?? "") === normalize(target.brand));
  const modelTokens = tokenize(target.model);
  const modelHits = modelTokens.filter((token) => title.includes(token)).length;
  const modelRatio = modelTokens.length ? modelHits / modelTokens.length : 0;
  if (brandMatch && modelRatio >= 0.6) {
    score = Math.max(score, 0.78 + modelRatio * 0.12);
    reasons.push("Brand/model matched");
  } else if (modelRatio >= 0.6) {
    score = Math.max(score, 0.72 + modelRatio * 0.1);
    reasons.push("Model matched");
  }

  const rejection = categoryRejection(target, title);
  if (rejection) {
    reasons.push(rejection);
    return { score: Math.min(score, 0.5), tier: "reject", rejected: true, reasons };
  }

  // Category confirmations raise confidence toward the verified threshold.
  applyConfirmations(target, title, reasons, (bonus) => {
    score = Math.min(0.99, Math.max(score, score + bonus));
  });

  if (reasons.length === 0) reasons.push("No strong identifiers matched");

  const tier: LiveMatchTier = score >= 0.9 ? "verified" : score >= 0.75 ? "possible" : "reject";
  return { score: round(Math.min(score, 0.99)), tier, rejected: tier === "reject", reasons };
}

function categoryRejection(target: LiveProduct, title: string): string | null {
  const category = target.category;

  if (category === "gpu" || looksLikeGpu(target)) {
    const targetGpu = parseGpuModel(target.model);
    const titleGpu = parseGpuModelFromTitle(title);
    if (targetGpu && titleGpu && !gpuModelsEqual(targetGpu, titleGpu)) {
      return `Rejected: title says ${titleGpu.raw} but target is ${targetGpu.raw}`;
    }
    const vram = specNumber(target, "gpuVramGb", "vramGb");
    if (vram) {
      const titleVram = matchNumber(title, /(\d+)\s?gb/);
      if (titleVram !== null && titleVram !== vram) {
        return `Rejected: listing says ${titleVram}GB VRAM but target is ${vram}GB`;
      }
    }
  }

  if (category === "cpu" || looksLikeCpu(target)) {
    const targetCpu = parseCpuModel(target.model);
    const titleCpu = parseCpuModelFromTitle(title);
    if (targetCpu && titleCpu && targetCpu !== titleCpu) {
      return `Rejected: title CPU ${titleCpu} does not match target ${targetCpu}`;
    }
  }

  if (category === "ram") {
    const capacity = specNumber(target, "capacityGb");
    if (capacity) {
      const titleCap = matchNumber(title, /(\d+)\s?gb/);
      if (titleCap !== null && titleCap !== capacity) {
        return `Rejected: listing says ${titleCap}GB but target RAM is ${capacity}GB`;
      }
    }
    const ddr = stringSpec(target, "ramType");
    if (ddr) {
      const titleDdr = title.match(/ddr(\d)/)?.[0];
      if (titleDdr && titleDdr !== normalize(ddr)) {
        return `Rejected: listing is ${titleDdr.toUpperCase()} but target RAM is ${ddr}`;
      }
    }
  }

  if (category === "storage") {
    const capacity = specNumber(target, "capacityGb");
    if (capacity) {
      const tb = capacity >= 1000 ? capacity / 1000 : null;
      const titleCap = matchNumber(title, /(\d+)\s?gb/);
      const titleTb = matchNumber(title, /(\d+)\s?tb/);
      if (titleCap !== null && titleCap !== capacity && titleTb === null) {
        return `Rejected: listing says ${titleCap}GB but target storage is ${capacity}GB`;
      }
      if (tb !== null && titleTb !== null && titleTb !== tb) {
        return `Rejected: listing says ${titleTb}TB but target storage is ${tb}TB`;
      }
    }
  }

  if (category === "psu") {
    const wattage = specNumber(target, "wattage");
    if (wattage) {
      const titleWatt = matchNumber(title, /(\d{3,4})\s?w\b/);
      if (titleWatt !== null && Math.abs(titleWatt - wattage) >= 50) {
        return `Rejected: listing says ${titleWatt}W but target PSU is ${wattage}W`;
      }
    }
  }

  return null;
}

function applyConfirmations(target: LiveProduct, title: string, reasons: string[], addBonus: (bonus: number) => void) {
  const vram = specNumber(target, "gpuVramGb", "vramGb");
  if (vram && title.includes(`${vram}gb`)) {
    reasons.push("VRAM matched");
    addBonus(0.05);
  }
  const capacity = specNumber(target, "capacityGb");
  if (capacity && (title.includes(`${capacity}gb`) || (capacity >= 1000 && title.includes(`${capacity / 1000}tb`)))) {
    reasons.push("Capacity matched");
    addBonus(0.05);
  }
  const wattage = specNumber(target, "wattage");
  if (wattage && title.includes(`${wattage}w`)) {
    reasons.push("Wattage matched");
    addBonus(0.05);
  }
}

type GpuModel = { brand: string; number: string; suffix: string; raw: string };

function parseGpuModel(text: string): GpuModel | null {
  const match = normalize(text).match(/\b(rtx|rx|gtx|arc)\s?(\d{3,4})\s?(xtx|xt|ti super|ti|super)?\b/);
  if (!match) return null;
  return {
    brand: match[1],
    number: match[2],
    suffix: (match[3] ?? "").replace(/\s+/g, " ").trim(),
    raw: [match[1], match[2], match[3]].filter(Boolean).join(" ").toUpperCase(),
  };
}

function parseGpuModelFromTitle(title: string): GpuModel | null {
  return parseGpuModel(title);
}

function gpuModelsEqual(a: GpuModel, b: GpuModel) {
  return a.number === b.number && a.suffix === b.suffix;
}

/** Extract a CPU model id like "14600k", "14600kf", "7800x3d". */
function parseCpuModel(text: string): string | null {
  const normalized = normalize(text);
  const match = normalized.match(/\b(\d{4,5})\s?(x3d|ks|kf|xt|k|x|f|g|t|u|h)?\b/);
  if (!match) return null;
  return `${match[1]}${match[2] ?? ""}`;
}

function parseCpuModelFromTitle(title: string): string | null {
  return parseCpuModel(title);
}

function looksLikeGpu(target: LiveProduct) {
  return /\b(rtx|rx|gtx|arc)\b/.test(normalize(target.model));
}

function looksLikeCpu(target: LiveProduct) {
  return /\b(ryzen|core|i[3579]|ultra)\b/.test(normalize(target.model));
}

function specNumber(target: LiveProduct, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = target.specs?.[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function stringSpec(target: LiveProduct, key: string): string | null {
  const value = target.specs?.[key];
  return typeof value === "string" ? value : null;
}

function matchNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
