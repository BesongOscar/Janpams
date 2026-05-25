# Implementation Plan: Complete Addressing & Street Selection (100% Offline First)

This plan implements **every feature** from the **Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide**, with **no feature left out** and **100% offline-first** guarantee.

---

## Decisions (confirmed)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Spec documents** | Use **both**: the single implementation guide and `docs/src` web reference code. |
| 2 | **Cloud data packs** | **Yes**: offline first allows **one-time data pack download** from cloud; after download all core flows work offline. |
| 3 | **Debug UI** | **No**: StreetSelectionDebugOverlay, StreetSelectionDebugPanel, devModeStore are **not** needed for mobile. |
| 4 | **Authority override** | **No**: Direction override is **not** in scope for v1; street direction **must remain locked once locked** (no DirectionOverrideModal). |
| 5 | **Map library** | **MapLibre** for all new map components now. **Valhalla mobile** may be used for routing later (out of scope for this plan). |
| 6 | **Types** | **Port from web**: port types from `docs/src` (web) into app `lib/`; no shared `packages/types` in app. |
| 7 | **Offline-first rules** | **Yes**: no core flow may require network after setup (or after pack download); graceful degradation when no pack. |
| 8 | **Feature checklist** | **Yes**: all 32 items from the guide have a phase; out-of-scope items explicitly marked. |
| 9 | **9 phases** | **Yes**: implement in the dependency order defined below. |

---

## Offline-First Principles (applied to every feature)

- **No feature** may **require** network after initial setup (or after data pack download, if cloud download is allowed).
- **Geocoding, reverse geocoding, street selection, house number calculation, direction lock, address check, and address CRUD** must all work with **local SQLite + local data packs** only when packs are present.
- **UI** must degrade gracefully when no data pack is present (e.g. “No street data for this region” instead of silent failure).
- **Sync** (e.g. direction locks, created addresses) may queue for later and must not block core flows.

---

## Feature Checklist (from the guide – none left out)

| # | Category | Feature / File | Status in plan |
|---|----------|----------------|----------------|
| 1 | Core | `createLocationAddress.ts` – full pipeline | Phase 1 |
| 2 | Core | `streetSelection.ts` – selectStreets, access-reality, urban/rural | Phase 2 |
| 3 | Core | `streetDirectionService.ts` – getMergeAnchorFromLock | Phase 1 |
| 4 | Core | `streetGeometry.ts` – resolveStreetGeometry (done) | Phase 1 verify |
| 5 | Core | `streetValidation.ts` (done) | Phase 1 verify |
| 6 | Core | `pluscode.ts` – encode, decode, isSameGridCell | Phase 1 verify |
| 7 | Core | `addressFormat.ts` (done) | Phase 1 verify |
| 8 | Core | `addressServices.ts` – save/load address | Phase 8 |
| 9 | Core | `checkLocationAddress.ts` (done + addressLines) | Phase 1 verify |
| 10 | Geocoding | `reverseGeocode.ts` – offlineReverseGeocode | Phase 1 verify |
| 11 | Geocoding | `getAddressComponents.ts` | Phase 1 verify |
| 12 | Geocoding | `adminResolver.ts` | Phase 7 |
| 13 | Geocoding | `settlementResolver.ts` | Phase 7 |
| 14 | Geocoding | `normalization.ts` | Phase 7 |
| 15 | Offline data | `offlineDataPacks.ts` – findConnectedStreetSegments, mergeSegmentGeometries | Phase 3 |
| 16 | Offline data | Data pack download (offline-first: local/sync only or cloud download once) | Phase 7 |
| 17 | Offline data | `db` – SQLite schema (street_segments, street_direction_locks, admin_boundaries, settlement_places) | Phase 1 verify + Phase 7 |
| 18 | Map | `ActiveStreetLayer.tsx` – marching ants, start/end, lock badge | Phase 5 |
| 19 | Map | `NearbyStreetsLayer.tsx` – alternate/corner streets | Phase 5 |
| 20 | Map | `SearchHighlightLayer.tsx` – street search highlight | Phase 5 |
| 21 | Map | `StreetSelectionDebugOverlay.tsx` | **Out of scope** (no debug UI on mobile) |
| 22 | Map | `StreetSelectionDebugPanel.tsx` | **Out of scope** (no debug UI on mobile) |
| 23 | Map | `GPSLocationLayer.tsx` | Phase 5 |
| 24 | Map | `NeighborBoxesLayer.tsx` – Plus Code neighbor boxes | Phase 5 |
| 25 | Street UI | `DirectionOverrideModal.tsx` | **Out of scope** (lock remains once locked; no override in v1) |
| 26 | Street UI | `StreetDirectionInfo.tsx` | Phase 6 |
| 27 | State | `mapStore` / address store (Zustand) – activeStreet, resolvedGeometry, directionLock, nearbyStreets | Phase 4 |
| 28 | State | `devModeStore` | **Out of scope** (no debug UI on mobile) |
| 29 | Hooks | `useActiveStreet.ts` – geometry + direction lock | Phase 4 |
| 30 | Hooks | `useAddresses.ts`, `useAddressModeEntry.ts` (as needed by app) | Phase 8 |
| 31 | Types | Core address/street/lock types – **port from web** (`docs/src`) into `lib/` | Phase 1 |
| 32 | Spec links | Code references to implementation guide + spec docs | Phase 9 |

