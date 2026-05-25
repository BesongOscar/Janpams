# Forensic: Navigation (Web) vs Directions / Rides (Mobile)

**Goal:** Align mobile "Directions / Rides" with web "Navigation" and share core functions (like address creation). This document compares what is implemented on each platform and lists gaps.

**Web reference:** For full detail on how the web handles navigation (flow, UI, search, directions, display), see **[NAVIGATION_WEB_FLOW_AND_UI.md](../../mbukanji-maps/docs/NAVIGATION_WEB_FLOW_AND_UI.md)** in mbukanji-maps.

**Mobile implementation plan:** Phased task list to implement the same navigation flow on mobile (panel, three states, search, waypoints, route card, map): **[NAVIGATION_MOBILE_WEB_FLOW_IMPLEMENTATION_PLAN.md](./NAVIGATION_MOBILE_WEB_FLOW_IMPLEMENTATION_PLAN.md)**.

---

## 1. Naming and entry points

| Aspect | Web (mbukanji-maps) | Mobile (address-maker-glopams) |
|--------|----------------------|------------------------------|
| **Feature name** | **Navigation** | **Directions** / **Rides** (tab label: "Get Directions") |
| **Entry** | Navigation panel (sidebar / map); "Get directions" from search/address | Tab: **route-directions** (`app/(tabs)/route-directions.tsx`) |
| **Primary UI** | `NavigationPanel.tsx` (search, origin/destination, waypoints, modes, route preview) | `route-directions.tsx` (search, start/end, "Find route", route modal) |

---

## 2. Routing engine and shared core

| Aspect | Web | Mobile |
|--------|-----|--------|
| **Route computation** | `generateRoutePath` from **@janpams/core** (web resolves to `apps/core/mbukanji-maps/packages/core`). **Valhalla-only**: WASM + offline tiles; no OSRM/Dijkstra at runtime. | `getRoute()` in `lib/routing/index.ts` → **Valhalla first** (when pack has tiles) via **@jansoft/mbukanji-valhalla-mobile**, then **local** `generateRoutePath` in `lib/routePath.ts` (OSRM cache → Dijkstra → fallback). **Online fallback:** `fetchOSRMRoute` in `lib/routing/osrmClient.ts` when offline fails. |
| **Shared routing in monorepo** | Web uses its **own** `mbukanji-maps/packages/core` (routing + Valhalla). Root `packages/core` has **navigation** (types, OffRoutePolicy, ETATracker) but **no** `generateRoutePath` in the root package. | Mobile uses **root** `packages/core` for pluscode, address, geocoding, streets, **navigation** (types, OffRoutePolicy, ETATracker). Mobile routing is **implemented using @jansoft/mbukanji-valhalla-mobile** (Valhalla for React Native); app-local `lib/valhalla/` wires this package. Fallback chain: `lib/routePath.ts`, `lib/routing/`. |
| **Valhalla** | Valhalla worker + `ValhallaService` in `src/lib/valhalla/`; init via `initValhallaRouting` from `@janpams/core` (web’s local core). | **@jansoft/mbukanji-valhalla-mobile** (mobile Valhalla package). `lib/valhalla/initValhalla.ts`, `ValhallaProvider`; init in SyncManager. Valhalla route via `getValhallaRoute(start, end)`. |

**Mobile Valhalla package:** Routing on mobile is implemented using **@jansoft/mbukanji-valhalla-mobile** (not the web WASM package). The app’s `lib/valhalla/` layer should use this package for init, tile loading, and route requests.

**Gap – shared routing core:** Web and mobile do **not** share the same routing implementation. Web uses its local core (Valhalla WASM). Mobile uses **@jansoft/mbukanji-valhalla-mobile** + app-local fallbacks. To share core: standardize on one contract (e.g. `getRoute(start, end, options)`) and shared types in root `packages/core`; each platform keeps its own Valhalla integration (web WASM, mobile `mbukanji-valhalla-mobile`).

---

## 3. Navigation module (turn‑by‑turn, GPS, ETA, off‑route)

