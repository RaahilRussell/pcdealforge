import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bell, ExternalLink, ShieldCheck, TrendingDown } from "lucide-react";

import { EvidenceCitationList } from "@/components/EvidenceCitationList";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { generateBuilds } from "@/lib/builds/generateBuilds";
import { getBestSafeOffer, rankOffers } from "@/lib/deals/scoring";
import { getCurrentOffers, getOptimizerCatalog, getPriceHistory, getProduct } from "@/lib/data/catalog";
import { formatEvidenceCitation, summarizeEvidence } from "@/lib/evidence/formatEvidence";
import { getEvidenceForProduct } from "@/lib/evidence/evidenceMap";
import { calculateProductPriceTrend } from "@/lib/pricing/priceTrends";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const [offers, historiesByProductId, catalog, evidenceRecords] = await Promise.all([
    getCurrentOffers([product.id]),
    getPriceHistory([product.id]),
    getOptimizerCatalog(),
    getEvidenceForProduct(product.id),
  ]);
  const citations = evidenceRecords.map((record, index) => formatEvidenceCitation(record, index + 1));
  const citationsByClaimType = new Map(evidenceRecords.map((record, index) => [record.claimType, citations[index]]));
  const sourceSummary = summarizeEvidence(citations);
  const history = historiesByProductId[product.id] ?? [];
  const stats = priceStats(history);
  const rankedOffers = rankOffers(offers, stats, "open_box_allowed");
  const bestOffer = getBestSafeOffer(offers, stats, "open_box_allowed");
  const trend =
    history.length > 0
      ? calculateProductPriceTrend({
          productId: product.id,
          productName: `${product.brand} ${product.model}`,
          history,
          currentPrice: bestOffer?.effectivePrice,
          bestOffer,
        })
      : null;
  const generated = generateBuilds({
    budget: 1600,
    useCase: "gaming",
    resolution: "1440p",
    gpuPreference: "any",
    ramGb: 32,
    storageGb: 1000,
    wifiRequired: true,
    riskTolerance: "open_box_allowed",
    ...catalog,
  });
  const compatibleBuilds = [generated.bestOverall, generated.cheapestSafe, generated.bestPerformancePerDollar].flatMap(
    (build) => (build && Object.values(build.parts).some((part) => part.id === product.id) ? [build] : []),
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Build optimizer
          </Link>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-sm font-semibold uppercase tracking-normal text-zinc-500">{product.category}</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                {product.brand} {product.model}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
                Seeded product detail with verified offer scoring, deterministic price timing, and compatibility-aware
                build context.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {sourceSummary.totalSources} evidence records · {sourceSummary.seededDemoCount} seeded demo sources ·{" "}
                average confidence {Math.round(sourceSummary.averageConfidence * 100)}%
              </p>
            </div>
            {trend ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-medium text-zinc-500">Verdict</div>
                <div className={`mt-1 text-2xl font-semibold ${verdictTone(trend.verdict)}`}>{trend.verdict.replace("_", " ")}</div>
                <div className="mt-1 text-sm text-zinc-600">{formatCurrency(trend.currentPrice)} effective</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Specs</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {Object.entries(product.specs).map(([key, value]) => {
                const citation = citationsByClaimType.get(specClaimTypeForKey(key, product.category));

                return (
                  <div key={key} className="grid grid-cols-[150px_1fr] gap-3 border-b border-zinc-100 pb-2">
                    <dt className="font-medium text-zinc-500">{formatSpecKey(key)}</dt>
                    <dd className="text-zinc-800">
                      {formatSpecValue(value)}
                      {citation ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          [{citation.citationNumber}] Seeded demo source
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold">Mock Alerts</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-700">
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
                Alert me when this part drops below {formatCurrency((trend?.currentPrice ?? bestOffer?.effectivePrice ?? 100) - 25)}
              </div>
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
                Alert me when a build using this part drops below $1,400
              </div>
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
                Alert me when a compatible swap saves me money
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-8">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold">Current Best Offers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-normal text-zinc-500">
                    <th className="py-3 pr-4">Retailer</th>
                    <th className="py-3 pr-4">Condition</th>
                    <th className="py-3 pr-4">Effective price</th>
                    <th className="py-3 pr-4">Deal score</th>
                    <th className="py-3 pr-4">Risk</th>
                    <th className="py-3">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedOffers.map((offer) => (
                    <tr key={offer.offer.id} className="border-b border-zinc-100">
                      <td className="py-3 pr-4 font-medium">{offer.offer.retailer}</td>
                      <td className="py-3 pr-4">{offer.offer.condition.replace("_", " ")}</td>
                      <td className="py-3 pr-4 font-semibold">{formatCurrency(offer.effectivePrice)}</td>
                      <td className="py-3 pr-4">{Math.round(offer.dealScore)}</td>
                      <td className="py-3 pr-4 text-zinc-600">
                        {offer.riskNotes.length > 0 ? offer.riskNotes.join(", ") : "Safe recommendation"}
                      </td>
                      <td className="py-3">
                        {offer.offer.url.includes("example.com") ? (
                          <span className="text-zinc-500">Seeded demo listing</span>
                        ) : (
                          <a className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900" href={offer.offer.url}>
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold">Price History</h2>
            </div>
            <PriceHistoryChart history={history} currentPrice={trend?.currentPrice} />
            {trend ? (
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-5">
                <Metric label="Current" value={formatCurrency(trend.currentPrice)} />
                <Metric label="30d low" value={formatCurrency(trend.thirtyDayLow)} />
                <Metric label="90d low" value={formatCurrency(trend.ninetyDayLow)} />
                <Metric label="180d low" value={formatCurrency(trend.oneEightyDayLow)} />
                <Metric label="Average" value={formatCurrency(trend.ninetyDayAverage)} />
                <div className="md:col-span-5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
                  <div className="font-medium">Usually cheaper: {trend.usuallyCheaper ? "yes" : "no"}</div>
                  <p className="mt-1 leading-6">{trend.explanation}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Compatible Builds Using This Part</h2>
            <div className="mt-4 grid gap-3">
              {compatibleBuilds.length > 0 ? (
                compatibleBuilds.map((build) => (
                  <div key={build.id} className="grid gap-2 rounded-md border border-zinc-200 p-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="font-medium">{build.parts.cpu.model} + {build.parts.gpu.model}</div>
                      <div className="mt-1 text-sm text-zinc-600">{build.whySelected}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-semibold">{formatCurrency(build.totalPrice)}</div>
                      <div className="text-sm text-zinc-600">{Math.round(build.performanceScore)} performance</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  No seeded recommendation currently selects this part at the default 1440p target.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Product Evidence</h2>
            <EvidenceCitationList citations={citations} />
          </section>
        </div>
      </section>
    </main>
  );
}

function priceStats(history: Array<{ lowestTrustedPrice: number }>) {
  if (history.length === 0) {
    return { ninetyDayAverage: 0, historicalLow: 0 };
  }

  return {
    ninetyDayAverage:
      history.slice(-90).reduce((sum, point) => sum + point.lowestTrustedPrice, 0) / Math.min(90, history.length),
    historicalLow: Math.min(...history.map((point) => point.lowestTrustedPrice)),
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function formatSpecKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatSpecValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function specClaimTypeForKey(key: string, category: string) {
  const map: Record<string, string> = {
    socket: "socket",
    tdp: "tdp",
    supportedRamTypes: "ram_type",
    performanceScore: "performance_score",
    lengthMm: "gpu_length",
    slots: "gpu_slots",
    powerConnector: "power_connector",
    recommendedPsuW: "psu_wattage",
    ramType: "ram_type",
    capacityGb: "ram_capacity",
    speedMt: "ram_speed",
    heightMm: category === "ram" ? "ram_height" : "cooler_height",
    formFactor: "form_factor",
    formFactorSupport: "form_factor",
    interface: "storage_interface",
    type: category === "storage" ? "storage_type" : "cooler_type",
    m2Slots: "m2_slots",
    hasWifi: "wifi",
    hasFrontUsbCHeader: "front_usb_c",
    hasFrontUsbC: "front_usb_c",
    wattage: "psu_wattage",
    has12vhpwr: "power_connector",
    has12v2x6: "power_connector",
    maxGpuLengthMm: "case_clearance",
    maxCpuCoolerHeightMm: "case_clearance",
    radiatorSupport: "radiator_support",
    radiatorSizeMm: "radiator_support",
    supportedSockets: "socket",
  };

  return map[key] ?? key;
}

function verdictTone(verdict: string) {
  if (verdict === "BUY_NOW") return "text-emerald-700";
  if (verdict === "WAIT") return "text-amber-700";
  return "text-rose-700";
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