---

## Phased Implementation Plan

### Phase 1: Core logic & data (verify and complete) — offline first

**Goal:** All core addressing and direction logic works 100% offline; no feature regressions.

- 1.1 **createLocationAddress.ts**  
  - Confirm full pipeline: centroid → orientation → adaptive projection → chainage → side → house number.  
  - Confirm use of `resolveStreetGeometry(street, directionLock)` everywhere geometry is used.  
  - Ensure `allocateHouseNumberAsync` and all callers pass `directionLock` when available.

- 1.2 **streetDirectionService.ts**  
  - Add `getMergeAnchorFromLock(streetKey)` (or equivalent) if required by merge logic in Phase 3.  
  - Ensure all APIs use SQLite only (no network).

- 1.3 **streetGeometry.ts**  
  - No behavior change; confirm it remains the single source of truth for resolved geometry.

- 1.4 **pluscode.ts**  
  - Verify `encode`, `decode`, `isSameGridCell` exist and match guide; add any missing helpers.

- 1.5 **addressFormat.ts / streetValidation.ts / checkLocationAddress.ts**  
  - Already implemented; verify parity with guide and that they are used in all relevant flows (offline only).

- 1.6 **SQLite schema**  
  - Verify tables: `street_segments`, `street_direction_locks`, `admin_boundaries`, `settlement_places` (and any other from guide).  
  - Add migrations for any missing columns or indexes (e.g. bbox, spatial indexes).

- 1.7 **Offline reverse geocoding & getAddressComponents**  
  - Ensure `offlineReverseGeocode` and `getAddressComponentsSync` are the default path; no dependency on online APIs for core flows.

**Deliverables:** Core calculation and direction lock fully offline; schema and types aligned with guide.

---

### Phase 2: Street selection (access-reality, urban/rural, alternates) — offline first

**Goal:** Replace distance-only selection with the guide’s algorithm: urban/rural radius, access-reality filter, scoring, and alternate streets.

- 2.1 **Port `streetSelection.ts`**  
  - Implement (or port from `docs/src/lib/streetSelection.ts`):  
    - `selectStreets()` with config (urbanRadius: 60, ruralRadius: 100, context: urban | rural).  
    - `findInterveningStreets()` (access-reality: reject streets with intervening obstacles).  
    - `findStreetIntersection()` for corner alternates.  
    - `calculateDistanceScore()`, `calculateEnclosureScore()` (and any other scoring in the guide).  
  - All data from SQLite + in-memory geometry; no network.

- 2.2 **Integrate with `resolveStreetAddress` / offlineDataPacks**  
  - Replace or wrap `findClosestStreets` with `selectStreets()` (or equivalent) so that:  
    - Active street is chosen by access-reality + score.  
    - Nearby/alternate streets list is populated for re-selection and UI.  
  - Use `urbanRadius` / `ruralRadius` from config; context (urban vs rural) can be from admin boundary or a simple heuristic if needed.

- 2.3 **Rejection reasons and debugging**  
  - Expose rejection reason (e.g. INTERVENING_STREET, TOO_FAR) for debugging and optional UI.  
  - Ensure house number calculation and direction lock still receive one “active” street and optional “nearby” list.

**Deliverables:** Street selection matches guide algorithm; 100% offline using local DB and segments.

---

### Phase 3: Connected segments & merged geometry — offline first

**Goal:** Streets that are split into multiple segments in the DB are merged into one geometry for chainage and display.

- 3.1 **findConnectedStreetSegments**  
  - Implement in `lib/offlineDataPacks.ts` (port from `docs/src/lib/offlineDataPacks.ts`):  
    - Input: one `StreetSegment`.  
    - Output: array of segments that form a continuous street (same name/ref or same type for unnamed).  
    - Use endpoint proximity (e.g. `arePointsConnected`) and SQLite/local segment list only.

