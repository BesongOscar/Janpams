# Plan: Mobile → Web Look & Behaviour Parity

**Status:** Phase 1, 2, 3, and 4 implemented (2026-02-04)  
**Last updated:** 2026-02-04  
**Scope:** Match web (mbukanji-maps) for Plus Code grid, marching ants, camera behaviour, and related UX.

**Implemented (Phase 1):**
- **1.1** MapViewMapLibre exposes `getPointInView` on ref; `regionRevision` incremented on `onRegionDidChange` for overlay re-project.
- **1.2** `MarchingAntsBoxOverlay` (SVG + Reanimated, 1s, 8-4) for Plus Code active cell; center LineLayer ants removed; blue fill kept.
- **1.3** `MarchingAntsStreetOverlay` (SVG, dasharray cycle 0.8s, 12-6) in new-create-address; street ShapeSource/LineLayer and start/end/lock markers removed.
- **1.4** Selected grid rectangle (when `!centerLocation`) uses same `MarchingAntsBoxOverlay` via bounds from `selectedGridRectangle.coordinates`.
- Obsolete `gridBorderPhase` and street `routeAnimPhase` timers removed.

**Implemented (Phase 2):**
- **2.1** When `isLocationRestricted` and grid on: `cameraCenter` and `neighborCenter` = GPS (userLocation with fallback to location hook). `centerLocation` = active cell (activeLocation ?? markerCoordinates ?? GPS). handleMapPress does **not** call animateToRegion when restricted, so camera stays on GPS; only blue box + marching ants move to clicked cell.
- **2.2** MapViewMapLibre computes 8 neighbors from `neighborCenter` (GPS), then filters out the cell that equals `centerLocation` (active), so 7 green + 1 blue when a neighbor is selected.

**Implemented (Phase 3):**
- **3.1** GPS breadcrumb visibility: `GPSLocationLayer` now receives `showOnlyWhenRestrictedAndOffset={true}` so the breadcrumb shows only when **location-restricted (basic_user)** and **active location ≠ GPS** (isSameGridCell), matching web.
- **3.2** Restriction overlay verified: hole from `getNineCellBbox(restrictionCenter)`, fillOpacity 0.35, only when `restrictionCenter` is set (address mode + location-restricted + showGrid).
- **3.3** GPS breadcrumb animation: **keep pulsing** as an intentional mobile enhancement (web uses static fill). Documented in PLUSCODE_ANIMATION_DISPLAY_SPEC; no change.

**References:**
- `TASK_LIST_WEB_MOBILE_GAPS.md`
- `WEB_TO_MOBILE_ALIGNMENT.md`
- `PLUSCODE_ANIMATION_DISPLAY_SPEC.md`
- Web: `apps/core/mbukanji-maps` (MapView.tsx MarchingAntsOverlay, ActiveStreetLayer MarchingAntsStreetOverlay, NeighborBoxesLayer)

---

## Phase 1: Marching Ants via SVG Overlay (Match Web)

**Goal:** Use the same technique as web (SVG in screen space, CSS-like animation). On mobile: MapLibre `getPointInView`, `react-native-svg`, and Reanimated.

### 1.1 Map ref and projection

- **Task:** Expose the MapLibre map ref from `MapViewMapLibre` so callers can call `getPointInView(coordinate)`.
  - Options: `forwardRef` to the inner `MapView`, or expose an imperative handle that runs `getPointInView` and returns the result.
- **Task:** Add a small helper (or hook) that, given bounds `{ sw: [lng, lat], ne: [lng, lat] }` or a path `[lon, lat][]`, calls `getPointInView` for each point and returns screen rect or path. Handle async and map-not-ready.

### 1.2 Plus Code box – SVG overlay

- **Task:** Add a **MarchingAntsBoxOverlay** (or equivalent) component:
  - Inputs: map ref, active bounds in lat/lon (same as web: from grid math, e.g. `getGridBounds(centerLat, centerLon)`).
  - On mount and on region change (e.g. `onRegionDidChange`): call `getPointInView` for sw and ne, set state with `{ x, y, width, height }` in view coordinates.
  - Render a View overlay (same frame as map, `position: 'absolute'`, `pointerEvents="none"`) containing `react-native-svg`: single `<Rect>` with `stroke="#0000EE"`, `strokeWidth={3}`, `strokeDasharray="8 4"`.
  - Animate with Reanimated: `useSharedValue` + `useAnimatedProps` on the rect’s `strokeDashoffset` from 0 to -12 over 1000 ms, linear, infinite (match web `marching-ants-box`).
