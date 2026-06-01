import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";

import { formatCurrency, formatSpecValue, isSeededDemoUrl } from "@/lib/builds/reportDetails";
import { getPrebuiltSystem, listSavedBuilds } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function PrebuiltPage({ params }: { params: Promise<{ prebuiltId: string }> }) {
  const { prebuiltId } = await params;
  const [prebuilt, builds] = await Promise.all([getPrebuiltSystem(prebuiltId), listSavedBuilds(12)]);

  if (!prebuilt) {
    notFound();
  }

  const closestDiy =
    [...builds].sort((left, right) => Math.abs(left.totalPrice - prebuilt.price) - Math.abs(right.totalPrice - prebuilt.price))[0] ??
    null;
  const external = !prebuilt.url.startsWith("/") && !isSeededDemoUrl(prebuilt.url);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/builds" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Build reports
          </Link>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Seeded prebuilt alternative</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                {prebuilt.brand} {prebuilt.model}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                This prebuilt record is a placeholder architecture for future DIY-vs-prebuilt comparisons. It is seeded
                MVP data unless a verified retailer URL is attached.
              </p>
            </div>
            {external ? (
              <a className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" href={prebuilt.url} target="_blank" rel="noopener noreferrer">
                Retailer link
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                Seeded demo prebuilt
              </span>
            )}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Price" value={formatCurrency(prebuilt.price)} />
            <Metric label="GPU" value={prebuilt.gpuName} />
            <Metric label="RAM" value={`${prebuilt.ramGb}GB`} />
            <Metric label="Storage" value={`${prebuilt.storageGb}GB`} />
            <Metric label="Value" value={Math.round(prebuilt.valueScore).toString()} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="grid content-start gap-4">
          <Panel title="Included Specs">
            <dl className="grid gap-2 text-sm">
              <Detail label="CPU" value={prebuilt.cpuName} />
              <Detail label="GPU" value={prebuilt.gpuName} />
              <Detail label="RAM" value={`${prebuilt.ramGb}GB`} />
              <Detail label="Storage" value={`${prebuilt.storageGb}GB`} />
              <Detail label="PSU" value={prebuilt.psuInfo ?? "Unknown"} />
              <Detail label="Motherboard" value={prebuilt.motherboardInfo ?? "Unknown"} />
              <Detail label="Case" value={prebuilt.caseInfo ?? "Unknown"} />
              <Detail label="Cooling" value={prebuilt.coolingInfo ?? "Unknown"} />
              <Detail label="Warranty" value={prebuilt.warrantyInfo ?? "Unknown"} />
            </dl>
          </Panel>
          <Panel title="Scores">
            <div className="grid gap-3">
              <Metric label="Upgradeability" value={Math.round(prebuilt.upgradeabilityScore).toString()} />
              <Metric label="Value" value={Math.round(prebuilt.valueScore).toString()} />
              <Metric label="Confidence" value={`${Math.round(prebuilt.confidenceScore * 100)}%`} />
            </div>
          </Panel>
        </aside>

        <div className="grid gap-8">
          <Panel title="What Is Unknown">
            <p className="text-sm leading-7 text-zinc-700">
              Prebuilt listings often hide important component details. This seeded record may not know the exact PSU,
              motherboard, case, cooling configuration, memory channel layout, or proprietary part usage. Those unknowns matter
              because they affect upgradeability, acoustics, thermals, and long-term reliability.
            </p>
          </Panel>

          <Panel title="Hidden Risks">
            <div className="grid gap-3 md:grid-cols-2">
              {["unknown PSU quality", "unknown motherboard model", "single-channel RAM", "weak cooling", "proprietary parts", "higher prebuilt markup"].map((risk) => (
                <div key={risk} className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {risk}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              The warranty can be an advantage, but it does not remove the need to verify exact components before buying.
            </p>
          </Panel>

          <Panel title="DIY Value Comparison">
            {closestDiy ? (
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm leading-7 text-zinc-700">
                    The nearest saved DIY build by price is {closestDiy.name} at {formatCurrency(closestDiy.totalPrice)}.
                    DIY exposes every component and compatibility claim, while the prebuilt offers convenience and potential
                    warranty simplicity at the cost of less transparent component selection.
                  </p>
                </div>
                <Link className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800" href={`/builds/${closestDiy.id}`}>
                  Open DIY report
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Generate a DIY build to compare against this seeded prebuilt.</p>
            )}
          </Panel>

          <Panel title="Raw Seeded Specs">
            <dl className="grid gap-2 text-sm">
              {Object.entries(prebuilt.specs).map(([key, value]) => (
                <Detail key={key} label={formatSpecKey(key)} value={formatSpecValue(value)} />
              ))}
            </dl>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-zinc-100 pb-2">
      <dt className="font-medium text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{value}</dd>
    </div>
  );
}

function formatSpecKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
