import { generateBuildSchema } from "@/lib/api/schemas";
import { generateSourceBackedBuilds } from "@/lib/builds/reporting";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateBuildSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid build request", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await generateSourceBackedBuilds(parsed.data);

  return Response.json(result);
}
