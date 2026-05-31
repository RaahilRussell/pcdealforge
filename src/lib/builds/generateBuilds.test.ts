import { describe, expect, it } from "vitest";

import { generateBuilds } from "./generateBuilds";
import type { BuildOptimizerInput, BuildProduct } from "./types";
import type { NormalizedOffer } from "../deals/types";
import type { DailyPricePoint } from "../pricing/priceTrends";

function product(product: BuildProduct): BuildProduct {
  return product;
}

function offer(product: BuildProduct, price: number): NormalizedOffer {
  return {
    id: `offer-${product.id}`,
    productId: product.id,
    retailer: "Test Retailer",
    title: `${product.brand} ${product.model}`,
    url: `https://example.com/${product.id}`,
    price,
    shipping: 0,
    taxEstimate: 0,
    condition: "new",
    sellerName: "Test Retailer",
    sellerRating: 4.8,
    inStock: true,
    confidenceScore: 0.96,
  };
}

function history(price: number): DailyPricePoint[] {
  return Array.from({ length: 180 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    minNewPrice: price,
    avgNewPrice: price + 5,
    lowestTrustedPrice: price,
    retailerCount: 3,
  }));
}

const products: BuildProduct[] = [
  product({
    id: "cpu-am5",
    category: "cpu",
    brand: "AMD",
    model: "Ryzen 5 7600",
    normalizedName: "amd ryzen 5 7600",
    specs: { socket: "AM5", tdp: 65, performanceScore: 78, supportedRamTypes: ["DDR5"] },
  }),
  product({
    id: "gpu-amd",
    category: "gpu",
    brand: "AMD",
    model: "Radeon RX 7800 XT",
    normalizedName: "amd radeon rx 7800 xt",
    specs: { lengthMm: 276, slots: 2.7, tdp: 263, powerConnector: "2x8-pin", performanceScore: 92 },
  }),
  product({
    id: "gpu-nvidia",
    category: "gpu",
    brand: "NVIDIA",
    model: "GeForce RTX 4070 Super",
    normalizedName: "nvidia geforce rtx 4070 super",
    specs: { lengthMm: 267, slots: 2.5, tdp: 220, powerConnector: "12VHPWR", performanceScore: 96 },
  }),
  product({
    id: "mobo-am5",
    category: "motherboard",
    brand: "MSI",
    model: "B650 WiFi",
    normalizedName: "msi b650 wifi",
    specs: {
      socket: "AM5",
      ramType: "DDR5",
      formFactor: "ATX",
      m2Slots: 2,
      hasWifi: true,
      hasFrontUsbCHeader: true,
      biosSupportJson: { "Ryzen 7000": "supported" },
      maxRamGb: 128,
    },
  }),
  product({
    id: "ram-ddr5",
    category: "ram",
    brand: "G.Skill",
    model: "32GB DDR5",
    normalizedName: "g skill 32gb ddr5",
    specs: { ramType: "DDR5", capacityGb: 32, speedMt: 6000, heightMm: 33 },
  }),
  product({
    id: "ssd-1tb",
    category: "storage",
    brand: "WD",
    model: "1TB NVMe",
    normalizedName: "wd 1tb nvme",
    specs: { formFactor: "M.2 2280", capacityGb: 1000 },
  }),
  product({
    id: "psu-750",
    category: "psu",
    brand: "Corsair",
    model: "750W Gold",
    normalizedName: "corsair 750w gold",
    specs: {
      wattage: 750,
      has12vhpwr: true,
      has12v2x6: false,
      pcie8PinCount: 4,
      qualityTier: "A",
    },
  }),
  product({
    id: "case-atx",
    category: "case",
    brand: "Fractal",
    model: "Airflow",
    normalizedName: "fractal airflow",
    specs: {
      formFactorSupport: ["ATX", "Micro ATX", "Mini ITX"],
      maxGpuLengthMm: 360,
      maxCpuCoolerHeightMm: 170,
      radiatorSupport: [240, 360],
      hasFrontUsbC: true,
      airflowScore: 85,
    },
  }),
  product({
    id: "cooler-air",
    category: "cooler",
    brand: "Thermalright",
    model: "Tower",
    normalizedName: "thermalright tower",
    specs: {
      type: "air",
      supportedSockets: ["AM5", "LGA1700"],
      heightMm: 155,
      tdpRating: 220,
      ramClearanceIssue: false,
    },
  }),
];

function input(gpuPreference: BuildOptimizerInput["gpuPreference"] = "any"): BuildOptimizerInput {
  const priceById: Record<string, number> = {
    "cpu-am5": 180,
    "gpu-amd": 460,
    "gpu-nvidia": 530,
    "mobo-am5": 160,
    "ram-ddr5": 95,
    "ssd-1tb": 70,
    "psu-750": 100,
    "case-atx": 80,
    "cooler-air": 35,
  };

  return {
    budget: 1500,
    useCase: "gaming",
    resolution: "1440p",
    gpuPreference,
    ramGb: 32,
    storageGb: 1000,
    wifiRequired: true,
    riskTolerance: "new_only",
    products,
    offersByProductId: Object.fromEntries(products.map((item) => [item.id, [offer(item, priceById[item.id])]])),
    historiesByProductId: Object.fromEntries(products.map((item) => [item.id, history(priceById[item.id])])),
  };
}

describe("generateBuilds", () => {
  it("never returns a build with compatibility FAIL", () => {
    const result = generateBuilds(input());

    expect(result.bestOverall?.compatibilityReport.failCount).toBe(0);
    expect(result.cheapestSafe?.compatibilityReport.failCount).toBe(0);
    expect(result.bestPerformancePerDollar?.compatibilityReport.failCount).toBe(0);
  });

  it("keeps cheapestSafe less than or equal to bestOverall when possible", () => {
    const result = generateBuilds(input());

    expect(result.cheapestSafe?.totalPrice ?? Infinity).toBeLessThanOrEqual(result.bestOverall?.totalPrice ?? 0);
  });

  it("respects GPU preference when a valid preferred GPU exists", () => {
    const result = generateBuilds(input("amd"));

    expect(result.bestOverall?.parts.gpu.brand).toBe("AMD");
    expect(result.cheapestSafe?.parts.gpu.brand).toBe("AMD");
    expect(result.bestPerformancePerDollar?.parts.gpu.brand).toBe("AMD");
  });
});
