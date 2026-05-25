# Web → Mobile Alignment: Address Creation, Street Detection, Auto-Numbering, Marching Ants

This document identifies **exactly what the web does** for address creation, street detection, auto-numbering, and marching ants, and how the mobile app aligns (or should align) with it.

---

## 1. Street detection (web)

| What | Web (docs/src) | Mobile (app) |
|------|-----------------|--------------|
| **Entry** | User goes to Create Address page with `?lat=&lon=` or Map → tap → check location | Map tab → grid on → tap cell → check location |
| **Street resolution** | `resolveStreetAddress(lat, lon, 60, useAccessRealityAlgorithm)` in CreateAddressPage (useEffect on lat/lon) and in MapView when handling map selection | `resolveStreetAddress(lat, lon, 60)` in map tab when `hasOfflinePacks` (offline-first branch) and in useEffect when `addressNotFound` |
| **Street selection** | `selectStreets()` inside `resolveStreetAddress` (access-reality, urban/rural radius, scoring) | Same: `lib/streetSelection.ts` → `selectStreets()` used by `lib/offlineDataPacks.ts` → `resolveStreetAddress` |
| **Merged geometry** | `findConnectedStreetSegments` + `mergeSegmentGeometries` in offlineDataPacks; `useActiveStreet` can call `mergeStreetGeometry` for alternate street | Same: `lib/offlineDataPacks.ts` has `findConnectedStreetSegments`, `mergeSegmentGeometries`; used in `resolveStreetAddress` and in `useActiveStreet` when updating from location |
| **Store** | `mapStore`: `activeStreetData`, `resolvedStreetGeometry`, `activeStreetDirectionLock`, `nearbyStreets` set from resolve result | Same: `lib/store/mapStore.ts`; `syncMapStoreFromResolveResult` in `hooks/useActiveStreet.ts` |
| **Direction lock** | `getDirectionLock(streetKey)` in resolveStreetAddress; lock comes from SQLite (web: IndexedDB) | Same: `lib/streetDirectionService.ts` → `getDirectionLock`; SQLite `street_direction_locks` |

**Alignment:** ✅ Street detection and selection logic are ported and used when `hasOfflinePacks` is true. When packs are not installed, the map tab still uses the API for the found/not-found decision; offline path runs only as enrichment for “address not found.”

---

## 2. Auto-numbering (web)

| What | Web (docs/src) | Mobile (app) |
|------|-----------------|--------------|
| **House number source** | `resolveStreetAddress` returns `houseNumber`, `chainage`, `street.side` from `calculateHouseNumberSync` (createLocationAddress) using Plus Code centroid, chainage, side | Same: `lib/offlineDataPacks.ts` → `calculateHouseNumberSync(lat, lon, streetForCalc, { directionLock, nearbyStreets })`; same formula (ordinal × 2 + parity) |
| **Formula** | Plus Code ordinal = floor(chainage / 14m); houseNumber = ordinal × 2 + (1 if L else 2) | Same in `lib/createLocationAddress.ts` (PLUS_CODE_GRID_SIZE, determineSideOfStreet, etc.) |
| **Allocation (create time)** | Web CreateAddressPage uses `addressData?.houseNumber` from resolve result; no separate `allocateHouseNumberAsync` call on create (number already from resolve). allocateHouseNumber is used elsewhere for “allocate only” flows | Mobile: resolveStreetAddress already returns houseNumber. For create we use that number. `allocateHouseNumber` / `allocateHouseNumberAsync` in addressServices used if we need to allocate with duplicate check (e.g. reserve); new-create-address currently builds from API/check result |
| **Direction lock for geometry** | `resolveStreetGeometry(street, directionLock)` so numbering direction matches lock | Same: `lib/streetGeometry.ts`; direction lock applied in createLocationAddress via getDirectionLock |

**Alignment:** ✅ Auto-numbering formula and use of direction lock are the same. Mobile should use the house number (and side, chainage) from the **offline** resolve result when creating an address from the map (from store or from resolveStreetAddress result), not from the API.

---

## 3. Marching ants animation (selected street) – web

| What | Web (docs/src) | Mobile (app) |
|------|-----------------|--------------|
| **Component** | `ActiveStreetLayer.tsx` → `MarchingAntsStreetOverlay` | `components/ActiveStreetLayer.tsx` |
| **Data** | `resolvedStreetGeometry` from mapStore (geometry from `resolveStreetGeometry(street, directionLock)`) | Same: `useMapStore` → `resolvedStreetGeometry` |
| **Rendering** | SVG overlay: path from geometry (mapInstance.project to pixels); white outline + colored line with `strokeDasharray="12 6"` and CSS class `street-marching-ants` | MapLibre: ShapeSource + LineLayer; white outline layer + second LineLayer with `lineDasharray: marchingDash` (animated in JS) |
| **Animation** | CSS: `.street-marching-ants { animation: street-marching-ants 0.8s linear infinite }`; keyframes `stroke-dashoffset: 0` → `-18` | JS: `useEffect` + `setInterval` updating `dashPhase`; `marchingDash = [dashLen*(1-phase), gapLen+dashLen*phase]` so dash appears to move |
| **Start/end markers** | Green circle = geometry[0] (start of numbering), Red circle = geometry[last] (end) | Same: PointAnnotation for start (green) and end (red) from `resolvedStreetGeometry.start` / `.end` |
| **Lock badge** | `LockStatusBadge` at ~40% along the line when locked; shows “LOCKED” or “LOCKED ↻” | Same: PointAnnotation at midPoint when `isLocked`; Lock status from `activeStreetDirectionLock` |

**Alignment:** ✅ Same semantics (resolved geometry, start/end, lock badge). Web uses CSS keyframes on SVG; mobile uses MapLibre LineLayer with JS-driven lineDasharray. Both produce a “marching ants” effect on the selected street.

