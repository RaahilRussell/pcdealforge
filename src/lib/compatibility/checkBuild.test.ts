import { describe, expect, it } from "vitest";

import { checkBuild } from "./checkBuild";
import type { BuildParts, ProductCategory, ProductForCompatibility } from "./types";

function part(
  category: ProductCategory,
  overrides: Partial<ProductForCompatibility> & { specs?: Record<string, unknown> } = {},
): ProductForCompatibility {
  return {
    id: overrides.id ?? category,
    category,
    brand: overrides.brand ?? "Test",
    model: overrides.model ?? category,
    specs: overrides.specs ?? {},
  };
}

function baseBuild(overrides: Partial<BuildParts> = {}): BuildParts {
  const parts: BuildParts = {
    cpu: part("cpu", {
      brand: "AMD",
      model: "Ryzen 5 7600",
      specs: {
        socket: "AM5",
        tdp: 65,
        supportedRamTypes: ["DDR5"],
      },
    }),
    motherboard: part("motherboard", {
      model: "B650 WiFi",
      specs: {
        socket: "AM5",
        chipset: "B650",
        ramType: "DDR5",
        formFactor: "ATX",
        m2Slots: 2,
        hasWifi: true,
        hasFrontUsbCHeader: true,
        biosSupportJson: { "Ryzen 7000": "supported" },
        maxRamGb: 128,
      },
    }),
    ram: part("ram", {
      model: "32GB DDR5-6000",
      specs: {
        ramType: "DDR5",
        capacityGb: 32,
        heightMm: 33,
      },
    }),
    gpu: part("gpu", {
      model: "Radeon RX 7800 XT",
      specs: {
        lengthMm: 276,
        slots: 2.7,
        tdp: 263,
        powerConnector: "2x8-pin",
        performanceScore: 92,
      },
    }),
    storage: part("storage", {
      model: "1TB NVMe",
      specs: {
        formFactor: "M.2 2280",
        interface: "PCIe 4.0 x4 NVMe",
        capacityGb: 1000,
      },
    }),
    psu: part("psu", {
      model: "750W Gold",
      specs: {
        wattage: 750,
        has12vhpwr: false,
        has12v2x6: false,
        pcie8PinCount: 4,
        qualityTier: "A",
      },
    }),
    case: part("case", {
      model: "Airflow ATX",
      specs: {
        formFactorSupport: ["ATX", "Micro ATX", "Mini ITX"],
        maxGpuLengthMm: 360,
        maxCpuCoolerHeightMm: 170,
        radiatorSupport: [240, 360],
        hasFrontUsbC: true,
      },
    }),
    cooler: part("cooler", {
      model: "Tower cooler",
      specs: {
        type: "air",
        supportedSockets: ["AM4", "AM5", "LGA1700"],
        heightMm: 155,
        tdpRating: 220,
        ramClearanceIssue: false,
      },
    }),
  };

  return { ...parts, ...overrides };
}

function resultLevel(report: ReturnType<typeof checkBuild>, id: string) {
  return report.results.find((result) => result.id === id)?.level;
}

