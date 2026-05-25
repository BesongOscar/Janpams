# Monorepo Sharing: Mobile & Web Core

**Principle:** The monorepo is structured so that **mobile (address-maker-glopams) and web (mbukanji-maps) share core logic** via `packages/core` (`@janpams/core`). New features and parity work should follow this before adding app-local duplicates.

---

## Do

- **Use `@janpams/core`** for types, POI classification, search normalization, routing helpers, and any logic needed by both apps.
- **Keep app code as platform glue:** UI, storage (IndexedDB vs SQLite), and app-specific config only.
- **Before implementing a parity feature:** Check if `packages/core` already exports the type or function; if yes, import from core instead of reimplementing in the app.
- **When adding new shared logic:** Add it to `packages/core` and consume it from both apps so behavior stays in sync.

---

## Don’t

- Don’t copy web logic into mobile (or vice versa) when that logic can live in `packages/core`.
- Don’t redefine types (e.g. `POIRecord`, `POICategory`, `CachedRoute`) in app schemas if they exist or can live in core.
- Don’t implement classification/algorithm logic twice (e.g. POI tier/category) in each app.

---

## What’s in `packages/core` today

Relevant to offline/parity work:

- **`poi/`** — POI types, `classifyTier`, `classifyCategory`, `getSubcategory`, `getStabilityScore`, distance/ranking helpers.
- **`search/`** — Search normalization, query helpers.
- **`streets/`** — Street validation, selection, haversine.
- **`geocoding/`** — Geocoding helpers.
- **`address/`**, **`pluscode/`** — Address and Plus Code utilities.
- **`navigation/`** — Navigation types, off-route policy, ETA.
- **`routing`** (export) — Routing-related exports.

Both apps depend on `@janpams/core`; mobile also uses path aliases for `@janpams/core/pluscode`, `@janpams/core/address`, `@janpams/core/geocoding`, `@janpams/core/streets`.

---

## Phase 1 and refactor

Phase 1 (POIs, route_cache, search index) added some **app-local** code in mobile that duplicates or mirrors what exists (or could exist) in core:

| Mobile (app-local)           | Prefer instead                          |
|-----------------------------|-----------------------------------------|
| `lib/poi/buildPOIFromOSM.ts`| Use `@janpams/core` POI classification   |
| `lib/db/schemas.ts` POI/route types | Shared types from core where possible |
| Route cache *logic*         | Core can export pure helpers (e.g. `routeCoordHash`); DB layer stays app-specific |

**Before or during further integration:** Refactor mobile to import POI types and `buildPOIFromOSM` (or equivalent) from `@janpams/core`, and align type definitions so a single source of truth lives in core. Storage (SQLite vs IndexedDB) remains in each app; shared types and algorithms live in core.

This keeps the monorepo aligned with the goal: **one shared core, two platform-specific apps.**
