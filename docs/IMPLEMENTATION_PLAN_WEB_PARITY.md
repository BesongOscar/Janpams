# Implementation Plan: Web Parity (Auto-Numbering & Marching Ants)

This plan closes the gaps between mobile and web for street auto-numbering, resolve flow, and marching ants. All items are required to match web.

---

## Dependency order

1. **Task 6** (GeoJSON coordinate order) – Fix first so the active street line and any new markers use correct coordinates.
2. **Task 2** (useAccessRealityAlgorithm + legacy path) – No UI dependency; can run in parallel with 4/5.
3. **Task 1** (Recalc on street change) – Small fix in `handlePickStreet` (set originalApiStreetName when picking).
4. **Tasks 4 & 5** (Start/end markers + lock badge) – Depend on Task 6 for correct positions; add after 6.
5. **Task 7** (Form only from resolve) – Verify and tighten; no new UI.
6. **Task 8** (streetKey + autoLock) – Verify already done.
7. **Task 3** (Allocate on create) – Web does not call allocate on create; verify mobile matches (no change).
8. **Tasks 9 & 10** (Docs + parity checklist) – After code changes.

---

## Task 1: Recalc house number when user changes street

**Goal:** When the user picks a different street from "Pick a Street", form and store reflect the new street and recalculated house number (web parity).

**Current state:** `handlePickStreet` already calls `calculateHouseNumberSync`, updates store and form (street, houseNumber, geometry, etc.).

**Actions:**
- In `handlePickStreet`, set `originalApiStreetName` to `selected.name` (and keep `originalApiNeighborhood` unchanged) so dual-address "user edited" detection is correct after a pick.
- Ensure `calculatedAddress` (and any chainage/side used by submit) is from the same recalc; already the case.

**Files:** `app/new-create-address.tsx`

---

## Task 2: useAccessRealityAlgorithm + legacy resolve path

**Goal:** `resolveStreetAddress` accepts a fourth parameter `useAccessRealityAlgorithm`. When false, use legacy path (findClosestStreets); when true, use selectStreets (current behavior).

**Actions:**
- In `lib/offlineDataPacks.ts`: Add `useAccessRealityAlgorithm: boolean = true` to `resolveStreetAddress`. If `true`, keep current body (detectContext + selectStreets). If `false`, add legacy branch: call `findClosestStreets`, build `nearbyStreets` and `activeStreet` (with `findConnectedStreetSegments` + `mergeSegmentGeometries`), build `streetForCalc` with geometry [lat,lon], call `calculateHouseNumberSync`, set result.houseNumber, chainage, side, streetKey, etc., mirroring web’s legacy block.
- Add `determineSide` usage in legacy path (import from `streetSelection` or implement inline to match web).
- Ensure `getStreetDisplayName` is used for names in legacy path.
- Expose the flag to callers: add a dev/settings store or pass from route/settings; default to `true` so behavior is unchanged until toggle exists.
- Update all call sites of `resolveStreetAddress` to pass the flag (e.g. from a store or default true).

**Files:** `lib/offlineDataPacks.ts`, optionally a small dev/settings store or route param, `app/new-create-address.tsx` (and any other callers).

---

## Task 3: Allocate + reserve on create

**Goal:** Match web: web CreateAddressPage does not call `allocateHouseNumberAsync` or `reserveHouseNumber` on submit; it uses the house number from the resolve result.

**Actions:**
- Verify mobile does the same: submit uses house number from resolve / store (e.g. `calculatedAddress` or form state derived from it). No new call to `allocateHouseNumberAsync` on create.
- Document in alignment doc.

**Files:** None (verification + doc).

---

## Task 4: Green start / red end markers on active street

**Goal:** On the new-create-address map (and any other screen that shows the active street), show a green marker at the first point of the resolved geometry and a red marker at the last point.

**Actions:**
- Use `resolvedStreetGeometry.start` and `resolvedStreetGeometry.end`. Note: in mobile, `ResolvedStreetGeometry` uses [lat, lon]; MapLibre markers need coordinate objects { latitude, longitude }.
- Add two markers (e.g. MapLibre Marker or PointAnnotation) inside the same MapView as the active street line: one at start (green), one at end (red). Use colors from `lib/streetColors.ts` (START_MARKER_COLOR, END_MARKER_COLOR).
- Only render when `activeStreetShape` (or resolved geometry) is present.