describe("checkBuild compatibility rules", () => {
  it("passes an AM5 CPU with an AM5 motherboard", () => {
    const report = checkBuild({ parts: baseBuild(), wifiRequired: true });

    expect(report.overallStatus).toBe("PASS");
    expect(resultLevel(report, "cpu-socket-match")).toBe("PASS");
  });

  it("fails an AM5 CPU with an LGA1700 motherboard", () => {
    const report = checkBuild({
      parts: baseBuild({
        motherboard: part("motherboard", {
          model: "Z790",
          specs: {
            socket: "LGA1700",
            ramType: "DDR5",
            formFactor: "ATX",
            m2Slots: 2,
            hasWifi: true,
            hasFrontUsbCHeader: true,
            biosSupportJson: { "Intel 14th": "supported" },
            maxRamGb: 128,
          },
        }),
      }),
    });

    expect(resultLevel(report, "cpu-socket-match")).toBe("FAIL");
    expect(report.overallStatus).toBe("FAIL");
  });

  it("fails DDR5 RAM with a DDR4 motherboard", () => {
    const report = checkBuild({
      parts: baseBuild({
        motherboard: part("motherboard", {
          model: "B760 DDR4",
          specs: {
            socket: "AM5",
            ramType: "DDR4",
            formFactor: "ATX",
            m2Slots: 2,
            hasWifi: true,
            hasFrontUsbCHeader: true,
            biosSupportJson: { "Ryzen 7000": "supported" },
            maxRamGb: 128,
          },
        }),
      }),
    });

    expect(resultLevel(report, "ram-type-match")).toBe("FAIL");
  });

  it("fails when the GPU is too long for the case", () => {
    const report = checkBuild({
      parts: baseBuild({
        case: part("case", {
          specs: {
            formFactorSupport: ["ATX"],
            maxGpuLengthMm: 260,
            maxCpuCoolerHeightMm: 170,
            radiatorSupport: [240],
            hasFrontUsbC: true,
          },
        }),
      }),
    });

    expect(resultLevel(report, "gpu-length-clearance")).toBe("FAIL");
  });

  it("warns when GPU clearance is below 20mm", () => {
    const report = checkBuild({
      parts: baseBuild({
        case: part("case", {
          specs: {
            formFactorSupport: ["ATX"],
            maxGpuLengthMm: 290,
            maxCpuCoolerHeightMm: 170,
            radiatorSupport: [240],
            hasFrontUsbC: true,
          },
        }),
      }),
    });

    expect(resultLevel(report, "gpu-length-clearance")).toBe("WARNING");
  });

  it("warns when a front USB-C case lacks a motherboard header", () => {
    const report = checkBuild({
      parts: baseBuild({
        motherboard: part("motherboard", {
          model: "B650 without USB-C header",
          specs: {
            socket: "AM5",
            ramType: "DDR5",
            formFactor: "ATX",
            m2Slots: 2,
            hasWifi: true,
            hasFrontUsbCHeader: false,
            biosSupportJson: { "Ryzen 7000": "supported" },
            maxRamGb: 128,
          },
        }),
      }),
    });

    expect(resultLevel(report, "front-usb-c-header")).toBe("WARNING");
  });

  it("fails when PSU wattage is under the recommended headroom", () => {
    const report = checkBuild({
      parts: baseBuild({
        psu: part("psu", {
          specs: {
            wattage: 450,
            has12vhpwr: false,
            has12v2x6: false,
            pcie8PinCount: 4,
            qualityTier: "A",
          },
        }),
      }),
    });

    expect(resultLevel(report, "psu-wattage-headroom")).toBe("FAIL");
  });

  it("fails when the PSU lacks a required GPU connector", () => {
    const report = checkBuild({
      parts: baseBuild({
        gpu: part("gpu", {
          model: "RTX 4070 Super",
          specs: {
            lengthMm: 267,
            slots: 2.5,
            tdp: 220,
            powerConnector: "12VHPWR",
            performanceScore: 96,
          },
        }),
      }),
    });

    expect(resultLevel(report, "psu-gpu-power-connector")).toBe("FAIL");
  });

  it("warns when Wi-Fi is required but missing", () => {
    const report = checkBuild({
      wifiRequired: true,
      parts: baseBuild({
        motherboard: part("motherboard", {
          model: "B550 no Wi-Fi",
          specs: {
            socket: "AM5",
            ramType: "DDR5",
            formFactor: "ATX",
            m2Slots: 2,
            hasWifi: false,
            hasFrontUsbCHeader: true,
            biosSupportJson: { "Ryzen 7000": "supported" },
            maxRamGb: 128,
          },
        }),
      }),
    });

    expect(resultLevel(report, "wifi-requirement")).toBe("WARNING");
    expect(report.results.find((result) => result.id === "wifi-requirement")?.explanation).toContain("adapter");
  });
});
