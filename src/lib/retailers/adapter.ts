import type {
  RawRetailerOffer,
  RetailerAdapter,
  RetailerAdapterResult,
  RetailerAdapterStatus,
  RetailerSourceType,
} from "./types";

export const UNAVAILABLE_MESSAGE =
  "Live retailer data unavailable for this retailer. Configure API credentials or use demo mode.";

export function unavailableResult(
  retailer: string,
  sourceType: RetailerSourceType,
  message: string = UNAVAILABLE_MESSAGE,
): RetailerAdapterResult {
  return { retailer, sourceType, status: "unavailable", offers: [], message };
}

export function disabledResult(
  retailer: string,
  sourceType: RetailerSourceType,
  message: string,
): RetailerAdapterResult {
  return { retailer, sourceType, status: "disabled", offers: [], message };
}

export function okResult(
  retailer: string,
  sourceType: RetailerSourceType,
  offers: RawRetailerOffer[],
  message?: string,
): RetailerAdapterResult {
  return { retailer, sourceType, status: "enabled", offers, message };
}

export function errorResult(
  retailer: string,
  sourceType: RetailerSourceType,
  error: unknown,
): RetailerAdapterResult {
  const message = error instanceof Error ? error.message : String(error);
  return { retailer, sourceType, status: "unavailable", offers: [], error: message };
}

export function adapterStatusOf(adapter: RetailerAdapter): RetailerAdapterStatus {
  return adapter.isConfigured() ? "enabled" : "unavailable";
}

export type { RetailerAdapter };
