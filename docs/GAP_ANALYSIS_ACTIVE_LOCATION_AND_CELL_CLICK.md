# Gap Analysis: Active Location and Cell Click — Web vs Mobile

## Canonical behavior (both platforms)

- **userLocation** = User’s actual GPS position. Must be **fixed** to GPS only: updated when we get a new position (e.g. “Use my location” or initial load). **Never** set when the user selects a different box.
- **activeLocation** = The **neighbor box (grid cell) the user has selected**. Updated when the user taps a cell (including the center = GPS cell). Determines which cell shows marching ants and which address is shown in the card/sheet.

This document compares how the **web** (mbukanji-maps) and **mobile** (address-maker-glopams) handle:
1. **Active location** (what is “selected” — GPS vs clicked cell)
2. **Cell clicking** (click on grid cell / neighbor)
3. **Reusing GPS result** when tapping back to the GPS cell
4. **Snap-to-grid** and **fly-to** behavior

---

## 1. Active location and source tracking

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Store** | `mapStore`: `activeLocation`, `userLocation`, `activeLocationSource` | `mapStore`: same (`activeLocation`, `userLocation`, `activeLocationSource`) |
| **Source values** | `'gps' \| 'map_click' \| null` | `'gps' \| 'map_click'` (same) |
| **Initial active location** | Set to GPS in `initializeMapLocation` and in MapControls “Go to my location” | Set to snapped GPS in `handleUseCurrentLocation` and on focus |
| **When clicking cell** | `setActiveLocation({ lat, lon, timestamp })` with **raw click** (e.lngLat) | `setActiveLocation` with **snapped cell center** (from `getGridCellBounds`) |

**Gap 1 — Snap to grid on click**  
- **Web:** Keeps **raw click coordinates** for `activeLocation`. Grid cell is derived via `getGridBounds(activeLocation.lat, activeLocation.lon)` for display (marching ants, neighbor boxes).  
- **Mobile:** **Snaps** to cell center (`getGridCellBounds` → `centerLat`, `centerLng`) and uses that for `activeLocation`, `markerCoordinates`, and address check.  
- **Impact:** Mobile is consistent (one canonical point per cell). Web can have a slightly different point inside the same cell for check vs display. Aligning mobile to web would mean not snapping (use raw tap); aligning web to mobile would mean snapping to cell center. Recommendation: keep mobile snap for consistent address-check and UI.

---

## 2. Same-cell and GPS-cell detection

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Same grid cell helper** | `isSameGridCell(lat1, lon1, lat2, lon2)` from `@/lib/pluscode` (uses `getGridBounds`) | `isSameGridCell(lat1, lon1, lat2, lon2)` from `@/utils/plusCodeGrid` (local impl) |
| **“Clicking active box”** | `isClickingActiveBox = activeLocation && isSameGridCell(lat, lon, activeLocation.lat, activeLocation.lon)` | Same idea: `isClickingActiveBox = activeLocation && isSameGridCell(lat, longitude, activeLocation.latitude, activeLocation.longitude)` |
| **“Clicking user (GPS) box”** | `isClickingUserBox = userLocation && isSameGridCell(lat, lon, userLocation.lat, userLocation.lon)` | Same: `isClickingUserBox = location?.coordinates && isSameGridCell(...)` |

**Alignment:** Logic is the same; only prop names differ (`lat/lon` vs `latitude/longitude`). No functional gap.

---

## 3. Behavior when clicking the already-active cell

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Action** | `toggleSidebarWithCard()` — toggles between sidebar and AddressCard | If sheet visible → dismiss (`setShowCardMarker(false)`, clear address state). If hidden → no re-open. |
| **No address re-check** | Yes | Yes |

**Alignment:** Both avoid re-running the address check when re-clicking the same cell; both toggle UI (web: sidebar/card; mobile: sheet visibility).

---

## 4. Behavior when clicking the GPS cell (after having been on a neighbor)

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Reuse address at GPS?** | Yes: `setActiveLocationAddress(userLocationAddress)` (no new network/check) | Yes: uses `lastGpsCheckResult` to set `addressFound` / `addressNotFound` and Plus Code/W3W |
| **Reuse check result (FOUND/NOT_FOUND)?** | **No.** Only `setActiveLocationAddress` is called. Comment says “Also update locationCheckResult from the stored one if available” but **no code does it**. So sidebar can still show the **previous cell’s** `locationCheckResult`. | **Yes.** Restores from `lastGpsCheckResult` (found + response, or not found), so bottom sheet shows correct FOUND vs NOT_FOUND for the GPS cell. |
| **Fly-to** | `map-fly-to` with click (lat, lon) — raw | No extra fly-to (camera already at cell); marker/activeLocation set to cell center |

