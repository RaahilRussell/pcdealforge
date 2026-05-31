import { compareBuildsSchema } from "@/lib/api/schemas";
import { generateSourceBackedBuilds } from "@/lib/builds/reporting";
import { summarizeEvidence } from "@/lib/evidence/formatEvidence";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = compareBuildsSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid build comparison request", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await generateSourceBackedBuilds(parsed.data);

  if (!result.comparison) {
    return Response.json({ error: "Need all three build variants to compare" }, { status: 404 });
  }

  return Response.json({
    comparison: result.comparison,
    citations: result.comparison.citations,
    sourceConfidenceSummary: summarizeEvidence(result.comparison.citations),
  });
}
