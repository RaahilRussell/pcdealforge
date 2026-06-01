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
- Market timing advisor with `BUY_NOW`, `WAIT_FOR_PRICE_DROP`, `WAIT_FOR_NEW_RELEASE`, `BUY_ONLY_IF_NEEDED`, and `AVOID` verdicts.
- Seeded release-cycle signals that are explicitly labeled and never treated as live launch claims.
- Build optimizer returning best overall, cheapest safe, and best performance-per-dollar builds.
- Expanded recommendation categories including Best for Gaming, Best for AI / Local LLMs, Best Buy Now, Best Wait-and-Watch, and Best Prebuilt Alternative.
- Evidence/source citations for specs, compatibility claims, deal claims, price verdicts, and build reports.
- Deterministic long-form build essays and build comparisons.
- Clickable saved build reports with cost breakdowns, part explanations, offer links, compatibility deep dives, evidence pages, and markdown export.
- Product, offer, evidence/source, and seeded prebuilt detail pages.
- Next.js App Router API routes and UI with Recharts timelines.
- Vitest coverage for compatibility, deal scoring, price intelligence, optimizer behavior, evidence coverage, essays, and comparisons.

## Architecture

- `src/app`: Next.js App Router pages and API route handlers.
- `src/components`: client UI components, including the build workbench and price charts.
- `src/lib/compatibility`: deterministic build compatibility rules.
- `src/lib/deals`: offer normalization, matching, risk filtering, and deal scoring.
- `src/lib/pricing`: product and build price trend intelligence.
- `src/lib/builds`: candidate generation and build ranking.
- `src/lib/builds/reportDetails.ts`: saved report hydration, cost math, compatibility deep-dive values, markdown export, and prebuilt comparison helpers.
- `src/lib/builds/partExplanations.ts`: deterministic part-by-part selection explanations.
- `src/lib/builds/recommendationCategories.ts`: deterministic category scoring for gaming, AI, streaming, content creation, upgrade path, buy-now, wait, avoid, and prebuilt picks.
- `src/lib/timing`: market timing, release timing, and build-level timing verdicts.
- `src/lib/shopping`: actionable offer normalization, buy/view route selection, shopping list totals, and markdown shopping list output.
- `src/lib/llm`: optional Ollama report polishing with deterministic fallback.
- `src/lib/evidence`: citation formatting, evidence lookup, claim mapping, and source-backed report attachment.
- `src/lib/data`: Prisma-backed catalog loaders and mappers.
- `src/lib/db`: Prisma 7 SQLite client setup with the Better SQLite driver adapter.
- `prisma/schema.prisma`: SQLite schema.
- `prisma/seed.ts`: seeded catalog, offers, snapshots, and daily price aggregates.
- `vitest.config.ts`: test alias config matching the app's `@/` imports.

## Evidence And Source System

PCDealForge is designed so major claims can be traced to a source, deterministic rule, or stored datapoint. The MVP uses seeded evidence records:

- `EvidenceSource`: source metadata such as source type, title, publisher, capture date, confidence, notes, and optional URL.
- `ProductEvidence`: product-level claims such as socket, RAM type, GPU length, PSU wattage, connector support, case clearance, performance score, current price, and price history.
- `BuildEvidence`: build-level claims tied to compatibility, price, performance, value, risk, recommendation, user constraints, and internal calculations.

Seeded records are explicitly labeled `Seeded demo source`. They do not include fake manufacturer URLs and should not be interpreted as live manufacturer, retailer, or benchmark evidence. Internal calculations are labeled separately as `internal_calculation` or `compatibility_rule`.

Deterministic citations matter because the app should prove why it chose a build. A compatibility warning cites the relevant product evidence and rule. A price verdict cites seeded offer/history evidence and the formula source. A build essay cites the compatibility report, price trends, and internal scoring formulas.

## Seeded Demo Data Vs Production Data

