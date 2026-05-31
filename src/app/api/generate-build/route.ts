import { generateBuilds } from "@/lib/builds/generateBuilds";
import { generateBuildSchema } from "@/lib/api/schemas";
import { getOptimizerCatalog } from "@/lib/data/catalog";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateBuildSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid build request", details: parsed.error.flatten() }, { status: 400 });
  }

  const catalog = await getOptimizerCatalog();
  const result = generateBuilds({
    ...parsed.data,
    ...catalog,
  });

  return Response.json(result);
}
