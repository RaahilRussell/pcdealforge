# CLAUDE.md

Guidance for Claude Code and other coding agents working in this repository.

## Project

PCDealForge is a PCPartPicker-style MVP focused on real-world PC buying decisions. The product moat is not generic catalog browsing; it is deterministic compatibility, deal discovery, price history, price timing intelligence, full-build trend analysis, and verified cheapest compatible build recommendations.

Always follow `AGENTS.md`. This is a Next.js 16 project, so before changing app code, read the relevant guide in `node_modules/next/dist/docs/` instead of relying on older Next.js assumptions.

## Required Workflow

- Work phase by phase. Keep each phase small enough to validate.
- After each stable phase, run the relevant checks, tests, or build.
- Fix errors before moving to the next phase.
- Commit after every stable phase.
- Push to GitHub after each commit when `origin` exists.
- Do not leave fake imports, broken routes, placeholder APIs, or unfinished files.
- Prefer a working MVP over a large unfinished architecture.
- Use seeded or mock deal data first.
- Architect real API and scraper adapters later, but do not make the MVP depend on them.
- Compatibility checks must be deterministic TypeScript rules, not LLM guesses.
- LLMs may later explain compatibility and price results, but the actual decisions must come from code.

## Product Vision

PCDealForge helps builders find the cheapest safe PC build for their goals and timing. It should answer:

- Will these parts work together in the real world?
- Is this part currently a good deal?
- Should the buyer buy now, wait, or avoid?
- How has this part or full build changed in price over time?
- What is the cheapest verified compatible build for a target use case and budget?

The MVP should make these answers transparent, auditable, and reproducible.

## MVP Scope

Build a working vertical slice with seeded data:

- Part catalog covering CPU, motherboard, RAM, GPU, storage, PSU, case, and cooler.
- Build list/editor that calculates compatibility and total price.
- Deterministic compatibility warnings and blockers.
- Deal list using seeded retailer offers.
- Price history timelines for parts and full builds using seeded snapshots.
- Buy-now / wait / avoid recommendation based on deterministic price rules.
- Build optimizer that returns cheapest compatible builds for a small set of target profiles.

Out of scope for the initial MVP:

- Live scraping as a required runtime dependency.
- LLM-generated compatibility decisions.
- Huge user/account systems unless needed for the MVP path.
- Broad marketplace coverage before the local deterministic engines work.

## Architecture

Current stack:

- Next.js 16 App Router in `src/app`.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Prisma 7 with SQLite configured.
- Vitest dependencies are present; add or maintain test scripts when introducing tests.

Preferred structure as the app grows:

- `src/app`: routes, layouts, server components, page composition.
- `src/components`: reusable UI components.
- `src/lib/data`: seeded catalogs, deals, and price history fixtures.
- `src/lib/compatibility`: deterministic compatibility engine.
- `src/lib/deals`: deal normalization, filtering, and scoring.
- `src/lib/pricing`: price history and buy/wait/avoid logic.
- `src/lib/optimizer`: cheapest compatible build search.
- `src/lib/types`: shared domain types and Zod schemas.
- `src/generated/prisma`: generated Prisma client output, per current schema config.

Keep domain logic outside React components so it can be tested directly.

## Data Models

Use explicit, typed domain models. Prefer TypeScript types plus Zod schemas for seeded input validation. Prisma models can follow once the in-memory MVP shape is stable.

Core models:

- `Part`: id, type, brand, model, specs, launch date, metadata.
- `Cpu`: socket, chipset support metadata, power draw, integrated graphics flag.
- `Motherboard`: socket, chipset, form factor, memory type, memory slots, BIOS support notes, M.2/SATA/PCIe slots.
- `MemoryKit`: DDR generation, capacity, module count, speed, EXPO/XMP metadata.
- `Gpu`: length, slot width, power connectors, estimated wattage.
- `Storage`: interface, form factor, capacity, PCIe generation.
- `Psu`: wattage, efficiency rating, modularity, connector set, form factor.
- `Case`: supported motherboard form factors, GPU clearance, cooler clearance, PSU support.
- `Cooler`: socket support, height/radiator size, cooling capacity.
- `RetailOffer`: part id, retailer, price, currency, URL, availability, condition, captured timestamp.
- `PricePoint`: part id or build id, price, retailer/source, timestamp.
- `Build`: selected part ids by category, intended use, budget, region.
- `CompatibilityResult`: status, blockers, warnings, notes, rule ids.
- `DealScore`: current price, baseline price, discount percent, rarity/confidence, recommendation.
- `BuildOptimizationResult`: selected parts, total price, compatibility result, savings/tradeoffs.

