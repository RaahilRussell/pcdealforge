import { getCurrentOffers, getPriceHistory, getProduct } from "@/lib/data/catalog";
import { getBestSafeOffer } from "@/lib/deals/scoring";
import { calculateProductPriceTrend } from "@/lib/pricing/priceTrends";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const [offers, historiesByProductId] = await Promise.all([getCurrentOffers([id]), getPriceHistory([id])]);
  const history = historiesByProductId[id] ?? [];
  const ninetyDayAverage =
    history.slice(-90).reduce((sum, point) => sum + point.lowestTrustedPrice, 0) / Math.min(90, history.length);
  const historicalLow = Math.min(...history.map((point) => point.lowestTrustedPrice));
  const bestOffer = getBestSafeOffer(offers, { ninetyDayAverage, historicalLow }, "open_box_allowed");
  const priceTrend =
    history.length > 0
      ? calculateProductPriceTrend({
          productId: product.id,
          productName: `${product.brand} ${product.model}`,
          history,
          currentPrice: bestOffer?.effectivePrice,
          bestOffer,
        })
      : null;

  return Response.json({ product, offers, priceTrend });
}
