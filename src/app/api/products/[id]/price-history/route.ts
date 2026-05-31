import { getPriceHistory, getProduct } from "@/lib/data/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const historiesByProductId = await getPriceHistory([id]);

  return Response.json({
    product,
    history: historiesByProductId[id] ?? [],
  });
}
