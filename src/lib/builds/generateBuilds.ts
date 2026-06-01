import { checkBuild } from "../compatibility/checkBuild";
import type { BuildParts, ProductCategory } from "../compatibility/types";
import { getBestSafeOffer } from "../deals/scoring";
import { calculateProductPriceTrend } from "../pricing/priceTrends";
import type { ProductPriceTrend } from "../pricing/priceTrends";
import { classifyBuildVerdict, getBuildPriceReasons } from "../pricing/verdictReasons";
import { buildPriceVerdict, calculateBuildPerformanceScore, calculateOverallScore } from "./scoring";
import type {
  BuildOptimizerInput,
  BuildOptimizerResult,
  BuildProduct,
  CheaperCompatibleSwap,
  GeneratedBuild,
} from "./types";

type PricedProduct = {
  product: BuildProduct;
  bestOffer: NonNullable<ReturnType<typeof getBestSafeOffer>>;
  priceTrend: ProductPriceTrend;
};

const categories: ProductCategory[] = ["cpu", "gpu", "motherboard", "ram", "storage", "psu", "case", "cooler"];

export function generateBuilds(input: BuildOptimizerInput): BuildOptimizerResult {
  const pricedProducts = priceProducts(input);
  const grouped = groupByCategory(pricedProducts);
  const gpuPool = preferredGpuPool(grouped.gpu, input.gpuPreference);
  const candidates: GeneratedBuild[] = [];
  let candidatesEvaluated = 0;

  const cpus = bestByValue(grouped.cpu, 7);
  const gpus = bestByValue(gpuPool, 7);
  const motherboards = bestByValue(grouped.motherboard, 7);
  const ramKits = bestByValue(
    grouped.ram.filter((item) => specNumber(item.product, "capacityGb") >= input.ramGb),
    5,
  );
  const storageDrives = bestByValue(
    grouped.storage.filter((item) => specNumber(item.product, "capacityGb") >= input.storageGb),
    5,
  );
  const psus = bestByValue(grouped.psu, 6);
  const cases = bestByValue(grouped.case, 5);
  const coolers = bestByValue(grouped.cooler, 5);

  for (const cpu of cpus) {
    for (const gpu of gpus) {
      for (const motherboard of compatibleMotherboards(cpu, motherboards)) {
        for (const ram of compatibleRam(motherboard, ramKits)) {
          for (const storage of storageDrives) {
            for (const psu of psus) {
              for (const pcCase of cases) {
                for (const cooler of coolers) {
                  candidatesEvaluated += 1;
                  const selected = [cpu, gpu, motherboard, ram, storage, psu, pcCase, cooler];
                  const totalPrice = sumPrices(selected);
                  if (totalPrice > input.budget) continue;

                  const parts = toRequiredParts(selected);
                  const compatibilityReport = checkBuild({ parts, wifiRequired: input.wifiRequired });
                  if (compatibilityReport.failCount > 0) continue;

                  const productPriceTrends = selected.map((item) => item.priceTrend);
                  const potentialSavings = productPriceTrends.reduce(
                    (sum, trend) => sum + trend.estimatedSavingsIfWaiting,
                    0,
                  );
                  const performanceScore = calculateBuildPerformanceScore({ parts }, input.useCase, input.resolution);
                  const dealScore = average(selected.map((item) => item.bestOffer.dealScore));
                  const initialPriceVerdict = buildPriceVerdict(
                    productPriceTrends.map((trend) => trend.verdict),
                    potentialSavings,
                    totalPrice,
                  );
                  const overallScore = calculateOverallScore(
                    performanceScore,
                    dealScore,
                    compatibilityReport,
                    totalPrice,
                    input.budget,
                  );
                  const priceVerdictDetails = classifyBuildVerdict(
                    getBuildPriceReasons(
                      {
                        totalPrice,
                        compatibilityReport,
                        productPriceTrends,
                      },
                      productPriceTrends.map((trend) => trend.verdictDetails),
                    ),
                  );
                  const priceVerdict =
                    priceVerdictDetails.verdict === "BUY_NOW" && initialPriceVerdict === "WAIT"
                      ? initialPriceVerdict
                      : priceVerdictDetails.verdict;

                  candidates.push({
                    id: buildId(parts),
                    parts,
                    offers: toOffers(selected),
                    totalPrice,
                    performanceScore,
                    compatibilityReport,
                    dealScore,
                    priceVerdict,
                    priceVerdictDetails:
                      priceVerdict === priceVerdictDetails.verdict
                        ? priceVerdictDetails
                        : classifyBuildVerdict([
                            ...priceVerdictDetails.reasons,
                            {
                              severity: "warning",
                              code: "build_multiple_wait_signals",
                              title: "Multiple parts have weak price timing",
                              explanation:
                                "Multiple selected parts carry wait signals, so the full build is a WAIT even though no single issue reaches AVOID severity.",
                            },
                          ]),
                    productPriceTrends,
                    overallScore,
                    whySelected: "Candidate build is within budget and has no compatibility blockers.",
                    cheaperCompatibleSwaps: [],
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  const rankedByOverall = [...candidates].sort((left, right) => right.overallScore - left.overallScore);
  const rankedByPrice = [...candidates].sort((left, right) => left.totalPrice - right.totalPrice);
  const rankedByPerformancePerDollar = [...candidates].sort(
    (left, right) => right.performanceScore / right.totalPrice - left.performanceScore / left.totalPrice,
  );

  const bestOverall = decorateBuild(rankedByOverall[0] ?? null, pricedProducts, input);
  const cheapestSafe = decorateBuild(rankedByPrice[0] ?? null, pricedProducts, input);
  const bestPerformancePerDollar = decorateBuild(rankedByPerformancePerDollar[0] ?? null, pricedProducts, input);

  if (bestOverall) {
    bestOverall.whySelected = "Best blend of performance, deal quality, compatibility confidence, and budget use.";
  }

  if (cheapestSafe) {
    cheapestSafe.whySelected = "Lowest verified-compatible build within the requested constraints.";
  }

  if (bestPerformancePerDollar) {
    bestPerformancePerDollar.whySelected = "Highest performance score per dollar among compatible candidates.";
  }

  return {
    bestOverall,
    cheapestSafe,
    bestPerformancePerDollar,
    candidatesEvaluated,
  };
}

function priceProducts(input: BuildOptimizerInput): PricedProduct[] {
  return input.products.flatMap((product) => {
    const history = input.historiesByProductId[product.id] ?? [];
    const offers = input.offersByProductId[product.id] ?? [];
    if (history.length === 0 || offers.length === 0) return [];

    const ninetyDayAverage =
      history.slice(-90).reduce((sum, point) => sum + point.lowestTrustedPrice, 0) / Math.min(90, history.length);
    const historicalLow = Math.min(...history.map((point) => point.lowestTrustedPrice));
    const bestOffer = getBestSafeOffer(offers, { ninetyDayAverage, historicalLow }, input.riskTolerance);
    if (!bestOffer) return [];

    const priceTrend = calculateProductPriceTrend({
      productId: product.id,
      productName: `${product.brand} ${product.model}`,
      history,
      currentPrice: bestOffer.effectivePrice,
      bestOffer,
    });

    return [{ product, bestOffer, priceTrend }];
  });
}

function groupByCategory(pricedProducts: PricedProduct[]) {
  const empty: Record<ProductCategory, PricedProduct[]> = {
    cpu: [],
    gpu: [],
    motherboard: [],
    ram: [],
    storage: [],
    psu: [],
    case: [],
    cooler: [],
  };

  return pricedProducts.reduce((grouped, item) => {
    grouped[item.product.category].push(item);
    return grouped;
  }, empty);
}

function preferredGpuPool(gpus: PricedProduct[], preference: BuildOptimizerInput["gpuPreference"]) {
  if (preference === "any") return gpus;
  const brandNeedle = preference === "nvidia" ? "nvidia" : "amd";
  const preferred = gpus.filter((gpu) => gpu.product.brand.toLowerCase().includes(brandNeedle));
  return preferred.length > 0 ? preferred : gpus;
}

function bestByValue(products: PricedProduct[], limit: number) {
  return [...products]
    .sort((left, right) => valueScore(right) - valueScore(left))
    .slice(0, limit)
    .sort((left, right) => left.bestOffer.effectivePrice - right.bestOffer.effectivePrice);
}

function valueScore(item: PricedProduct) {
  return performanceScore(item.product) / Math.max(1, item.bestOffer.effectivePrice);
}

function performanceScore(product: BuildProduct) {
  const direct = specNumber(product, "performanceScore");
  if (direct) return direct;
  if (product.category === "ram") return specNumber(product, "capacityGb") + specNumber(product, "speedMt") / 200;
  if (product.category === "storage") return specNumber(product, "capacityGb") / 50;
  if (product.category === "psu") return specNumber(product, "wattage") / 15;
  if (product.category === "case") return specNumber(product, "airflowScore");
  if (product.category === "cooler") return specNumber(product, "tdpRating") / 3;
  return 50;
}

function compatibleMotherboards(cpu: PricedProduct, motherboards: PricedProduct[]) {
  const cpuSocket = specString(cpu.product, "socket");
  return motherboards.filter((motherboard) => specString(motherboard.product, "socket") === cpuSocket);
}

function compatibleRam(motherboard: PricedProduct, ramKits: PricedProduct[]) {
  const ramType = specString(motherboard.product, "ramType");
  return ramKits.filter((ram) => specString(ram.product, "ramType") === ramType);
}

function sumPrices(products: PricedProduct[]) {
  return roundMoney(products.reduce((sum, item) => sum + item.bestOffer.effectivePrice, 0));
}

function toRequiredParts(products: PricedProduct[]) {
  const entries = products.map((item) => [item.product.category, item.product]);
  return Object.fromEntries(entries) as Required<BuildParts>;
}

function toOffers(products: PricedProduct[]) {
  return Object.fromEntries(products.map((item) => [item.product.category, item.bestOffer])) as GeneratedBuild["offers"];
}

function buildId(parts: Required<BuildParts>) {
  return categories.map((category) => parts[category].id).join("__");
}

function decorateBuild(
  build: GeneratedBuild | null,
  pricedProducts: PricedProduct[],
  input: BuildOptimizerInput,
): GeneratedBuild | null {
  if (!build) return null;
  return {
    ...build,
    cheaperCompatibleSwaps: findCheaperCompatibleSwaps(build, pricedProducts, input).slice(0, 5),
  };
}

function findCheaperCompatibleSwaps(
  build: GeneratedBuild,
  pricedProducts: PricedProduct[],
  input: BuildOptimizerInput,
): CheaperCompatibleSwap[] {
  const swaps: CheaperCompatibleSwap[] = [];
  const byId = new Map(pricedProducts.map((item) => [item.product.id, item]));

  for (const category of categories) {
    const current = byId.get(build.parts[category].id);
    if (!current) continue;

    const alternatives = pricedProducts.filter(
      (item) => item.product.category === category && item.bestOffer.effectivePrice < current.bestOffer.effectivePrice,
    );

    for (const alternative of alternatives.slice(0, 8)) {
      const swappedParts = {
        ...build.parts,
        [category]: alternative.product,
      };
      const report = checkBuild({ parts: swappedParts, wifiRequired: input.wifiRequired });
      if (report.failCount > 0) continue;

      swaps.push({
        category,
        fromProductId: current.product.id,
        toProductId: alternative.product.id,
        savings: roundMoney(current.bestOffer.effectivePrice - alternative.bestOffer.effectivePrice),
        explanation: `${alternative.product.brand} ${alternative.product.model} is cheaper and remains compatible.`,
      });
      break;
    }
  }

  return swaps.sort((left, right) => right.savings - left.savings);
}

function specNumber(product: BuildProduct, key: string) {
  const value = product.specs[key];
  return typeof value === "number" ? value : 0;
}

function specString(product: BuildProduct, key: string) {
  const value = product.specs[key];
  return typeof value === "string" ? value : "";
}

function average(values: number[]) {
  return values.length === 0 ? 0 : roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
