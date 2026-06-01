"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type AdapterStatus = {
  retailer: string;
  sourceType: string;
  status: "enabled" | "unavailable" | "disabled";
  message?: string;
};

type RefreshResponse = {
  mode: "live" | "demo";
  lastCheckedAt: string;
  message: string;
  retailersChecked: number;
  offersFetched: number;
  offersVerified: number;
  offersRejected: number;
  verifiedLiveCount: number;
  verifiedRecentCount: number;
  staleCount: number;
  demoCount: number;
  unverifiedCount: number;
  errorsByRetailer: Record<string, string>;
  adapterStatus: AdapterStatus[];
};

export function LiveRefreshPanel({ mode, productIds }: { mode: "live" | "demo"; productIds?: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefreshResponse | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/deals/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
      setResult((await response.json()) as RefreshResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Live retailer prices</div>
          <div className="text-xs text-zinc-500">
            Mode: {mode === "live" ? "Live retailer adapters" : "Seeded demo data (prices are not live)"}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh live prices"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      {result ? (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-zinc-700">{result.message}</p>
          <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Verified live" value={result.verifiedLiveCount} tone="emerald" />
            <Stat label="Verified recent" value={result.verifiedRecentCount} tone="emerald" />
            <Stat label="Stale" value={result.staleCount} tone="amber" />
            <Stat label="Demo" value={result.demoCount} tone="zinc" />
            <Stat label="Unverified" value={result.unverifiedCount} tone="rose" />
            <Stat label="Rejected" value={result.offersRejected} tone="rose" />
          </div>
          <div className="text-xs text-zinc-500">
            Last refresh: {new Date(result.lastCheckedAt).toLocaleString()} · {result.retailersChecked} retailers checked
          </div>
          <ul className="grid gap-1 text-xs">
            {result.adapterStatus.map((adapter) => (
              <li key={adapter.retailer} className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-1">
                <span className="font-medium text-zinc-700">
                  {adapter.retailer} <span className="text-zinc-400">({adapter.sourceType})</span>
                </span>
                <span className={statusClass(adapter.status)}>
                  {adapter.status}
                  {adapter.message ? <span className="ml-1 font-normal text-zinc-500">— {adapter.message}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-zinc-700";
  return (
    <div className="rounded-md border border-zinc-200 px-2 py-1.5">
      <div className="text-zinc-500">{label}</div>
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "enabled") return "text-right text-emerald-700";
  if (status === "disabled") return "text-right text-amber-700";
  return "text-right text-zinc-500";
}
