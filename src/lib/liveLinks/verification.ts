import type { ExtractedProduct } from "./priceExtractor";
import { scoreLiveMatch } from "./productMatch";
import type { LiveCondition, LivePriceStatus, LiveProduct } from "./types";

export type RiskTolerance = "new_only" | "open_box_allowed" | "used_allowed";

export type LivePriceVerification = {
  priceStatus: LivePriceStatus;
  verifiedPrice?: number;
  shipping?: number;
  taxEstimate?: number;
  effectivePrice?: number;
  condition?: LiveCondition;
  inStock?: boolean;
  confidenceScore: number;
  verificationReasons: string[];
};

export type ClassifyLivePriceInput = {
  target: LiveProduct;
  extracted: ExtractedProduct;
  productUrl: string;
  /** Whether the fetch was blocked (CAPTCHA/login/anti-bot/non-200). */
  blocked?: boolean;
  riskTolerance?: RiskTolerance;
};

const NO_VERIFY_REASON = "No verified product price could be extracted without API access.";

/**
 * Decide whether an extracted price can be trusted as a live verified price, or whether the user
 * still needs to click through to verify. Only a high-confidence product match with a parseable
 * price on a real product page becomes `verified_live`.
 */
export function classifyLivePrice(input: ClassifyLivePriceInput): LivePriceVerification {
  const reasons: string[] = [];

  if (input.blocked) {
    return unverified(["Live page was blocked or required a CAPTCHA/login; no price extracted.", NO_VERIFY_REASON]);
  }

  if (!isRealProductUrl(input.productUrl)) {
    return unverified(["URL is not a real retailer product page.", NO_VERIFY_REASON]);
  }

  const price = input.extracted.price;
  if (price === undefined) {
    return unverified(["No parseable price found on the page.", NO_VERIFY_REASON]);
  }

  const match = scoreLiveMatch(input.target, { title: input.extracted.title ?? "" });
  reasons.push(...match.reasons);

  if (match.rejected) {
    return unverified([`Rejected: ${match.reasons.join("; ")}`, NO_VERIFY_REASON]);
  }

  const condition = input.extracted.condition ?? "unknown";
  if (violatesRiskTolerance(condition, input.riskTolerance ?? "used_allowed")) {
    return unverified([`Condition "${condition}" violates the ${input.riskTolerance} risk setting.`, NO_VERIFY_REASON]);
  }

  if (match.tier !== "verified") {
    return {
      priceStatus: "unverified_click_to_check",
      confidenceScore: match.score,
      verificationReasons: [...reasons, "Possible product match below the 0.90 verification threshold — click to verify."],
    };
  }

  const taxEstimate = round(price * 0.08);
  return {
    priceStatus: "verified_live",
    verifiedPrice: price,
    shipping: 0,
    taxEstimate,
    effectivePrice: round(price + taxEstimate),
    condition,
    inStock: input.extracted.inStock,
    confidenceScore: match.score,
    verificationReasons: [...reasons, "Price parsed from live structured data with a high-confidence product match."],
  };
}

function unverified(verificationReasons: string[]): LivePriceVerification {
  return { priceStatus: "unverified_click_to_check", confidenceScore: 0, verificationReasons };
}

function violatesRiskTolerance(condition: LiveCondition, risk: RiskTolerance): boolean {
  if (risk === "new_only") return condition !== "new" && condition !== "unknown";
  if (risk === "open_box_allowed") return condition === "used" || condition === "refurbished";
  return false;
}

function isRealProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // A bare search page is not a product page.
    const isSearch = /\/(s|search|sch|searchpage|pl)\b/.test(parsed.pathname) || parsed.search.includes("search");
    return !isSearch;
  } catch {
    return false;
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
