"use client";

import { EvidenceCitationList } from "./EvidenceCitationList";

type PriceTrend = {
  productName: string;
  currentPrice: number;
  thirtyDayLow: number;
  ninetyDayLow: number;
  oneEightyDayLow: number;
  ninetyDayAverage: number;
  verdict: "BUY_NOW" | "WAIT" | "AVOID";
  verdictDetails?: {
    verdict: "BUY_NOW" | "WAIT" | "AVOID";
    primaryReason: {
      severity: "positive" | "neutral" | "warning" | "danger";
      code: string;
      title: string;
      explanation: string;
      currentValue?: number;
      comparisonValue?: number;
      deltaDollars?: number;
      deltaPercent?: number;
      affectedPartName?: string;
      evidenceIds?: string[];
    };
    summary: string;
    specificJustification: string;
  };
  explanation: string;
  evidence?: Array<{
    evidenceId?: string;
    sourceId?: string;
    citationNumber: number;
    title: string;
    sourceType: string;
    publisher: string;
    url?: string | null;
    confidenceScore: number;
    capturedAt: string;
    claim: string;
    value: string;
    unit?: string | null;
    notes?: string | null;
  }>;
};

export function SourceBackedPricePanel({ trends }: { trends: PriceTrend[] }) {
  return (
    <div className="grid gap-4">
      {trends.map((trend) => {
        const citations = trend.evidence ?? [];

        return (
          <details key={trend.productName} className="rounded-md border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-zinc-950">{trend.productName}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {trend.verdictDetails
                      ? `${trend.verdictDetails.verdict.replace("_", " ")}: ${trend.verdictDetails.specificJustification}`
                      : `Current price is ${currency(trend.currentPrice)}, compared with a 90-day average of ${currency(
                          trend.ninetyDayAverage,
                        )} and a 180-day low of ${currency(trend.oneEightyDayLow)}. This triggers a ${trend.verdict.replace(
                          "_",
                          " ",
                        )} verdict.`}{" "}
                    {citations.map((citation) => `[${citation.citationNumber}]`).join("")}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${verdictClass(trend.verdict)}`}>
                  {trend.verdict.replace("_", " ")}
                </span>
              </div>
            </summary>
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4">
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <Metric label="Current" value={currency(trend.currentPrice)} />
                <Metric label="30d low" value={currency(trend.thirtyDayLow)} />
                <Metric label="90d low" value={currency(trend.ninetyDayLow)} />
                <Metric label="180d low" value={currency(trend.oneEightyDayLow)} />
              </div>
              <p className="text-sm leading-6 text-zinc-600">{trend.explanation}</p>
              {trend.verdictDetails ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                  <div className="font-semibold text-zinc-900">{trend.verdictDetails.primaryReason.title}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <Metric label="Current" value={formatReasonValue(trend.verdictDetails.primaryReason.currentValue)} />
                    <Metric label="Comparison" value={formatReasonValue(trend.verdictDetails.primaryReason.comparisonValue)} />
                    <Metric label="Dollar delta" value={formatReasonValue(trend.verdictDetails.primaryReason.deltaDollars, true)} />
                    <Metric
                      label="Percent delta"
                      value={
                        trend.verdictDetails.primaryReason.deltaPercent === undefined
                          ? "n/a"
                          : `${Math.round(trend.verdictDetails.primaryReason.deltaPercent * 10) / 10}%`
                      }
                    />
                  </div>
                  {trend.verdictDetails.primaryReason.affectedPartName ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Affected part: {trend.verdictDetails.primaryReason.affectedPartName}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <EvidenceCitationList citations={citations} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function verdictClass(verdict: string) {
  if (verdict === "BUY_NOW") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (verdict === "WAIT") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatReasonValue(value: number | undefined, forceCurrency = false) {
  if (value === undefined) return "n/a";
  if (forceCurrency || Math.abs(value) > 1) return currency(value);
  return `${Math.round(value * 1000) / 10}%`;
}
