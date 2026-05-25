# Mobile–Web Feature Parity — Detailed Implementation Plan

**Status: ALL 24 TASKS IMPLEMENTED** (as of 2026-02-04)

**Goal:** Close all remaining feature gaps between web (mbukanji-maps) and mobile (address-maker-glopams) so the mobile app has the same capabilities as web, **except Location Plan** (explicitly out of scope for mobile).

**Scope:** This plan covers gaps **beyond** the offline data parity already completed (POIs, route cache, JAPA, Valhalla, search index repair, navigation screen — see `MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md`). Those 8 gaps are closed; this plan addresses the remaining feature, logic, and UI gaps.

**Out of scope:** Location Plan (corridor building, saved plans, PDF export), admin panel (PlatformUserManager, OrgUserManager — web-only), subscription management (web-only), dev mode dashboard (web-only convenience).

**Key finding:** Many modules already existed in `packages/core` (`@janpams/core`): compound address (Task 1.1), ETA tracker (Task 3.3), off-route policy (Task 3.4), navigation types (Task 3.5), search ranking (partial Task 1.3), geolocation thresholds (partial Task 4.3). Mobile wraps these shared modules rather than duplicating them.

---

## 1. Gap Overview

### Category A — Missing logic modules (no mobile equivalent)

| # | Gap | Web file | Mobile status | Phase |
|---|-----|----------|---------------|-------|
| A1 | Compound address suffix calculator | `lib/compoundAddress.ts` | Missing | 1 |
| A2 | Subdivision/country pair lookup | `lib/subdivisions.ts` + data JSON | Missing | 1 |
| A3 | Offline search query engine | `lib/search/searchQuery.ts` | Missing (index built, never queried) | 1 |
| A4 | Navigation match service (GPS snap) | `lib/navigation/matchService.ts` | Missing | 3 |
| A5 | Navigation GPS service (accuracy/smoothing) | `lib/navigation/gpsService.ts` | Missing | 3 |
| A6 | Navigation ETA tracker | `lib/navigation/etaTracker.ts` | Missing | 3 |
| A7 | Navigation off-route policy | `lib/navigation/offRoutePolicy.ts` | Missing | 3 |
| A8 | Tier/role mapping | `lib/tierRoleMapping.ts` | Missing | 4 |

### Category B — Missing UI components

| # | Gap | Web component | Mobile status | Phase |
|---|-----|--------------|---------------|-------|
| B1 | Country dropdown in OfflineDataManager | `map/OfflineDataManager.tsx` — `<Select>` | Static "Cameroon" pill | 1 |
| B2 | POI map layer | `map/POILayer.tsx` | Not rendered on map | 2 |
| B3 | Street name editor (popup, type dropdown, validation) | `address/StreetNameEditor.tsx` | No dedicated editor | 2 |
| B4 | Edit address modal/flow | `address/EditAddressModal.tsx`, `pages/EditAddressPage.tsx` | Missing entirely | 2 |
| B5 | Address info panel (source badges, quality) | `layout/AddressInfoPanel.tsx` | Basic found/not-found cards | 2 |
| B6 | Navigation panel (transport modes, waypoints, preferences) | `navigation/NavigationPanel.tsx` | Basic A→B only | 3 |
| B7 | GPS verification dialog | `location/GpsVerificationModal.tsx` | Missing | 4 |
| B8 | Street name badge (naming mode indicator) | `address/StreetNameBadge.tsx` | Missing | 2 |

### Category C — Feature gaps in existing mobile code

| # | Gap | Web behavior | Mobile gap | Phase |
|---|-----|-------------|------------|-------|
| C1 | Offline search not queryable | `querySearch()` queries local index | `useSearch` only calls online API | 1 |
| C2 | Compound suffix not calculated | `calculateCompoundSuffix()` → A/B/C | Non-street-facing detected but no suffix | 1 |
| C3 | Dual address creation | Official + user-suggested on name edit | Schema exists, flow not implemented | 2 |
| C4 | Address source indicators | "JanGo DB" / "Offline Data" / "Online" badges | Not surfaced | 2 |
| C5 | Address quality assessment | HIGH/MEDIUM/LOW displayed to user | Not surfaced | 2 |
| C6 | Live navigation services | GPS snap, ETA, off-route detection | Route displayed, no live tracking | 3 |
| C7 | Transport modes & route preferences | Car/bike/walk, avoid options | Missing | 3 |
| C8 | Multi-stop waypoints | A → B → C route | A → B only | 3 |
| C9 | Address list / edit flow | Full table with search, edit, delete | Basic list, no edit | 2 |
| C10 | Tier/role feature gating | Tier-based capability restrictions | No gating | 4 |
| C11 | Online OSRM routing fallback | Live OSRM when online | Cache + Dijkstra + Valhalla only | 3 |

