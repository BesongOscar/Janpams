# Web vs Mobile Create-Address Flow – Gap Review

Review of `docs/src` (web) vs mobile (`lib/`, `app/`) for the create-address flow. Gaps identified and fixes applied where applicable.

---

## 1. resolveStreetAddress

| Aspect | Web (`docs/src/lib/offlineDataPacks.ts`) | Mobile (`lib/offlineDataPacks.ts`) | Status |
|--------|------------------------------------------|------------------------------------|--------|
| **Signature** | `(lat, lon, maxStreetDistance?, useAccessRealityAlgorithm?)` – 4 params | `(lat, lon, maxStreetDistance?)` – 3 params | **Intentional**: Mobile always uses access-reality (selectStreets). No legacy path. |
| **House number calc** | Does NOT pass `directionLock` to `calculateHouseNumberSync` (raw OSM geometry) | Was passing `directionLock` → **fixed**: no longer passes `directionLock` (web parity). | **Fixed** |
| **streetForCalc** | Includes `osm_id` from segment_id | Now includes `osm_id` (was missing). | **Fixed** |
| **Result: debugData** | Returns `debugData: { allCandidates, rejectedStreets }` when access-reality path | Was missing. | **Fixed**: type and return value added. |
| **Result: accessType, rejectedStreets** | Yes | Yes | OK |

---

## 2. calculateHouseNumberSync usage

| Context | Web | Mobile | Status |
|--------|-----|--------|--------|
| **Initial resolve (in resolveStreetAddress)** | `calculateHouseNumberSync(lat, lon, streetForCalc, { nearbyStreets })` – no directionLock | Same: `{ nearbyStreets }` only. | **Aligned** |
| **On street change (Pick a Street)** | `calculateHouseNumberSync(lat, lon, streetForCalc)` – no options | Was passing `{ directionLock, nearbyStreets }`. | **Fixed**: now `{ nearbyStreets }` only; use `createStreetKey(streetForCalc)` for UI/lock. |

---

## 3. Street type for calculation

| Aspect | Web | Mobile | Status |
|--------|-----|--------|--------|
| **Street interface** | `Street` with `osm_id` | Same in `lib/createLocationAddress.ts`. | OK |
| **activeStreetDataToStreet** | N/A (web builds streetForCalc inline with osm_id) | Was missing `osm_id`. | **Fixed**: `osm_id: parseInt(segment_id.split('-')[0], 10) \|\| 0` added. |
| **Street key on Pick a Street** | N/A (web doesn’t expose streetKey in that path) | Was `normalizeStreetKey(selected.name)`. Now `createStreetKey(streetForCalc)` for stable key. | **Fixed** |

---

## 4. CreateAddressPage / new-create-address flow

| Aspect | Web | Mobile | Status |
|--------|-----|--------|--------|
| **Original API values** | `originalApiStreetName`, `originalApiNeighborhood` set from geocode | Same. | OK |
| **Single source of truth** | resolveStreetAddress at page coords, form filled from result | Same. | OK |
| **autoLockOnFirstAddress** | After create, with `normalizeStreetKey(name, city?, osmId?)` | After create, with `streetKeyFromGeocode ?? normalizeStreetKey(street, city)`. | OK |
| **Submit: street_key** | Uses street name / osm for address record | Uses `streetKeyFromGeocode` / street name. | OK |

---

## 5. Optional / intentional differences

- **useAccessRealityAlgorithm**: Web has a 4th parameter and a legacy (findClosestStreets) path when `false`. Mobile has no 4th param and only the access-reality path. **Intentional** for mobile.
- **debugData consumption**: Web uses it for StreetSelectionDebugPanel, etc. Mobile does not use it yet; result shape is aligned for future dev/debug UI.

---

## Files changed (this review)

1. **lib/offlineDataPacks.ts**
   - Removed `directionLock` from `calculateHouseNumberSync` call (already done earlier).
   - Added `osm_id` to streetForCalc and nearbyStreetsForCalc (already done).
   - Added `debugData` to `OfflineReverseGeocodeResult` and to the returned result.
   - Imported `CandidateStreet` from streetSelection.

2. **app/new-create-address.tsx**
   - `activeStreetDataToStreet`: added `osm_id`.
   - `handlePickStreet`: no longer pass `directionLock` to `calculateHouseNumberSync`; pass only `{ nearbyStreets }`; use `createStreetKey(streetForCalc)` for street key.
   - Import: added `createStreetKey` from `@/lib/streetGeometry`.

---

## Summary

- **House number alignment**: Mobile no longer passes `directionLock` into house number calculation (initial resolve or on street pick), matching web and avoiding projection failures.
- **Street type / key**: `osm_id` and `createStreetKey(streetForCalc)` used so street identity and keys match web.
- **Result shape**: `debugData` added to mobile result for parity with web; mobile can add debug UI later if needed.
