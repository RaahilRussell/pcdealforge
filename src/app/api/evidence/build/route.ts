import { buildEvidenceSchema } from "@/lib/api/schemas";
import { generateSourceBackedBuilds, selectBuildVariant } from "@/lib/builds/reporting";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = buildEvidenceSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid build evidence request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { variant, ...buildInput } = parsed.data;
  const result = await generateSourceBackedBuilds(buildInput);
  const build = selectBuildVariant(result, variant);

  if (!build) {
    return Response.json({ error: "No compatible build found for requested variant" }, { status: 404 });
  }

  return Response.json({
    variant,
    evidence: build.evidence,
    sourceConfidenceSummary: build.sourceConfidenceSummary,
    compatibilityReport: build.compatibilityReport,
    priceTrends: build.productPriceTrends,
  });
}