---

## 2. Phase 1 — Core Address Logic & Offline Search

**Objective:** Fix critical address creation logic gaps and enable the offline search engine that already has a built index but no query layer.

### Task 1.1 — Port compound address suffix calculator

| Field | Detail |
|-------|--------|
| **Description** | Port web's `compoundAddress.ts` to mobile: `calculateCompoundSuffix(distance)`, `isNonStreetFacing(distance)`, `getCompoundBandDescription(distance)`. These compute the A/B/C suffix when a property is >30m from street. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/compoundAddress.ts`: Distance bands (0–30m = street-facing, 30–50m = A, 50–70m = B, etc.); formula `floor((distance - 30) / 20) + 1`; single letters A–Z, double letters AA–ZZ. |
| **Acceptance criteria** | (1) **Create** `lib/compoundAddress.ts` with `calculateCompoundSuffix(distanceToStreet: number): string | null`, `isNonStreetFacing(distance: number): boolean`, `getCompoundBandDescription(distance: number): string`. (2) In `app/new-create-address.tsx`, when distance > 30m, call `calculateCompoundSuffix` and set the `extension` field on the address. (3) UI shows the suffix (e.g. "123A") in the address preview when compound. (4) Unit tests for edge cases (exactly 30m, 31m, 50m, 550m → AA). |
| **Files to create/update** | **Create** `lib/compoundAddress.ts`; update `app/new-create-address.tsx` (wire suffix into form); update address preview card. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### Task 1.2 — Port subdivision/country pair lookup

| Field | Detail |
|-------|--------|
| **Description** | Port web's `subdivisions.ts` and the `subdivision_country_pair.json` data file so address display can show "SW, CMR" format. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/subdivisions.ts`: `getSubdivisionCountryPair(code, country?)`, `getSubdivisionByRegion(name, country?)`, `formatSubdivisionPair(region, country)`. Data: `src/data/subdivision_country_pair.json`. |
| **Acceptance criteria** | (1) Copy or symlink `subdivision_country_pair.json` into mobile `data/` or `assets/`. (2) **Create** `lib/subdivisions.ts` with same API. (3) In address display (cards, list), show subdivision pair where region is available. (4) Works offline (JSON bundled in app). |
| **Files to create/update** | **Create** `lib/subdivisions.ts`, copy `data/subdivision_country_pair.json`; update address display components. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### Task 1.3 — Port offline search query engine

| Field | Detail |
|-------|--------|
| **Description** | Port web's `searchQuery.ts` to mobile so the locally-built search index can be queried offline. This is the most critical gap — without it, offline search is non-functional. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/search/searchQuery.ts`: `querySearch(context)` → `GroupedResults`. Two-phase: (1) token prefix lookup in `search_tokens`, (2) fetch `search_items` by IDs, score/rank/group. Types: `SearchContext`, `SearchResult`, `GroupedResults`. Scoring: exact/prefix/token match, proximity, visible area, active pack, type bonus. |
| **Acceptance criteria** | (1) **Create** `lib/search/searchQuery.ts` with `querySearch(context: SearchContext): Promise<GroupedResults>`. (2) Query `search_tokens` table for token prefix matches; fetch `search_items` by matched IDs; score and rank; group by type (addresses, streets, places, admins). (3) Support `filterByPacks`, `filterByTypes`, `mapCenter`/`currentPosition` for proximity scoring. (4) Return `topMatch`, grouped arrays, `totalCount`, `emptyReason`. (5) Export from `lib/search/index.ts`. |
| **Files to create/update** | **Create** `lib/search/searchQuery.ts`; update `lib/search/index.ts` exports. |
| **Dependencies** | Search index already built (Phase 1 of offline parity). |
| **Estimated effort** | Large. |

### Task 1.4 — Wire offline search into useSearch hook

| Field | Detail |
|-------|--------|
| **Description** | Update `hooks/useSearch.ts` to query the local search index (via `querySearch`) when offline or as a first source, falling back to online API. Currently it only calls the online API. |
| **Web reference** | Web `SearchInput.tsx` calls `querySearch()` for offline results and shows grouped results with type icons. |
| **Acceptance criteria** | (1) `useSearch` calls `querySearch(query, context)` first (always, or when offline). (2) Results from local index are shown in search results UI with type indicators (address/street/POI/admin). (3) Online results are merged or shown as secondary section when available. (4) When fully offline, local search results are the only source. (5) Debounced (300–500ms). |
| **Files to create/update** | `hooks/useSearch.ts`; update `components/SearchInput.tsx` or `components/SearchResultContainer.tsx` to display grouped results. |
| **Dependencies** | Task 1.3. |
| **Estimated effort** | Medium. |

