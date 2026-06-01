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

type VerdictReason = {
  severity: "positive" | "neutral" | "warning" | "danger";
  code: string;
  title: string;
  explanation: string;
  currentValue?: number;
  comparisonValue?: number;
  deltaDollars?: number;
  deltaPercent?: number;
  affectedPartId?: string;
  affectedPartName?: string;
  evidenceIds?: string[];
};

type PriceVerdictDetails = {
  verdict: Verdict;
  primaryReason: VerdictReason;
  reasons: VerdictReason[];
  summary: string;
  specificJustification: string;
};

type EvidenceCitation = {
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
};

type Part = {
  id: string;
  category: Category;
  brand: string;
  model: string;
};

type ScoredOffer = {
  offer: {
    id: string;
    retailer: string;
    title: string;
    url: string;
    price: number;
    shipping: number;
    taxEstimate: number;
    condition: string;
  };
  sellerRiskPenalty?: number;
  conditionRiskPenalty?: number;
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
  estimatedSavingsIfWaiting: number;
  verdict: Verdict;
  verdictDetails?: PriceVerdictDetails;
  explanation: string;
  evidence?: EvidenceCitation[];
};

type BuildEssay = {
  executiveSummary: string;
  whyThisBuildExists?: string;
  performanceExpectations?: string;
  positives: string;
  negatives: string;
  compatibilityReasoning: string;
  dealReasoning: string;
  partByPartJustification?: string;
  bestUpgradePath?: string;
  whoShouldBuy: string;
  whoShouldAvoid: string;
  suggestedSwaps: string;
  finalVerdict: string;
  finalRecommendation?: string;
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
  priceVerdictDetails?: PriceVerdictDetails;
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
  timingReport?: {
    timingVerdict: string;
    overallTimingScore: number;
    priceTimingScore: number;
    releaseTimingScore: number;
    priceDriven: boolean;
    releaseDriven: boolean;
    priceDrivenPart?: { productName: string; priceTrend: { estimatedSavingsIfWaiting: number } };
    releaseDrivenPart?: { productName: string; releaseSignal: { signalType: string } };
    buyNowVsWait: string;
    releaseExplanation: string;
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
  recommendationCategories?: Array<{
    categoryId: string;
    title: string;
    buildId?: string;
    prebuiltId?: string;
    totalPrice: number;
    compatibilityStatus: string;
    priceVerdict: string;
    timingVerdict: string;
    performanceScore: number;
    categoryScore: number;
    shortWhy: string;
    detailedWhy: string;
    positives: string[];
    negatives: string[];
    whoShouldPickThis: string;
    whoShouldAvoidThis: string;
  }>;
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
      <section id="builder" className="border-b border-zinc-200 bg-white">
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
                <div
                  key={key}
                  className={`rounded-lg border p-5 text-left shadow-sm transition ${
                    activeVariant === key ? "border-teal-700 bg-white" : "border-zinc-200 bg-white hover:border-zinc-400"
                  }`}
                >
                  <button onClick={() => setActiveVariant(key)} className="w-full text-left">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">{variantLabels[key]}</h2>
                      <StatusPill status={build.compatibilityReport.overallStatus} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Total" value={formatCurrency(build.totalPrice)} />
                      <Metric label="Performance" value={Math.round(build.performanceScore).toString()} />
                      <Metric label="Price verdict" value={formatVerdict(build.priceVerdict)} tone={verdictTone(build.priceVerdict)} />
                      <Metric label="Timing" value={formatAnyVerdict(build.timingReport?.timingVerdict ?? build.priceVerdict)} tone={timingTone(build.timingReport?.timingVerdict ?? build.priceVerdict)} />
                    </div>
                    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Reason</div>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {build.priceVerdictDetails?.primaryReason.title ?? primaryTrendReason(build)?.title ?? "Price verdict calculated from seeded history"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        {build.priceVerdictDetails?.specificJustification ?? primaryTrendReason(build)?.explanation ?? "Seeded price history did not attach a detailed reason."}
                      </p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-600">{build.whySelected}</p>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      {buildBuyLinkCount(build)} buy/view links · Best deal: {bestDealPart(build)} · Biggest wait risk:{" "}
                      {biggestOverpricedPart(build)}
                    </p>
                  </button>
                  <Link
                    href={`/builds/${build.id}`}
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Open full report
                  </Link>
                </div>
              ))}
            </div>

            {results?.recommendationCategories?.length ? (
              <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold">Recommendation Categories</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Category winners are deterministic and may reuse the same build when it best fits multiple buying goals.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {results.recommendationCategories.map((category) => (
                    <Link
                      key={category.categoryId}
                      href={category.buildId ? `/builds/${category.buildId}` : category.prebuiltId ? `/prebuilts/${category.prebuiltId}` : "#"}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 hover:border-teal-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{category.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-600">{category.shortWhy}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {Math.round(category.categoryScore)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <Metric label="Total" value={formatCurrency(category.totalPrice)} />
                        <Metric label="Timing" value={formatAnyVerdict(category.timingVerdict)} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

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
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${timingPillClass(activeBuild.timingReport?.timingVerdict ?? activeBuild.priceVerdict)}`}>
                        {formatAnyVerdict(activeBuild.timingReport?.timingVerdict ?? activeBuild.priceVerdict)}
                      </span>
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
          {build.priceVerdictDetails ? (
            <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Why this verdict?</div>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {formatVerdict(build.priceVerdict)}: {build.priceVerdictDetails.primaryReason.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{build.priceVerdictDetails.specificJustification}</p>
              <VerdictReasonMetrics reason={build.priceVerdictDetails.primaryReason} />
            </div>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Evidence posture: {build.sourceConfidenceSummary?.seededDemoCount ?? 0} seeded demo sources,{" "}
            {build.sourceConfidenceSummary?.internalCalculationCount ?? 0} internal calculation sources, and{" "}
            {build.sourceConfidenceSummary?.compatibilityRuleCount ?? 0} compatibility rule sources. Seeded demo sources
            are local MVP records, not live web claims.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800" href={`/builds/${build.id}`}>
              Open full report
            </Link>
            {categories.map((category) => (
              <Link key={category} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900" href={`/products/${build.parts[category].id}`}>
                {categoryLabels[category]}
              </Link>
            ))}
          </div>
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

  return (
    <div className="grid gap-4">
      <Link className="w-fit rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800" href={`/builds/${build.id}#essay`}>
        Open full report
      </Link>
      <EssayReport essay={build.essay} />
    </div>
  );
}

function EssayReport({ essay }: { essay?: BuildEssay }) {
  if (!essay) {
    return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No essay generated.</div>;
  }

  const sections = [
    ["Executive Summary", essay.executiveSummary],
    ["Why This Build Exists", essay.whyThisBuildExists],
    ["Performance Expectations", essay.performanceExpectations],
    ["Major Positives", essay.positives],
    ["Major Negatives", essay.negatives],
    ["Compatibility Reasoning", essay.compatibilityReasoning],
    ["Deal/Price Reasoning", essay.dealReasoning],
    ["Part-by-Part Justification", essay.partByPartJustification],
    ["Best Upgrade Path", essay.bestUpgradePath],
    ["Who Should Buy", essay.whoShouldBuy],
    ["Who Should Avoid", essay.whoShouldAvoid],
    ["Suggested Swaps", essay.suggestedSwaps],
    ["Final Recommendation", essay.finalRecommendation ?? essay.finalVerdict],
  ].filter((section): section is [string, string] => Boolean(section[1]));

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
      <table className="w-full min-w-[1200px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-normal text-zinc-500">
            <th className="py-3 pr-4 font-semibold">Category</th>
            <th className="py-3 pr-4 font-semibold">Product link</th>
            <th className="py-3 pr-4 font-semibold">Why selected</th>
            <th className="py-3 pr-4 font-semibold">Retailer/offer</th>
            <th className="py-3 pr-4 font-semibold">Base</th>
            <th className="py-3 pr-4 font-semibold">Shipping</th>
            <th className="py-3 pr-4 font-semibold">Tax</th>
            <th className="py-3 pr-4 font-semibold">Effective</th>
            <th className="py-3 pr-4 font-semibold">Compatibility note</th>
            <th className="py-3 pr-4 font-semibold">Price verdict</th>
            <th className="py-3 font-semibold">Swap</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const part = build.parts[category];
            const offer = build.offers[category];
            const trend = build.productPriceTrends.find((item) => item.productId === part.id);
            const note = compatibilityNote(build, category);
            const link = offerHref(offer.offer);

            return (
              <tr key={category} className="border-b border-zinc-100">
                <td className="py-3 pr-4 font-medium text-zinc-700">{categoryLabels[category]}</td>
                <td className="py-3 pr-4">
                  <Link className="font-medium text-teal-700 hover:text-teal-900" href={`/products/${part.id}`}>
                    {part.brand} {part.model}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-zinc-600">{shortPartReason(category, build)}</td>
                <td className="py-3 pr-4">
                  {link.external ? (
                    <a className="font-medium text-teal-700 hover:text-teal-900" href={link.href} target="_blank" rel="noopener noreferrer">
                      {offer.offer.retailer}
                    </a>
                  ) : (
                    <Link className="font-medium text-teal-700 hover:text-teal-900" href={link.href}>
                      {offer.offer.retailer}
                    </Link>
                  )}
                  <div className="mt-1 text-xs text-zinc-500">{offer.offer.condition.replaceAll("_", " ")}</div>
                </td>
                <td className="py-3 pr-4">{formatCurrency(offer.offer.price)}</td>
                <td className="py-3 pr-4">{formatCurrency(offer.offer.shipping)}</td>
                <td className="py-3 pr-4">{formatCurrency(offer.offer.taxEstimate)}</td>
                <td className="py-3 pr-4 font-semibold">{formatCurrency(offer.effectivePrice)}</td>
                <td className="py-3 pr-4">
                  <span className={note.level === "PASS" ? "text-emerald-700" : note.level === "WARNING" ? "text-amber-700" : "text-rose-700"}>
                    {note.title}
                  </span>
                </td>
                <td className="py-3">
                  <div className="grid gap-1">
                    <VerdictPill verdict={trend?.verdict ?? "BUY_NOW"} />
                    <span className="max-w-[220px] text-xs leading-5 text-zinc-500">
                      {trend?.verdictDetails?.primaryReason.title ?? trend?.explanation ?? "Seeded price check"}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <button type="button" className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                    Swap
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function shortPartReason(category: Category, build: GeneratedBuild) {
  const part = build.parts[category];
  if (category === "gpu") return `${part.model} is the main performance driver for this recommendation.`;
  if (category === "cpu") return `${part.model} balances platform cost with the selected GPU.`;
  if (category === "motherboard") return "Matches CPU socket, RAM type, case form factor, and feature constraints.";
  if (category === "ram") return "Meets requested memory capacity and motherboard DDR type.";
  if (category === "storage") return "Meets requested capacity and uses the board storage path.";
  if (category === "psu") return "Clears wattage headroom and GPU connector rules.";
  if (category === "case") return "Provides motherboard, GPU, cooler, airflow, and front I/O fit data.";
  return "Supports CPU socket and fits the selected case cooling constraints.";
}

function offerHref(offer: ScoredOffer["offer"]) {
  if (!offer.id || seededDemoUrl(offer.url)) return { href: offer.id ? `/offers/${offer.id}` : "#", external: false };
  return { href: offer.url, external: true };
}

function seededDemoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "example.com" || parsed.hostname.endsWith(".example.com");
  } catch {
    return true;
  }
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
      <p className="sm:col-span-5 text-sm leading-6 text-zinc-600">
        {trend.verdictDetails
          ? `${formatVerdict(trend.verdictDetails.verdict)}: ${trend.verdictDetails.specificJustification}`
          : trend.explanation}
      </p>
      {trend.verdictDetails ? (
        <div className="sm:col-span-5">
          <VerdictReasonMetrics reason={trend.verdictDetails.primaryReason} />
        </div>
      ) : null}
    </div>
  );
}