| Component | Web | Mobile |
|-----------|-----|--------|
| **Types** | `src/lib/navigation/types.ts` (local) | Re-exported from **@janpams/core/navigation** (root package) |
| **MatchService** | `src/lib/navigation/matchService.ts` (snap position to route) | `lib/navigation/matchService.ts` (uses core types; platform-specific impl) |
| **GPSService** | `src/lib/navigation/gpsService.ts` (browser geolocation) | `lib/navigation/gpsService.ts` (expo-location) |
| **ETATracker** | `src/lib/navigation/etaTracker.ts` (local) | **@janpams/core/navigation** (shared) |
| **OffRoutePolicy** | `src/lib/navigation/offRoutePolicy.ts` (local) | **@janpams/core/navigation** (shared) |
| **loadStreetGeometry** | `src/lib/navigation/loadStreetGeometry.ts` (web only) | N/A |

**Gap – navigation types/source:** Web keeps its **own** copies of types, ETA, off-route in `mbukanji-maps/src/lib/navigation/`. Mobile already uses **@janpams/core/navigation** for types, ETATracker, OffRoutePolicy. Web could be refactored to use root `@janpams/core/navigation` for types + pure logic (ETA, off-route) so both platforms share one source.

---

## 4. UI and UX comparison

| Feature | Web (NavigationPanel) | Mobile (route-directions) |
|---------|------------------------|----------------------------|
| **Search for origin/destination** | Yes: unified search + planning mode with origin/destination/stop fields; `useSearch` with current position. | Yes: start/destination inputs; local Jango/global search (offline-first). |
| **Waypoints (A → B → C)** | Yes: multiple stops; badges A/B/C; reorder; each leg via `generateRoutePath`; waypoints passed in options. | Partial: `waypoints` state and RouteModal accept waypoints for **external** apps (e.g. Google/Apple Maps). **No** multi-stop route calculation in-app (only A→B). |
| **Transport modes** | Car, Transit, Bike, Walk + route preference (fastest/shortest) + avoid (U-turns, ferries, highways, tunnels, tolls, unpaved). | Car, Bike, Walk via `useRouteOptions`; passed to offline route and OSRM fallback. **No** transit mode; **no** avoid toggles in UI. |
| **Route preview on map** | Yes: when origin + destination set, route is computed and `onGetDirections(route)` called; map shows polyline and fit bounds. | Yes: after "Find route", path shown on map; `RouteModal` with distance/duration and "Open in external app". |
| **Start navigation (live)** | Planned in NAVIGATION_IMPLEMENTATION_PLAN (Navigation Controller, step generator, voice, UI). **Not yet implemented**: no live GPS along route, no turn-by-turn. | `useNavigation` hook and "Start navigation" exist; ETA/snap/off-route can be wired (MOBILE_WEB_FEATURE_PARITY_PLAN Task 3.6). **Partially implemented**: hook and services present; full live flow not complete. |
| **No routing data / no pack** | Message + "Manage data packs" → Offline data manager. | `NoRoutingDataCard`; OfflineDataManager; same idea. |

---

## 5. Gaps summary (mobile vs web)

1. **Routing core not shared**  
   - Web: Valhalla-only in web’s local `packages/core`.  
   - Mobile: Valhalla + OSRM cache + Dijkstra + OSRM online in app `lib/`.  
   - **Gap:** No single shared routing API in root `packages/core`; duplicate/divergent logic.

2. **Multi-stop waypoints (A → B → C)**  
   - Web: Full UI and logic (stops, reorder, per-leg route, combined path).  
   - Mobile: Waypoints only for external app URLs; **no** in-app multi-leg route.  
   - **Gap:** Mobile needs waypoint UI and multi-leg routing (reuse or mirror web contract).

3. **Route preferences (avoid options)**  
   - Web: Fastest/shortest + avoid U-turns, ferries, highways, tunnels, tolls, unpaved.  
   - Mobile: Mode (car/bike/walk) only; **no** avoid toggles.  
   - **Gap:** Mobile needs avoid/preference options and pass them into shared or local routing.