### Task 1.5 — Country dropdown in OfflineDataManager

| Field | Detail |
|-------|--------|
| **Description** | Replace the static "Cameroon" pill in OfflineDataManager with a working dropdown that supports multiple countries (currently only CM, but structured for extensibility). |
| **Web reference** | `apps/core/mbukanji-maps/src/components/map/OfflineDataManager.tsx`: `COUNTRIES` config with code/name/regions per country; `selectedCountry` state; `<Select>` component; `getAvailableDataPacks(selectedCountry)`. |
| **Acceptance criteria** | (1) Add `COUNTRIES` config (same structure as web: code, name, regions with cities). (2) Add `selectedCountry` state (default 'CM'). (3) Replace static pill with a Picker/Dropdown that lists countries from `COUNTRIES`. (4) When country changes, call `getAvailableDataPacks(selectedCountry)` and update region list. (5) Region grid shows only regions for selected country. (6) Search filters within selected country's regions. |
| **Files to create/update** | `components/OfflineDataManager/index.tsx`; optionally extract `COUNTRIES` config to a shared file. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

---

## 3. Phase 2 — Address Creation & Display Parity

**Objective:** Bring address creation flow, editing, and display to the same level as web.

### Task 2.1 — Street name editor component

| Field | Detail |
|-------|--------|
| **Description** | Create a dedicated street name editor (bottom sheet or modal) with: street type dropdown (from `street_appellations.json`), auto-type detection/extraction, naming mode badge, and validation (blocked words, emoji, etc.). |
| **Web reference** | `apps/core/mbukanji-maps/src/components/address/StreetNameEditor.tsx`: Props `streetName, streetType, isFromApi, onSave, onCancel`. Uses `street_appellations.json` for types. `extractStreetType(input)` auto-detects type from name. `validateStreetName()` and `detectNamingMode()` from `lib/streetValidation.ts`. Naming modes: Standard, Numeric, Landmark, Custom. |
| **Acceptance criteria** | (1) **Create** `components/StreetNameEditor.tsx` (or bottom sheet). (2) Text input for street name. (3) Dropdown for street type using `street_appellations.json` data (bundled). (4) Auto-extract type from name (e.g. "Unity Street" → name "Unity", type "Street"). (5) Show naming mode badge using `detectNamingMode()` from existing `lib/streetValidation.ts`. (6) Validate input on save (blocked words, emoji detection from `streetValidation`). (7) Callback `onSave(name, type)` returns cleaned values. |
| **Files to create/update** | **Create** `components/StreetNameEditor.tsx`; copy `data/street_appellations.json` from web if not present; update `app/new-create-address.tsx` to use it. |
| **Dependencies** | `lib/streetValidation.ts` (already exists on mobile). |
| **Estimated effort** | Medium. |

### Task 2.2 — Street name badge (naming mode indicator)

