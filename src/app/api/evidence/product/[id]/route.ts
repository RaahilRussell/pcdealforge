import { formatEvidenceCitation, summarizeEvidence } from "@/lib/evidence/formatEvidence";
import { getEvidenceForProduct } from "@/lib/evidence/evidenceMap";
import { getProduct } from "@/lib/data/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getProduct(id);

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const evidenceRecords = await getEvidenceForProduct(id);
  const citations = evidenceRecords.map((record, index) => formatEvidenceCitation(record, index + 1));

  return Response.json({
    product,
    evidenceRecords,
    citations,
    sourceConfidenceSummary: summarizeEvidence(citations),
  });
}