- 3.2 **mergeSegmentGeometries**  
  - Implement in `lib/offlineDataPacks.ts`:  
    - Input: array of connected segments + optional `MergeGeometryOptions` (anchorPoint, shouldReverseAfterMerge).  
    - Output: single ordered linestring `[number, number][]`.  
    - Use direction lock anchor (e.g. `getMergeAnchorFromLock`) when available for deterministic order.

- 3.3 **Use merged geometry in selection and calculation**  
  - In street selection: when an active candidate is chosen, call `findConnectedStreetSegments` and then `mergeSegmentGeometries` (with lock anchor if present).  
  - Pass the merged geometry into `resolveStreetGeometry` / `getResolvedGeometry` and thence into house number calculation.  
  - Ensure `resolveStreetAddress` (or the path that provides “active street” to the app) uses merged geometry where applicable.

**Deliverables:** Multi-segment streets yield one merged geometry; chainage and numbering use that geometry; all from local DB.

---

### Phase 4: State management (Zustand store + useActiveStreet) — offline first

**Goal:** Global map/address state and a single hook for “active street” with geometry and direction lock.

- 4.1 **Address/Map store (Zustand)**  
  - Add store (e.g. `lib/store/addressStore.ts` or `mapStore.ts`) with:  
    - `userLocation`, `activeLocation` (lat/lon).  
    - `activeStreet` (id, name, geometry, distance, side).  
    - `resolvedStreetGeometry` (from `resolveStreetGeometry`).  
    - `activeStreetDirectionLock`.  
    - `nearbyStreets`, `streetSelectionDebug` (if debug is in scope).  
    - `calculatedAddress` (house number, street, side, chainage, etc.).  
  - Actions: setUserLocation, setActiveLocation, setActiveStreet, setResolvedGeometry, setDirectionLock, setNearbyStreets, setCalculatedAddress, reset.  
  - No network in store; all data from local modules.

- 4.2 **useActiveStreet hook**  
  - Implement `hooks/useActiveStreet.ts`:  
    - Inputs: location (lat/lon), optional config (e.g. urban/rural).  
    - Calls street selection (Phase 2) then direction lock + geometry resolution (Phase 1/3).  
    - Returns: activeStreet, resolvedGeometry, directionLock, nearbyStreets, calculatedAddress (and optionally rejection/debug info).  
  - Hook must work entirely offline (SQLite + in-memory).

- 4.3 **Wire screens to store + hook**  
  - Map tab and new-create-address (and any other address-creation flow) use `useActiveStreet` and the store instead of ad-hoc state where appropriate.  
  - Ensure “create address” and “address not found” flows still get street + neighborhood from offline geocode and selection.

**Deliverables:** One source of truth for active street and calculated address; all state derivable offline.

---

### Phase 5: Map visualization components — offline first

**Goal:** All map layers from the guide implemented with MapLibre; data from store/local only.

- 5.1 **ActiveStreetLayer**  
  - Component: active street line (marching ants), start/end markers, lock status badge.  
  - Data: from store (`resolvedStreetGeometry` or `activeStreet`).  
  - Styling: match guide (e.g. line width, dash, color).  
  - No network.

- 5.2 **NearbyStreetsLayer**  
  - Component: draw alternate/corner streets (e.g. different color/weight).  
  - Data: `nearbyStreets` from store.  
  - Offline only.

- 5.3 **SearchHighlightLayer**  
  - Component: highlight street(s) from search.  
  - Data: search results from local search (e.g. street_segments by name).  
  - Search must be offline (SQLite / in-memory).

- 5.4 **GPSLocationLayer**  
  - Component: GPS marker (and optional accuracy circle).  
  - Data: `userLocation` or `activeLocation` from store.  
  - Offline-only data source.

- 5.5 **NeighborBoxesLayer**  
  - Component: Plus Code grid neighbor boxes (e.g. adjacent G-squares).  
  - Data: computed from current plus code + decode.  
  - No network.

- 5.6 **Integration**  
  - Compose these layers in the existing MapLibre map (e.g. in the map tab and/or new-create-address).  
  - Ensure layers are driven only by store/hook (no direct API calls).

**Deliverables:** All guide map components present and working from local state; 100% offline.

---

### Phase 6: Street direction UI components — offline first

**Goal:** User can see lock status. No authority override in v1 (lock remains once locked).

- 6.1 **StreetDirectionInfo**  
  - Component: show current direction lock status (unlocked / locked, as_is / reversed).  
  - Data: from store (`activeStreetDirectionLock`) or from `getDirectionLock(streetKey)` (SQLite).  
  - No network. No DirectionOverrideModal (out of scope for mobile v1).

