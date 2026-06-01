import type { ProductCategory } from "@/lib/compatibility/types";
import type { EvidenceCitation } from "@/lib/evidence/types";

import type { GeneratedBuild } from "./types";

export type PartChoiceExplanation = {
  category: ProductCategory;
  shortReason: string;
  detailedReason: string;
  positives: string[];
  negatives: string[];
  compatibilityRole: string[];
  priceRole: string[];
  evidence: EvidenceCitation[];
};

export function explainCpuChoice(build: GeneratedBuild) {
  const cpu = build.parts.cpu;
  const motherboard = build.parts.motherboard;
  const offer = build.offers.cpu;
  const trend = trendFor(build, cpu.id);

  return makeExplanation(build, "cpu", {
    shortReason: `${cpu.model} matches the ${motherboard.model} socket and leaves enough budget for the GPU.`,
    detailedReason: `The CPU is selected as the platform anchor for this build. It uses the ${spec(cpu, "socket")} socket, which is checked against the ${motherboard.model} motherboard, and its ${numberSpec(cpu, "tdp")}W TDP feeds the PSU headroom calculation. This matters because the CPU has to be compatible before the optimizer can safely spend the rest of the budget on graphics performance, memory, storage, and power delivery.`,
    positives: [
      `${numberSpec(cpu, "performanceScore")} seeded performance score supports the build's ${Math.round(build.performanceScore)} overall performance rating.`,
      `${numberSpec(cpu, "tdp")}W TDP is included in the PSU load calculation.`,
      `${spec(cpu, "socket")} socket gives the motherboard compatibility rule exact data to compare.`,
    ],
    negatives: [
      trend?.verdict === "WAIT"
        ? `The CPU price trend is a wait signal, so the seeded sale band suggests patience may save money.`
        : `The CPU selection is based on seeded demo performance data, not live benchmark ingestion yet.`,
    ],
    compatibilityRole: [
      `CPU socket ${spec(cpu, "socket")} must match motherboard socket ${spec(motherboard, "socket")}.`,
      `CPU TDP ${numberSpec(cpu, "tdp")}W is added to GPU TDP and system overhead for PSU sizing.`,
    ],
    priceRole: [
      `Selected effective CPU offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`,
      trend ? `CPU price verdict is ${trend.verdict.replace("_", " ")}.` : "No product trend was attached.",
    ],
  });
}

export function explainGpuChoice(build: GeneratedBuild) {
  const gpu = build.parts.gpu;
  const pcCase = build.parts.case;
  const psu = build.parts.psu;
  const offer = build.offers.gpu;
  const trend = trendFor(build, gpu.id);

  return makeExplanation(build, "gpu", {
    shortReason: `${gpu.model} is the primary performance driver and still fits the case, PSU, and budget constraints.`,
    detailedReason: `The GPU is the main performance lever for a gaming build, especially at the selected resolution. This selected GPU has a seeded performance score of ${numberSpec(gpu, "performanceScore")}, a ${numberSpec(gpu, "lengthMm")}mm card length, and a ${spec(gpu, "powerConnector")} connector requirement. The compatibility engine checks those values against the ${pcCase.model} GPU clearance and the ${psu.model} connector support so the recommendation is not only fast on paper but physically and electrically viable.`,
    positives: [
      `${numberSpec(gpu, "vramGb")}GB VRAM and ${numberSpec(gpu, "performanceScore")} seeded performance score are the largest contributors to performance.`,
      `${numberSpec(gpu, "lengthMm")}mm length is compared against ${numberSpec(pcCase, "maxGpuLengthMm")}mm case clearance.`,
      `${spec(gpu, "powerConnector")} connector requirement is checked against the selected PSU.`,
    ],
    negatives: [
      trend?.estimatedSavingsIfWaiting
        ? `Seeded price history estimates about ${currency(trend.estimatedSavingsIfWaiting)} of potential GPU savings if waiting.`
        : `GPU prices are still seeded demo values, so the buyer should verify live listings before purchase.`,
    ],
    compatibilityRole: [
      `GPU length ${numberSpec(gpu, "lengthMm")}mm must be below case max ${numberSpec(pcCase, "maxGpuLengthMm")}mm.`,
      `GPU recommended PSU ${numberSpec(gpu, "recommendedPsuW")}W is considered alongside selected PSU wattage ${numberSpec(psu, "wattage")}W.`,
      `GPU connector ${spec(gpu, "powerConnector")} must be supported by the PSU connector set.`,
    ],
    priceRole: [
      `Selected effective GPU offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`,
      trend ? `GPU price verdict is ${trend.verdict.replace("_", " ")}.` : "No product trend was attached.",
    ],
  });
}

