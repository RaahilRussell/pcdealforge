import { dealsRefreshSchema } from "@/lib/api/schemas";
import { getCurrentOffers, listProducts } from "@/lib/data/catalog";
import { getRetailerConfig } from "@/lib/retailers/config";
import { runRetailerRefresh } from "@/lib/retailers/refresh";
import type { RetailerTargetProduct } from "@/lib/retailers/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = dealsRefreshSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid refresh request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { productIds, categories, allowDemoFallback, riskTolerance } = parsed.data;
  const config = getRetailerConfig();

  const allProducts = (await Promise.all((categories ?? [null]).map((category) => listProducts(category)))).flat();
  const filtered = productIds ? allProducts.filter((product) => productIds.includes(product.id)) : allProducts;
  const products: RetailerTargetProduct[] = filtered.map((product) => ({
    id: product.id,
    category: product.category,
    brand: product.brand,
    model: product.model,
    normalizedName: product.normalizedName,
    mpn: product.mpn,
    upc: product.upc,
    specs: product.specs,
  }));

  const seededOffers = await getCurrentOffers(productIds);

  const summary = await runRetailerRefresh({
    products,
    config,
    seededOffers,
    riskTolerance,
    allowDemoFallback,
  });

  // Keep the response payload lean — return counts/status and a capped sample of offers.
  return Response.json({
    mode: summary.mode,
    lastCheckedAt: summary.lastCheckedAt,
    message: summary.message,
    retailersChecked: summary.retailersChecked,
    offersFetched: summary.offersFetched,
    offersVerified: summary.offersVerified,
    offersRejected: summary.offersRejected,
    verifiedLiveCount: summary.verifiedLiveCount,
    verifiedRecentCount: summary.verifiedRecentCount,
    staleCount: summary.staleCount,
    demoCount: summary.demoCount,
    unverifiedCount: summary.unverifiedCount,
    errorsByRetailer: summary.errorsByRetailer,
    adapterStatus: summary.adapterStatus,
    rejected: summary.rejected.slice(0, 25),
    offers: summary.offers.slice(0, 50),
  });
}