**Deliverables:** Lock status visible; no override UI.

---

### Phase 7: Geocoding & offline data completeness — offline first

**Goal:** Admin and settlement resolution, normalization, and data pack handling so that all address components and street data come from local sources when available.

- 7.1 **adminResolver.ts**  
  - Resolve city/region (and optionally country) from admin_boundaries (SQLite) by point-in-polygon or bbox.  
  - Used by reverse geocode and getAddressComponents when building address.  
  - Offline only.

- 7.2 **settlementResolver.ts**  
  - Resolve neighborhood/suburb from settlement_places (SQLite) by distance or containment.  
  - Feed into getAddressComponents.  
  - Offline only.

- 7.3 **normalization.ts**  
  - Address text normalization (trim, case, accents if needed).  
  - Used by geocoding and address format; no network.

- 7.4 **Data pack download / cloud**  
  - Per decisions: one-time data pack download from cloud is allowed. Implement or align cloudDataPacks (or downloader) so that:
    - Packs are downloaded when online and stored locally.  
    - All addressing features use only local storage after that.  
  - No core flow may require network after pack download; graceful degradation when no pack.

- 7.5 **Schema**  
  - Ensure `admin_boundaries`, `settlement_places` (and any POI tables if used) exist and are populated by pack ingestion.  
  - Indexes for bbox/point lookups.

**Deliverables:** Full address resolution (street, neighborhood, city, region, country) from local DB; data pack story clear and offline-first.

---

### Phase 8: Address services & hooks — offline first

**Goal:** Address CRUD and address-mode entry aligned with guide; all operations local-first.

- 8.1 **addressServices.ts**  
  - Align with guide: create/read/update/delete address using local DB (and optional sync queue).  
  - Save flow must call `autoLockOnFirstAddress` and store address with correct street key and components.  
  - No reliance on server for core create/read.

- 8.2 **useAddresses.ts / useAddressModeEntry.ts**  
  - Implement or adapt so that:  
    - Address list and “address at location” come from local DB + checkLocationAddress.  
    - Entry point (e.g. “create address” from map) uses active street and calculated address from store/hook.  
  - All data from local modules and store.

**Deliverables:** Address save/load and entry flows fully offline-capable and aligned with guide.

---

### Phase 9: Spec/documentation links — no runtime impact

**Goal:** Traceability from code to spec where documents exist.

- 9.1 **Code comments / README**  
  - In core modules (createLocationAddress, streetSelection, streetDirectionService, streetGeometry), add short comments or a small “Spec reference” section pointing to:  
    - Implementation guide section.  
    - Spec documents (use both guide and docs/src per decisions).  
  - No new runtime behavior; offline-first unchanged.

**Deliverables:** Easier navigation from code to spec for future maintainers.

---

## Dependency order (summary)

- **Phase 1** must be done first (core + schema + offline geocode).  
- **Phase 2** (street selection) can start after 1; it will later use **Phase 3** (merged geometry) for multi-segment streets.  
- **Phase 3** (connected segments + merge) depends on 1 (direction lock, geometry resolution) and feeds into 2 and 4.  
- **Phase 4** (store + useActiveStreet) should use 1, 2, and 3 so that “active street” is the full pipeline.  
- **Phase 5** (map layers) and **Phase 6** (direction UI) depend on 4 (store) and 1 (lock/geometry).  
- **Phase 7** (geocoding + data packs) can run in parallel with 2–4 once 1 and schema are stable.  
- **Phase 8** (address services) depends on 1 and 4; can be done after 4.  
- **Phase 9** can be done at any time.

---

## Success criteria (100% offline first)

- [ ] With a region data pack loaded locally, the app can:  
  - Reverse geocode, resolve street (with access-reality selection), resolve merged geometry, apply direction lock, compute house number, and show address components **without network**.
- [ ] Direction lock is read/written only from/to SQLite; no server call required.
- [ ] Address create/read and checkLocationAddress work from local DB and local geocode only.
- [ ] All map layers and street UI components get data only from store/local modules.
- [ ] If no pack is present, the app shows a clear “No data for this region” (or similar) and does not call external APIs for core flows.

---

## Next steps

1. **Implement:** Execute phases in the order above (decisions confirmed; debug UI and authority override out of scope for mobile v1).  
2. **Test:** After each phase, run through the “Success criteria” checklist and fix any regression or online dependency.

Implementation can proceed phase by phase with no in-scope feature from the guide left out and with 100% offline first guaranteed for all of them.