- **Task:** In `MapViewMapLibre`, when `showGrid` and there is an active center (or explicit active location):
  - Compute grid bounds (reuse same logic as current center square).
  - Render **MarchingAntsBoxOverlay** as a sibling on top of the map, passing map ref and bounds.
- **Task:** Remove the current center-grid **LineLayer** marching-ants implementation (the `lineDasharray` + `gridBorderPhase` on the center square). Keep the blue fill (FillLayer) either in MapLibre or, if desired, also in SVG for full parity.
- **Acceptance:** Plus Code active cell shows a single dashed rectangle in screen space; ants animate like web (1 s cycle, 8–4 pattern); pan/zoom update the overlay position.

### 1.3 Active street – SVG overlay (new-create-address)

- **Task:** Add a **MarchingAntsStreetOverlay** (or equivalent) component:
  - Inputs: map ref, street geometry `[lon, lat][]`, lock state, start/end and lock position in geometry (e.g. 0%, 100%, 40%).
  - On mount and on region change: for each geometry point, call `getPointInView([lon, lat])`, build path string `M x1,y1 L x2,y2 ...` and compute start/end/mid points in pixels.
  - Render overlay View + `react-native-svg`:
    - White outline path (stroke width 8, opacity 0.9).
    - Dashed path (stroke `#0000EE`, width 4, `strokeDasharray="12 6"`).
    - Animate dashed path with Reanimated: `strokeDashoffset` 0 → -18 over 800 ms, linear, infinite (match web `street-marching-ants`).
    - Start (green) and end (red) circles; lock badge at mid pixel position when locked.
- **Task:** In `new-create-address.tsx`, use **MarchingAntsStreetOverlay** when `activeStreetShape` (or resolved street geometry) exists: pass map ref (from MapViewMapLibre ref), geometry, and lock/start/end info. Remove the current ShapeSource + LineLayer marching-ants (and optionally the white outline) for the active street so the street ants are SVG-only.
- **Acceptance:** Street marching ants, outline, start/end markers, and lock badge match web; ants in screen space; 0.8 s cycle, 12–6 pattern.

### 1.4 Selected grid rectangle (fallback path)

- **Task:** When `selectedGridRectangle` is used and `!centerLocation`, either:
  - Use the same **MarchingAntsBoxOverlay** by converting `selectedGridRectangle.coordinates` to bounds (sw/ne) and passing that, so the rectangle also gets marching ants; or
  - Document that this path is legacy and not used when grid is on; otherwise add a minimal dashed-line animation for this rectangle so it’s not static.
- **Acceptance:** No “selected rectangle” drawn without ants when that code path is active.

---

## Phase 2: Camera & Grid Behaviour (Match Web)

**Goal:** When user taps a neighbor cell, camera stays on GPS; only the active box (and ants) move to the clicked cell.

### 2.1 Separate grid center from active location

- **Task:** Introduce (or clarify) two concepts in the main map screen (`(tabs)/index.tsx`):
  - **Grid center:** Always the user’s GPS location (or last known). Used for camera target and for drawing the 9-cell neighborhood.
  - **Active location:** The cell used for address check and for “where we show the blue box + marching ants.” On neighbor tap, only active location changes; grid center stays at GPS.
- **Task:** Ensure `MapViewMapLibre` receives:
  - `centerLocation` (or equivalent) = grid center (GPS) for camera and for computing the 9 cells.
  - `activeLocation` (or equivalent) = cell to highlight with blue + marching ants. When no tap, activeLocation can equal grid center.
- **Task:** When user taps a neighbor cell, set only the “active” state (e.g. `markerCoordinates` / active cell) to the tapped cell; do **not** set the map’s center/camera target to that cell. Camera remains centered on GPS so all 9 cells stay in view.
- **Acceptance:** Behaviour matches web: “DO NOT fly the map”; camera stays on GPS; blue box + marching ants move to the clicked cell; 9-cell grid stays fixed.

### 2.2 Neighbor boxes: exclude active cell

- **Task:** When drawing the 8 neighbor (green) cells, **exclude** the cell that equals `activeLocation` (same as web’s `NeighborBoxesLayer`). So when a neighbor is selected, 7 green boxes are visible (8 − 1 active).
- **Task:** Reuse the same “same grid cell” logic as web (e.g. `isSameGridCell(centerLat, centerLon, activeLat, activeLon)`). Ensure the blue + ants overlay and the green neighbor layer use the same active location and grid math.
- **Acceptance:** No green box under the active (blue) cell; 7 green + 1 blue when a neighbor is selected.