| Field | Detail |
|-------|--------|
| **Description** | Small badge showing the detected naming mode (Standard / Numeric / Landmark / Custom) next to street names in address cards and creation flow. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/address/StreetNameBadge.tsx`. Uses `detectNamingMode()` from `lib/streetValidation.ts`. |
| **Acceptance criteria** | (1) **Create** `components/StreetNameBadge.tsx`. (2) Takes `streetName` prop. (3) Calls `detectNamingMode()` and shows a small colored badge (e.g. green "Standard", blue "Numeric", amber "Landmark", grey "Custom"). (4) Used in address cards and creation flow. |
| **Files to create/update** | **Create** `components/StreetNameBadge.tsx`; use in address display components. |
| **Dependencies** | `lib/streetValidation.ts` (exists). |
| **Estimated effort** | Small. |

### Task 2.3 — Dual address creation flow

| Field | Detail |
|-------|--------|
| **Description** | When user edits a street name during address creation (changing from the API/OSM name), create two addresses: the original (name_source = 'api_official') and the user-edited version (name_source = 'user_suggested', linked via `linked_address_id`). |
| **Web reference** | `apps/core/mbukanji-maps/src/pages/CreateAddressPage.tsx`: Detects name edit → creates official address + user-suggested address, links them, adds street suggestion to queue. |
| **Acceptance criteria** | (1) Track whether user edited the street name vs kept the API name. (2) If edited: create original address with `name_source = 'api_official'`, create second address with `name_source = 'user_suggested'` and `linked_address_id` pointing to original. (3) Add street name suggestion to `street_suggestions` table (existing `lib/db/suggestions.ts`). (4) Both addresses visible in address list. (5) Schema fields already exist (`name_source`, `linked_address_id` in `lib/db/schemas.ts`). |
| **Files to create/update** | `app/new-create-address.tsx`, `lib/addressServices.ts` (add dual-create logic). |
| **Dependencies** | Task 2.1 (street name editor to detect edit). |
| **Estimated effort** | Medium. |

### Task 2.4 — Edit address modal/flow

| Field | Detail |
|-------|--------|
| **Description** | Allow users to edit an existing address (street name, business name, neighborhood, property type, connection). Currently mobile has no edit flow. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/address/EditAddressModal.tsx`: Editable fields: street name, business name, neighborhood, property type, connection. Property type dropdown (categorized). Save calls `updateAddress()`. |
| **Acceptance criteria** | (1) **Create** `components/EditAddressModal.tsx` (or screen). (2) Receives address object; shows editable fields (street name, business name, neighborhood, property type, connection type). (3) Property type and connection type dropdowns. (4) Save calls `updateAddress()` from `lib/addressServices.ts` (or `SyncManager.updateAddress`). (5) Updated address synced to server when online. (6) Accessible from address detail view / address list. |
| **Files to create/update** | **Create** `components/EditAddressModal.tsx`; update `app/my-addresses.tsx` or address detail to add "Edit" button; update `lib/addressServices.ts` if `updateAddress` is missing. |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

### Task 2.5 — Address info enrichment (source badges, quality indicators)

| Field | Detail |
|-------|--------|
| **Description** | Enrich address found/not-found cards with: (1) source badge showing where the address came from (JanGo DB, Offline OSM, Online OSM, External API), (2) quality indicator (HIGH/MEDIUM/LOW), (3) verification status. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/layout/AddressInfoPanel.tsx`: Source badges, quality display, verification status badge, "Verify" / "JanGo" indicators. |
| **Acceptance criteria** | (1) `AddressFoundCard` shows source badge (small tag: "JanGo", "OSM Offline", "OSM Online", "External"). (2) Quality indicator (color-coded: green HIGH, amber MEDIUM, red LOW). (3) Verification status ("Pending" / "Verified" / "Rejected") if available. (4) `checkLocationAddress` already returns `source` and `quality` — wire them into the UI. |
| **Files to create/update** | `components/AddressFoundCard.tsx`, `components/AddressNotFoundCard.tsx`; optionally create shared `components/AddressBadge.tsx`. |
| **Dependencies** | None (data already returned by `checkLocationAddress`). |
| **Estimated effort** | Small. |

### Task 2.6 — POI map layer

| Field | Detail |
|-------|--------|
| **Description** | Render POIs on the map as markers with tier-based styling when a data pack is installed. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/map/POILayer.tsx`: Loads POIs within radius; tier-based colors and sizes (4 tiers); category icons; hover tooltip; click selection. |
| **Acceptance criteria** | (1) **Create** `components/POILayer.tsx` using MapLibre `ShapeSource` + `SymbolLayer` (or `PointAnnotation`). (2) Query POIs from `lib/db/pois.ts` (`getByPackId` or spatial query) for the visible map area. (3) Tier-based marker styling (Tier 1 largest/bold, Tier 3 small/dimmed). (4) Tap handler shows POI name, category, distance. (5) Configurable visibility (toggle on/off). (6) Render only when a data pack is installed. |
| **Files to create/update** | **Create** `components/POILayer.tsx`; integrate into main map view (`app/(tabs)/index.tsx` and/or `app/(tabs)/route-directions.tsx`). |
| **Dependencies** | POI data in DB (already done in offline parity Phase 1). |
| **Estimated effort** | Medium. |

### Task 2.7 — Address list improvements and edit integration

| Field | Detail |
|-------|--------|
| **Description** | Improve the `my-addresses.tsx` screen: add search/filter, swipe-to-edit, and delete confirmation. Wire in the Edit address modal from Task 2.4. |
| **Web reference** | `apps/core/mbukanji-maps/src/pages/AddressListPage.tsx`: Table with columns, search, sort, pagination, row actions (edit, delete, view on map). |
| **Acceptance criteria** | (1) Search/filter by street name, house number, or Plus Code. (2) Each address row has "Edit" and "Delete" actions (swipe gesture or action menu). (3) "Edit" opens EditAddressModal (Task 2.4). (4) "Delete" shows confirmation, calls `deleteAddress()`, updates sync queue. (5) Tap row to view on map or show detail. |
| **Files to create/update** | `app/my-addresses.tsx`; use `components/EditAddressModal.tsx`. |
| **Dependencies** | Task 2.4. |
| **Estimated effort** | Medium. |

