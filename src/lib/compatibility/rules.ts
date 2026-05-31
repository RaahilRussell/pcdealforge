import type {
  BuildParts,
  CompatibilityCheckInput,
  CompatibilityResult,
  ProductCategory,
  ProductForCompatibility,
} from "./types";

type Rule = (input: CompatibilityCheckInput) => CompatibilityResult | CompatibilityResult[];

const requiredCategories: ProductCategory[] = [
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "storage",
  "psu",
  "case",
  "cooler",
];

function result(
  id: string,
  level: CompatibilityResult["level"],
  title: string,
  explanation: string,
  affectedParts: ProductCategory[],
  confidence = 1,
): CompatibilityResult {
  return { id, level, title, explanation, affectedParts, confidence, ruleId: id, evidence: [] };
}

function pass(id: string, title: string, explanation: string, affectedParts: ProductCategory[]) {
  return result(id, "PASS", title, explanation, affectedParts);
}

function warning(
  id: string,
  title: string,
  explanation: string,
  affectedParts: ProductCategory[],
  confidence = 0.9,
) {
  return result(id, "WARNING", title, explanation, affectedParts, confidence);
}

function fail(id: string, title: string, explanation: string, affectedParts: ProductCategory[]) {
  return result(id, "FAIL", title, explanation, affectedParts);
}

function partName(part?: ProductForCompatibility) {
  return part ? `${part.brand} ${part.model}` : "missing part";
}

function specString(part: ProductForCompatibility | undefined, key: string) {
  const value = part?.specs[key];
  return typeof value === "string" ? value : undefined;
}