The seeded MVP data exists to make the local product usable and testable without scraping or paid APIs. It is useful for validating architecture and UI behavior, but it is not a live market feed.

In production:

- Manufacturer specs would be ingested from official product pages, structured spec sheets, or approved APIs.
- Retailer offers would be ingested from compliant APIs or partner feeds, with captured timestamps and listing confidence.
- Benchmark/performance sources would be ingested as benchmark reference records with workload metadata and source confidence.
- Price snapshots would be stored from verified offer captures, not generated demo timelines.

The evidence schema already has source types for manufacturer specs, retailer offers, benchmark references, compatibility rules, price snapshots, seeded demo data, user constraints, and internal calculations.

## Compatibility Engine

The compatibility engine is plain TypeScript and does not use LLM judgment. `checkBuild` runs named rules and returns:

- `overallStatus`: `PASS`, `WARNING`, or `FAIL`
- counts for pass, warning, and fail results
- a result list with stable rule IDs, explanation text, affected parts, and confidence

Implemented checks include CPU socket, BIOS generation support, RAM type and capacity, case form factor, GPU length and slot thickness, cooler socket and clearance, AIO radiator support, PSU wattage, GPU power connectors, PSU quality, front USB-C header support, Wi-Fi warnings, M.2 storage support, and tall RAM plus large air cooler clearance.

The source-backed compatibility report attaches evidence citations after the deterministic rule pass. For example, GPU fit cites GPU length evidence plus case clearance evidence, while PSU headroom cites CPU TDP, GPU TDP, GPU recommended PSU, selected PSU wattage, and the internal PSU formula.

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

Source-backed price panels cite the current offer evidence, seeded price history evidence, and deterministic formula sources. They do not claim live pricing when the source is seeded demo data.

## Market Timing Advisor

Timing is separate from the basic price verdict. `src/lib/timing` combines:

- price timing score: current price versus 30/90/180-day averages, historical low, volatility, sale band, usually-cheaper behavior, and estimated wait savings
- release timing score: category, brand/family release signal, source type, confidence, expected window/date if known, and platform lifecycle risk
- overall timing score: price timing, release timing, deal quality, urgency/value posture, and risk tolerance context

Timing verdicts:

- `BUY_NOW`: current value is favorable and no high-confidence release signal says waiting is clearly better.
- `WAIT_FOR_PRICE_DROP`: the build or a key part is above its seeded normal sale band or has meaningful expected savings.
- `WAIT_FOR_NEW_RELEASE`: a stored release signal is strong enough to make launch timing the main wait reason.
- `BUY_ONLY_IF_NEEDED`: compatible and usable, but timing is not strong enough to call it a clear buy.
- `AVOID`: price, listing risk, or timing is poor enough that the recommendation should not drive a purchase.

Release timing does not use rumors as facts. The MVP only uses `ProductReleaseSignal` records. Seeded demo release signals are labeled as seeded demo data, official signals would need explicit source records, and unknown signals do not force a wait recommendation.

The build report includes an "Is This a Good Time to Buy?" section that states whether the wait reason is price-driven or release-driven, which part causes the timing verdict, and whether release-cycle risk is actually material.

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

Recommendation categories are generated from the deterministic build data:

- Best for Gaming prioritizes GPU performance, VRAM, resolution fit, CPU balance, airflow, PSU reliability, and price/performance.
- Best for AI / Local LLMs prioritizes VRAM, NVIDIA/CUDA tooling where applicable, system RAM, storage, PSU headroom, and cooling.
- Best for Content Creation prioritizes CPU performance, GPU acceleration, RAM, storage, cooling, and stability.
- Best for Streaming prioritizes encoder/tooling assumptions, CPU headroom, memory, PSU, and cooling.
- Best Upgrade Path rewards modern socket/platform, DDR5, M.2 slot count, PSU headroom, and case clearance.
- Best Buy Now requires favorable timing and no major release-cycle warning.
- Best Wait-and-Watch explains whether the wait reason is price-driven or release-driven.
- Best Prebuilt Alternative uses seeded prebuilt value, upgradeability, confidence, warranty/convenience, and hidden-risk score.

