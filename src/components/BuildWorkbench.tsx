"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Cpu,
  Loader2,
  Search,
  ShieldCheck,
  TrendingDown,
  Wifi,
} from "lucide-react";

import { PriceHistoryChart } from "./PriceHistoryChart";

type Category = "cpu" | "gpu" | "motherboard" | "ram" | "storage" | "psu" | "case" | "cooler";
type Status = "PASS" | "WARNING" | "FAIL";
type Verdict = "BUY_NOW" | "WAIT" | "AVOID";
type VariantKey = "bestOverall" | "cheapestSafe" | "bestPerformancePerDollar";

type Part = {
  id: string;
  category: Category;
  brand: string;
  model: string;
};

type ScoredOffer = {
  offer: {
    retailer: string;
    title: string;
    url: string;
    condition: string;
  };
  effectivePrice: number;
  dealScore: number;
};

type CompatibilityResult = {
  id: string;
  level: Status;
  title: string;
  explanation: string;
  affectedParts: Category[];
  confidence: number;
};

type ProductPriceTrend = {
  productId: string;
  productName: string;
  currentPrice: number;
  thirtyDayLow: number;
  ninetyDayLow: number;
  oneEightyDayLow: number;
  ninetyDayAverage: number;
  verdict: Verdict;
  explanation: string;
};

type GeneratedBuild = {
  id: string;
  parts: Record<Category, Part>;
  offers: Record<Category, ScoredOffer>;
  totalPrice: number;
  performanceScore: number;
  compatibilityReport: {
    overallStatus: Status;
    passCount: number;
    warningCount: number;
    failCount: number;
    results: CompatibilityResult[];
  };
  dealScore: number;
  priceVerdict: Verdict;
  productPriceTrends: ProductPriceTrend[];
  overallScore: number;
  whySelected: string;
  cheaperCompatibleSwaps: Array<{
    category: Category;
    savings: number;
    explanation: string;
  }>;
};

type GenerateBuildResponse = Record<VariantKey, GeneratedBuild | null> & {
  candidatesEvaluated: number;
};

type HistoryResponse = {
  history: Array<{
    date: string;
    lowestTrustedPrice: number;
    minNewPrice: number;
    avgNewPrice: number;
  }>;
};

const variantLabels: Record<VariantKey, string> = {
  bestOverall: "Best Overall",
  cheapestSafe: "Cheapest Safe",
  bestPerformancePerDollar: "Best Performance/$",
};

const categoryLabels: Record<Category, string> = {
  cpu: "CPU",
  gpu: "GPU",
  motherboard: "Motherboard",
  ram: "RAM",
  storage: "Storage",
  psu: "PSU",
  case: "Case",
  cooler: "Cooler",
};

const categories: Category[] = ["cpu", "gpu", "motherboard", "ram", "storage", "psu", "case", "cooler"];