---

## 4. Phase 3 — Navigation & Routing Parity

**Objective:** Add live navigation services (GPS snapping, ETA, off-route detection), transport modes, route preferences, and multi-stop waypoints.

### Task 3.1 — Port navigation match service

| Field | Detail |
|-------|--------|
| **Description** | Port web's `MatchService` to mobile: snap GPS position to nearest point on route polyline, track distance along route, calculate progress %. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/navigation/matchService.ts`: `snapToRoute(position, route)` → `MatchResult` (snappedPosition, distanceToRoute, distanceAlongRoute, remainingDistance, progress, bearing, segmentIndex). Uses perpendicular projection. |
| **Acceptance criteria** | (1) **Create** `lib/navigation/matchService.ts` with `snapToRoute(position, route)` returning `MatchResult`. (2) Perpendicular projection onto route polyline segments. (3) Calculate distanceToRoute, distanceAlongRoute, remainingDistance, progress (0–1), bearing. (4) Export types: `MatchResult`, `Coords`. |
| **Files to create/update** | **Create** `lib/navigation/matchService.ts`, `lib/navigation/types.ts`. |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

### Task 3.2 — Port navigation GPS service

| Field | Detail |
|-------|--------|
| **Description** | Port web's `GPSService` to mobile: accuracy gating (reject >100m), position smoothing (rolling average), quality classification. Adapts to use `expo-location` instead of browser geolocation. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/navigation/gpsService.ts`: `start()`, `stop()`, `getCurrentPosition()`. Accuracy threshold 100m; smoothing over 3-sample window; quality levels: excellent (<5m), good (<15m), fair (<30m), poor (>30m). |
| **Acceptance criteria** | (1) **Create** `lib/navigation/gpsService.ts` using `expo-location` for position tracking. (2) Accuracy gating: discard positions with accuracy > 100m. (3) Position smoothing: rolling 3-sample average. (4) Quality classification: excellent/good/fair/poor. (5) `start(callback)`, `stop()`, `getCurrentPosition()`, `getQuality()`. (6) Handles permission requests gracefully. |
| **Files to create/update** | **Create** `lib/navigation/gpsService.ts`. |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

### Task 3.3 — Port navigation ETA tracker

| Field | Detail |
|-------|--------|
| **Description** | Port web's `ETATracker`: rolling speed average, ETA calculation from remaining distance, confidence levels. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/navigation/etaTracker.ts`: 10-sample rolling speed; moving threshold 0.5 m/s; default fallback 30 km/h; confidence: low/medium/high; `formatETA()`. |
| **Acceptance criteria** | (1) **Create** `lib/navigation/etaTracker.ts` with `calculateETA(remainingDistance, currentSpeed?)`, `getAverageSpeed()`, `getAverageSpeedKmh()`, `formatETA(seconds)`, `reset()`. (2) Rolling 10-sample speed window. (3) Confidence levels based on sample count and speed variance. (4) Formatted ETA string ("2 min", "1 hr 15 min"). |
| **Files to create/update** | **Create** `lib/navigation/etaTracker.ts`. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### Task 3.4 — Port navigation off-route policy

| Field | Detail |
|-------|--------|
| **Description** | Port web's `OffRoutePolicy`: deviation detection with distance/time thresholds, connectivity-aware actions (reroute online, guide offline). |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/navigation/offRoutePolicy.ts`: 50m warn, 100m reroute; 5-second delay before reroute; actions: none/warn/reroute/guide/wait. |
| **Acceptance criteria** | (1) **Create** `lib/navigation/offRoutePolicy.ts` with `handleDeviation(distanceFromRoute, isOnline)` → action (none/warn/reroute/guide). (2) 50m warn threshold, 100m reroute threshold. (3) 5-second time gate to prevent spam rerouting from GPS noise. (4) When offline and off-route: `guide` action (show "Return to route" message). (5) `reset()` on new route or reroute. |
| **Files to create/update** | **Create** `lib/navigation/offRoutePolicy.ts`. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### Task 3.5 — Navigation module index and types