function specNumber(part: ProductForCompatibility | undefined, key: string) {
  const value = part?.specs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function specBoolean(part: ProductForCompatibility | undefined, key: string) {
  const value = part?.specs[key];
  return typeof value === "boolean" ? value : undefined;
}

function specArray<T = unknown>(part: ProductForCompatibility | undefined, key: string) {
  const value = part?.specs[key];
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function biosSupport(part: ProductForCompatibility | undefined) {
  const value = part?.specs.biosSupportJson;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parsePcie8PinCount(connector?: string) {
  if (!connector) return 0;
  const match = connector.match(/(\d+)x8-pin/i);
  return match ? Number(match[1]) : connector.includes("8-pin") ? 1 : 0;
}

function cpuGeneration(cpu?: ProductForCompatibility) {
  const model = cpu?.model.toLowerCase() ?? "";
  if (model.includes("9600") || model.includes("9700") || model.includes("9950")) return "Ryzen 9000";
  if (model.includes("7600") || model.includes("7700") || model.includes("7800")) return "Ryzen 7000";
  if (model.includes("5600") || model.includes("5700") || model.includes("5800")) return "Ryzen 5000";
  if (model.includes("14")) return "Intel 14th";
  if (model.includes("13")) return "Intel 13th";
  if (model.includes("12")) return "Intel 12th";
  return undefined;
}

function hasAll(parts: BuildParts, categories: ProductCategory[]) {
  return categories.every((category) => Boolean(parts[category]));
}

const missingPartsRule: Rule = ({ parts }) => {
  const missing = requiredCategories.filter((category) => !parts[category]);
  if (missing.length === 0) {
    return pass(
      "required-parts-present",
      "Required parts selected",
      "The build includes every required category for a complete PC.",
      requiredCategories,
    );
  }

  return missing.map((category) =>
    fail(
      `missing-${category}`,
      `Missing ${category}`,
      `Select a ${category} before this build can be verified.`,
      [category],
    ),
  );
};

const cpuSocketRule: Rule = ({ parts }) => {
  const { cpu, motherboard } = parts;
  if (!hasAll(parts, ["cpu", "motherboard"])) return [];

  const cpuSocket = specString(cpu, "socket");
  const motherboardSocket = specString(motherboard, "socket");
  if (cpuSocket && motherboardSocket && cpuSocket === motherboardSocket) {
    return pass(
      "cpu-socket-match",
      "CPU socket matches motherboard",
      `${partName(cpu)} uses ${cpuSocket}, which matches ${partName(motherboard)}.`,
      ["cpu", "motherboard"],
    );
  }

  return fail(
    "cpu-socket-match",
    "CPU socket mismatch",
    `${partName(cpu)} uses ${cpuSocket ?? "an unknown socket"}, but ${partName(
      motherboard,
    )} uses ${motherboardSocket ?? "an unknown socket"}.`,
    ["cpu", "motherboard"],
  );
};

const cpuGenerationRule: Rule = ({ parts }) => {
  const { cpu, motherboard } = parts;
  if (!hasAll(parts, ["cpu", "motherboard"])) return [];

  const generation = cpuGeneration(cpu);
  const support = biosSupport(motherboard);
  const supportValue = generation ? support?.[generation] : undefined;
  const supportText = typeof supportValue === "string" ? supportValue : undefined;
  const needsBiosVersion = specString(cpu, "needsBiosVersion");

  if (!generation || !support) {
    return warning(
      "cpu-generation-support",
      "CPU generation support needs manual confirmation",
      "The motherboard seed data does not include enough BIOS metadata to prove this CPU generation without checking the board support page.",
      ["cpu", "motherboard"],
      0.75,
    );
  }

  if (supportText && /bios|newer|update/i.test(supportText)) {
    return warning(
      "cpu-generation-support",
      "BIOS update may be required",
      `${partName(motherboard)} lists ${generation} support as "${supportText}". ${needsBiosVersion ?? ""}`.trim(),
      ["cpu", "motherboard"],
      0.88,
    );
  }

  if (supportText && /supported/i.test(supportText)) {
    return pass(
      "cpu-generation-support",
      "Motherboard supports CPU generation",
      `${partName(motherboard)} explicitly supports ${generation}.`,
      ["cpu", "motherboard"],
    );
  }

  return warning(
    "cpu-generation-support",
    "CPU generation support is unclear",
    `${partName(motherboard)} does not explicitly list ${generation}; verify BIOS support before buying.`,
    ["cpu", "motherboard"],
    0.8,
  );
};

const ramTypeRule: Rule = ({ parts }) => {
  const { ram, motherboard } = parts;
  if (!hasAll(parts, ["ram", "motherboard"])) return [];

  const ramType = specString(ram, "ramType");
  const boardRamType = specString(motherboard, "ramType");
  if (ramType && boardRamType && ramType === boardRamType) {
    return pass(
      "ram-type-match",
      "RAM type matches motherboard",
      `${partName(ram)} is ${ramType}, matching ${partName(motherboard)}.`,
      ["ram", "motherboard"],
    );
  }

  return fail(
    "ram-type-match",
    "RAM type mismatch",
    `${partName(ram)} is ${ramType ?? "unknown"}, but ${partName(motherboard)} requires ${
      boardRamType ?? "unknown"
    }.`,
    ["ram", "motherboard"],
  );
};

const ramCapacityRule: Rule = ({ parts }) => {
  const { ram, motherboard } = parts;
  if (!hasAll(parts, ["ram", "motherboard"])) return [];

  const capacityGb = specNumber(ram, "capacityGb");
  const maxRamGb = specNumber(motherboard, "maxRamGb");
  if (capacityGb !== undefined && maxRamGb !== undefined && capacityGb <= maxRamGb) {
    return pass(
      "ram-capacity-limit",
      "RAM capacity is within motherboard limit",
      `${capacityGb}GB is within the motherboard maximum of ${maxRamGb}GB.`,
      ["ram", "motherboard"],
    );
  }

  return fail(
    "ram-capacity-limit",
    "RAM capacity exceeds motherboard limit",
    `${partName(ram)} exceeds the motherboard memory capacity limit.`,
    ["ram", "motherboard"],
  );
};

const caseMotherboardRule: Rule = ({ parts }) => {
  const { case: pcCase, motherboard } = parts;
  if (!hasAll(parts, ["case", "motherboard"])) return [];

  const supported = specArray<string>(pcCase, "formFactorSupport") ?? [];
  const boardFormFactor = specString(motherboard, "formFactor");
  if (boardFormFactor && supported.includes(boardFormFactor)) {
    return pass(
      "case-motherboard-form-factor",
      "Case supports motherboard form factor",
      `${partName(pcCase)} supports ${boardFormFactor} motherboards.`,
      ["case", "motherboard"],
    );
  }

  return fail(
    "case-motherboard-form-factor",
    "Case does not support motherboard form factor",
    `${partName(pcCase)} supports ${supported.join(", ") || "no listed form factors"}, but ${partName(
      motherboard,
    )} is ${boardFormFactor ?? "unknown"}.`,
    ["case", "motherboard"],
  );
};

const gpuLengthRule: Rule = ({ parts }) => {
  const { gpu, case: pcCase } = parts;
  if (!hasAll(parts, ["gpu", "case"])) return [];

  const gpuLength = specNumber(gpu, "lengthMm");
  const maxGpuLength = specNumber(pcCase, "maxGpuLengthMm");
  if (gpuLength === undefined || maxGpuLength === undefined) {
    return warning(
      "gpu-length-clearance",
      "GPU clearance cannot be verified",
      "GPU length or case clearance data is missing.",
      ["gpu", "case"],
      0.7,
    );
  }

  const clearance = maxGpuLength - gpuLength;
  if (clearance < 0) {
    return fail(
      "gpu-length-clearance",
      "GPU is too long for the case",
      `${partName(gpu)} is ${gpuLength}mm long, exceeding ${partName(pcCase)} clearance by ${Math.abs(
        clearance,
      )}mm.`,
      ["gpu", "case"],
    );
  }

  if (clearance < 20) {
    return warning(
      "gpu-length-clearance",
      "GPU clearance is tight",
      `${partName(gpu)} fits with only ${clearance}mm of length clearance. Cable routing and front fans may be tight.`,
      ["gpu", "case"],
    );
  }

  return pass(
    "gpu-length-clearance",
    "GPU length fits case",
    `${partName(gpu)} has ${clearance}mm of length clearance in ${partName(pcCase)}.`,
    ["gpu", "case"],
  );
};

const coolerSocketRule: Rule = ({ parts }) => {
  const { cpu, cooler } = parts;
  if (!hasAll(parts, ["cpu", "cooler"])) return [];

  const cpuSocket = specString(cpu, "socket");
  const supportedSockets = specArray<string>(cooler, "supportedSockets") ?? [];
  if (cpuSocket && supportedSockets.includes(cpuSocket)) {
    return pass(
      "cooler-socket-support",
      "Cooler supports CPU socket",
      `${partName(cooler)} supports ${cpuSocket}.`,
      ["cpu", "cooler"],
    );
  }

  return fail(
    "cooler-socket-support",
    "Cooler does not support CPU socket",
    `${partName(cooler)} supports ${supportedSockets.join(", ") || "no listed sockets"}, not ${
      cpuSocket ?? "the selected CPU socket"
    }.`,
    ["cpu", "cooler"],
  );
};

const coolerCaseRule: Rule = ({ parts }) => {
  const { cooler, case: pcCase } = parts;
  if (!hasAll(parts, ["cooler", "case"])) return [];

  const type = specString(cooler, "type");
  if (type === "air") {
    const height = specNumber(cooler, "heightMm");
    const maxHeight = specNumber(pcCase, "maxCpuCoolerHeightMm");
    if (height !== undefined && maxHeight !== undefined && height <= maxHeight) {
      return pass(
        "air-cooler-height",
        "Air cooler height fits case",
        `${partName(cooler)} is ${height}mm tall; ${partName(pcCase)} allows ${maxHeight}mm.`,
        ["cooler", "case"],
      );
    }

    return fail(
      "air-cooler-height",
      "Air cooler is too tall for case",
      `${partName(cooler)} does not fit within ${partName(pcCase)} CPU cooler height clearance.`,
      ["cooler", "case"],
    );
  }

  if (type === "aio") {
    const radiatorSize = specNumber(cooler, "radiatorSizeMm");
    const supported = specArray<number>(pcCase, "radiatorSupport") ?? [];
    if (radiatorSize && supported.includes(radiatorSize)) {
      return pass(
        "aio-radiator-support",
        "AIO radiator size fits case",
        `${partName(pcCase)} supports a ${radiatorSize}mm radiator.`,
        ["cooler", "case"],
      );
    }

    return fail(
      "aio-radiator-support",
      "AIO radiator does not fit case",
      `${partName(pcCase)} supports ${supported.join(", ") || "no listed"}mm radiators, not ${
        radiatorSize ?? "the selected"
      }mm radiator.`,
      ["cooler", "case"],
    );
  }

  return warning(
    "cooler-case-clearance",
    "Cooler clearance cannot be verified",
    "Cooler type is missing or unrecognized.",
    ["cooler", "case"],
    0.7,
  );
};

const psuWattageRule: Rule = ({ parts }) => {
  const { cpu, gpu, psu } = parts;
  if (!hasAll(parts, ["cpu", "gpu", "psu"])) return [];

  const cpuTdp = specNumber(cpu, "tdp") ?? 0;
  const gpuTdp = specNumber(gpu, "tdp") ?? 0;
  const psuWattage = specNumber(psu, "wattage") ?? 0;
  const estimatedLoad = cpuTdp + gpuTdp + 100;
  const recommendedPsu = Math.ceil(estimatedLoad * 1.35);

  if (psuWattage >= recommendedPsu) {
    return pass(
      "psu-wattage-headroom",
      "PSU wattage has enough headroom",
      `Estimated load is ${estimatedLoad}W; recommended PSU is ${recommendedPsu}W and selected PSU is ${psuWattage}W.`,
      ["cpu", "gpu", "psu"],
    );
  }

  return fail(
    "psu-wattage-headroom",
    "PSU wattage is too low",
    `Estimated load is ${estimatedLoad}W; recommended PSU is ${recommendedPsu}W but selected PSU is ${psuWattage}W.`,
    ["cpu", "gpu", "psu"],
  );
};

const psuConnectorRule: Rule = ({ parts }) => {
  const { gpu, psu } = parts;
  if (!hasAll(parts, ["gpu", "psu"])) return [];

  const connector = specString(gpu, "powerConnector");
  const has12vhpwr = specBoolean(psu, "has12vhpwr") ?? false;
  const has12v2x6 = specBoolean(psu, "has12v2x6") ?? false;
  const pcie8PinCount = specNumber(psu, "pcie8PinCount") ?? 0;

  if (connector === "12V-2x6") {
    if (has12v2x6) {
      return pass(
        "psu-gpu-power-connector",
        "PSU has required GPU connector",
        `${partName(psu)} includes a native 12V-2x6 connector for ${partName(gpu)}.`,
        ["gpu", "psu"],
      );
    }

    if (has12vhpwr) {
      return warning(
        "psu-gpu-power-connector",
        "PSU has older 12VHPWR connector",
        `${partName(gpu)} asks for 12V-2x6. ${partName(psu)} has 12VHPWR, which may work with the included cable but is not the newer connector.`,
        ["gpu", "psu"],
      );
    }

    return fail(
      "psu-gpu-power-connector",
      "PSU lacks required GPU connector",
      `${partName(gpu)} requires 12V-2x6 and ${partName(psu)} does not provide it.`,
      ["gpu", "psu"],
    );
  }

  if (connector === "12VHPWR") {
    if (has12vhpwr || has12v2x6) {
      return pass(
        "psu-gpu-power-connector",
        "PSU has required GPU connector",
        `${partName(psu)} includes a native high-power GPU connector.`,
        ["gpu", "psu"],
      );
    }

    return fail(
      "psu-gpu-power-connector",
      "PSU lacks required GPU connector",
      `${partName(gpu)} requires 12VHPWR and ${partName(psu)} does not provide it.`,
      ["gpu", "psu"],
    );
  }

  const required8Pins = parsePcie8PinCount(connector);
  if (required8Pins > 0 && pcie8PinCount >= required8Pins) {
    return pass(
      "psu-gpu-power-connector",
      "PSU has enough PCIe 8-pin connectors",
      `${partName(gpu)} needs ${required8Pins} PCIe 8-pin connector(s); ${partName(psu)} lists ${pcie8PinCount}.`,
      ["gpu", "psu"],
    );
  }

  if (required8Pins > 0) {
    return fail(
      "psu-gpu-power-connector",
      "PSU lacks enough PCIe 8-pin connectors",
      `${partName(gpu)} needs ${required8Pins} PCIe 8-pin connector(s); ${partName(psu)} lists ${pcie8PinCount}.`,
      ["gpu", "psu"],
    );
  }

  return warning(
    "psu-gpu-power-connector",
    "GPU power connector is unknown",
    "The selected GPU power connector could not be parsed from specs.",
    ["gpu", "psu"],
    0.75,
  );
};

const psuQualityRule: Rule = ({ parts }) => {
  const { gpu, psu } = parts;
  if (!hasAll(parts, ["gpu", "psu"])) return [];

  const qualityTier = specString(psu, "qualityTier") ?? "unknown";
  const gpuPerformance = specNumber(gpu, "performanceScore") ?? 0;
  const gpuTdp = specNumber(gpu, "tdp") ?? 0;
  const highEndGpu = gpuPerformance >= 100 || gpuTdp >= 300;
  if (highEndGpu && ["C", "D", "E", "unknown"].includes(qualityTier)) {
    return warning(
      "psu-quality-high-end-gpu",
      "PSU quality is low for this GPU",
      `${partName(gpu)} is a high-end GPU. Prefer an A/B-tier PSU instead of quality tier ${qualityTier}.`,
      ["gpu", "psu"],
    );
  }

  return pass(
    "psu-quality-high-end-gpu",
    "PSU quality tier is acceptable",
    `${partName(psu)} quality tier ${qualityTier} is acceptable for the selected GPU class.`,
    ["gpu", "psu"],
  );
};

const frontUsbCRule: Rule = ({ parts }) => {
  const { case: pcCase, motherboard } = parts;
  if (!hasAll(parts, ["case", "motherboard"])) return [];

  const caseHasUsbC = specBoolean(pcCase, "hasFrontUsbC") ?? false;
  const boardHasHeader = specBoolean(motherboard, "hasFrontUsbCHeader") ?? false;
  if (!caseHasUsbC || boardHasHeader) {
    return pass(
      "front-usb-c-header",
      "Front USB-C wiring is supported",
      caseHasUsbC
        ? `${partName(motherboard)} has the header needed for ${partName(pcCase)} front USB-C.`
        : `${partName(pcCase)} does not require a front USB-C header.`,
      ["case", "motherboard"],
    );
  }

  return warning(
    "front-usb-c-header",
    "Case front USB-C will not connect",
    `${partName(pcCase)} has front USB-C, but ${partName(motherboard)} does not list a front USB-C header.`,
    ["case", "motherboard"],
  );
};

const wifiRule: Rule = ({ parts, wifiRequired }) => {
  const { motherboard } = parts;
  if (!motherboard) return [];

  const hasWifi = specBoolean(motherboard, "hasWifi") ?? false;
  if (!wifiRequired || hasWifi) {
    return pass(
      "wifi-requirement",
      "Wi-Fi requirement is satisfied",
      wifiRequired
        ? `${partName(motherboard)} includes Wi-Fi.`
        : "Wi-Fi was not requested for this build.",
      ["motherboard"],
    );
  }

  return warning(
    "wifi-requirement",
    "Motherboard lacks Wi-Fi",
    `${partName(motherboard)} does not include Wi-Fi. Add a PCIe or USB Wi-Fi adapter, or pick a Wi-Fi motherboard.`,
    ["motherboard"],
  );
};

const storageRule: Rule = ({ parts }) => {
  const { storage, motherboard } = parts;
  if (!hasAll(parts, ["storage", "motherboard"])) return [];

  const formFactor = specString(storage, "formFactor") ?? "";
  const m2Slots = specNumber(motherboard, "m2Slots") ?? 0;
  if (/m\.2/i.test(formFactor) && m2Slots < 1) {
    return fail(
      "storage-m2-slot",
      "M.2 storage needs an available M.2 slot",
      `${partName(storage)} is an M.2 drive, but ${partName(motherboard)} lists no M.2 slots.`,
      ["storage", "motherboard"],
    );
  }

  return pass(
    "storage-m2-slot",
    "Storage interface is supported",
    /m\.2/i.test(formFactor)
      ? `${partName(motherboard)} has ${m2Slots} M.2 slot(s).`
      : `${partName(storage)} does not require an M.2 slot.`,
    ["storage", "motherboard"],
  );
};

const thickGpuRule: Rule = ({ parts }) => {
  const { gpu } = parts;
  if (!gpu) return [];

  const slots = specNumber(gpu, "slots") ?? 0;
  if (slots > 3) {
    return warning(
      "gpu-slot-thickness",
      "GPU is thicker than three slots",
      `${partName(gpu)} is listed as ${slots} slots thick. Confirm expansion slot and airflow clearance.`,
      ["gpu"],
    );
  }

  return pass(
    "gpu-slot-thickness",
    "GPU slot thickness is standard",
    `${partName(gpu)} is listed as ${slots || "unknown"} slots thick.`,
    ["gpu"],
  );
};

const ramClearanceRule: Rule = ({ parts }) => {
  const { ram, cooler } = parts;
  if (!hasAll(parts, ["ram", "cooler"])) return [];

  const ramHeight = specNumber(ram, "heightMm") ?? 0;
  const coolerType = specString(cooler, "type");
  const coolerHasIssue = specBoolean(cooler, "ramClearanceIssue") ?? false;
  if (coolerType === "air" && coolerHasIssue && ramHeight >= 42) {
    return warning(
      "ram-cooler-clearance",
      "Tall RAM may conflict with air cooler fan",
      `${partName(ram)} is ${ramHeight}mm tall and ${partName(cooler)} can overhang RAM slots.`,
      ["ram", "cooler"],
    );
  }

  return pass(
    "ram-cooler-clearance",
    "RAM and cooler clearance looks acceptable",
    "The selected RAM height and cooler type do not show a known clearance issue.",
    ["ram", "cooler"],
  );
};

export const compatibilityRules: Rule[] = [
  missingPartsRule,
  cpuSocketRule,
  cpuGenerationRule,
  ramTypeRule,
  ramCapacityRule,
  caseMotherboardRule,
  gpuLengthRule,
  coolerSocketRule,
  coolerCaseRule,
  psuWattageRule,
  psuConnectorRule,
  psuQualityRule,
  frontUsbCRule,
  wifiRule,
  storageRule,
  thickGpuRule,
  ramClearanceRule,
];
