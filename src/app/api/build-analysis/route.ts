import { buildAnalysisSchema } from "@/lib/api/schemas";
import { generateSourceBackedBuilds, selectBuildVariant } from "@/lib/builds/reporting";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = buildAnalysisSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid build analysis request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { variant, ...buildInput } = parsed.data;
  const result = await generateSourceBackedBuilds(buildInput);
  const build = selectBuildVariant(result, variant);

  if (!build) {
    return Response.json({ error: "No compatible build found for requested analysis" }, { status: 404 });
  }

  return Response.json({
    variant,
    build,
    essay: build.essay,
    citations: build.essay.citations,
    sourceConfidenceSummary: build.sourceConfidenceSummary,
  });
}
