import type { ProductCategory, ProductForCompatibility } from "@/lib/compatibility/types";

export type ClaimRequest = {
  productId: string;
  claimType: string;
};

const categoryClaimFallbacks: Record<ProductCategory, string[]> = {
  cpu: ["socket", "tdp", "ram_type", "performance_score"],
  gpu: ["gpu_length", "gpu_slots", "tdp", "power_connector", "psu_wattage", "performance_score"],
  motherboard: ["socket", "chipset", "ram_type", "form_factor", "m2_slots", "wifi", "front_usb_c"],
  ram: ["ram_type", "ram_capacity", "ram_speed", "ram_height"],
  storage: ["storage_capacity", "storage_interface", "storage_form_factor"],
  psu: ["psu_wattage", "power_connector", "efficiency", "quality_tier"],
  case: ["form_factor", "case_clearance", "radiator_support", "front_usb_c"],
  cooler: ["socket", "cooler_height", "radiator_support", "tdp", "ram_clearance"],
};

export function buildClaimRequestsForProducts(products: ProductForCompatibility[]): ClaimRequest[] {
  return products.flatMap((product) =>
    (categoryClaimFallbacks[product.category] ?? []).map((claimType) => ({
      productId: product.id,
      claimType,
    })),
  );
}

export function compatibilityClaimRequests(
  ruleId: string,
  productsByCategory: Partial<Record<ProductCategory, ProductForCompatibility>>,
) {
  const productId = (category: ProductCategory) => productsByCategory[category]?.id;
  const request = (category: ProductCategory, claimType: string): ClaimRequest | null => {
    const id = productId(category);
    return id ? { productId: id, claimType } : null;
  };

  const requestsByRule: Record<string, Array<ClaimRequest | null>> = {
    "cpu-socket-match": [request("cpu", "socket"), request("motherboard", "socket")],
    "cpu-generation-support": [request("cpu", "socket"), request("motherboard", "bios_support")],
    "ram-type-match": [request("ram", "ram_type"), request("motherboard", "ram_type")],
    "ram-capacity-limit": [request("ram", "ram_capacity"), request("motherboard", "ram_capacity")],
    "case-motherboard-form-factor": [request("case", "form_factor"), request("motherboard", "form_factor")],
    "gpu-length-clearance": [request("gpu", "gpu_length"), request("case", "case_clearance")],
    "cooler-socket-support": [request("cooler", "socket"), request("cpu", "socket")],
    "air-cooler-height": [request("cooler", "cooler_height"), request("case", "case_clearance")],
    "aio-radiator-support": [request("cooler", "radiator_support"), request("case", "radiator_support")],
    "cooler-case-clearance": [request("cooler", "cooler_height"), request("case", "case_clearance")],
    "psu-wattage-headroom": [
      request("cpu", "tdp"),
      request("gpu", "tdp"),
      request("gpu", "psu_wattage"),
      request("psu", "psu_wattage"),
    ],
    "psu-gpu-power-connector": [request("gpu", "power_connector"), request("psu", "power_connector")],
    "psu-quality-high-end-gpu": [request("gpu", "performance_score"), request("psu", "quality_tier")],
    "front-usb-c-header": [request("case", "front_usb_c"), request("motherboard", "front_usb_c")],
    "wifi-requirement": [request("motherboard", "wifi")],
    "storage-m2-slot": [request("storage", "storage_form_factor"), request("motherboard", "m2_slots")],
    "gpu-slot-thickness": [request("gpu", "gpu_slots")],
    "ram-cooler-clearance": [request("ram", "ram_height"), request("cooler", "ram_clearance")],
  };

  return (requestsByRule[ruleId] ?? []).filter((item): item is ClaimRequest => Boolean(item));
}
