import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldCheck, ShoppingCart, TrendingDown } from "lucide-react";

import { EvidenceCitationList } from "@/components/EvidenceCitationList";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ReportActions } from "@/components/ReportActions";
import {
  buildCategories,
  buildTypeLabel,
  categoryLabels,
  evidenceHref,
  formatCurrency,
  formatSpecValue,
  getBuildReport,
  offerLinkTarget,
  priceVerdictLabel,
} from "@/lib/builds/reportDetails";
import { getPriceHistory } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function BuildReportPage({ params }: { params: Promise<{ buildId: string }> }) {
  const { buildId } = await params;
  const report = await getBuildReport(buildId);

  if (!report) {
    notFound();
  }

  const { saved, build, costBreakdown, partExplanations, compatibilityDeepDive, prebuiltComparison } = report;
  const histories = await getPriceHistory(buildCategories.map((category) => build.parts[category].id));
  const buildHistory = aggregateBuildHistory(histories);
  const sourceCount = build.evidence.length;
  const budgetRemaining = saved.targetBudget - costBreakdown.effectiveTotal;
  const bestDeal = [...build.productPriceTrends].sort((left, right) => left.currentPrice - right.currentPrice)[0];
  const worstDeal = [...build.productPriceTrends].sort(
    (left, right) => right.estimatedSavingsIfWaiting - left.estimatedSavingsIfWaiting,
  )[0];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/builds" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Saved builds
          </Link>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{buildTypeLabel(saved.buildType)}</Badge>
                <Badge>Seeded demo data</Badge>
                <Badge>{sourceCount} sources</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{saved.name}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-600">
                {build.whySelected || build.essay.executiveSummary}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Last generated {saved.updatedAt.toLocaleString()} · {saved.candidateCount?.toLocaleString() ?? "Unknown"} candidates evaluated
              </p>
            </div>
            <ReportActions markdown={report.markdown} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label="Total" value={formatCurrency(build.totalPrice)} />
            <Metric label="Performance" value={Math.round(build.performanceScore).toString()} />
            <Metric label="Deal score" value={Math.round(build.dealScore).toString()} />
            <Metric label="Compatibility" value={build.compatibilityReport.overallStatus} />
            <Metric label="Verdict" value={priceVerdictLabel(build.priceVerdict)} />
            <Metric label="Budget delta" value={budgetRemaining >= 0 ? `${formatCurrency(budgetRemaining)} left` : `${formatCurrency(Math.abs(budgetRemaining))} over`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Panel id="summary" title="Build Summary" icon={<FileText className="h-5 w-5 text-teal-700" />}>
          <p className="max-w-5xl text-sm leading-7 text-zinc-700">
            This report targets a {saved.useCase} build at {saved.resolution} under {formatCurrency(saved.targetBudget)}.
            It selected {build.parts.cpu.brand} {build.parts.cpu.model} with {build.parts.gpu.brand} {build.parts.gpu.model}
            and stores the selected parts, offers, compatibility report, price verdict, essay, and evidence as a saved build record.
            The recommendation is {priceVerdictLabel(build.priceVerdict)} in the seeded price model; the biggest tradeoff is{" "}
            {worstDeal
              ? `${worstDeal.productName} has the largest estimated waiting savings at ${formatCurrency(
                  worstDeal.estimatedSavingsIfWaiting,
                )}.`
              : "that the current MVP uses seeded demo data instead of live retailer feeds."}
          </p>
        </Panel>

        <Panel id="cost" title="Full Cost Breakdown" icon={<ShoppingCart className="h-5 w-5 text-teal-700" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-normal text-zinc-500">
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Selected offer</th>
                  <th className="py-3 pr-4">Retailer</th>
                  <th className="py-3 pr-4">Condition</th>
                  <th className="py-3 pr-4">Base</th>
                  <th className="py-3 pr-4">Shipping</th>
                  <th className="py-3 pr-4">Tax est.</th>
                  <th className="py-3 pr-4">Risk penalty</th>
                  <th className="py-3 pr-4">Effective</th>
                  <th className="py-3">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {costBreakdown.rows.map((row) => {
                  const link = offerLinkTarget(row.offer.offer);
                  const partEvidence = partExplanations[row.category].evidence[0];

                  return (
                    <tr key={row.category} className="border-b border-zinc-100 align-top">
                      <td className="py-3 pr-4 font-medium">{categoryLabels[row.category]}</td>
                      <td className="py-3 pr-4">
                        <Link className="font-medium text-teal-700 hover:text-teal-900" href={`/products/${row.part.id}`}>
                          {row.part.brand} {row.part.model}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">{row.offer.offer.title}</td>
                      <td className="py-3 pr-4">
                        {link.external ? (
                          <a className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900" href={link.href} target="_blank" rel="noopener noreferrer">
                            {row.offer.offer.retailer}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Link className="font-medium text-teal-700 hover:text-teal-900" href={link.href}>
                            {row.offer.offer.retailer}
                          </Link>
                        )}
                      </td>
                      <td className="py-3 pr-4">{row.offer.offer.condition.replaceAll("_", " ")}</td>
                      <td className="py-3 pr-4">{formatCurrency(row.basePrice)}</td>
                      <td className="py-3 pr-4">{formatCurrency(row.shipping)}</td>
                      <td className="py-3 pr-4">{formatCurrency(row.taxEstimate)}</td>
                      <td className="py-3 pr-4">{formatCurrency(row.riskPenalty)}</td>
                      <td className="py-3 pr-4 font-semibold">{formatCurrency(row.effectivePrice)}</td>
                      <td className="py-3">
                        {partEvidence && evidenceHref(partEvidence) ? (
                          <Link className="text-teal-700 hover:text-teal-900" href={evidenceHref(partEvidence)!}>
                            [{partEvidence.citationNumber}]
                          </Link>
                        ) : (
                          <span className="text-zinc-500">Seeded</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Subtotal" value={formatCurrency(costBreakdown.subtotal)} />
            <Metric label="Shipping" value={formatCurrency(costBreakdown.shippingTotal)} />
            <Metric label="Estimated tax" value={formatCurrency(costBreakdown.taxTotal)} />
            <Metric label="Risk penalties" value={formatCurrency(costBreakdown.riskPenaltyTotal)} />
            <Metric label="Effective total" value={formatCurrency(costBreakdown.effectiveTotal)} />
          </div>
        </Panel>

        <Panel id="parts" title="Part-by-Part Explanation" icon={<ShieldCheck className="h-5 w-5 text-teal-700" />}>
          <div className="grid gap-4 lg:grid-cols-2">
            {buildCategories.map((category) => {
              const part = build.parts[category];
              const offer = build.offers[category];
              const explanation = partExplanations[category];
              const link = offerLinkTarget(offer.offer);

              return (
                <article key={category} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{categoryLabels[category]}</div>
                      <h3 className="mt-1 text-lg font-semibold">{part.brand} {part.model}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">{explanation.shortReason}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(offer.effectivePrice)}</div>
                      <div className="text-xs text-zinc-500">{offer.offer.retailer}</div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(part.specs).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-white p-2">
                        <dt className="text-xs font-medium uppercase tracking-normal text-zinc-500">{formatSpecKey(key)}</dt>
                        <dd className="mt-1 text-zinc-800">{formatSpecValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm leading-6 text-zinc-700">{explanation.detailedReason}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <BulletBox title="Positives" items={explanation.positives} />
                    <BulletBox title="Downsides" items={explanation.negatives} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900" href={`/products/${part.id}`}>
                      View product page
                    </Link>
                    {link.external ? (
                      <a className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900" href={link.href} target="_blank" rel="noopener noreferrer">
                        View selected offer
                      </a>
                    ) : (
                      <Link className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900" href={link.href}>
                        View selected offer
                      </Link>
                    )}
                    <EvidenceChip citations={explanation.evidence} />
                    <button className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-zinc-200" type="button">
                      Swap this part
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>

        <Panel id="compatibility" title="Compatibility Deep Dive" icon={<ShieldCheck className="h-5 w-5 text-teal-700" />}>
          <div className="grid gap-3">
            {compatibilityDeepDive.map((row) => (
              <details key={row.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{row.ruleName}</div>
                      <div className="mt-1 text-sm text-zinc-600">{row.explanation}</div>
                    </div>
                    <StatusPill status={row.level} />
                  </div>
                </summary>
                <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-[1fr_280px]">
                  <div className="grid gap-2 text-sm">
                    {row.checkedValues.map((value) => (
                      <div key={`${row.id}-${value.label}`} className="grid grid-cols-[190px_1fr] gap-3 rounded-md bg-zinc-50 p-3">
                        <div className="font-medium text-zinc-500">{value.label}</div>
                        <div className="text-zinc-800">{value.value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-zinc-500">Sources</div>
                    <EvidenceChipList citations={row.evidence} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </Panel>

        <Panel id="price" title="Price Timing Deep Dive" icon={<TrendingDown className="h-5 w-5 text-teal-700" />}>
          <div className="grid gap-6">
            <PriceHistoryChart history={buildHistory} currentPrice={build.totalPrice} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Current build" value={formatCurrency(build.totalPrice)} />
              <Metric label="30d low" value={formatCurrency(minWindow(buildHistory, 30))} />
              <Metric label="90d low" value={formatCurrency(minWindow(buildHistory, 90))} />
              <Metric label="180d low" value={formatCurrency(minWindow(buildHistory, 180))} />
              <Metric label="Potential savings" value={formatCurrency(build.productPriceTrends.reduce((sum, trend) => sum + trend.estimatedSavingsIfWaiting, 0))} />
            </div>
            <p className="text-sm leading-7 text-zinc-700">
              The build verdict is {priceVerdictLabel(build.priceVerdict)}. The best part deal by current seeded price is{" "}
              {bestDeal?.productName ?? "not available"}, while the most overpriced part by estimated waiting savings is{" "}
              {worstDeal?.productName ?? "not available"}. Each price claim is based on seeded price snapshots and internal
              calculation evidence, not live retailer inventory.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {build.productPriceTrends.map((trend) => (
                <Link key={trend.productId} href={`/products/${trend.productId}#price-history`} className="rounded-md border border-zinc-200 bg-zinc-50 p-4 hover:border-teal-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{trend.productName}</div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      {priceVerdictLabel(trend.verdict)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                    <Metric label="Now" value={formatCurrency(trend.currentPrice)} />
                    <Metric label="30d" value={formatCurrency(trend.thirtyDayLow)} />
                    <Metric label="90d" value={formatCurrency(trend.ninetyDayLow)} />
                    <Metric label="180d" value={formatCurrency(trend.oneEightyDayLow)} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        <Panel id="essay" title="Full Essay" icon={<FileText className="h-5 w-5 text-teal-700" />}>
          <div className="grid gap-4">
            {essaySections(build.essay).map(([title, body]) => (
              <section key={title} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-zinc-700">{body}</p>
              </section>
            ))}
          </div>
        </Panel>

        <Panel id="prebuilts" title="Compare to Prebuilt Alternatives" icon={<ShoppingCart className="h-5 w-5 text-teal-700" />}>
          <p className="text-sm leading-7 text-zinc-700">{prebuiltComparison.explanation}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PrebuiltCard title="Nearest by price" prebuilt={prebuiltComparison.nearestByPrice} />
            <PrebuiltCard title="Nearest by GPU" prebuilt={prebuiltComparison.nearestByGpu} />
            <PrebuiltCard title="Best prebuilt value" prebuilt={prebuiltComparison.bestValue} />
          </div>
        </Panel>

        <Panel id="sources" title="Sources Used" icon={<FileText className="h-5 w-5 text-teal-700" />}>
          <EvidenceCitationList citations={build.evidence} />
        </Panel>
      </section>
    </main>
  );
}

function Panel({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">{children}</span>;
}

function BulletBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-white p-3 ring-1 ring-zinc-200">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-zinc-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceChip({ citations }: { citations: Array<{ citationNumber: number; evidenceId?: string }> }) {
  const citation = citations.find((item) => item.evidenceId);
  if (!citation?.evidenceId) return <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-zinc-200">View evidence</span>;
  return (
    <Link className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900" href={`/evidence/${citation.evidenceId}`}>
      View evidence [{citation.citationNumber}]
    </Link>
  );
}

function EvidenceChipList({ citations }: { citations: Array<{ citationNumber: number; title: string; evidenceId?: string }> }) {
  if (citations.length === 0) return <div className="text-sm text-zinc-500">No evidence attached.</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {citations.slice(0, 8).map((citation) =>
        citation.evidenceId ? (
          <Link key={`${citation.citationNumber}-${citation.title}`} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200" href={`/evidence/${citation.evidenceId}`}>
            [{citation.citationNumber}]
          </Link>
        ) : (
          <span key={`${citation.citationNumber}-${citation.title}`} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
            [{citation.citationNumber}]
          </span>
        ),
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "PASS"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "WARNING"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{status}</span>;
}

function PrebuiltCard({ title, prebuilt }: { title: string; prebuilt: { id: string; brand: string; model: string; price: number; gpuName: string; valueScore: number } | null }) {
  if (!prebuilt) {
    return <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">{title}: no seeded prebuilt available.</div>;
  }

  return (
    <Link href={`/prebuilts/${prebuilt.id}`} className="rounded-md border border-zinc-200 bg-zinc-50 p-4 hover:border-teal-600">
      <div className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{title}</div>
      <div className="mt-2 font-semibold">{prebuilt.brand} {prebuilt.model}</div>
      <div className="mt-1 text-sm text-zinc-600">{prebuilt.gpuName}</div>
      <div className="mt-3 flex justify-between text-sm">
        <span>{formatCurrency(prebuilt.price)}</span>
        <span>{Math.round(prebuilt.valueScore)} value</span>
      </div>
    </Link>
  );
}

function essaySections(essay: {
  executiveSummary: string;
  whyThisBuildExists?: string;
  performanceExpectations?: string;
  positives: string;
  negatives: string;
  compatibilityReasoning: string;
  dealReasoning: string;
  partByPartJustification?: string;
  bestUpgradePath?: string;
  suggestedSwaps: string;
  whoShouldBuy: string;
  whoShouldAvoid: string;
  finalRecommendation?: string;
  finalVerdict: string;
}) {
  return [
    ["Executive Summary", essay.executiveSummary],
    ["Why This Build Exists", essay.whyThisBuildExists ?? essay.executiveSummary],
    ["Performance Expectations", essay.performanceExpectations ?? essay.positives],
    ["Positives", essay.positives],
    ["Negatives", essay.negatives],
    ["Compatibility Explanation", essay.compatibilityReasoning],
    ["Deal and Price Timing Explanation", essay.dealReasoning],
    ["Part-by-Part Justification", essay.partByPartJustification ?? essay.positives],
    ["Best Upgrade Path", essay.bestUpgradePath ?? essay.suggestedSwaps],
    ["Suggested Swaps", essay.suggestedSwaps],
    ["Who Should Buy This", essay.whoShouldBuy],
    ["Who Should Avoid This", essay.whoShouldAvoid],
    ["Final Recommendation", essay.finalRecommendation ?? essay.finalVerdict],
  ] as const;
}

function aggregateBuildHistory(histories: Record<string, Array<{ date: Date | string; lowestTrustedPrice: number; avgNewPrice: number }>>) {
  const entries = Object.values(histories);
  if (entries.length === 0) return [];
  const shortest = Math.min(...entries.map((history) => history.length));
  const normalized = entries.map((history) =>
    [...history].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()).slice(-shortest),
  );

  return normalized[0].map((point, index) => ({
    date: point.date,
    lowestTrustedPrice: normalized.reduce((sum, history) => sum + history[index].lowestTrustedPrice, 0),
    avgNewPrice: normalized.reduce((sum, history) => sum + history[index].avgNewPrice, 0),
  }));
}

function minWindow(history: Array<{ lowestTrustedPrice: number }>, days: number) {
  const prices = history.slice(-days).map((point) => point.lowestTrustedPrice);
  return Math.min(...prices);
}

function formatSpecKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