export function BuildWorkbench() {
  const [budget, setBudget] = useState(1500);
  const [useCase, setUseCase] = useState("gaming");
  const [resolution, setResolution] = useState("1440p");
  const [gpuPreference, setGpuPreference] = useState("any");
  const [ramGb, setRamGb] = useState(32);
  const [storageGb, setStorageGb] = useState(1000);
  const [wifiRequired, setWifiRequired] = useState(true);
  const [riskTolerance, setRiskTolerance] = useState("open_box_allowed");
  const [results, setResults] = useState<GenerateBuildResponse | null>(null);
  const [activeVariant, setActiveVariant] = useState<VariantKey>("bestOverall");
  const [history, setHistory] = useState<HistoryResponse["history"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBuild = results?.[activeVariant] ?? results?.bestOverall ?? null;
  const activeGpuId = activeBuild?.parts.gpu.id;

  useEffect(() => {
    if (!activeGpuId) return;

    let mounted = true;
    fetch(`/api/products/${activeGpuId}/price-history`)
      .then((response) => response.json())
      .then((data: HistoryResponse) => {
        if (mounted) setHistory(data.history ?? []);
      })
      .catch(() => {
        if (mounted) setHistory([]);
      });

    return () => {
      mounted = false;
    };
  }, [activeGpuId]);

  const visibleVariants = useMemo(() => {
    if (!results) return [];
    return (Object.keys(variantLabels) as VariantKey[])
      .map((key) => ({ key, build: results[key] }))
      .filter((variant): variant is { key: VariantKey; build: GeneratedBuild } => Boolean(variant.build));
  }, [results]);

  async function generateBuild() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/generate-build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget,
        useCase,
        resolution,
        gpuPreference,
        ramGb,
        storageGb,
        wifiRequired,
        riskTolerance,
      }),
    }).catch(() => null);

    setLoading(false);

    if (!response || !response.ok) {
      setError("Build generation failed. Check the local seed data and API route.");
      return;
    }

    const data = (await response.json()) as GenerateBuildResponse;
    setResults(data);
    setActiveVariant("bestOverall");
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="flex min-h-[420px] flex-col justify-center">
            <div className="mb-5 flex items-center gap-3 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              Deterministic compatibility, seeded deals, price timing
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
              PCDealForge
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
              Find the cheapest verified-compatible PC build for your budget, with transparent deal scoring and
              buy-now, wait, or avoid price intelligence.
            </p>
            <div className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Seeded parts" value="64" />
              <Metric label="Offer rows" value="152" />
              <Metric label="Price history" value="180d" />
              <Metric label="Rule checks" value="18" />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
            <div className="grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-zinc-700">
                Budget
                <input
                  className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none focus:border-teal-600"
                  type="number"
                  min={400}
                  max={10000}
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Use case" value={useCase} onChange={setUseCase} options={["gaming", "workstation", "general"]} />
                <Select label="Resolution" value={resolution} onChange={setResolution} options={["1080p", "1440p", "4k"]} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="GPU" value={gpuPreference} onChange={setGpuPreference} options={["any", "nvidia", "amd"]} />
                <Select
                  label="Risk"
                  value={riskTolerance}
                  onChange={setRiskTolerance}
                  options={["new_only", "open_box_allowed", "used_allowed"]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-medium text-zinc-700">
                  RAM
                  <input
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-teal-600"
                    type="number"
                    min={16}
                    value={ramGb}
                    onChange={(event) => setRamGb(Number(event.target.value))}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-zinc-700">
                  Storage
                  <input
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-teal-600"
                    type="number"
                    min={500}
                    value={storageGb}
                    onChange={(event) => setStorageGb(Number(event.target.value))}
                  />
                </label>
              </div>

              <label className="flex h-11 items-center justify-between rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700">
                <span className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-teal-700" />
                  Wi-Fi required
                </span>
                <input
                  type="checkbox"
                  checked={wifiRequired}
                  onChange={(event) => setWifiRequired(event.target.checked)}
                  className="h-5 w-5 accent-teal-700"
                />
              </label>

              <button
                onClick={generateBuild}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Generate Build
              </button>
              {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {visibleVariants.length === 0 ? (
          <div className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold">Ready for a seeded recommendation</h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              The local MVP uses the Prisma seed catalog, mock retailer offers, deterministic compatibility checks,
              and generated price history. Run a build to inspect the ranked recommendations.
            </p>
          </div>
        ) : (
          <div className="grid gap-8">
            <div className="grid gap-4 lg:grid-cols-3">
              {visibleVariants.map(({ key, build }) => (
                <button
                  key={key}
                  onClick={() => setActiveVariant(key)}
                  className={`rounded-lg border p-5 text-left shadow-sm transition ${
                    activeVariant === key ? "border-teal-700 bg-white" : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{variantLabels[key]}</h2>
                    <StatusPill status={build.compatibilityReport.overallStatus} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Total" value={formatCurrency(build.totalPrice)} />
                    <Metric label="Performance" value={Math.round(build.performanceScore).toString()} />
                    <Metric label="Deal score" value={Math.round(build.dealScore).toString()} />
                    <Metric label="Verdict" value={formatVerdict(build.priceVerdict)} tone={verdictTone(build.priceVerdict)} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-zinc-600">{build.whySelected}</p>
                </button>
              ))}
            </div>

            {activeBuild ? (
              <div className="grid gap-8">
                <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{variantLabels[activeVariant]}</h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        {results?.candidatesEvaluated.toLocaleString()} candidates evaluated
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={activeBuild.compatibilityReport.overallStatus} />
                      <VerdictPill verdict={activeBuild.priceVerdict} />
                    </div>
                  </div>
                  <PartsTable build={activeBuild} />
                </section>

                <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
                  <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-teal-700" />
                      <h2 className="text-lg font-semibold">GPU Price Timeline</h2>
                    </div>
                    <PriceHistoryChart history={history} currentPrice={activeBuild.productPriceTrends.find((trend) => trend.productId === activeGpuId)?.currentPrice} />
                    <PriceSummary trend={activeBuild.productPriceTrends.find((trend) => trend.productId === activeGpuId)} />
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <h2 className="text-lg font-semibold">Compatibility Report</h2>
                    </div>
                    <div className="grid max-h-[430px] gap-3 overflow-auto pr-1">
                      {activeBuild.compatibilityReport.results.map((result) => (
                        <div key={result.id} className="rounded-md border border-zinc-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-zinc-950">{result.title}</div>
                              <p className="mt-1 text-sm leading-5 text-zinc-600">{result.explanation}</p>
                            </div>
                            <StatusPill status={result.level} />
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">
                            {result.affectedParts.map((part) => categoryLabels[part]).join(", ")} ·{" "}
                            {Math.round(result.confidence * 100)}% confidence
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-teal-700" />
                    <h2 className="text-lg font-semibold">Mock Alerts</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <AlertStub label="Part drop" value={`Alert me when ${activeBuild.parts.gpu.model} drops below ${formatCurrency(activeBuild.offers.gpu.effectivePrice - 40)}`} />
                    <AlertStub label="Build drop" value={`Alert me when this build drops below ${formatCurrency(activeBuild.totalPrice - 100)}`} />
                    <AlertStub label="Swap savings" value="Alert me when a compatible swap saves me money" />
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function PartsTable({ build }: { build: GeneratedBuild }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-normal text-zinc-500">
            <th className="py-3 pr-4 font-semibold">Category</th>
            <th className="py-3 pr-4 font-semibold">Selected part</th>
            <th className="py-3 pr-4 font-semibold">Best offer</th>
            <th className="py-3 pr-4 font-semibold">Price</th>
            <th className="py-3 pr-4 font-semibold">Retailer</th>
            <th className="py-3 pr-4 font-semibold">Compatibility note</th>
            <th className="py-3 font-semibold">Price verdict</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const part = build.parts[category];
            const offer = build.offers[category];
            const trend = build.productPriceTrends.find((item) => item.productId === part.id);
            const note = compatibilityNote(build, category);

            return (
              <tr key={category} className="border-b border-zinc-100">
                <td className="py-3 pr-4 font-medium text-zinc-700">{categoryLabels[category]}</td>
                <td className="py-3 pr-4">
                  <Link className="font-medium text-teal-700 hover:text-teal-900" href={`/products/${part.id}`}>
                    {part.brand} {part.model}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-zinc-600">{offer.offer.title}</td>
                <td className="py-3 pr-4 font-semibold">{formatCurrency(offer.effectivePrice)}</td>
                <td className="py-3 pr-4 text-zinc-600">{offer.offer.retailer}</td>
                <td className="py-3 pr-4">
                  <span className={note.level === "PASS" ? "text-emerald-700" : note.level === "WARNING" ? "text-amber-700" : "text-rose-700"}>
                    {note.title}
                  </span>
                </td>
                <td className="py-3">
                  <VerdictPill verdict={trend?.verdict ?? "BUY_NOW"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-zinc-700">
      {label}
      <select
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-teal-600"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone ?? "text-zinc-950"}`}>{value}</div>
    </div>
  );
}

function AlertStub({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-700">{value}</div>
    </div>
  );
}

function PriceSummary({ trend }: { trend?: ProductPriceTrend }) {
  if (!trend) return null;

  return (
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
      <Metric label="Current" value={formatCurrency(trend.currentPrice)} />
      <Metric label="30d low" value={formatCurrency(trend.thirtyDayLow)} />
      <Metric label="90d low" value={formatCurrency(trend.ninetyDayLow)} />
      <Metric label="180d low" value={formatCurrency(trend.oneEightyDayLow)} />
      <Metric label="Average" value={formatCurrency(trend.ninetyDayAverage)} />
      <p className="sm:col-span-5 text-sm leading-6 text-zinc-600">{trend.explanation}</p>
    </div>
  );
}

function compatibilityNote(build: GeneratedBuild, category: Category) {
  return (
    build.compatibilityReport.results.find(
      (result) => result.affectedParts.includes(category) && result.level !== "PASS",
    ) ?? { level: "PASS", title: "Verified" }
  );
}

function StatusPill({ status }: { status: Status }) {
  const className =
    status === "PASS"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "WARNING"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{status}</span>;
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${verdictClass(verdict)}`}>{formatVerdict(verdict)}</span>;
}

function verdictClass(verdict: Verdict) {
  if (verdict === "BUY_NOW") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (verdict === "WAIT") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function verdictTone(verdict: Verdict) {
  if (verdict === "BUY_NOW") return "text-emerald-700";
  if (verdict === "WAIT") return "text-amber-700";
  return "text-rose-700";
}

function formatVerdict(verdict: Verdict) {
  return verdict.replace("_", " ");
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
