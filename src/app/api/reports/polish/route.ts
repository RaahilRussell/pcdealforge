import { z } from "zod";

import { polishReport } from "@/lib/llm/reportWriter";

const polishSchema = z.object({
  deterministicReport: z.string().min(1),
  deterministicVerdicts: z.record(z.string(), z.string()).default({}),
  citations: z
    .array(
      z.object({
        citationNumber: z.number(),
        title: z.string(),
        sourceType: z.string(),
        claim: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = polishSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid polish request", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await polishReport(parsed.data);
  return Response.json(result);
}