| Field | Detail |
|-------|--------|
| **Description** | Create the central navigation module export file and shared types. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/navigation/index.ts` and `types.ts`. |
| **Acceptance criteria** | (1) **Create** `lib/navigation/types.ts` with `Coords`, `Route`, `NavigationRoute`, `MatchResult`, `ETAResult`, `GPSPosition`, `NavigationAction`. (2) **Create** `lib/navigation/index.ts` re-exporting all services and types. |
| **Files to create/update** | **Create** `lib/navigation/types.ts`, `lib/navigation/index.ts`. |
| **Dependencies** | Tasks 3.1–3.4. |
| **Estimated effort** | Small. |

### Task 3.6 — Integrate live navigation into route directions screen

| Field | Detail |
|-------|--------|
| **Description** | Wire the navigation services into `route-directions.tsx`: GPS tracking along route, snapped position marker, ETA display, off-route warnings, progress bar. |
| **Web reference** | Web's MapPage + NavigationPanel: live GPS dot on route, ETA card, "Off route" warning, progress indicator. |
| **Acceptance criteria** | (1) When "Start navigation" pressed, start `GPSService` and `ETATracker`. (2) On each GPS update, call `matchService.snapToRoute()` and update snapped position marker on map. (3) Display ETA, remaining distance, current speed. (4) Call `offRoutePolicy.handleDeviation()` on each update; show warning when off-route. (5) Auto-advance step list based on progress. (6) "Stop navigation" stops GPS tracking. |
| **Files to create/update** | `app/(tabs)/route-directions.tsx`; create `hooks/useNavigation.ts` for state management. |
| **Dependencies** | Tasks 3.1–3.5, route directions screen (exists). |
| **Estimated effort** | Large. |

### Task 3.7 — Transport modes and route preferences

| Field | Detail |
|-------|--------|
| **Description** | Add transport mode selector (car, bike, walk) and route preference toggles (avoid highways, tolls, unpaved, etc.) to route directions screen. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/navigation/NavigationPanel.tsx`: Mode icons (car/transit/bike/walk); preference toggles: fastest/shortest, avoid U-turns/ferries/highways/tunnels/tolls/unpaved. |
| **Acceptance criteria** | (1) Transport mode selector: car (default), bike, walk. Each mode affects Valhalla costing or route preference. (2) Route preferences section (collapsible): avoid highways, avoid tolls, avoid unpaved. (3) Selected mode/preferences passed to `getRoute()` as options. (4) Valhalla uses costing model based on mode (auto/bicycle/pedestrian). (5) Non-Valhalla fallback (Dijkstra) ignores preferences (no mode support). |
| **Files to create/update** | `app/(tabs)/route-directions.tsx`; update `lib/routing/index.ts` (`getRoute` options); update Valhalla request if needed. |
| **Dependencies** | Valhalla integration (already done). |
| **Estimated effort** | Medium. |

### Task 3.8 — Multi-stop waypoints

| Field | Detail |
|-------|--------|
| **Description** | Support A → B → C multi-stop routes (origin, stops, destination) instead of just A → B. |
| **Web reference** | `NavigationPanel.tsx`: Waypoint badges A/B/C; reorder stops; each leg computed independently; total distance/duration summed. |
| **Acceptance criteria** | (1) UI: add "Add stop" button in route planning. (2) Each stop has a search input and map marker. (3) Reorder stops (drag or up/down buttons). (4) Each leg (A→B, B→C) is routed independently via `getRoute()`. (5) Combined path displayed on map; combined distance and ETA shown. (6) Step list shows all legs sequentially. (7) Remove stop button. (8) Maximum 5 stops (practical limit). |
| **Files to create/update** | `app/(tabs)/route-directions.tsx`; create route planning state logic. |
| **Dependencies** | Task 3.7 (route options). |
| **Estimated effort** | Large. |

### Task 3.9 — Online OSRM routing fallback