## Build Essays And Comparisons

Build reports are generated deterministically in TypeScript without an LLM API. The report generator uses only the build object, compatibility report, deal score, price trends, compatible swaps, and citations already attached to the build.

Each build essay includes:

- Executive Summary
- Why This Build Exists
- Performance Expectations
- Major Positives
- Major Negatives
- Compatibility Reasoning
- Deal/Price Reasoning
- Part-by-Part Justification
- Best Upgrade Path
- Who Should Buy
- Who Should Avoid
- Suggested Swaps
- Final Recommendation
- Sources Used

The comparison report explains Best Overall, Cheapest Safe, and Best Performance/$ tradeoffs, including cost differences, performance differences, waiting risks, biggest risk per build, and upgrade-path considerations.

Because reports are deterministic, they avoid hallucinated facts. If the evidence is seeded demo data, the essay says so.

## Clickable Buying Reports

Generated recommendations are persisted to `SavedBuild` with stable deterministic IDs. The build cards on the homepage link to full report pages:

- `/builds`: recent generated and seeded saved build reports.
- `/builds/[buildId]`: full mini-report for a generated build.
- `/products/[productId]`: product specs, offers, price history, compatibility usage, build usage, and product evidence.
- `/offers/[offerId]`: selected offer details, effective price math, confidence/risk notes, and connected price history.
- `/evidence/[evidenceId]`: source metadata and exact claim details.
- `/prebuilts/[prebuiltId]`: seeded prebuilt detail and DIY comparison.

The build report page is intended to be a buying audit, not just a summary card. It includes:

- top-level price, performance, deal, compatibility, verdict, source count, and seeded/live data labels
- shopping list rows for every selected offer, with product ID, offer ID, retailer, condition, base price, shipping, tax estimate, risk/condition penalties, effective price, stock, confidence, seller, and buy/view route
- "Buy This Build" tools for opening real retailer links, copying links, copying markdown shopping list, and exporting markdown
- full cost breakdown by part, including base price, shipping, tax estimate, seller/condition risk penalties, and final effective price
- "Is This a Good Time to Buy?" and "Release Timing / Wait Risk" sections
- category-fit notes for gaming, AI/local LLMs, and upgrade path
- part-by-part explanations for why each component was selected, what it is good at, its downside, and what compatibility role it plays
- exact compatibility values for every rule, such as CPU socket versus motherboard socket, GPU length versus case clearance, and PSU wattage math
- build-level and per-part price timing analysis with Recharts timeline data
- a deterministic essay with positives, negatives, tradeoffs, ideal buyer, buyer-to-avoid, upgrade path, and final recommendation
- source links for product evidence, rule evidence, seeded price evidence, and internal calculation evidence
- before-buying checklist covering stock, return policy, seller risk, clearance, BIOS support, PSU cable support, tax/shipping, wait-tracking, and official release verification
- copy/export tools that generate a markdown report

Seeded or demo offer links route to internal `/offers/[offerId]` pages. Real external retailer URLs can be opened in a new tab when they are present and valid. The seeded MVP does not pretend example/demo listings are live retailer claims.

## Optional Ollama Polishing

`src/lib/llm` adds optional local Ollama support for prose polishing only. Ollama is never used for compatibility, price, value, timing, ranking, source, or release decisions.

Environment variables:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

`POST /api/reports/polish` accepts deterministic report facts, verdicts, and citations. The prompt explicitly says:

```text
You are only rewriting the provided facts. Do not add new claims, sources, prices, benchmarks, release dates, or compatibility conclusions. Preserve all warnings and citations.
```

If Ollama is unavailable or returns an error, the app returns the deterministic report with `usedOllama: false` and a fallback reason.