**Files:** `app/new-create-address.tsx`, `lib/streetColors.ts` (if not already used).

---

## Task 5: Lock status badge on map

**Goal:** When street direction is locked, show a badge (e.g. "LOCKED" or "LOCKED ↻") along the active street line (~40% from start), driven by `activeStreetDirectionLock`.

**Actions:**
- Read `activeStreetDirectionLock` from store; compute a point ~40% along the resolved geometry (in lat/lon).
- Add a marker or custom view at that point showing the lock badge (text + optional icon). Use LOCK_INDICATOR_COLOR from streetColors.
- Only show when direction is locked.

**Files:** `app/new-create-address.tsx`, `lib/streetColors.ts`.

---

## Task 6: GeoJSON [lon, lat] for map geometry

**Goal:** The active street LineString and any geometry passed to MapLibre are in GeoJSON order [lon, lat]. Internal calculation keeps [lat, lon].

**Actions:**
- In `new-create-address.tsx`, when building `activeStreetShape` from `activeStreetGeometry`, convert coordinates: `coordinates: activeStreetGeometry.map(([lat, lon]) => [lon, lat])` (if current store geometry is [lat, lon]). If the store already provides [lon, lat], document and leave as is.
- Confirm `resolvedStreetGeometry.geometry` from `streetGeometry.ts` is [lat, lon] (Street convention); conversion to [lon, lat] happens only at map render.

**Files:** `app/new-create-address.tsx`.

---

## Task 7: Form only from resolveStreetAddress / store

**Goal:** The create form is filled only from the result of `resolveStreetAddress` at page coordinates (and/or the store updated from that result). No overwriting from API-only or other sources.

**Actions:**
- Audit the new-create-address flow: initial fill from resolve result in useEffect; fallback from getAddressComponents only when resolve fails; no other path that overwrites street/house number/chainage from API.
- Ensure when opening from map, params or store provide the same data as resolve (or we run resolve on the create screen at page coords). Already run resolve at page coords; verify no duplicate or conflicting fill from check response.

**Files:** `app/new-create-address.tsx`.

---

## Task 8: streetKey + autoLockOnFirstAddress after create

**Goal:** Use the same streetKey source as web and call `autoLockOnFirstAddress(streetKey)` after `SyncManager.createAddress`.

**Actions:**
- Verify streetKey is taken from resolve/store (e.g. `streetKeyFromGeocode` or `activeStreetDirectionLock?.streetKey` or from result.streetKey).
- Verify `autoLockOnFirstAddress(streetKey)` is called after create (already in place); confirm order and params match web.

**Files:** `app/new-create-address.tsx`.

---

## Task 9: Update WEB_TO_MOBILE_ALIGNMENT.md

**Goal:** Alignment doc states that mobile matches web for: resolve (both algorithm paths), recalc on street change, marching ants (line + start/end + lock badge), coordinate order, form-from-resolve, and autoLock after create.

**Actions:**
- Update the alignment doc to mark each gap as implemented.
- Remove or correct "optional" or "partial" wording for these items.

**Files:** `docs/WEB_TO_MOBILE_ALIGNMENT.md`.

---

## Task 10: Add parity checklist

**Goal:** A short checklist for sign-off: resolve (access-reality + legacy), recalc on street change, allocate/match on create, marching ants (line + start + end + lock badge), coordinate order, form-from-resolve, autoLock.

**Actions:**
- Add a "Web parity checklist" section (in the alignment doc or a separate PARITY_CHECKLIST.md) listing each item and how to verify.

**Files:** `docs/WEB_TO_MOBILE_ALIGNMENT.md` or `docs/PARITY_CHECKLIST.md`.

---

## Implementation order (recommended)

1. Task 6 – Coordinate order for map.
2. Task 2 – Legacy path in resolveStreetAddress + flag.
3. Task 1 – originalApiStreetName in handlePickStreet.
4. Task 4 – Start/end markers.
5. Task 5 – Lock badge.
6. Task 7 – Audit form source.
7. Task 8 – Verify streetKey and autoLock.
8. Task 3 – Verify no allocate on create.
9. Task 9 – Update alignment doc.
10. Task 10 – Add parity checklist.