---

## 4. Address creation (web)

| What | Web (docs/src) | Mobile (app) |
|------|-----------------|--------------|
| **Page** | CreateAddressPage (URL params lat, lon) | new-create-address (route params latitude, longitude from map) |
| **Address data source** | `addressData` from `resolveStreetAddress` in useEffect (houseNumber, street, side, chainage, osmData) | new-create-address gets data from API check response and/or location; **not** yet from store / resolveStreetAddress result |
| **Save** | `SyncManager.createAddress(baseAddressData)` then **after** save: `await autoLockOnFirstAddress(streetKey)` | `SyncManager.createAddress(addressData)` only; **no** `autoLockOnFirstAddress` |
| **streetKey** | From `normalizeStreetKey(originalApiStreetName \|\| streetName, addressData?.osmData?.city, osmId)`; osmId from `activeStreetData.segment_id` | Not passed; createAddressWithDirectionLock(streetKey) exists but is not used in new-create-address |
| **Fields** | house_number, side_of_street, chainage_meters, distance_from_street, street_name, neighborhood, city, region, country, plus_code, etc. | Same schema; data currently from API payload conversion |

**Gap (CLOSED Feb 2026):** Both items below are now implemented in mobile:

- **Align address data:** When opening new-create-address from the map (e.g. from AddressNotFoundCard), pass or read from store: `calculatedAddress` / `activeStreetDirectionLock` and the result of `resolveStreetAddress` (or use store’s `calculatedAddress`, `activeStreet`, etc.) so house number, side, chainage, and street name come from the **same** pipeline as the map (street detection + auto-numbering).
- **Align save:** After SyncManager.createAddress, call **autoLockOnFirstAddress(streetKey)**. Get streetKey from store (`activeStreetDirectionLock?.streetKey`) or from the resolve result when entering the create screen.

---

## 5. Other web behaviors (for parity)

| Feature | Web | Mobile |
|---------|-----|--------|
| **GPS / active location box** | Marching ants on Plus Code box at activeLocation (MarchingAntsOverlay); GPS layer can hide when user is at same location | MapLibre: GPSLocationLayer with `showOnlyWhenOffset`; center grid + neighbor squares |
| **Nearby/alternate streets** | NearbyStreetsLayer from `nearbyStreets` in store; different colors | Same: NearbyStreetsLayer from store |
| **Direction info UI** | StreetDirectionInfo (lock status) | Same: StreetDirectionInfo in bottom sheet |
| **Check location** | checkLocationAddress with offlineReverseGeocode (resolveStreetAddress) and findLocalJanGoByPlusCode10; FOUND = jango match or externalCandidate with house number | When hasOfflinePacks: checkLocation (addressServices) → same logic. When no packs: API checkAddress |

---

## 6. Summary: changes completed (Feb 2026)

1. **Address creation flow (new-create-address)**  
   - **Data:** When coming from map (e.g. “Create address” from AddressNotFoundCard), populate form from **store** or from **resolveStreetAddress** result (house number, side, chainage, street name, city, neighborhood, region, country) so it matches web’s use of addressData from resolve.  
   - **Save:** After creating the address, call **autoLockOnFirstAddress(streetKey)**. Get streetKey from map store (`activeStreetDirectionLock?.streetKey`) or from the resolve result (e.g. pass streetKey as a route param when opening new-create-address from the map).

2. **Street detection / marching ants**  
   - Already aligned when `hasOfflinePacks` is true: resolveStreetAddress runs, store is updated, ActiveStreetLayer uses resolvedStreetGeometry (marching ants, start/end, lock badge). Ensure new-create-address receives or reads the same street and calculated address (e.g. from store or passed params) so the created address matches what the user sees on the map.

3. **Offline-first Plus Code / What3Words** — ✅ DONE
   - Plus Code computed locally via `getDisplayCode()` from `@janpams/core/pluscode`.
   - W3W API only called when `isOnline`; omitted offline.

4. **Shared packages (monorepo reuse)** — ✅ DONE
   - `checkLocationAddress` in `packages/core/src/address/checkLocationAddress.ts`.
   - `normalizeStreetKey` in `packages/core/src/streets/normalizeStreetKey.ts`.

5. **Create-page view mode** — ✅ DONE
   - Detects existing JanGo address → form disabled with banner.

6. **Optional (legacy)**  
   - Use **createAddressWithDirectionLock(data, streetKey)** in new-create-address when saving from the map so one function handles both “create” and “auto-lock on first address” in one place (same order as web: create then autoLock).

---

## File reference (web)

- **Address creation:** `docs/src/pages/CreateAddressPage.tsx` (useEffect with resolveStreetAddress; handleSubmit with SyncManager.createAddress + autoLockOnFirstAddress)
- **Street detection / resolve:** `docs/src/lib/offlineDataPacks.ts` (resolveStreetAddress, selectStreets, mergeSegmentGeometries)
- **Auto-numbering:** `docs/src/lib/createLocationAddress.ts` (calculateHouseNumberSync, allocateHouseNumberAsync)
- **Direction lock:** `docs/src/lib/streetDirectionService.ts` (getDirectionLock, autoLockOnFirstAddress)
- **Marching ants (street):** `docs/src/components/map/ActiveStreetLayer.tsx` (MarchingAntsStreetOverlay, strokeDasharray 12 6, CSS street-marching-ants)
- **Store:** `docs/src/store/mapStore.ts`; **hook:** `docs/src/hooks/useActiveStreet.ts`
- **Check location:** `docs/src/lib/addressServices.ts` (checkLocation); `docs/src/lib/checkLocationAddress.ts`
