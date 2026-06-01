import type {
  LiveBuildTotal,
  LiveBuildVerdict,
  LiveBuildVerdictValue,
  ResolvedLiveOffers,
} from "./types";

/**
 * Compute a build's live total from per-part resolved offers.
 *
 *  - verified : every required part has a verified live price.
 *  - partial  : some parts verified, some not.
 *  - estimated: no verified prices but every part has an MSRP/catalog estimate.
 *  - unknown  : too many parts have no price at all.
 *
 * Verified totals only use prices actually extracted from live pages. MSRP is only ever a clearly
 * labelled estimate, never presented as a live price.
 */
export function computeLiveBuildTotal(parts: ResolvedLiveOffers[]): LiveBuildTotal {
  const totalParts = parts.length;
  let verifiedTotal = 0;
  let estimatedTotal = 0;
  let verifiedPartCount = 0;
  let missingPriceCount = 0;

  for (const part of parts) {
    const verified = part.bestVerified?.effectivePrice;
    if (typeof verified === "number") {
      verifiedPartCount += 1;
      verifiedTotal += verified;
      estimatedTotal += verified;
    } else if (typeof part.msrp === "number" && part.msrp > 0) {
      estimatedTotal += part.msrp;
    } else {
      missingPriceCount += 1;
    }
  }

  const clickToVerifyCount = totalParts - verifiedPartCount;

  const status =
    totalParts > 0 && verifiedPartCount === totalParts
      ? "verified"
      : verifiedPartCount > 0
        ? "partial"
        : missingPriceCount === 0 && totalParts > 0
          ? "estimated"
          : "unknown";

  return {
    status,
    verifiedTotal: round(verifiedTotal),
    estimatedTotal: round(estimatedTotal),
    verifiedPartCount,
    clickToVerifyCount,
    missingPriceCount,
    totalParts,
    label: labelFor(status, round(verifiedTotal), round(estimatedTotal), verifiedPartCount, totalParts, clickToVerifyCount),
  };
}

function labelFor(
  status: LiveBuildTotal["status"],
  verifiedTotal: number,
  estimatedTotal: number,
  verifiedPartCount: number,
  totalParts: number,
  clickToVerifyCount: number,
): string {
  switch (status) {
    case "verified":
      return `Verified live total: ${currency(verifiedTotal)} across all ${totalParts} parts.`;
    case "partial":
      return `Partial live total: ${currency(verifiedTotal)} verified across ${verifiedPartCount}/${totalParts} parts. ${clickToVerifyCount} part${
        clickToVerifyCount === 1 ? "" : "s"
      } require click-to-verify pricing.`;
    case "estimated":
      return `Estimated total: ${currency(estimatedTotal)} from catalog/MSRP only — no live prices verified yet.`;
    default:
      return "Not enough live price data to total this build yet.";
  }
}

export type LiveVerdictInput = {
  total: LiveBuildTotal;
  /** Whether enough verified live 30-day history exists to make a real timing claim. */
  hasLiveHistory: boolean;
  /** When live history exists, the price-driven verdict to surface (BUY_NOW/WAIT/AVOID). */
  historyVerdict?: { verdict: "BUY_NOW" | "WAIT" | "AVOID"; summary: string; reasons?: string[] };
};

/**
 * Build verdict for Live Link Mode.
 *
 * Without verified 30-day live history the app must NOT pretend to know a price trend. It returns
 * VERIFY_PRICES (links available, verify pricing) or INSUFFICIENT_HISTORY rather than AVOIDing a
 * build just because history is missing.
 */
export function computeLiveBuildVerdict(input: LiveVerdictInput): LiveBuildVerdict {
  const { total, hasLiveHistory } = input;

  if (!hasLiveHistory) {
    if (total.status === "unknown") {
      return verdict(
        "INSUFFICIENT_HISTORY",
        "Not enough live price data yet. Open the retailer links to verify current prices.",
        ["No verified live prices and no live 30-day history are available yet."],
        total,
        false,
      );
    }
    return verdict(
      "VERIFY_PRICES",
      "VERIFY PRICES — Live links are available, but the app does not have enough verified 30-day price history yet.",
      [
        total.label,
        "Click the retailer links to confirm current price and stock before buying.",
      ],
      total,
      false,
    );
  }

  const history = input.historyVerdict ?? {
    verdict: "WAIT" as const,
    summary: "WAIT — based on verified live build history.",
    reasons: [],
  };
  return verdict(history.verdict, history.summary, [total.label, ...(history.reasons ?? [])], total, true);
}

function verdict(
  value: LiveBuildVerdictValue,
  summary: string,
  reasons: string[],
  total: LiveBuildTotal,
  hasLiveHistory: boolean,
): LiveBuildVerdict {
  return { verdict: value, summary, reasons, total, hasLiveHistory };
}

export function liveVerdictLabel(value: LiveBuildVerdictValue): string {
  return value.replaceAll("_", " ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function currency(value: number) {
  return `$${round(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
