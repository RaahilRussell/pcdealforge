import { describe, expect, it } from "vitest";

import { checkBuild } from "@/lib/compatibility/checkBuild";
import type { ProductCategory } from "@/lib/compatibility/types";
import { getCurrentOffers, getPriceHistory, listProducts, toCompatibilityProduct } from "@/lib/data/catalog";
import { getBestSafeOffer } from "@/lib/deals/scoring";
import { attachEvidenceToCompatibilityReport, attachEvidenceToDealReport, getEvidenceForProduct } from "./evidenceMap";
import { formatEvidenceCitation } from "./formatEvidence";
import { calculateProductPriceTrend } from "@/lib/pricing/priceTrends";

describe("evidence system", () => {
  it("gives every seeded product at least three evidence records", async () => {
    const products = await listProducts();

    for (const product of products) {
      const evidence = await getEvidenceForProduct(product.id);
      expect(evidence.length, product.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("attaches evidence to every compatibility failure or warning", async () => {
    const products = await listProducts();
    const byId = new Map(products.map((product) => [product.id, toCompatibilityProduct(product)]));
    const parts = {
      cpu: byId.get("cpu-ryzen-5-7600"),
      motherboard: byId.get("mobo-msi-z790-tomahawk-wifi"),
      ram: byId.get("ram-gskill-flare-x5-32-ddr5-6000-cl30"),
      gpu: byId.get("gpu-rtx-5080"),
      storage: byId.get("storage-wd-black-sn850x-2tb"),
      psu: byId.get("psu-evga-650-bq"),
      case: byId.get("case-corsair-4000d-airflow"),
      cooler: byId.get("cooler-noctua-nh-d15-g2"),
    } as Partial<Record<ProductCategory, NonNullable<ReturnType<typeof toCompatibilityProduct>>>>;

    const report = await attachEvidenceToCompatibilityReport(checkBuild({ parts, wifiRequired: true }), parts);
    const failuresAndWarnings = report.results.filter((result) => result.level !== "PASS");

    expect(failuresAndWarnings.length).toBeGreaterThan(0);
    expect(failuresAndWarnings.every((result) => result.evidence.length > 0)).toBe(true);
  });

  it("attaches evidence to price verdicts", async () => {
    const product = (await listProducts("gpu")).find((item) => item.id === "gpu-rtx-5070");
    expect(product).toBeTruthy();

    const [offers, historiesByProductId] = await Promise.all([
      getCurrentOffers([product!.id]),
      getPriceHistory([product!.id]),
    ]);
    const history = historiesByProductId[product!.id];
    const stats = {
      ninetyDayAverage:
        history.slice(-90).reduce((sum, point) => sum + point.lowestTrustedPrice, 0) / Math.min(90, history.length),
      historicalLow: Math.min(...history.map((point) => point.lowestTrustedPrice)),
    };
    const bestOffer = getBestSafeOffer(offers, stats, "open_box_allowed");
    const trend = calculateProductPriceTrend({
      productId: product!.id,
      productName: `${product!.brand} ${product!.model}`,
      history,
      currentPrice: bestOffer?.effectivePrice,
      bestOffer,
    });
    const dealReport = await attachEvidenceToDealReport(bestOffer ? [bestOffer] : [], [trend]);

    expect(dealReport.priceTrends[0].evidence.length).toBeGreaterThan(0);
    expect(dealReport.priceTrends[0].explanation).toContain("[");
  });

  it("labels seeded demo sources and does not require fake URLs", async () => {
    const evidence = await getEvidenceForProduct("cpu-ryzen-5-7600");
    const citations = evidence.map((record, index) => formatEvidenceCitation(record, index + 1));
    const seeded = citations.filter((citation) => citation.sourceType === "seeded_demo");

    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((citation) => citation.title === "Seeded demo source")).toBe(true);
    expect(seeded.every((citation) => !citation.url)).toBe(true);
  });
});
