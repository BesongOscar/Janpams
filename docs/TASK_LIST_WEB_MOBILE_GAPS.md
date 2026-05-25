# Task List: Web–Mobile Gaps (Mobile Fixes)

This list identifies **gaps between web and mobile** that should be fixed on **mobile** to achieve parity. No code—tasks only. Reference: web = `apps/core/mbukanji-maps`, mobile = `apps/core/address-maker-glopams`.

**See also:** [MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md](./MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md) — implementation plan for marching ants (SVG overlay), camera behaviour, and breadcrumb/restriction to match web. **Phase 4 (Docs & Cleanup)** completed 2026-02-04.

---

## 1. Plus code / GPS box animations (optional parity) — marching ants DONE

| Web | Mobile today | Gap |
|-----|----------------|-----|
| Active box: static blue fill (0.25) + marching ants only. No pulse. | Same (marching ants on active; static blue). | None. |
| GPS breadcrumb: static light blue (0.4) when active ≠ GPS. No pulse. | Mobile adds **pulsing** on GPS breadcrumb when active ≠ GPS. | Mobile has an enhancement (pulse). |

**Task:** Decide whether to match web exactly: if so, remove pulsing animation from GPS breadcrumb on mobile so it is static like web. If not, leave as-is and document as intentional enhancement.

**Done (2026-02-04):** Plus Code active box and selected-rectangle marching ants now use SVG overlay (`MarchingAntsBoxOverlay`) in screen space (getPointInView + Reanimated), matching web. Street marching ants on new-create-address use `MarchingAntsStreetOverlay` (same approach). See `MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md`.

---

## 2. Camera behavior when basic_user clicks a neighbor — DONE

| Web | Mobile today | Gap |
|-----|----------------|-----|
| “DO NOT fly the map” — camera stays centered on **GPS**; all 9 cells remain visible; blue + marching ants move to clicked cell; GPS breadcrumb appears. | When restricted: `cameraCenter`/`neighborCenter` = GPS (userLocation or location hook); `centerLocation` = active cell; handleMapPress does not call animateToRegion. | None. |

**Done (Phase 2):** For basic_user, camera stays on GPS; only active box + marching ants move to the clicked cell. See `MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md` Phase 2.

---

## 3. GPS breadcrumb visibility logic (basic_user only on web) — DONE

| Web | Mobile today | Gap |
|-----|----------------|-----|
| `showBreadcrumb={hasClickedAway}` where `hasClickedAway = isLocationRestricted && userLocation && activeLocation && !isSameGridCell(...)`. So breadcrumb only when **restricted** and active ≠ GPS. | Mobile: `showOnlyWhenRestrictedAndOffset={true}` — breadcrumb only when `isLocationRestricted` and active ≠ GPS (isSameGridCell). | None. |

**Done (Phase 3):** GPS breadcrumb shows only for basic_user when they tap a different cell. See `MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md` Phase 3.1.

---

## 4. Restriction overlay (dim outside 9 cells) — DONE

| Web | Mobile today | Gap |
|-----|----------------|-----|
| RestrictionOverlay: SVG clip path, black 35% overlay with a “hole” over the 9-cell neighborhood. Only when `appMode === 'address' && isLocationRestricted`. | MapViewMapLibre: hole from `getNineCellBbox(restrictionCenter)`, fillOpacity 0.35, only when `restrictionCenter` set (isLocationRestricted && showGrid && gpsAnchor). | None. |

**Done (Phase 3):** Restriction overlay verified; hole and opacity match web. See `MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md` Phase 3.2.

---

## 5. Neighbor boxes: exclude active cell (show 7 when clicked) — DONE

| Web | Mobile today | Gap |
|-----|----------------|-----|
| NeighborBoxesLayer skips drawing the cell that equals activeLocation, so after click you see 7 green boxes (8 − 1 active). | MapViewMapLibre: 8 neighbors from `getNeighborGrids(neighborCenter)` (GPS), then filter out the cell that equals `centerLocation` (active); blue box at centerLocation. So 7 green + 1 blue. | None. |

**Done (Phase 2):** Neighbor layer excludes the active cell; no green under the blue box. See `MOBILE_MARCHING_ANTS_AND_BEHAVIOUR_PARITY_PLAN.md` Phase 2.2.

---

## 6. Address mode entry: initial activeLocation = GPS and fly-to

| Web | Mobile today | Gap |
|-----|----------------|-----|
| enterAddressMode: set activeLocation to GPS, setGridVisible(true), dispatch map-fly-to to user location (zoom 18). | Map tab: centerLocation from markerCoordinates || location?.coordinates || selectedLocation; grid and location set when user has location. | Ensure on first load (or when opening map tab with permission), mobile sets activeLocation and userLocation from GPS, flies to that location at the same zoom level as web (e.g. 18), and shows grid so behavior matches “address mode entry.” |

**Task:** Verify that when the user opens the map tab and has GPS, mobile sets store’s activeLocation and userLocation to GPS, flies camera to that location at the correct zoom, and shows the grid. Document or fix any difference from web’s enterAddressMode.

---

## 7. checkLocation after neighbor click

