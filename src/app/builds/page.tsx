import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { buildTypeLabel, formatCurrency, priceVerdictLabel } from "@/lib/builds/reportDetails";
import { listSavedBuilds } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const builds = await listSavedBuilds(24);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Build optimizer
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <FileText className="h-7 w-7 text-teal-700" />
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">Saved Build Reports</h1>
              <p className="mt-2 text-sm text-zinc-600">
                Generated recommendations are persisted as source-backed seeded demo reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {builds.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            No generated builds are saved yet. Generate a build from the homepage to create report links.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {builds.map((build) => (
              <Link
                key={build.id}
                href={`/builds/${build.id}`}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-teal-600"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                    {buildTypeLabel(build.buildType)}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    {build.compatibilityStatus}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-semibold">{build.name}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Total" value={formatCurrency(build.totalPrice)} />
                  <Metric label="Performance" value={Math.round(build.performanceScore).toString()} />
                  <Metric label="Deal" value={Math.round(build.dealScore).toString()} />
                  <Metric label="Verdict" value={priceVerdictLabel(build.priceVerdict)} />
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  {build.useCase} · {build.resolution} · {build.ramGb}GB RAM · {build.storageGb}GB storage
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
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