## Prebuilt Placeholder Mode

The schema includes `PrebuiltSystem` and the seed script creates a small demo prebuilt set. This is an architecture placeholder for future DIY-versus-prebuilt buying decisions.

Prebuilt pages show:

- price, retailer, CPU, GPU, RAM, storage, warranty, and known component details
- unknowns such as exact PSU, motherboard, cooling, memory channel layout, or proprietary parts
- hidden risks like unknown PSU quality, weak cooling, single-channel RAM, higher markup, and upgradeability limits
- timing verdict, hidden-risk score, demo/live status, confidence, and last checked timestamp
- nearest saved DIY build comparison by price

The prebuilt records are seeded demo records unless a future ingestion pipeline attaches validated retailer/source URLs.

## Database Schema

The Prisma schema defines:

- `Product`: category, brand/model identity, normalized name, optional MPN/UPC, JSON-string specs.
- `Offer`: current retailer listing with price, tax, shipping, condition, confidence, seller metadata, and stock.
- `PriceSnapshot`: timestamped offer-level price history.
- `DailyProductPrice`: daily aggregate lows and averages for trend analysis.
- `SavedBuild`: serialized build snapshot for future persistence.
- `PrebuiltSystem`: seeded/demo prebuilt PC records with value, upgradeability, hidden risk, timing verdict, demo/live status, and last checked timestamp.
- `ProductReleaseSignal`: release-cycle signal records with category, brand, product family, generation, signal type, confidence, expected window/date, source title/URL, and notes.
- `EvidenceSource`: source metadata for seeded demo records, internal formulas, rules, and future external sources.
- `ProductEvidence`: product-level cited claims.
- `BuildEvidence`: build-level cited claims.

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
- `GET /api/evidence/product/[id]`
- `POST /api/evidence/build`
- `POST /api/build-analysis`
- `POST /api/compare-builds`
- `POST /api/reports/polish`

POST bodies are validated with Zod.

## App Routes

- `/`: build workbench and generated recommendation tabs.
- `/builds`: saved report index.
- `/builds/[buildId]`: full clickable build buying report.
- `/products/[productId]`: product detail report.
- `/offers/[offerId]`: offer detail and effective price math.
- `/evidence/[evidenceId]`: source/evidence detail.
- `/prebuilts/[prebuiltId]`: seeded prebuilt detail and DIY comparison.

## MVP Limitations

- Seeded demo specs and prices are not live source-of-truth data.
- Seeded retailer offer URLs are not presented as source citations.
- Seeded offer pages demonstrate the route and math architecture but are not live retailer listings.
- Seeded prebuilts are placeholders for future DIY-vs-prebuilt comparison.
- Performance scores are seeded relative scores, not measured benchmarks.
- Compatibility rules cover the MVP surface, but production should add richer board revision, BIOS, RAM QVL, cooler offset, and case fan/radiator conflict data.
- Build essays are deterministic summaries, not personalized financial advice.

## Future Real Integrations

The MVP intentionally avoids sketchy scraping. Future adapters should implement the narrow deal adapter interface and return normalized offers from approved sources such as:

- eBay Browse API
- Amazon affiliate or creator API
- Newegg partner feeds or APIs
- Best Buy APIs or partner feeds
- Micro Center local inventory feeds
- Official manufacturer product/spec pages
- Benchmark databases or lab test datasets with reproducible methodology

Live integrations should not leak marketplace-specific shapes into compatibility, pricing, or optimizer logic.

## Roadmap

- Replace seeded demo evidence with official manufacturer and retailer evidence records.
- Add source refresh jobs and stale-source warnings.
- Add benchmark source adapters with workload-specific performance profiles.
- Add richer compatibility rules for motherboard revisions, BIOS versions, RAM QVL, cooler offsets, and case fan/radiator conflicts.
- Add source review tooling so low-confidence evidence cannot influence safe recommendations.