| Field | Detail |
|-------|--------|
| **Description** | When online and cached/Dijkstra route is unavailable or low quality, fall back to a live OSRM request for better route quality. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/routing/osrmClient.ts`: Fetches route from OSRM demo/self-hosted server. |
| **Acceptance criteria** | (1) **Create** `lib/routing/osrmClient.ts` with `fetchOSRMRoute(start, end, options?)`. (2) Uses OSRM demo server (or configurable URL). (3) Returns path, distance, duration, steps. (4) In `getRoute()`, after Valhalla fails and before Dijkstra, try OSRM if online. (5) Cache the result in route_cache for future offline use. (6) Timeout 10s; on failure, proceed to Dijkstra. |
| **Files to create/update** | **Create** `lib/routing/osrmClient.ts`; update `lib/routing/index.ts` (`getRoute` chain). |
| **Dependencies** | Network connectivity check. |
| **Estimated effort** | Medium. |

---

## 5. Phase 4 — Polish & Platform Features

**Objective:** Add tier/role gating, GPS verification, and remaining polish items.

### Task 4.1 — Tier/role mapping and feature gating

| Field | Detail |
|-------|--------|
| **Description** | Port web's `tierRoleMapping.ts` so subscription tiers control which features are available (e.g. freemium = basic_user only, business = advanced_agent/org_admin). |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/tierRoleMapping.ts`: `TIER_ROLE_CONSTRAINTS`, `isPlatformRole()`, `getRolesForTier()`, `canAssignRole()`, `validateRoleAssignment()`. |
| **Acceptance criteria** | (1) **Create** `lib/tierRoleMapping.ts` with same API as web. (2) Auth context or user store includes subscription tier. (3) Feature gating hook `useFeatureGate(feature)` returns boolean based on tier. (4) Gated features: advanced search, POI layer, multi-stop routing, etc. (chosen by product). (5) Graceful degradation: show "Upgrade" prompt when gated feature accessed. |
| **Files to create/update** | **Create** `lib/tierRoleMapping.ts`, **create** `hooks/useFeatureGate.ts`; update relevant screens. |
| **Dependencies** | Auth context (exists). |
| **Estimated effort** | Medium. |

### Task 4.2 — GPS verification dialog

| Field | Detail |
|-------|--------|
| **Description** | Before address creation, verify GPS accuracy meets threshold and show dialog if poor quality. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/location/GpsVerificationModal.tsx`: Shows GPS accuracy, quality badge, "Accuracy is poor" warning, wait or proceed options. |
| **Acceptance criteria** | (1) **Create** `components/GpsVerificationModal.tsx`. (2) Shows current GPS accuracy (meters), quality badge (excellent/good/fair/poor). (3) If poor (>30m): warning message, "Wait for better signal" vs "Proceed anyway" buttons. (4) If excellent/good: auto-proceed after 1s. (5) Called before address creation (from `app/(tabs)/index.tsx` or `new-create-address.tsx`). |
| **Files to create/update** | **Create** `components/GpsVerificationModal.tsx`; wire into address creation flow. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### Task 4.3 — Trusted geolocation / spoofing detection

| Field | Detail |
|-------|--------|
| **Description** | Port basic GPS trust scoring to detect mock/spoofed locations on mobile. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/trustedGeolocation.ts`: Trust scoring based on accuracy consistency, speed plausibility, altitude checks. |
| **Acceptance criteria** | (1) **Create** `lib/trustedGeolocation.ts` with `calculateTrustScore(positions[])`. (2) Checks: accuracy consistency across samples, speed plausibility (not teleporting), altitude present. (3) Returns trust level: trusted/suspicious/untrusted. (4) On `suspicious` or `untrusted`: log warning; optionally flag address with low trust. (5) expo-location provides `mocked` field on Android — use it. |
| **Files to create/update** | **Create** `lib/trustedGeolocation.ts`; integrate with address creation flow. |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

---

## 6. Dependency Graph

```
Phase 1: 1.1, 1.2, 1.5 (independent)
          1.3 → 1.4

Phase 2: 2.1 → 2.3 (dual address needs editor)
          2.1 → 2.2
          2.4 → 2.7 (edit modal → address list)
          2.5, 2.6 (independent)

Phase 3: 3.1, 3.2, 3.3, 3.4 (independent navigation services)
          3.1–3.4 → 3.5 → 3.6
          3.7 → 3.8
          3.9 (independent)

Phase 4: 4.1, 4.2, 4.3 (independent)
```

---

## 7. Priority Order (recommended implementation sequence)

### Sprint 1 — Critical (blocks core functionality)
1. **Task 1.3** — Offline search query engine (without this, offline search is broken)
2. **Task 1.4** — Wire offline search into useSearch
3. **Task 1.1** — Compound address suffix
4. **Task 1.5** — Country dropdown in OfflineDataManager

### Sprint 2 — Address creation parity
5. **Task 2.1** — Street name editor
6. **Task 2.2** — Street name badge
7. **Task 2.3** — Dual address creation
8. **Task 2.5** — Address info enrichment (source + quality)
9. **Task 1.2** — Subdivision lookup

### Sprint 3 — Address management
10. **Task 2.4** — Edit address modal
11. **Task 2.7** — Address list improvements
12. **Task 2.6** — POI map layer