## Compatibility Engine Requirements

The compatibility engine must be deterministic TypeScript code with named rules and test coverage.

Minimum rules:

- CPU socket must match motherboard socket.
- Motherboard chipset/BIOS support must be represented explicitly where relevant.
- RAM DDR generation must match motherboard memory type.
- RAM module count must fit motherboard slot count.
- Case must support motherboard form factor.
- GPU length and slot width must fit case constraints.
- Cooler socket support and height/radiator clearance must fit CPU/case.
- PSU wattage must satisfy estimated build wattage plus a safety margin.
- PSU must provide required GPU/CPU connectors.
- Storage interface/form factor must match motherboard slots.
- Detect missing required categories.

Results should separate:

- `blocker`: build should not be recommended.
- `warning`: build may work but has caveats.
- `note`: informational explanation.

Every rule should expose a stable `ruleId` so UI, tests, and future LLM explanations can reference the same decision.

## Deal Engine Requirements

Use seeded/mock retailer data first. The deal engine should normalize offers and score them without relying on live APIs.

Minimum behavior:

- Normalize prices, retailer names, stock status, condition, and timestamps.
- Exclude unavailable or suspicious offers from "verified cheapest" results.
- Compare current price against seeded historical baseline.
- Surface best current offer per part.
- Mark deal quality with deterministic labels such as `excellent`, `good`, `fair`, and `bad`.
- Track data freshness so old prices are not treated as verified.

Future scraper/API adapters should implement a narrow interface that returns normalized offers. They should not leak scraper-specific shapes into app logic.

## Price Intelligence Requirements

Price intelligence must be deterministic and explainable.

Minimum behavior:

- Render price history timelines for individual parts.
- Render full-build total price history from component snapshots.
- Calculate rolling low, median, high, and recent trend.
- Recommend `buy-now`, `wait`, or `avoid` from rules based on discount, trend, volatility, stock, and age of price data.
- Show the reason codes behind each recommendation.

Do not use an LLM to decide whether a price is good. A future LLM can translate reason codes into user-friendly prose.

## Build Optimizer Requirements

The optimizer should search seeded parts and return verified compatible builds.

Minimum behavior:

- Accept a budget, target use case, and optional required parts.
- Generate candidate builds from seeded data.
- Run every candidate through the compatibility engine.
- Exclude builds with blockers.
- Rank by total verified price, then quality/value rules.
- Return cheapest compatible build and a small set of alternatives.
- Include tradeoff notes such as upgrade path, PSU headroom, or GPU/CPU balance.

Keep the first optimizer simple and deterministic. Avoid premature complex solver architecture until the seeded MVP works end to end.

## UI Requirements

The UI should feel like a dense, useful buying tool rather than a marketing site.

Required MVP screens or sections:

- Part catalog with filters for category, compatibility-relevant specs, retailer, and price.
- Build editor with selected parts, total price, compatibility status, and blockers/warnings.
- Deal dashboard showing best current seeded deals.
- Part detail view with offer table, price timeline, and buy/wait/avoid recommendation.
- Full-build price trend view.
- Cheapest compatible build recommendations for target budgets.

UI behavior:

- Keep compatibility and price reasoning visible.
- Do not hide blockers behind vague messages.
- Use clear status treatments for compatible, warning, and incompatible states.
- Prefer compact tables, comparison layouts, and readable charts over decorative hero sections.
- Use `lucide-react` icons where icons are helpful.
- Maintain responsive layouts without text overlap.

## Testing Requirements

Tests should focus first on deterministic domain logic.

Required coverage as features are added:

- Compatibility rules for both passing and failing builds.
- Deal scoring thresholds and stale/unavailable offer handling.
- Price recommendation reason codes.
- Full-build price history aggregation.
- Optimizer behavior when required parts or budgets constrain the search.
- Smoke coverage for critical pages/routes once UI is implemented.

When adding tests, make sure the repo has a usable script such as `npm test` or `npm run test`. Run `npm run lint`, relevant tests, and `npm run build` after stable phases when app code changes.

## Git And Commit Workflow

- Check `git status --short` before editing and before committing.
- Do not revert user changes unless explicitly instructed.
- Keep commits scoped to one stable phase.
- Commit message style: concise imperative summary, for example `Add seeded compatibility engine`.
- After committing, push to `origin` if it exists.
- If checks fail, fix the failure before committing.
- Do not commit generated noise, debug artifacts, or unrelated formatting churn.