**Gap 2 — Web does not restore `locationCheckResult` when re-clicking GPS cell**  
- **Web:** Sidebar (AddressInfoPanel) uses `locationCheckResult` for FOUND/NOT_FOUND and source. When user clicks back to GPS cell, only `activeLocationAddress` is restored; `locationCheckResult` stays from the last non-GPS click → **wrong status/source for GPS cell**.  
- **Mobile:** Correctly restores both address and FOUND/NOT_FOUND from `lastGpsCheckResult` when tapping the GPS cell.  
- **Recommendation:** Web should set a cached GPS check result when doing the initial GPS check (and optionally when using “Go to my location”), and when `isClickingUserBox` restore that cached result into `locationCheckResult` so the sidebar matches the GPS cell.

---

## 5. Caching the GPS check result

| Aspect | Web | Mobile |
|--------|-----|--------|
| **On first load / “Go to my location”** | `checkLocationForAddress` → `checkLocation` → `setLocationCheckResult(result)` and `setBothAddresses(address)`. So **result is in store** but not in a dedicated “GPS cache” used when re-clicking GPS. | On first load: runs `checkLocation` and sets `addressFound` / `addressNotFound` and store. **Does not set `lastGpsCheckResult`.** So when user taps neighbor then taps back to GPS, `lastGpsCheckResult` can be **null** (unless they had previously clicked the GPS cell). |
| **When clicking a cell** | No “last GPS result” cache; when clicking GPS cell only `activeLocationAddress` is reused. | When the **clicked cell is the GPS cell**, mobile caches that check into `lastGpsCheckResult` (in the same `handleMapPress` block that runs address check). So cache is only set when user **clicks** the GPS cell, not on initial load. |

**Gap 3 — Mobile does not set `lastGpsCheckResult` on first load**  
- **Impact:** If user (1) opens app (GPS cell active, address checked), (2) taps a neighbor, (3) taps back to GPS cell → mobile uses `lastGpsCheckResult` to restore sheet state. But `lastGpsCheckResult` was never set on step (1), so it’s only set if at some point the user had triggered a check **by clicking** the GPS cell. So after “first load → neighbor → back to GPS,” the cache may be empty and mobile may do a **full re-check** instead of reusing.  
- **Recommendation:** In `handleUseCurrentLocation`, after the offline/API check and setting `addressFound` / `addressNotFound`, also set `lastGpsCheckResult` for the current (snapped) GPS coordinates so that “tap neighbor → tap back to GPS” reuses the result without a second check.

---

## 6. Click on a new (non-GPS, non-active) cell

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Set active location** | `setActiveLocation({ lat, lon, timestamp })` (raw click) | `setActiveLocation` to **cell center** + `setMarkerCoordinates` to cell center |
| **Source** | `setActiveLocationSource('map_click')` | Same |
| **Fly-to** | `map-fly-to` with (lat, lon) and zoom 18 | `mapRef.current.animateToRegion` to cell (when not location-restricted) |
| **Address check** | `performLocationCheck(lat, lon)` then `checkLocationForAddress(lat, lon)`; store gets `locationCheckResult` and `activeLocationAddress` | Offline: `checkLocation(cellLat, cellLng)` then `offlineResultToCheckResponse`; set `addressFound` / `addressNotFound`; `resolveStreetAddress` and `syncMapStoreFromResolveResult`; set `activeLocationAddress`. No packs: `checkAddress` (API). |
| **Coordinates used for check** | **Raw** (lat, lon) from click | **Snapped** (cellLat, cellLng) |

**Gap 4 — Coordinates used for address check**  
- **Web:** Check runs at **raw click** coordinates (can be anywhere inside the cell).  
- **Mobile:** Check runs at **cell center** (snapped).  
- **Impact:** For the same cell, web and mobile can run the check at slightly different points; usually same result, but mobile is more deterministic. No change needed on mobile unless web is changed to snap.

---