---

## Phase 3: GPS Breadcrumb & Restriction

**Goal:** Breadcrumb and dimming match web visibility and geometry.

### 3.1 GPS breadcrumb visibility

- **Task:** Align breadcrumb visibility with web: show only when **location-restricted (basic_user)** and **active location ≠ GPS** (e.g. `isLocationRestricted && activeLocation && !isSameGridCell(activeLocation, userLocation)`). If web uses a different condition, mirror that exactly.
- **Task:** Ensure the prop that controls “show breadcrumb” (e.g. `showOnlyWhenOffset` or similar) is driven by the same logic as web (restricted + offset), not only “active ≠ GPS.”
- **Acceptance:** Non-restricted users don’t see breadcrumb when they tap away; restricted users see it when they tap a different cell.

### 3.2 Restriction overlay

- **Task:** Verify restriction overlay (dim outside 9 cells): hole is exactly the 9-cell neighborhood (same bounds as web’s `getNineCellBbox` or equivalent), opacity 35%, and only when address mode + location-restricted.
- **Acceptance:** Hole and opacity match web; overlay only in correct mode.

### 3.3 Optional: GPS breadcrumb animation

- **Task:** Decide whether to remove pulsing on the GPS breadcrumb so it’s static like web, or keep pulsing as an intentional mobile enhancement. If matching web exactly, remove pulse and use static fill.
- **Acceptance:** Documented decision and consistent behaviour.

---

## Phase 4: Docs & Cleanup — DONE (2026-02-04)

- **Done:** Updated `TASK_LIST_WEB_MOBILE_GAPS.md` : completed items (marching ants SVG overlay, selected rectangle ants, Phase 2–3) marked; summary table reflects Done status for items 1–5; item 11 updated to MarchingAntsStreetOverlay (SVG).
- **Task:** Add a short “Marching ants” section to `WEB_TO_MOBILE_ALIGNMENT.md` or parity doc: “Mobile now uses SVG overlay + getPointInView + Reanimated, matching web’s SVG + CSS animation approach.”
- **Done:** WEB_TO_MOBILE_ALIGNMENT and PLUSCODE_ANIMATION_DISPLAY_SPEC updated for Phase 4 (marching ants = SVG overlay).
- **Done:** Obsolete JS-based LineLayer marching-ants and `gridBorderPhase` / `routeAnimPhase` timers removed (Phase 1 implementation).

---

## Implementation Order (Suggested)

1. **Phase 1.1** – Map ref and projection helper.
2. **Phase 1.2** – Plus Code box SVG overlay; remove center LineLayer ants.
3. **Phase 2.1–2.2** – Camera + active vs center + neighbor exclusion (enables correct “ants move, camera stays” behaviour).
4. **Phase 1.3** – Street SVG overlay on new-create-address; remove street LineLayer ants.
5. **Phase 1.4** – Selected grid rectangle ants or legacy-path decision.
6. **Phase 3.1–3.3** – Breadcrumb visibility and restriction overlay; optional pulse removal.
7. **Phase 4** – Docs and cleanup. — DONE (2026-02-04)

---

## Dependencies & Risks

- **Map ref:** MapViewMapLibre must expose the MapLibre ref (or a wrapper that exposes `getPointInView`) so overlay components can project coordinates. If the ref is currently only internal, this is a prerequisite for Phase 1.
- **Reanimated + SVG:** Use `Animated.createAnimatedComponent` with `react-native-svg` so `strokeDashoffset` is animatable; confirm on both iOS and Android.
- **Performance:** Project only on region change (or when active location changes), not every frame; keep overlay state minimal to avoid unnecessary re-renders.

---

## Web Reference (Summary)

| Feature | Web implementation |
|--------|----------------------|
| Plus Code box ants | `MapView.tsx` → `MarchingAntsOverlay`: SVG rect, bounds from `getGridBounds`, `mapInstance.project(sw/ne)`, CSS `.marching-ants` (1s, stroke-dashoffset 0→-12), strokeDasharray 8 4. |
| Street ants | `ActiveStreetLayer.tsx` → `MarchingAntsStreetOverlay`: SVG path from projected geometry, white outline + dashed path, `.street-marching-ants` (0.8s, stroke-dashoffset 0→-18), strokeDasharray 12 6; start/end circles, lock badge at ~40%. |
| Camera | Camera stays on GPS; active box + ants move to clicked cell. |
| Neighbors | `NeighborBoxesLayer` skips cell that equals `activeLocation` (7 green boxes when a neighbor is selected). |
