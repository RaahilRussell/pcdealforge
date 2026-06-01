import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShoppingCart, TrendingDown } from "lucide-react";

import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { formatCurrency, isSeededDemoUrl } from "@/lib/builds/reportDetails";
import { getCurrentOffers, getOffer, getPriceHistory, getProduct } from "@/lib/data/catalog";
import { rankOffers } from "@/lib/deals/scoring";

export const dynamic = "force-dynamic";

export default async function OfferPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = await getOffer(offerId);

  if (!offer?.productId) {
    notFound();
  }

  const [product, offers, histories] = await Promise.all([
    getProduct(offer.productId),
    getCurrentOffers([offer.productId]),
    getPriceHistory([offer.productId]),
  ]);

  if (!product) {
    notFound();
  }

  const history = histories[product.id] ?? [];
  const stats = {
    ninetyDayAverage:
      history.length === 0 ? offer.price : history.slice(-90).reduce((sum, point) => sum + point.lowestTrustedPrice, 0) / Math.min(90, history.length),
    historicalLow: history.length === 0 ? offer.price : Math.min(...history.map((point) => point.lowestTrustedPrice)),
  };
  const scoredOffer = rankOffers(offers, stats, "open_box_allowed").find((item) => item.offer.id === offer.id);
  const effectivePrice = scoredOffer?.effectivePrice ?? offer.price + offer.shipping + offer.taxEstimate;
  const seededDemo = isSeededDemoUrl(offer.url);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href={`/products/${product.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            {product.brand} {product.model}
          </Link>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Offer detail</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">{offer.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                {seededDemo
                  ? "This is seeded MVP offer data, not a live retailer listing."
                  : "This offer has a stored external URL. Verify live price and stock before buying."}
              </p>
            </div>
            {seededDemo ? (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                Seeded demo offer
              </span>
            ) : (
              <a className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" href={offer.url} target="_blank" rel="noopener noreferrer">
                Open retailer
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside className="grid content-start gap-4">
          <Panel title="Price Math" icon={<ShoppingCart className="h-5 w-5 text-teal-700" />}>
            <div className="grid gap-3 text-sm">
              <Metric label="Base price" value={formatCurrency(offer.price)} />
              <Metric label="Shipping" value={formatCurrency(offer.shipping)} />
              <Metric label="Tax estimate" value={formatCurrency(offer.taxEstimate)} />
              <Metric label="Seller penalty" value={formatCurrency(scoredOffer?.sellerRiskPenalty ?? 0)} />
              <Metric label="Condition penalty" value={formatCurrency(scoredOffer?.conditionRiskPenalty ?? 0)} />
              <Metric label="Effective price" value={formatCurrency(effectivePrice)} />
            </div>
          </Panel>
          <Panel title="Trust" icon={<ShoppingCart className="h-5 w-5 text-teal-700" />}>
            <dl className="grid gap-2 text-sm">
              <Detail label="Retailer" value={offer.retailer} />
              <Detail label="Condition" value={offer.condition.replaceAll("_", " ")} />
              <Detail label="Seller" value={offer.sellerName ?? "Retailer direct / not specified"} />
              <Detail label="Seller rating" value={offer.sellerRating ? `${offer.sellerRating}/5` : "Not specified"} />
              <Detail label="Confidence" value={`${Math.round(offer.confidenceScore * 100)}%`} />
              <Detail label="In stock" value={offer.inStock ? "Yes" : "No"} />
              <Detail label="Last checked" value={offer.lastCheckedAt ? new Date(offer.lastCheckedAt).toLocaleString() : "Unknown"} />
            </dl>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              {scoredOffer?.isSafeRecommendation
                ? "This offer can be used as a safe seeded recommendation under the selected risk tolerance."
                : "This offer is not a top safe recommendation if the condition, seller, confidence, or stock data is too risky."}
            </p>
          </Panel>
        </aside>

        <div className="grid gap-8">
          <Panel title="Product" icon={<ShoppingCart className="h-5 w-5 text-teal-700" />}>
            <Link className="text-lg font-semibold text-teal-700 hover:text-teal-900" href={`/products/${product.id}`}>
              {product.brand} {product.model}
            </Link>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Category: {product.category}. Offer rows are seeded demo data unless the URL points to a verified external source.
            </p>
          </Panel>

          <Panel title="Price History Connected to This Offer" icon={<TrendingDown className="h-5 w-5 text-teal-700" />}>
            <PriceHistoryChart history={history} currentPrice={effectivePrice} />
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
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
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-zinc-100 pb-2">
      <dt className="font-medium text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{value}</dd>
    </div>
  );
}