export function explainMotherboardChoice(build: GeneratedBuild) {
  const motherboard = build.parts.motherboard;
  const cpu = build.parts.cpu;
  const ram = build.parts.ram;
  const pcCase = build.parts.case;
  const offer = build.offers.motherboard;

  return makeExplanation(build, "motherboard", {
    shortReason: `${motherboard.model} connects the CPU, DDR generation, storage, Wi-Fi, and case form factor requirements.`,
    detailedReason: `The motherboard works because it matches the ${cpu.model} socket, supports the selected DDR generation, fits the selected case form factor, and exposes M.2 slot data for the storage check. If Wi-Fi or front USB-C are required by the user or case, the board's seeded feature flags are used by the compatibility rules instead of relying on vague product naming.`,
    positives: [
      `${spec(motherboard, "socket")} socket matches the selected CPU family.`,
      `${spec(motherboard, "ramType")} memory support matches the ${ram.model} kit.`,
      `${numberSpec(motherboard, "m2Slots")} M.2 slot(s) support the selected storage drive.`,
    ],
    negatives: [
      truthySpec(motherboard, "hasWifi")
        ? `No obvious feature miss is flagged for Wi-Fi in the seeded data.`
        : `This board lacks seeded Wi-Fi support, so Wi-Fi-required builds need a warning or adapter.`,
    ],
    compatibilityRole: [
      `Motherboard socket ${spec(motherboard, "socket")} is compared to CPU socket ${spec(cpu, "socket")}.`,
      `Motherboard RAM type ${spec(motherboard, "ramType")} is compared to RAM type ${spec(ram, "ramType")}.`,
      `Motherboard form factor ${spec(motherboard, "formFactor")} is checked against case support ${listSpec(pcCase, "formFactorSupport")}.`,
    ],
    priceRole: [`Selected effective motherboard offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainRamChoice(build: GeneratedBuild) {
  const ram = build.parts.ram;
  const motherboard = build.parts.motherboard;
  const offer = build.offers.ram;

  return makeExplanation(build, "ram", {
    shortReason: `${ram.model} satisfies the requested capacity and matches the motherboard DDR generation.`,
    detailedReason: `The memory kit is selected to meet or exceed the user's requested capacity while matching the motherboard's RAM type. The compatibility engine compares DDR generation and checks capacity against board limits, which prevents a cheap but wrong-generation kit from being treated as a safe recommendation.`,
    positives: [
      `${numberSpec(ram, "capacityGb")}GB capacity meets the build request.`,
      `${spec(ram, "ramType")} matches motherboard support.`,
      `${numberSpec(ram, "speedMt")} MT/s speed is represented in the seeded specs.`,
    ],
    negatives: [
      numberSpec(ram, "heightMm") > 42
        ? `Tall RAM can create cooler-clearance warnings with large air coolers.`
        : `No tall-RAM clearance issue is visible in the seeded data.`,
    ],
    compatibilityRole: [
      `RAM type ${spec(ram, "ramType")} must equal motherboard RAM type ${spec(motherboard, "ramType")}.`,
      `RAM capacity ${numberSpec(ram, "capacityGb")}GB is checked against motherboard max ${numberSpec(motherboard, "maxRamGb")}GB.`,
    ],
    priceRole: [`Selected effective RAM offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainStorageChoice(build: GeneratedBuild) {
  const storage = build.parts.storage;
  const motherboard = build.parts.motherboard;
  const offer = build.offers.storage;

  return makeExplanation(build, "storage", {
    shortReason: `${storage.model} meets the storage target and uses a motherboard-supported M.2/NVMe path.`,
    detailedReason: `The storage drive is selected because it meets the requested capacity and exposes interface/form-factor data that can be checked against available motherboard M.2 slots. Users who install large game libraries or media projects may still prefer a 2TB upgrade even when the 1TB target passes.`,
    positives: [
      `${numberSpec(storage, "capacityGb")}GB capacity satisfies the optimizer input.`,
      `${spec(storage, "interface")} interface is represented in the compatibility data.`,
      `Motherboard has ${numberSpec(motherboard, "m2Slots")} M.2 slot(s) in seeded specs.`,
    ],
    negatives: [
      numberSpec(storage, "capacityGb") < 2000
        ? `1TB-class storage is workable, but a 2TB drive is often more comfortable for modern game libraries.`
        : `The higher capacity costs more, but reduces the need for an early storage upgrade.`,
    ],
    compatibilityRole: [`M.2/NVMe storage requires at least one available motherboard M.2 slot.`],
    priceRole: [`Selected effective storage offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainPsuChoice(build: GeneratedBuild) {
  const psu = build.parts.psu;
  const cpu = build.parts.cpu;
  const gpu = build.parts.gpu;
  const offer = build.offers.psu;
  const estimatedLoad = numberSpec(cpu, "tdp") + numberSpec(gpu, "tdp") + 100;
  const recommended = estimatedLoad * 1.35;

  return makeExplanation(build, "psu", {
    shortReason: `${psu.model} is selected because its wattage and connector data clear the GPU and headroom rules.`,
    detailedReason: `The PSU works because its wattage is compared against CPU TDP, GPU TDP, and a 100W system overhead after applying a 1.35x headroom rule. It also has to provide the connector required by the selected GPU. This matters because a build can be electrically incompatible even when the CPU, GPU, and motherboard technically fit together.`,
    positives: [
      `${numberSpec(psu, "wattage")}W wattage exceeds the ${Math.ceil(recommended)}W calculated recommendation.`,
      `${spec(psu, "efficiency")} efficiency and ${spec(psu, "qualityTier")} quality tier are included in seeded specs.`,
      `GPU connector requirement is ${spec(gpu, "powerConnector")}.`,
    ],
    negatives: [
      spec(psu, "qualityTier").toLowerCase().includes("low")
        ? `The PSU quality tier is low, which is a risk for high-end GPUs.`
        : `The PSU is still seeded demo data; verify the exact retail model before buying.`,
    ],
    compatibilityRole: [
      `Estimated load is CPU ${numberSpec(cpu, "tdp")}W + GPU ${numberSpec(gpu, "tdp")}W + 100W overhead = ${estimatedLoad}W.`,
      `Recommended PSU after 1.35x headroom is ${Math.ceil(recommended)}W; selected PSU is ${numberSpec(psu, "wattage")}W.`,
      `GPU connector ${spec(gpu, "powerConnector")} is checked against PSU connector support.`,
    ],
    priceRole: [`Selected effective PSU offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainCaseChoice(build: GeneratedBuild) {
  const pcCase = build.parts.case;
  const motherboard = build.parts.motherboard;
  const gpu = build.parts.gpu;
  const cooler = build.parts.cooler;
  const offer = build.offers.case;

  return makeExplanation(build, "case", {
    shortReason: `${pcCase.model} supports the motherboard form factor and provides clearance for the GPU and cooler.`,
    detailedReason: `The case is selected for physical fit: motherboard form factor support, GPU length clearance, CPU cooler height or radiator support, airflow score, and front USB-C behavior. These checks catch common real-world issues that pure price sorting would miss.`,
    positives: [
      `Supports motherboard form factors: ${listSpec(pcCase, "formFactorSupport")}.`,
      `${numberSpec(pcCase, "maxGpuLengthMm")}mm GPU clearance versus ${numberSpec(gpu, "lengthMm")}mm selected GPU length.`,
      `${numberSpec(pcCase, "airflowScore")} seeded airflow score and ${numberSpec(pcCase, "includedFans")} included fan(s).`,
    ],
    negatives: [
      truthySpec(pcCase, "hasFrontUsbC") && !truthySpec(motherboard, "hasFrontUsbCHeader")
        ? `The case front USB-C port may not be usable because the motherboard lacks the matching header.`
        : `No front USB-C mismatch is visible in the selected seeded data.`,
    ],
    compatibilityRole: [
      `Case support ${listSpec(pcCase, "formFactorSupport")} is compared to motherboard ${spec(motherboard, "formFactor")}.`,
      `GPU clearance leaves ${numberSpec(pcCase, "maxGpuLengthMm") - numberSpec(gpu, "lengthMm")}mm beyond the selected GPU.`,
      `Cooler support is checked against ${cooler.model}.`,
    ],
    priceRole: [`Selected effective case offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainCoolerChoice(build: GeneratedBuild) {
  const cooler = build.parts.cooler;
  const cpu = build.parts.cpu;
  const pcCase = build.parts.case;
  const offer = build.offers.cooler;

  return makeExplanation(build, "cooler", {
    shortReason: `${cooler.model} supports the CPU socket and has cooling capacity data for the selected CPU.`,
    detailedReason: `The cooler is selected because its supported socket list, height or radiator size, and TDP rating can be checked against the selected CPU and case. The optimizer needs this data so the recommendation does not pair a strong CPU with a cooler that either cannot mount or physically cannot fit.`,
    positives: [
      `Supports CPU socket ${spec(cpu, "socket")}: ${listSpec(cooler, "supportedSockets")}.`,
      `${numberSpec(cooler, "tdpRating")}W TDP rating versus CPU ${numberSpec(cpu, "tdp")}W TDP.`,
      cooler.specs.radiatorSizeMm
        ? `${numberSpec(cooler, "radiatorSizeMm")}mm radiator size is checked against case support.`
        : `${numberSpec(cooler, "heightMm")}mm height is checked against case cooler clearance.`,
    ],
    negatives: [
      cooler.specs.ramClearanceIssue
        ? `Seeded data flags a possible RAM-clearance issue with tall memory.`
        : `No RAM-clearance issue is flagged for this cooler in seeded data.`,
    ],
    compatibilityRole: [
      `Cooler socket support is checked against CPU socket ${spec(cpu, "socket")}.`,
      cooler.specs.radiatorSizeMm
        ? `AIO radiator support is checked against case radiator support ${listSpec(pcCase, "radiatorSupport")}.`
        : `Air cooler height ${numberSpec(cooler, "heightMm")}mm is checked against case max ${numberSpec(pcCase, "maxCpuCoolerHeightMm")}mm.`,
    ],
    priceRole: [`Selected effective cooler offer is ${currency(offer.effectivePrice)} from ${offer.offer.retailer}.`],
  });
}

export function explainPartChoices(build: GeneratedBuild): Record<ProductCategory, PartChoiceExplanation> {
  return {
    cpu: explainCpuChoice(build),
    gpu: explainGpuChoice(build),
    motherboard: explainMotherboardChoice(build),
    ram: explainRamChoice(build),
    storage: explainStorageChoice(build),
    psu: explainPsuChoice(build),
    case: explainCaseChoice(build),
    cooler: explainCoolerChoice(build),
  };
}

function makeExplanation(
  build: GeneratedBuild,
  category: ProductCategory,
  explanation: Omit<PartChoiceExplanation, "category" | "evidence">,
): PartChoiceExplanation {
  return {
    category,
    ...explanation,
    evidence: collectEvidenceForCategory(build, category),
  };
}

function collectEvidenceForCategory(build: GeneratedBuild, category: ProductCategory) {
  const part = build.parts[category];
  const compatibilityEvidence = build.compatibilityReport.results
    .filter((result) => result.affectedParts.includes(category))
    .flatMap((result) => result.evidence ?? []);
  const priceEvidence = build.productPriceTrends.find((trend) => trend.productId === part.id)?.evidence ?? [];
  const all = [...compatibilityEvidence, ...priceEvidence];
  const seen = new Set<string>();

  return all.filter((citation) => {
    const key = `${citation.evidenceId ?? citation.sourceId ?? citation.title}:${citation.claim}:${citation.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trendFor(build: GeneratedBuild, productId: string) {
  return build.productPriceTrends.find((trend) => trend.productId === productId);
}

function spec(part: { specs: Record<string, unknown> }, key: string) {
  const value = part.specs[key];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value === null || value === undefined) return "unknown";
  return String(value);
}

function listSpec(part: { specs: Record<string, unknown> }, key: string) {
  return spec(part, key);
}

function numberSpec(part: { specs: Record<string, unknown> }, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : 0;
}

function truthySpec(part: { specs: Record<string, unknown> }, key: string) {
  return Boolean(part.specs[key]);
}

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
