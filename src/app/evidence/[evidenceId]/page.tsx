import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

import { getEvidenceDetail } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const detail = await getEvidenceDetail(evidenceId);

  if (!detail) {
    notFound();
  }

  const source = detail.kind === "product_evidence" ? detail.record.source : detail.source;
  const isSeeded = source.sourceType === "seeded_demo";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Build optimizer
          </Link>
          <div className="mt-6 flex items-start gap-3">
            <FileText className="mt-1 h-7 w-7 text-teal-700" />
            <div>
              <div className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Evidence/source record</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                {isSeeded ? "Seeded demo source" : source.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                {isSeeded
                  ? "This source exists to demonstrate the evidence architecture. It should be replaced by manufacturer, retailer, benchmark, or validated scraper/API data in production."
                  : "This record is a stored source or calculation used by a PCDealForge claim."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Source</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Detail label="Source type" value={source.sourceType.replaceAll("_", " ")} />
            <Detail label="Title" value={isSeeded ? "Seeded demo source" : source.title} />
            <Detail label="Publisher" value={source.publisher} />
            <Detail label="Captured" value={new Date(source.capturedAt).toLocaleString()} />
            <Detail label="Confidence" value={`${Math.round(source.confidenceScore * 100)}%`} />
            <Detail label="Source status" value={isSeeded ? "Seeded demo data" : "Stored source"} />
          </dl>
          {source.url ? (
            <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900" href={source.url} target="_blank" rel="noopener noreferrer">
              Source URL
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              No external URL is attached. This is not presented as live web evidence.
            </div>
          )}
          {source.notes ? <p className="mt-4 text-sm leading-6 text-zinc-600">{source.notes}</p> : null}
        </section>

        {detail.kind === "product_evidence" ? (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Claim</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Claim type" value={detail.record.claimType.replaceAll("_", " ")} />
              <Detail label="Claim" value={detail.record.claim} />
              <Detail label="Value" value={`${detail.record.value}${detail.record.unit ? ` ${detail.record.unit}` : ""}`} />
              <Detail label="Product" value={detail.product ? `${detail.product.brand} ${detail.product.model}` : detail.record.productId} />
            </dl>
            {detail.product ? (
              <Link className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900" href={`/products/${detail.product.id}`}>
                View related product
              </Link>
            ) : null}
          </section>
        ) : (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Calculation/Rule Source</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              This record is used as a source for internal calculations or deterministic compatibility logic. It may be cited by
              multiple build reports.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-zinc-100 pb-2">
      <dt className="font-medium text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{value}</dd>
    </div>
  );
}