4. **Transit mode**  
   - Web: Transit in UI (duration heuristic only).  
   - Mobile: No transit.  
   - **Gap:** Optional; add only if product requires transit on mobile.

5. **Live navigation (turn‑by‑turn)**  
   - Web: Planned (controller, steps, voice, UI) but not built.  
   - Mobile: Hook and services (GPS, match, ETA, off-route) exist; full flow not wired.  
   - **Gap:** Both need a clear “start navigation” → GPS → snap → ETA → off-route flow; can share types and policies from `@janpams/core/navigation`.

6. **Navigation types in core**  
   - Web: Own `lib/navigation/*` (types, etaTracker, offRoutePolicy).  
   - Mobile: Uses `@janpams/core/navigation`.  
   - **Gap:** Web should use root `@janpams/core/navigation` for types and pure logic so one source of truth.

7. **Naming**  
   - Web: "Navigation".  
   - Mobile: "Directions" / "Get Directions" / "Rides" (tab).  
   - **Gap:** Product decision: unify label (e.g. "Navigation") or keep "Directions" and document equivalence.

---

## 6. Recommended direction for shared core

1. **Root `packages/core`**  
   - Export a **routing API** (e.g. `getRoute(start, end, options)` and/or `generateRoutePath`) and shared types (`RoutePathResult`, `RoutePathOptions`, costing/mode).  
   - Web: Switch to root `@janpams/core` for routing (or adopt the same API from a shared subpath).  
   - Mobile: Use **@jansoft/mbukanji-valhalla-mobile** for Valhalla; wrap `lib/routing` + `lib/routePath` to call shared core types/contract where possible. Keep Valhalla provider and SQLite/cache as app adapters.

2. **Navigation**  
   - Web: Use `@janpams/core/navigation` for types, `OffRoutePolicy`, `ETATracker`; keep MatchService/GPSService in app (browser vs expo-location).  
   - Mobile: Already aligned; ensure `useNavigation` and route-directions screen use the same types and policies.

3. **Feature parity**  
   - Mobile: Add waypoints (multi-stop) UI and multi-leg routing.  
   - Mobile: Add route preferences (fastest/shortest, avoid options) and pass them into routing.  
   - Both: Implement or complete live navigation (session, steps, GPS snap, ETA, off-route) using shared navigation core.

4. **Naming**  
   - Option A: Rename mobile tab/label to "Navigation" for consistency.  
   - Option B: Keep "Directions" on mobile and document that it is the same feature as web "Navigation".

---

## 7. File reference

| Area | Web | Mobile |
|------|-----|--------|
| **Navigation panel / screen** | `apps/core/mbukanji-maps/src/components/navigation/NavigationPanel.tsx` | `apps/core/address-maker-glopams/app/(tabs)/route-directions.tsx` |
| **Route modal / preview** | MapPage + onGetDirections (polyline + bounds) | `components/modals/RouteModal.tsx` |
| **Routing entry** | `generateRoutePath` from `@janpams/core` (web local) | `lib/routing/index.ts` (`getRoute`), `lib/routePath.ts`, `lib/valhalla/` (uses **@jansoft/mbukanji-valhalla-mobile**) |
| **Navigation lib** | `src/lib/navigation/*` (types, match, gps, eta, offRoute) | `lib/navigation/*` + `@janpams/core/navigation` |
| **Offline route hook** | N/A (route in panel) | `hooks/useOfflineRoute.ts` |
| **Route options (mode)** | NavigationPanel state (transportMode, routePreference, avoidSettings) | `hooks/useRouteOptions.ts` |
| **Docs** | `docs/NAVIGATION_IMPLEMENTATION_PLAN.md` | `docs/MOBILE_WEB_FEATURE_PARITY_PLAN.md` (Tasks 3.x) |

---

*Generated for alignment of Directions/Rides (mobile) with Navigation (web) and shared core.*