| Web | Mobile today | Gap |
|-----|----------------|-----|
| After updating activeLocation to clicked cell, web performs checkLocation at the new coordinates and opens the sidebar with results. | Mobile handleMapPress runs check (e.g. checkAddress) and updates addressFound/addressNotFound and opens the bottom sheet. | Likely aligned. |

**Task:** Confirm that after a neighbor (or any allowed grid) tap, mobile runs the same “check location” flow as web (offline resolve when packs exist, API when not) and shows the result in the bottom sheet. No code change if already correct; otherwise fix the trigger or data source.

---

## 8. activeLocationSource (gps vs map_click)

| Web | Mobile today | Gap |
|-----|----------------|-----|
| activeLocationSource set to `'gps'` when using GPS, `'map_click'` when user clicked a neighbor. | Store may have activeLocation but not always a separate “source” field. | If web uses this for analytics or trust policy, mobile should set the same concept when setting activeLocation (gps on first load / from GPS, map_click on grid tap). |

**Task:** If web relies on activeLocationSource, add or use an equivalent on mobile (e.g. in map store) and set it to `gps` or `map_click` when updating activeLocation.

---

## 9. Hover tooltip on GPS breadcrumb (web only)

| Web | Mobile today | Gap |
|-----|----------------|-----|
| Web GPSLocationLayer: on hover, popup “This is your GPS location.” | No hover on touch. | No parity needed for hover; optional: add long-press or info icon on mobile for same message. |

**Task:** Optional. If product wants the same hint on mobile, add a long-press or small info control on/near the GPS breadcrumb that shows “This is your GPS location.”

---

## 10. POI layer at active location

| Web | Mobile today | Gap |
|-----|----------------|-----|
| MapView renders POILayer at activeLocation (radius 500). | Map tab may or may not include a POI layer. | If web shows POIs around the active location, mobile should do the same when the map tab is in address/create flow. |

**Task:** Check if mobile map tab shows a POI (or nearby landmarks) layer centered on the active location; if not and web does, add or enable it for parity.

---

## 11. Street marching ants + start/end + lock badge (new-create-address)

| Web | Mobile today | Gap |
|-----|----------------|-----|
| ActiveStreetLayer: marching ants on resolved street line, green start and red end markers, lock badge at ~40% when locked. | Implemented on new-create-address: **MarchingAntsStreetOverlay** (SVG overlay, getPointInView), start/end circles and lock badge in SVG; geometry from store. | Per WEB_TO_MOBILE_ALIGNMENT this is done. Re-verify on new-create-address: geometry, colors, and lock badge position match web. |

**Task:** Re-verify street marching ants, start/end markers, and lock badge on new-create-address (data from store, correct [lon,lat] for MapLibre). Fix any visual or data mismatch.

---

## 12. Offline / no packs: address check and messaging

| Web | Mobile today | Gap |
|-----|----------------|-----|
| When no offline packs, check uses API; user may see different messaging or flows. | Mobile: when no packs, uses API check; OfflineDataInfoCard prompts download. | Ensure when no packs, mobile’s “address not found” / “address found” flow and wording match web (or document intentional differences). |

**Task:** Compare “no offline data” flow and copy between web and mobile; align behavior or messaging where needed.

---

## Summary table (for tracking)

| # | Area | Priority | Status | Notes |
|---|------|----------|--------|--------|
| 1 | Plus code / GPS box animations | — | **Done** | Marching ants SVG overlay; selected rectangle ants. |
| 2 | Camera on neighbor click | Medium | **Done** | Camera stays on GPS (Phase 2). |
| 3 | Breadcrumb only for restricted | Medium | **Done** | showOnlyWhenRestrictedAndOffset (Phase 3). |
| 4 | Restriction overlay | Low | **Done** | Hole and opacity verified (Phase 3). |
| 5 | Neighbor list exclude active | Medium | **Done** | 7 green + 1 blue (Phase 2). |
| 6 | Address mode entry / fly-to | Medium | **Addressed** | activeLocation = GPS + source=gps on restore and when location available. |
| 7 | checkLocation after tap | Low | Open | Confirm trigger and data source. |
| 8 | activeLocationSource | Low | **Done** | Store + set gps/map_click in handleMapPress and on enter. |
| 9 | GPS tooltip (long-press) | Optional | Open | UX enhancement. |
| 10 | POI layer on map tab | Low | Open | Add if web has it. |
| 11 | Street ants/start/end/lock | Low | **Done** | MarchingAntsStreetOverlay (SVG) on new-create-address. |
| 12 | No-packs flow and copy | Low | Open | Align messaging. |

---

## Suggested order of work

1. **2, 5, 6** — Camera + neighbor semantics + address mode entry (core map behavior).
2. **3** — GPS breadcrumb visibility (restricted-only if that’s web).
3. **4, 7, 8** — Restriction overlay verify, checkLocation verify, activeLocationSource.
4. **1, 9, 10, 11, 12** — Optional or verification tasks.

No code in this doc; implement each task in the codebase and update this list or WEB_TO_MOBILE_ALIGNMENT.md as tasks are completed.