## 7. Neighbor click (location-restricted / basic_user)

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Handler** | `handleNeighborClick(lat, lon)` — no fly-to (neighbors already visible) | Same idea: `isLocationRestricted` limits which cells are clickable; when allowed, same `handleMapPress` flow; camera not recentered when restricted (`gpsAnchor` keeps camera on GPS). |
| **Active location** | `setActiveLocation({ lat, lon })` (neighbor center passed from NeighborBoxesLayer) | Set to snapped center of clicked cell |
| **Address check** | `performLocationCheck` + `checkLocationForAddress` | Same `checkLocation` / `checkAddress` path as any other cell |

**Alignment:** Both support “neighbor only” for restricted users and avoid flying when neighbors are already in view. Mobile uses `isClickInNeighborCellOnly` and `gpsAnchor`; web uses a dedicated neighbor click handler. Behavior is aligned.

---

## 8. First load (initial GPS)

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Entry** | `initializeMapLocation()` in useEffect on mount | `handleUseCurrentLocation()` in `useFocusEffect` (and tab press) |
| **GPS then** | `setUserLocation(position)`, `setActiveLocation(position)`, `setActiveLocationSource('gps')`, fly-to, then `checkLocationForAddress` → `setLocationCheckResult` + `setBothAddresses` | Snap to grid; set location, marker, activeLocation, source; local Plus Code + optional W3W; then `checkLocation` (offline) or `checkAddress` (API); set addressFound/addressNotFound and store. |
| **Snap to grid** | **No.** Web keeps raw GPS for `userLocation` and `activeLocation`. | **Yes.** Snapped to `snapToPlusCodeGrid`; marker and active location use snapped coords. |
| **Cache for “back to GPS”** | `locationCheckResult` and `userLocationAddress` are set, but when re-clicking GPS cell only `activeLocationAddress` is restored (see Gap 2). | `lastGpsCheckResult` is **not** set on first load (see Gap 3). |

---

## 9. Summary of gaps

| # | Gap | Owner | Severity | Recommendation |
|---|-----|--------|----------|----------------|
| 1 | **Snap to grid:** Web uses raw click for activeLocation; mobile snaps to cell center. | Both | Low | Keep mobile snap; optional: document or align web to snap for consistency. |
| 2 | **Web:** When re-clicking GPS cell, `locationCheckResult` is not restored; sidebar can show previous cell’s FOUND/NOT_FOUND. | Web | Medium | Cache GPS `locationCheckResult` and restore it when `isClickingUserBox`. |
| 3 | **Mobile:** `lastGpsCheckResult` is not set on first load, so “first load → neighbor → back to GPS” may re-run check instead of reusing. | Mobile | Medium | In `handleUseCurrentLocation`, after setting addressFound/addressNotFound, set `lastGpsCheckResult` for the snapped GPS coords. |
| 4 | **Check coordinates:** Web uses raw click; mobile uses cell center. | Both | Low | Keep mobile behavior (cell center) for deterministic result. |

---

## 10. File references

**Web**  
- Map click / active location: `apps/core/mbukanji-maps/src/pages/MapPage.tsx` (`handleMapClick`, `handleNeighborClick`, `initializeMapLocation`)  
- Store: `apps/core/mbukanji-maps/src/store/mapStore.ts`  
- Plus code helpers: `apps/core/mbukanji-maps/src/lib/pluscode.ts` (`isSameGridCell`, `getGridBounds`)  
- Address check: `apps/core/mbukanji-maps/src/hooks/useAddressModeEntry.ts` (`performLocationCheck`); `MapPage` `checkLocationForAddress`  
- Address UI: `apps/core/mbukanji-maps/src/components/layout/AddressInfoPanel.tsx`, `AddressCard.tsx` (use `locationCheckResult`, `activeLocationAddress`)  

**Mobile**  
- Map press / active location: `apps/core/address-maker-glopams/app/(tabs)/index.tsx` (`handleMapPress`, `handleUseCurrentLocation`)  
- Store: `apps/core/address-maker-glopams/lib/store/mapStore.ts`  
- Grid helpers: `apps/core/address-maker-glopams/utils/plusCodeGrid.ts` (`isSameGridCell`); local `getGridCellBounds`, `snapToPlusCodeGrid` in index  
- Address check: `lib/addressServices.ts` (`checkLocation`); `offlineResultToCheckResponse`  
- Bottom sheet: `AddressFoundCard`, `AddressNotFoundCard`; state `addressFound`, `addressNotFound`, `lastGpsCheckResult`
