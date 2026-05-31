import { checkBuild } from "@/lib/compatibility/checkBuild";
import type { ProductCategory } from "@/lib/compatibility/types";
import { compatibilityCheckSchema } from "@/lib/api/schemas";
import { getProductsByIds, toCompatibilityProduct } from "@/lib/data/catalog";
import { attachEvidenceToCompatibilityReport } from "@/lib/evidence/evidenceMap";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = compatibilityCheckSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid compatibility payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const partIds = parsed.data.partIds;
  const products = await getProductsByIds(Object.values(partIds));
  const byId = new Map(products.map((product) => [product.id, toCompatibilityProduct(product)]));
  const parts = Object.fromEntries(
    Object.entries(partIds).map(([category, productId]) => [category, byId.get(productId)]),
  ) as Partial<Record<ProductCategory, ReturnType<typeof toCompatibilityProduct>>>;

  const report = await attachEvidenceToCompatibilityReport(
    checkBuild({ parts, wifiRequired: parsed.data.wifiRequired }),
    parts,
  );

  return Response.json({ report });
}