function VerdictReasonMetrics({ reason }: { reason: VerdictReason }) {
  const metrics = [
    reason.currentValue !== undefined ? ["Current", formatMaybeCurrency(reason.currentValue)] : null,
    reason.comparisonValue !== undefined ? ["Comparison", formatMaybeCurrency(reason.comparisonValue)] : null,
    reason.deltaDollars !== undefined ? ["Dollar delta", formatCurrency(reason.deltaDollars)] : null,
    reason.deltaPercent !== undefined ? ["Percent delta", `${Math.round(reason.deltaPercent * 10) / 10}%`] : null,
    reason.affectedPartName ? ["Affected part", reason.affectedPartName] : null,
  ].filter((metric): metric is [string, string] => Boolean(metric));

  if (metrics.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-5">
      {metrics.map(([label, value]) => (
        <div key={`${label}-${value}`} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <div className="text-[11px] font-semibold uppercase tracking-normal text-zinc-500">{label}</div>
          <div className="mt-1 text-xs font-semibold text-zinc-800">{value}</div>
        </div>
      ))}
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

function formatAnyVerdict(verdict: string) {
  return verdict.replaceAll("_", " ");
}

function timingTone(verdict: string) {
  if (verdict === "BUY_NOW") return "text-emerald-700";
  if (verdict === "AVOID") return "text-rose-700";
  return "text-amber-700";
}

function timingPillClass(verdict: string) {
  if (verdict === "BUY_NOW") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (verdict === "AVOID") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function buildBuyLinkCount(build: GeneratedBuild) {
  return categories.filter((category) => Boolean(build.offers[category]?.offer?.id)).length;
}

function bestDealPart(build: GeneratedBuild) {
  return [...build.productPriceTrends].sort((left, right) => left.currentPrice - right.currentPrice)[0]?.productName ?? "unknown";
}

function biggestOverpricedPart(build: GeneratedBuild) {
  return (
    build.timingReport?.priceDrivenPart?.productName ??
    [...build.productPriceTrends].sort((left, right) => right.estimatedSavingsIfWaiting - left.estimatedSavingsIfWaiting)[0]
      ?.productName ??
    "unknown"
  );
}

function primaryTrendReason(build: GeneratedBuild) {
  return build.productPriceTrends
    .map((trend) => trend.verdictDetails?.primaryReason)
    .find((reason) => reason?.severity === "danger" || reason?.severity === "warning");
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatMaybeCurrency(value: number) {
  if (Math.abs(value) <= 1) return `${Math.round(value * 1000) / 10}%`;
  return formatCurrency(value);
}
