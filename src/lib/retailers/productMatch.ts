import type { RawRetailerOffer, RetailerTargetProduct } from "./types";

/**
 * Deterministic product-match scoring between a target product and a retailer listing.
 *
 * The goal is to never verify an offer that is actually for a different product (e.g. a listing
 * titled "RTX 5060" matched against a target "RTX 5070"). Identifiers (UPC/MPN/SKU) give the
 * strongest signal; spec conflicts (VRAM, CPU model, RAM capacity, PSU wattage) are hard rejects.
 */

export type ProductMatchResult = {
  score: number;
  reasons: string[];
  rejected: boolean;
};

export function scoreProductMatch(
  target: RetailerTargetProduct,
  offer: Pick<RawRetailerOffer, "title" | "brand" | "model" | "mpn" | "upc" | "sku" | "sourceRetailer">,
): ProductMatchResult {
  const reasons: string[] = [];
  const title = normalize(offer.title);
  let score = 0;

  // ---- Identifier matches (strongest signal). ----
  if (target.upc && offer.upc && digits(target.upc) === digits(offer.upc)) {
    score = Math.max(score, 0.98);
    reasons.push("UPC matched");
  }
  if (target.mpn && offer.mpn && normalize(target.mpn) === normalize(offer.mpn)) {
    score = Math.max(score, 0.95);
    reasons.push("MPN matched");
  }
  if (offer.sku && skuMatchesTarget(target, offer.sku)) {
    score = Math.max(score, 0.9);
    reasons.push("SKU matched");
  }

  // ---- Brand/model textual match. ----
  const brandMatches = !!target.brand && (title.includes(normalize(target.brand)) || normalize(offer.brand ?? "") === normalize(target.brand));
  const modelTokens = tokenize(target.model);
  const modelHits = modelTokens.filter((token) => title.includes(token)).length;
  const modelRatio = modelTokens.length ? modelHits / modelTokens.length : 0;
  if (brandMatches && modelRatio >= 0.6) {
    score = Math.max(score, 0.8 + modelRatio * 0.1);
    reasons.push("Brand/model matched");
  } else if (modelRatio >= 0.6) {
    score = Math.max(score, 0.7);
    reasons.push("Model matched");
  }

  // ---- Spec hard rejects. ----
  const rejection = specRejection(target, title);
  if (rejection) {
    reasons.push(rejection);
    return { score: Math.min(score, 0.4), reasons, rejected: true };
  }

  // ---- Spec confirmations (raise confidence). ----
  const vram = specNumber(target, "gpuVramGb", "vramGb");
  if (vram && title.includes(`${vram}gb`)) reasons.push("VRAM matched");
  const capacity = specNumber(target, "capacityGb");
  if (capacity && (title.includes(`${capacity}gb`) || (capacity >= 1000 && title.includes(`${capacity / 1000}tb`)))) {
    reasons.push("Capacity matched");
  }
  const wattage = specNumber(target, "wattage");
  if (wattage && title.includes(`${wattage}w`)) reasons.push("Wattage matched");

  if (reasons.length === 0) {
    reasons.push("No strong product identifiers matched");
  }

  return { score: Math.min(score, 0.99), reasons, rejected: false };
}

function specRejection(target: RetailerTargetProduct, title: string): string | null {
  // GPU VRAM mismatch.
  const vram = specNumber(target, "gpuVramGb", "vramGb");
  if (vram) {
    const titleVram = matchNumber(title, /(\d+)\s?gb/);
    if (titleVram !== null && titleVram !== vram && looksLikeGpu(target)) {
      return `Rejected: listing says ${titleVram}GB VRAM but target is ${vram}GB`;
    }
  }
  // GPU chipset model mismatch (e.g. RTX 5060 vs RTX 5070).
  const chip = stringSpec(target, "gpuChipset") ?? gpuModelNeedle(target.model);
  if (chip) {
    const conflict = conflictingGpuModel(title, chip);
    if (conflict) return `Rejected: title says ${conflict} but target is ${chip}`;
  }
  // CPU model mismatch.
  const cpuModel = stringSpec(target, "cpuModel");
  if (cpuModel && looksLikeCpu(target) && !title.includes(normalize(cpuModel))) {
    const conflict = conflictingCpuModel(title, cpuModel);
    if (conflict) return `Rejected: title says ${conflict} but target CPU is ${cpuModel}`;
  }
  // RAM capacity/type mismatch.
  const capacity = specNumber(target, "capacityGb");
  if (capacity && stringSpec(target, "ramType")) {
    const titleCap = matchNumber(title, /(\d+)\s?gb/);
    if (titleCap !== null && titleCap !== capacity) {
      return `Rejected: listing says ${titleCap}GB but target RAM is ${capacity}GB`;
    }
  }
  // PSU wattage mismatch.
  const wattage = specNumber(target, "wattage");
  if (wattage) {
    const titleWatt = matchNumber(title, /(\d{3,4})\s?w\b/);
    if (titleWatt !== null && Math.abs(titleWatt - wattage) >= 50) {
      return `Rejected: listing says ${titleWatt}W but target PSU is ${wattage}W`;
    }
  }
  return null;
}

function skuMatchesTarget(target: RetailerTargetProduct, sku: string) {
  const targetSku = stringSpec(target, "sku");
  return !!targetSku && normalize(targetSku) === normalize(sku);
}

function looksLikeGpu(target: RetailerTargetProduct) {
  return target.category === "gpu" || /\b(rtx|rx|gtx|arc)\b/.test(normalize(target.model));
}

function looksLikeCpu(target: RetailerTargetProduct) {
  return target.category === "cpu" || /\b(ryzen|core|i[3579]|ultra)\b/.test(normalize(target.model));
}

function gpuModelNeedle(model: string): string | null {
  const match = normalize(model).match(/\b(rtx|rx|gtx|arc)\s?(\d{3,4})\s?(xt|ti|super|xtx)?\b/);
  if (!match) return null;
  return [match[1], match[2], match[3]].filter(Boolean).join(" ").trim();
}

function conflictingGpuModel(title: string, chip: string): string | null {
  const targetNumber = chip.match(/\d{3,4}/)?.[0];
  const titleMatch = title.match(/\b(rtx|rx|gtx|arc)\s?(\d{3,4})\s?(xt|ti|super|xtx)?\b/);
  if (!titleMatch || !targetNumber) return null;
  const titleNumber = titleMatch[2];
  if (titleNumber !== targetNumber) {
    return [titleMatch[1], titleMatch[2], titleMatch[3]].filter(Boolean).join(" ").trim();
  }
  return null;
}

function conflictingCpuModel(title: string, cpuModel: string): string | null {
  const targetNumber = normalize(cpuModel).match(/\d{4,5}/)?.[0];
  const titleNumber = title.match(/\b(ryzen|core|i[3579]|ultra)\s?\w*\s?(\d{4,5})/)?.[2];
  if (targetNumber && titleNumber && targetNumber !== titleNumber) {
    return `model ${titleNumber}`;
  }
  return null;
}

function specNumber(target: RetailerTargetProduct, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = target.specs?.[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function stringSpec(target: RetailerTargetProduct, key: string): string | null {
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
