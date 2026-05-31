import { dealsRefreshSchema } from "@/lib/api/schemas";
import { getCurrentOffers, listProducts } from "@/lib/data/catalog";
import { MockDealAdapter } from "@/lib/deals/adapters/mock";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = dealsRefreshSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid refresh request", details: parsed.error.flatten() }, { status: 400 });
  }

  const [products, seededOffers] = await Promise.all([listProducts(), getCurrentOffers()]);
  const adapter = new MockDealAdapter(seededOffers);
  const refreshedOffers = await adapter.refreshOffers({
    products: products.map((product) => ({
      id: product.id,
      brand: product.brand,
      model: product.model,
      normalizedName: product.normalizedName,
      mpn: product.mpn,
      upc: product.upc,
    })),
  });

  return Response.json({
    adapter: parsed.data.adapter,
    refreshedOfferCount: refreshedOffers.length,
    message: "Mock refresh completed from seeded offer data. Live marketplace adapters are intentionally not enabled.",
  });
}
