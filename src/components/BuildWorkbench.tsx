"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Cpu,
  Loader2,
  Search,
  ShieldCheck,
  TrendingDown,
  Wifi,
} from "lucide-react";

import { PriceHistoryChart } from "./PriceHistoryChart";
import { EvidenceCitationList } from "./EvidenceCitationList";
import { SourceBackedCompatibilityReport } from "./SourceBackedCompatibilityReport";
import { SourceBackedPricePanel } from "./SourceBackedPricePanel";

type Category = "cpu" | "gpu" | "motherboard" | "ram" | "storage" | "psu" | "case" | "cooler";
type Status = "PASS" | "WARNING" | "FAIL";
type Verdict = "BUY_NOW" | "WAIT" | "AVOID";
type VariantKey = "bestOverall" | "cheapestSafe" | "bestPerformancePerDollar";
type ReportTab = "Overview" | "Parts" | "Compatibility" | "Price History" | "Evidence" | "Full Essay";

type EvidenceCitation = {
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
};

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
  ruleId: string;
  evidence: EvidenceCitation[];
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
  evidence?: EvidenceCitation[];
};

type BuildEssay = {
  executiveSummary: string;
  positives: string;
  negatives: string;
  compatibilityReasoning: string;
  dealReasoning: string;
  whoShouldBuy: string;
  whoShouldAvoid: string;
  suggestedSwaps: string;
  finalVerdict: string;
  citations: EvidenceCitation[];
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
  essay?: BuildEssay;
  evidence?: EvidenceCitation[];
  sourceConfidenceSummary?: {
    totalSources: number;
    averageConfidence: number;
    seededDemoCount: number;
    internalCalculationCount: number;
    compatibilityRuleCount: number;
  };
};

type GenerateBuildResponse = Record<VariantKey, GeneratedBuild | null> & {
  candidatesEvaluated: number;
  comparison?: {
    quickRecommendation: string;
    bestOverallVsCheapestSafe: string;
    bestOverallVsBestPerformancePerDollar: string;
    cheapestSafeVsBestPerformancePerDollar: string;
    whichOneIWouldBuyAndWhy: string;
    whatIWouldWaitOn: string;
    biggestRiskInEachBuild: string;
    bestUpgradePath: string;
    citations: EvidenceCitation[];
  } | null;
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
const reportTabs: ReportTab[] = ["Overview", "Parts", "Compatibility", "Price History", "Evidence", "Full Essay"];

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
  const [activeTab, setActiveTab] = useState<ReportTab>("Overview");
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
    setActiveTab("Overview");
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

                  <div className="mb-5 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-2">
                    {reportTabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium ${
                          activeTab === tab ? "bg-teal-700 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <BuildReportTab
                    tab={activeTab}
                    build={activeBuild}
                    history={history}
                    activeGpuId={activeGpuId}
                    comparison={results?.comparison ?? null}
                  />
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

function BuildReportTab({
  tab,
  build,
  history,
  activeGpuId,
  comparison,
}: {
  tab: ReportTab;
  build: GeneratedBuild;
  history: HistoryResponse["history"];
  activeGpuId?: string;
  comparison: GenerateBuildResponse["comparison"];
}) {
  const gpuTrend = build.productPriceTrends.find((trend) => trend.productId === activeGpuId);

  if (tab === "Overview") {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Total" value={formatCurrency(build.totalPrice)} />
          <Metric label="Performance" value={Math.round(build.performanceScore).toString()} />
          <Metric label="Deal score" value={Math.round(build.dealScore).toString()} />
          <Metric
            label="Sources"
            value={(build.sourceConfidenceSummary?.totalSources ?? build.evidence?.length ?? 0).toString()}
          />
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="font-semibold">Why This Build?</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{build.essay?.executiveSummary ?? build.whySelected}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Evidence posture: {build.sourceConfidenceSummary?.seededDemoCount ?? 0} seeded demo sources,{" "}
            {build.sourceConfidenceSummary?.internalCalculationCount ?? 0} internal calculation sources, and{" "}
            {build.sourceConfidenceSummary?.compatibilityRuleCount ?? 0} compatibility rule sources. Seeded demo sources
            are local MVP records, not live web claims.
          </p>
        </div>
        {comparison ? (
          <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
            <h3 className="font-semibold">Build Comparison</h3>
            <p className="text-sm leading-6 text-zinc-700">{comparison.quickRecommendation}</p>
            <p className="text-sm leading-6 text-zinc-700">{comparison.whichOneIWouldBuyAndWhy}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "Parts") {
    return <PartsTable build={build} />;
  }

  if (tab === "Compatibility") {
    return <SourceBackedCompatibilityReport results={build.compatibilityReport.results} />;
  }

  if (tab === "Price History") {
    return (
      <div className="grid gap-6">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-teal-700" />
            <h3 className="text-lg font-semibold">GPU Price Timeline</h3>
          </div>
          <PriceHistoryChart history={history} currentPrice={gpuTrend?.currentPrice} />
          <PriceSummary trend={gpuTrend} />
        </div>
        <SourceBackedPricePanel trends={build.productPriceTrends} />
      </div>
    );
  }

  if (tab === "Evidence") {
    return <EvidenceCitationList citations={build.evidence ?? build.essay?.citations ?? []} />;
  }

  return <EssayReport essay={build.essay} />;
}

function EssayReport({ essay }: { essay?: BuildEssay }) {
  if (!essay) {
    return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No essay generated.</div>;
  }

  const sections = [
    ["Executive Summary", essay.executiveSummary],
    ["Major Positives", essay.positives],
    ["Major Negatives", essay.negatives],
    ["Compatibility Reasoning", essay.compatibilityReasoning],
    ["Deal/Price Reasoning", essay.dealReasoning],
    ["Who Should Buy", essay.whoShouldBuy],
    ["Who Should Avoid", essay.whoShouldAvoid],
    ["Suggested Swaps", essay.suggestedSwaps],
    ["Final Verdict", essay.finalVerdict],
  ];

  return (
    <div className="grid gap-5">
      {sections.map(([title, body]) => (
        <section key={title} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="font-semibold text-zinc-950">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-700">{body}</p>
        </section>
      ))}
      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-zinc-950">Sources Used</h3>
        <EvidenceCitationList citations={essay.citations} />
      </section>
    </div>
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
