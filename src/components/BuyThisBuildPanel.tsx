"use client";

import { useState } from "react";
import { Clipboard, ExternalLink, ShoppingCart } from "lucide-react";

type ShoppingRow = {
  category: string;
  productName: string;
  retailer: string;
  actionLabel: string;
  href: string;
  isExternalUrl: boolean;
  isDemoOffer: boolean;
  inStock: boolean;
};

export function BuyThisBuildPanel({
  rows,
  markdown,
}: {
  rows: ShoppingRow[];
  markdown: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const externalRows = rows.filter((row) => row.isExternalUrl && row.inStock);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function openExternalLinks() {
    for (const row of externalRows) {
      window.open(row.href, "_blank", "noopener,noreferrer");
    }
    setConfirmOpen(false);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-teal-700" />
        <h2 className="text-lg font-semibold">Buy This Build</h2>
      </div>
      <p className="max-w-4xl text-sm leading-6 text-zinc-600">
        PCDealForge does not complete purchases. Use these links as a checklist, then verify price, stock, return policy,
        seller, tax, shipping, and compatibility before buying.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={externalRows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          <ExternalLink className="h-4 w-4" />
          Open all real retailer links
        </button>
        <button
          type="button"
          onClick={() => copy(rows.map((row) => `${row.productName}: ${row.href}`).join("\n"), "links")}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
        >
          <Clipboard className="h-4 w-4" />
          {copied === "links" ? "Copied" : "Copy all buy links"}
        </button>
        <button
          type="button"
          onClick={() => copy(markdown, "markdown")}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
        >
          <Clipboard className="h-4 w-4" />
          {copied === "markdown" ? "Copied" : "Copy markdown shopping list"}
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <div key={`${row.category}-${row.productName}`} className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm md:grid-cols-[120px_1fr_auto]">
            <div className="font-semibold uppercase text-zinc-500">{row.category}</div>
            <div>
              <div className="font-medium text-zinc-900">{row.productName}</div>
              <div className="text-zinc-600">
                {row.retailer} · {row.isDemoOffer ? "Seeded demo offer" : "External retailer"} · {row.inStock ? "In stock" : "Unavailable"}
              </div>
            </div>
            <a
              href={row.href}
              target={row.isExternalUrl ? "_blank" : undefined}
              rel={row.isExternalUrl ? "noopener noreferrer" : undefined}
              className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-teal-700 ring-1 ring-zinc-200 hover:text-teal-900"
            >
              {row.actionLabel}
            </a>
          </div>
        ))}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Open retailer pages?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              You are about to open retailer pages for each selected part. PCDealForge does not complete purchases. Verify
              price, stock, return policy, seller, tax, shipping, and compatibility before buying.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-800">
                Cancel
              </button>
              <button type="button" onClick={openExternalLinks} className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                Open links
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
