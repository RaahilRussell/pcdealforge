# PCDealForge

PCDealForge is a PCPartPicker-style MVP for answering one practical buying question:

> What is the best working PC I can build for my budget, and are these parts actually good deals right now?

The current implementation is a seeded, deterministic vertical slice. It does not depend on auth, payments, live scraping, or external marketplace APIs.

## Main Features

- Seeded PC part catalog covering CPU, GPU, motherboard, RAM, storage, PSU, case, and cooler.
- Mock retailer offers with condition, seller rating, stock state, confidence, shipping, and tax estimate.
- 180 days of seeded daily price history for every product.
- Deterministic compatibility engine with PASS, WARNING, and FAIL results.
- Deal engine with effective price, risk penalties, confidence scoring, offer matching, and safe recommendation filtering.
- Price intelligence for buy-now, wait, or avoid recommendations.
- Build optimizer returning best overall, cheapest safe, and best performance-per-dollar builds.
- Next.js App Router API routes and UI with Recharts timelines.
- Vitest coverage for compatibility, deal scoring, price intelligence, and optimizer behavior.

## Architecture

- `src/app`: Next.js App Router pages and API route handlers.
- `src/components`: client UI components, including the build workbench and price charts.
- `src/lib/compatibility`: deterministic build compatibility rules.
- `src/lib/deals`: offer normalization, matching, risk filtering, and deal scoring.
- `src/lib/pricing`: product and build price trend intelligence.
- `src/lib/builds`: candidate generation and build ranking.
- `src/lib/data`: Prisma-backed catalog loaders and mappers.
- `src/lib/db`: Prisma 7 SQLite client setup with the Better SQLite driver adapter.
- `prisma/schema.prisma`: SQLite schema.
- `prisma/seed.ts`: seeded catalog, offers, snapshots, and daily price aggregates.

## Compatibility Engine

The compatibility engine is plain TypeScript and does not use LLM judgment. `checkBuild` runs named rules and returns:

- `overallStatus`: `PASS`, `WARNING`, or `FAIL`
- counts for pass, warning, and fail results
- a result list with stable rule IDs, explanation text, affected parts, and confidence

Implemented checks include CPU socket, BIOS generation support, RAM type and capacity, case form factor, GPU length and slot thickness, cooler socket and clearance, AIO radiator support, PSU wattage, GPU power connectors, PSU quality, front USB-C header support, Wi-Fi warnings, M.2 storage support, and tall RAM plus large air cooler clearance.

## Deal Engine

The deal engine calculates:

- effective price: `price + shipping + taxEstimate + sellerRiskPenalty + conditionRiskPenalty`
- seller trust and condition scores
- confidence-adjusted safe recommendation eligibility
- risk tolerance filtering for new-only, open-box allowed, and used allowed
- weighted deal score using price versus 90-day average, price versus historical low, seller trust, condition risk, and stock/shipping

Offer matching supports exact UPC, exact MPN, normalized brand/model matching, and token-based title matching. Low-confidence marketplace listings are not allowed to become the top safe recommendation.

## Price Intelligence

`calculateProductPriceTrend` computes:

- current price
- 30, 90, and 180-day lows
- 30, 90, and 180-day averages
- lowest tracked price
- usual price range
- typical sale band
- current price percentile
- usually-cheaper flag
- estimated savings from waiting
- `BUY_NOW`, `WAIT`, or `AVOID` verdict with explanation

Build-level price intelligence aggregates component timelines, flags overpriced parts, and carries compatible cheaper swap opportunities.

## Build Optimizer

The optimizer accepts budget, use case, resolution, GPU preference, requested RAM/storage, Wi-Fi requirement, and risk tolerance. It prices the seeded products, filters by safe offers, generates candidate builds, runs compatibility checks, rejects builds with compatibility failures, enforces budget, and ranks by:

```text
performanceScore * 0.40
+ dealScore * 0.25
+ compatibilityConfidence * 0.20
+ budgetEfficiency * 0.15
- warningPenalty
```

It returns:

- `bestOverall`
- `cheapestSafe`
- `bestPerformancePerDollar`

Each build includes selected parts, offers, total price, performance score, compatibility report, deal score, price verdict, selection reason, and cheaper compatible swaps.

## Database Schema

The Prisma schema defines:

- `Product`: category, brand/model identity, normalized name, optional MPN/UPC, JSON-string specs.
- `Offer`: current retailer listing with price, tax, shipping, condition, confidence, seller metadata, and stock.
- `PriceSnapshot`: timestamped offer-level price history.
- `DailyProductPrice`: daily aggregate lows and averages for trend analysis.
- `SavedBuild`: serialized build snapshot for future persistence.

SQLite is used for the MVP. Prisma 7 requires the Better SQLite driver adapter at runtime.

## Running Locally

Install dependencies:

```bash
npm install
```

Create and seed the local SQLite database:

```bash
npm run db:push
npm run db:seed
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run db:push
npm run db:seed
npm run db:studio
```

## API Routes

- `GET /api/products`
- `GET /api/products/[id]`
- `GET /api/products/[id]/price-history`
- `POST /api/compatibility/check`
- `POST /api/generate-build`
- `POST /api/deals/refresh`

POST bodies are validated with Zod.

## Future Real Integrations

The MVP intentionally avoids sketchy scraping. Future adapters should implement the narrow deal adapter interface and return normalized offers from approved sources such as:

- eBay Browse API
- Amazon affiliate or creator API
- Newegg partner feeds or APIs
- Best Buy APIs or partner feeds
- Micro Center local inventory feeds

Live integrations should not leak marketplace-specific shapes into compatibility, pricing, or optimizer logic.
