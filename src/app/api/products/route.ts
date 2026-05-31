import { listProducts } from "@/lib/data/catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const products = await listProducts(category);

  return Response.json({ products });
}