### Sprint 4 — Navigation services
13. **Task 3.1** — Match service
14. **Task 3.2** — GPS service
15. **Task 3.3** — ETA tracker
16. **Task 3.4** — Off-route policy
17. **Task 3.5** — Navigation module index
18. **Task 3.6** — Integrate live navigation

### Sprint 5 — Routing enhancements
19. **Task 3.7** — Transport modes and preferences
20. **Task 3.8** — Multi-stop waypoints
21. **Task 3.9** — Online OSRM fallback

### Sprint 6 — Platform polish
22. **Task 4.1** — Tier/role gating
23. **Task 4.2** — GPS verification dialog
24. **Task 4.3** — Trusted geolocation

---

## 8. Effort Summary

| Phase | Tasks | Small | Medium | Large | Total |
|-------|-------|-------|--------|-------|-------|
| 1 — Core logic & search | 5 | 2 | 1 | 1 | ~2 weeks |
| 2 — Address creation & display | 7 | 2 | 4 | 0 | ~3 weeks |
| 3 — Navigation & routing | 9 | 2 | 4 | 2 | ~4 weeks |
| 4 — Polish & platform | 3 | 1 | 2 | 0 | ~1.5 weeks |
| **Total** | **24** | **7** | **11** | **3** | **~10.5 weeks** |

---

## 9. Out of Scope (Explicit)

- **Location Plan:** Corridor building, saved location plans, PDF export, CreateLocationPlanPage, LocationPlanInfoPanel, PreviewLocationPlanPage. Not implemented on mobile.
- **Admin panel:** PlatformUserManager, OrgUserManager, EditUserModal, AddUserModal. Web-only management UI.
- **Subscription management UI:** SubscriptionPlanManager, PlanSelector. Web-only billing/plan UI.
- **Dev mode dashboard:** DevModeDashboard, DevModeToggle. Web development convenience, not needed on mobile.
- **Map capture/sharing:** `mapCapture.ts`. Low priority; can be added later if needed.

---

## 10. Reference File Map (Web → Mobile)

| Web (mbukanji-maps) | Mobile (address-maker-glopams) | Status |
|---------------------|------------------------------|--------|
| `src/lib/compoundAddress.ts` | `lib/compoundAddress.ts` | **To create** |
| `src/lib/subdivisions.ts` + JSON | `lib/subdivisions.ts` + JSON | **To create** |
| `src/lib/search/searchQuery.ts` | `lib/search/searchQuery.ts` | **To create** |
| `src/lib/navigation/matchService.ts` | `lib/navigation/matchService.ts` | **To create** |
| `src/lib/navigation/gpsService.ts` | `lib/navigation/gpsService.ts` | **To create** |
| `src/lib/navigation/etaTracker.ts` | `lib/navigation/etaTracker.ts` | **To create** |
| `src/lib/navigation/offRoutePolicy.ts` | `lib/navigation/offRoutePolicy.ts` | **To create** |
| `src/lib/navigation/types.ts` | `lib/navigation/types.ts` | **To create** |
| `src/lib/navigation/index.ts` | `lib/navigation/index.ts` | **To create** |
| `src/lib/routing/osrmClient.ts` | `lib/routing/osrmClient.ts` | **To create** |
| `src/lib/tierRoleMapping.ts` | `lib/tierRoleMapping.ts` | **To create** |
| `src/lib/trustedGeolocation.ts` | `lib/trustedGeolocation.ts` | **To create** |
| `components/address/StreetNameEditor.tsx` | `components/StreetNameEditor.tsx` | **To create** |
| `components/address/StreetNameBadge.tsx` | `components/StreetNameBadge.tsx` | **To create** |
| `components/address/EditAddressModal.tsx` | `components/EditAddressModal.tsx` | **To create** |
| `components/map/POILayer.tsx` | `components/POILayer.tsx` | **To create** |
| `components/location/GpsVerificationModal.tsx` | `components/GpsVerificationModal.tsx` | **To create** |
| `map/OfflineDataManager.tsx` (country dropdown) | `OfflineDataManager/index.tsx` | **To update** |
| `pages/CreateAddressPage.tsx` (dual creation) | `app/new-create-address.tsx` | **To update** |
| `hooks/useSearch.ts` (offline query) | `hooks/useSearch.ts` | **To update** |
| `app/(tabs)/route-directions.tsx` (nav services) | `app/(tabs)/route-directions.tsx` | **To update** |
| `app/my-addresses.tsx` (edit/search/filter) | `app/my-addresses.tsx` | **To update** |

This plan can be used as a task list: each task is a single unit of work with clear acceptance criteria and file targets. Implement in phase order, respecting the dependency graph (§6) and suggested priority (§7).
