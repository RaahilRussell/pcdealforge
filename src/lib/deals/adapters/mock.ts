import type { DealAdapter, DealAdapterContext } from "./base";
import type { NormalizedOffer } from "../types";

export class MockDealAdapter implements DealAdapter {
  readonly name = "mock";

  constructor(private readonly seededOffers: NormalizedOffer[] = []) {}

  async refreshOffers(_context: DealAdapterContext): Promise<NormalizedOffer[]> {
    void _context;
    return this.seededOffers.map((offer) => ({
      ...offer,
      lastCheckedAt: new Date(),
    }));
  }
}
