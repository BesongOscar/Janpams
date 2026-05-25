# Mobile Navigation: Web-Flow Implementation Plan

Implement the **same** navigation flow on mobile as on web (UI, logic, search, adding destinations, route card, map behaviour). This plan is phased; each task includes **how**, **why**, and **expected behaviour**. No code — planning only.

**Source of truth (web):** [NAVIGATION_WEB_FLOW_AND_UI.md](../../mbukanji-maps/docs/NAVIGATION_WEB_FLOW_AND_UI.md)  
**Current mobile screen:** `app/(tabs)/route-directions.tsx`

---

## Overview

| Phase | Focus |
|-------|--------|
| **Phase 1** | Panel structure, entry point, and state machine |
| **Phase 2** | State 1 — Default search (single input + results) |
| **Phase 3** | State 2 — Address found + "Get Directions →" |
| **Phase 4** | State 3 — Planning UI (waypoints, swap, add stop, clear) |
| **Phase 5** | Planning search (one dropdown at a time per field) |
| **Phase 6** | Transport modes and route preferences |
| **Phase 7** | Route calculation, route card, and map display |
| **Phase 8** | Map integration (fly-to, fit-bounds, show-route, markers) |
| **Phase 9** | Copy, errors, and parity polish |

---

## Phase 1 — Panel structure, entry point, and state machine

### Task 1-A1: Dedicated navigation panel (sheet) instead of top-bar form **[implemented]**

| | |
|--|--|
| **How** | Introduce a single navigation panel (e.g. `SwipeableBottomSheet` or equivalent) that holds **all** navigation UI. Move search and planning content out of the current top bar. Top bar on the Directions tab should only show: tab/label, menu, and optionally a trigger to open/focus the panel — **no** search input or transport chips in the top bar when in “navigation” flow. |
| **Why** | Web keeps all navigation in one floating panel; the top bar does not show search in navigation mode. Putting the full form in the top bar causes layout and overflow issues (e.g. wrong flex, cramped content). A dedicated panel gives space for the three states and scrollable content. |
| **Expected behaviour** | On opening the Directions tab, user sees a minimal top bar and a panel (collapsed or expanded). All “Enter address”, “Get Directions →”, and planning (origin/destination/stops, transport, route card) live inside this panel. Top bar never shows the big search or the full planning form. |

**Implementation summary (Task 1-A1):** In `route-directions.tsx`, a `SwipeableBottomSheet` (Navigation Panel) was added and all navigation UI was moved into it. The top bar now only shows: menu icon, "Directions – Rides" / "Plan – Routes" tabs, and when the panel is dismissed a chevron-up trigger to reopen it. The sheet holds either the getDirection search input or the full findRoute form (transport modes, route options, waypoint inputs, CTA) inside a `ScrollView` with `flexDirection: 'column'` for the findRoute container. State `showNavigationPanel` (default `true`) controls visibility; `onDismiss` sets it to `false`. Tab bar is hidden when the navigation panel or offline manager is open. Sheet heights: collapsed 72, expanded 420, full 680.

### Task 1-A2: Three-state panel state machine **[implemented]**

| | |
|--|--|
| **How** | Define and drive panel UI from a single `panelState`: `'default' \| 'address-found' \| 'planning'`. Render different content per state (State 1: one search; State 2: same search + “Get Directions →”; State 3: waypoints + transport + preferences + route card). Ensure only one state is active at a time and transitions are explicit. |
| **Why** | Web uses this exact state machine. Aligning mobile to the same states ensures identical flow: search first → choose destination → then “Get Directions →” → then planning. |
| **Expected behaviour** | Panel shows State 1 until user selects a search result; then State 2 until user taps “Get Directions →”; then State 3. No mixing of “search” and “planning” in one view; back/clear actions reset to the correct state (e.g. “Clear” → State 1, “Back to search” → State 1 or 2 as per web). |

**Implementation summary (Task 1-A2):** Added `panelState` (`'default' | 'address-found' | 'planning'`) and use it only when `activeNav === 'findRoute'`. On switching to Plan – Routes, `panelState` is set to `'default'`. State 1 (default): single search input; on result select → set destination and `panelState = 'address-found'` (modal not opened). State 2 (address-found): same input showing destination + “Get Directions →” button; on tap → `panelState = 'planning'`. State 3 (planning): existing findRoute content (ScrollView) plus a row with “Clear” (resets to default, clears destination/route/waypoints) and “← Back to search” (sets `panelState = 'address-found'`). Destination search overlay now shows when `panelState !== 'planning' || routeOptions.waypoints.length === 0` so it works in default/address-found.

### Task 1-A3: Entry point and “navigation only” scope

| | |
|--|--|
| **How** | Decide and document the single entry for this flow (e.g. “Directions” or “Navigation” tab). If keeping two tabs (“Directions – Rides” vs “Plan – Routes”), define that the **web-like flow** applies to one of them (e.g. Plan – Routes) and that opening it shows the panel with State 1. Ensure map and other UI (e.g. MapControls, offline icon) remain available; only the navigation UX follows the three-state panel. |
| **Why** | Web has one “Navigation” mode and one panel. A single clear entry avoids duplicate flows and keeps behaviour consistent with the spec. |
| **Expected behaviour** | User has one obvious way to start “search for a place then get directions” (e.g. open Directions/Plan tab → panel opens or is visible with “Enter address or place name”). No competing top-bar search for the same flow. |

---

## Phase 2 — State 1: Default search

### Task 2-B1: Single search input and placeholder

| | |
|--|--|
| **How** | In panel State 1, show exactly one text input with placeholder “Enter address or place name” (or i18n equivalent). No origin/destination fields yet. Input is the only way to search in this state. |
| **Why** | Web State 1 is a single search to find a place; that place becomes the destination after selection. |
| **Expected behaviour** | User sees one search box. Typing triggers search; no other search inputs or waypoint fields are visible in State 1. |

### Task 2-B2: Search results list and selection sets destination

| | |
|--|--|
| **How** | When the user types, show a results list (reuse or align with existing Jango/global search). On result selection: (1) set destination display text and coordinates, (2) transition panel to State 2 (`address-found`), (3) notify map (fly-to or fit-bounds for the selected result as per web). Do not open planning yet. |
| **Why** | Web uses one search and one selection to set “destination”; only after that does “Get Directions →” appear. Selection must store coordinates so the destination is known for later route calculation. |
| **Expected behaviour** | User types → sees results → taps one → input shows chosen place name, panel shows “Get Directions →”, map moves to the selected location. Panel does not yet show origin/destination/planning fields. |

### Task 2-B3: Map reaction on search result select (State 1 → 2)

| | |
|--|--|
| **How** | When a search result is selected in State 1, call a callback (e.g. `onSearchSelect`) with the result. The screen uses it to: fly map to the point (or fit-bounds for streets), and optionally set search highlight for street/place. Use existing map APIs (e.g. `animateToRegion`, route overlay) so behaviour matches web’s fly-to/fit-bounds/highlight. |
| **Why** | Web moves the map and can show a highlight when user picks a place; mobile should do the same so the user sees where the destination is. |
| **Expected behaviour** | After selecting a result, map animates to the selected location (and optional highlight for street/place). User clearly sees the chosen destination on the map before tapping “Get Directions →”. |

---

## Phase 3 — State 2: Address found + “Get Directions →”

### Task 3-C1: Show “Get Directions →” only in State 2

| | |
|--|--|
| **How** | In State 2 (`address-found`), render a single action: “Get Directions →” (button or link) below the search input (which now shows the selected destination text). Tapping it transitions to State 3 (`planning`) and clears any previous route state; destination text and coordinates are preserved. |
| **Why** | Web explicitly separates “I found a place” (State 2) from “I’m planning origin/destination/stops” (State 3). The explicit “Get Directions →” is the only way to enter planning. |
| **Expected behaviour** | User in State 2 sees “Get Directions →”. Tapping it opens the planning view (origin, stops, destination, transport, etc.) with destination pre-filled. No route is calculated until origin and destination both have coordinates from search in State 3. |

### Task 3-C2: No planning fields in State 2

| | |
|--|--|
| **How** | In State 2, do not render origin/destination/stops inputs, transport modes, or route card. Only the search input (with selected value) and “Get Directions →”. |
| **Why** | Keeps the flow identical to web: first choose destination, then enter planning. |
| **Expected behaviour** | State 2 looks minimal: one filled search field + one action. No waypoints or route options visible until user taps “Get Directions →”. |

---

## Phase 4 — State 3: Planning UI (waypoints, swap, add stop, clear)

### Task 4-D1: Waypoint list with Start, Stops, End

| | |
|--|--|
| **How** | In State 3, render a vertical list: **Start** (origin), zero or more **Stop 1, Stop 2, …**, **End** (destination). Each row has a label/badge (e.g. green Start, amber Stops, red End) and an input. Destination is pre-filled from State 2. Use a single column layout (e.g. `flexDirection: 'column'`); do not use a horizontal row for the whole block. |
| **Why** | Web shows a vertical waypoint column with clear Start / Stops / End; mobile layout was broken by using row. Vertical stacking matches web and avoids overflow. |
| **Expected behaviour** | User sees Start (optional “Your location”), optional stops, and End in a vertical list. Scrolling works if content is long. Layout is readable and not cramped. |

### Task 4-D2: Waypoint badges (A, B, C, …) and swap button

| | |
|--|--|
| **How** | Show visual badges for each waypoint (e.g. A for start, B/C/… for stops, last letter for destination). Add a “Swap” control (e.g. icon or button) that swaps origin and destination (and optionally reverses stops). Update both display text and stored coordinates. |
| **Why** | Web uses badges and a swap button for quick origin/destination flip. |
| **Expected behaviour** | Badges are visible and swap correctly exchanges origin and destination (and coordinates); list order and map markers update accordingly. |

### Task 4-D3: Add stop and remove stop

| | |
|--|--|
| **How** | Provide “Add stop” to append a new stop row (empty placeholder “Stop N”). Each stop row has a way to remove it (e.g. X). State: `stops[]` (display text) and `stopsCoords[]` (coordinates when set from search). |
| **Why** | Web supports multiple stops between origin and destination; mobile should support the same for parity. |
| **Expected behaviour** | User can add one or more stops and remove any stop. Order is preserved; route calculation (Phase 7) will use origin, stops in order, then destination. |

### Task 4-D4: Clear and Back to search

| | |
|--|--|
| **How** | “Clear” resets the panel to State 1, clears all waypoints and route state, and triggers map clear-route (remove polyline). “← Back to search” returns to State 1 (or State 2 if destination was already chosen) without clearing destination; optionally clear route and planning fields. Behaviour should match web. |
| **Why** | Web has Clear (full reset) and Back to search (return to search view); mobile needs both for same mental model. |
| **Expected behaviour** | Clear: panel shows single search again, map has no route line, no waypoints. Back to search: user returns to search/address-found view; destination can remain or be cleared per spec. |

---

## Phase 5 — Planning search (one dropdown at a time)

### Task 5-E1: One focused field and one results list

| | |
|--|--|
| **How** | In State 3, track which field has focus: `planningFocusedField`: `'origin' \| 'destination' \| number` (stop index). When the user focuses an input (Start, a Stop, or End), set this and show **one** results list/dropdown for that field only. When no field is focused (or user blurs), hide the results list and show the rest of the panel (transport, preferences, route card). |
| **Why** | Web shows only one dropdown at a time (for the focused origin/destination/stop). Multiple dropdowns would be confusing and layout-heavy on mobile. |
| **Expected behaviour** | Focusing Start shows search results for origin only; focusing End shows results for destination only; focusing Stop N shows results for that stop. Only one list visible at a time; tapping outside or selecting a result closes the list. |

### Task 5-E2: Search per field and coordinate storage

| | |
|--|--|
| **How** | For each waypoint type (origin, destination, each stop), use the same search backend (Jango/global) but separate “query” and “results” state per field, or one shared search that is “bound” to the currently focused field. On result selection: set that field’s display text and **coordinates**; close the dropdown and clear focus (or set focus to next field if desired). |
| **Why** | Route calculation (Phase 7) requires coordinates for origin and destination (and stops if multi-leg). Free text alone is not enough; selection from search must store coords. |
| **Expected behaviour** | User taps Start → types → selects result → Start shows the chosen name and stores [lon, lat]. Same for End and each Stop. Route runs only when origin and destination both have coordinates. |

### Task 5-E3: Placeholder and “Your location” for origin

| | |
|--|--|
| **How** | Start (origin) placeholder: “Your location” or equivalent. If the app has GPS, optionally pre-fill origin with current location (display text + coordinates) when entering State 3 so the user can leave it as is. If no GPS, user must search for a start place. |
| **Why** | Web uses “Your location” and can default origin to GPS; mobile should match. |
| **Expected behaviour** | Origin shows “Your location” when GPS is used; otherwise user can search. Destination and stops use “Choose destination” / “Stop N” placeholders until set. |

---

## Phase 6 — Transport modes and route preferences

### Task 6-F1: Transport mode row (Car, Bike, Walk; optional Transit)

| | |
|--|--|
| **How** | In State 3, below the waypoint list (and when no search dropdown is open), show a horizontal row of transport modes: Car, Bike, Walk. Optionally add Transit if product requires it (web has it). One mode selected at a time; selection is stored and passed to route calculation. |
| **Why** | Web shows Car | Transit | Bike | Walk; mobile already has Car/Bike/Walk. Same options and single selection. |
| **Expected behaviour** | User can select one mode; selection is visually clear; route (Phase 7) uses the selected mode. |

### Task 6-F2: Route preferences (Fastest / Shortest) and avoid options

| | |
|--|--|
| **How** | Add a collapsible “Route preferences” section: (1) Route type: Fastest time vs Shortest distance (radio or segmented). (2) Avoid toggles: U-turns, ferries, highways, tunnels, toll roads, unpaved (as on web). Store preferences and pass them into the route request (Valhalla/OSRM options where supported). |
| **Why** | Web has these; forensic doc notes mobile currently has no avoid toggles. Parity requires the same options and wiring to routing. |
| **Expected behaviour** | User can choose fastest/shortest and toggle avoid options; route recalculation (Phase 7) uses these settings. UI is collapsible so the panel is not overwhelming. |

---

## Phase 7 — Route calculation, route card, and map display

### Task 7-G1: Run route when origin and destination have coordinates

| | |
|--|--|
| **How** | In State 3, whenever both origin and destination have stored coordinates (from search selection or “Your location”), trigger route calculation (existing Valhalla/OSRM or equivalent). Use waypoints (stops) and transport/preferences from Phase 6. Do not run route when either origin or destination is only free text without coordinates. |
| **Why** | Web runs route only when both endpoints have coords from dropdown selection; same rule avoids failed or misleading routes. |
| **Expected behaviour** | Route runs automatically when user has set both Start and End from search (or GPS for start). Loading indicator is shown; on success show route card and map polyline; on failure show error (Phase 9). |

### Task 7-G2: Single route card (duration, distance, “Leave now”, mode)

| | |
|--|--|
| **How** | When route calculation succeeds, show one **route card** in the panel: duration (e.g. “~X min”), distance, “Leave now” (or equivalent), and selected transport mode. Card is tappable: on press, call `onGetDirections(route)` (or equivalent) so the map shows the polyline and fits bounds. If route is already shown, tap can re-fit or do nothing. |
| **Why** | Web shows a single route card and uses it to trigger map display; mobile should mirror this. |
| **Expected behaviour** | User sees one card with summary; tapping it ensures the route is drawn on the map and map fits the route. No duplicate cards or modals unless design explicitly adds “Open in external app” from the same card. |

### Task 7-G3: Map polyline and fit on route result

| | |
|--|--|
| **How** | When a route is available (from Task 7-G2 or auto-run), draw the route path as a polyline on the map and fit the map bounds to the route (with padding). Use existing map/route overlay APIs. If user taps the route card, ensure polyline and fit are applied (idempotent if already shown). |
| **Why** | Web shows the route on the map and fits bounds; mobile must do the same for the same experience. |
| **Expected behaviour** | After route is calculated, user sees the route line on the map and the map view includes the full route. Clear (Phase 4) removes the polyline. |

### Task 7-G4: Recalculate on mode/preference/waypoint change

| | |
|--|--|
| **How** | When the user changes transport mode, route preferences, or waypoints (add/remove/change), re-run route calculation if origin and destination still have coordinates. Update route card and map polyline with the new result. |
| **Why** | Web recalculates when these change; mobile should too. |
| **Expected behaviour** | Changing mode or preferences or editing waypoints triggers a new route and updated card/map. Loading state is shown during recalc. |

---

## Phase 8 — Map integration (fly-to, fit-bounds, show-route, markers)

### Task 8-H1: Map fly-to / fit-bounds on search select and planning point select

| | |
|--|--|
| **How** | When user selects a result (State 1 or in State 3 for any waypoint), move the map: for a point use fly-to (or equivalent) with appropriate zoom; for a street use fit-bounds if available. Optionally set a search highlight for street/place (if mobile has an equivalent to SearchHighlightLayer). |
| **Why** | Web flies or fits the map and can show highlight; mobile should mirror. |
| **Expected behaviour** | Every search selection (destination in State 1, or origin/destination/stop in State 3) updates the map view so the user sees the chosen location. |

### Task 8-H2: Planning markers (A, B, C, …) on map

| | |
|--|--|
| **How** | When in State 3 and origin and/or stops and/or destination have coordinates, show markers on the map (e.g. green for start, amber for stops, red for destination) with labels A, B, C, … Match web’s PlanningMarkersLayer behaviour. |
| **Why** | Web shows these markers; they help users confirm waypoints on the map. |
| **Expected behaviour** | As user sets waypoints, corresponding markers appear on the map. When waypoints are cleared, markers are removed. |

### Task 8-H3: Fit map to all planning points when points change

| | |
|--|--|
| **How** | When `planningPoints` (origin, stops, destination) change and at least two points exist, fit the map bounds to include all of them (with padding). When only one point exists, fly to that point. When none, no automatic move (or keep current view). |
| **Why** | Web fits bounds to all planning points so the full trip is visible. |
| **Expected behaviour** | Adding or changing waypoints triggers a fit so all markers are visible. Clear removes markers and optionally leaves map view as is or resets. |

### Task 8-H4: Clear route on Clear action

| | |
|--|--|
| **How** | When user taps “Clear”, remove the route polyline from the map and clear any route state in the panel. Ensure map layer/source for the route is removed. |
| **Why** | Web dispatches map-clear-route on Clear; mobile must do the same. |
| **Expected behaviour** | After Clear, no route line is visible and panel is in State 1. |

---

## Phase 9 — Copy, errors, and parity polish

### Task 9-I1: Copy for “select from list” and no routing data

| | |
|--|--|
| **How** | When user has typed origin/destination but not selected from the list (no coordinates), show a short message: e.g. “Select origin and destination from the list to calculate the route.” When route fails due to no routing data, show message and “Manage data packs” (or equivalent) that opens the offline data manager. |
| **Why** | Web uses this copy; it sets clear expectations and guides the user. |
| **Expected behaviour** | User sees the hint when only text is entered; user sees the no-data message and can open data packs when route fails for that reason. |

### Task 9-I2: Route loading and error states

| | |
|--|--|
| **How** | During route calculation, show a loading indicator (e.g. spinner or “Calculating route…”). On failure, show a clear error message (init failure vs no data) and optional “Copy” for technical error if needed. Do not show a route card when calculation failed. |
| **Why** | Web shows loading and distinct error states; mobile should match. |
| **Expected behaviour** | Loading is visible while route is computing; errors are clear and actionable (e.g. Manage data packs, or try again). |

### Task 9-I3: “← Back to search” and i18n

| | |
|--|--|
| **How** | In State 3, show “← Back to search” (or i18n key) at the bottom. Use the same i18n keys as web where applicable (e.g. route options, avoid labels, transport labels) so copy is consistent. |
| **Why** | Web has this link and consistent copy; mobile should too. |
| **Expected behaviour** | User can return to search view from planning; all user-facing strings are translatable and aligned with web where possible. |

### Task 9-I4: Panel visibility and tab bar (optional)

| | |
|--|--|
| **How** | If the navigation panel is implemented as a bottom sheet, ensure tab bar visibility: hide tab bar when the sheet is open (or when expanded), show it when closed/collapsed — matching Find/Create Address behaviour if that pattern exists. |
| **Why** | Consistency with other sheets (e.g. Offline Data Manager) and cleaner focus on navigation. |
| **Expected behaviour** | When the navigation panel is open/expanded, the bottom tab bar is hidden; when closed/collapsed, it reappears. |

---

## Summary table

| Phase | Tasks | Outcome |
|-------|--------|---------|
| 1 | A1–A3 | Dedicated panel, three-state machine, single entry |
| 2 | B1–B3 | State 1: single search, results, selection → State 2, map reacts |
| 3 | C1–C2 | State 2: “Get Directions →” only, no planning fields |
| 4 | D1–D4 | State 3: waypoints, swap, add/remove stop, clear, back to search |
| 5 | E1–E3 | One dropdown at a time, coords per field, “Your location” |
| 6 | F1–F2 | Transport row, route preferences and avoid options |
| 7 | G1–G4 | Route when coords set, route card, polyline, recalc on change |
| 8 | H1–H4 | Map fly-to/fit, planning markers, fit to points, clear route |
| 9 | I1–I4 | Copy, errors, back link, i18n, tab bar/sheet behaviour |

---

## Dependencies

- **Existing:** Map component and ref, search hooks (Jango/global), route calculation (Valhalla/OSRM), OfflineDataManager, SwipeableBottomSheet (or equivalent).
- **Web spec:** [NAVIGATION_WEB_FLOW_AND_UI.md](../../mbukanji-maps/docs/NAVIGATION_WEB_FLOW_AND_UI.md) for exact flow and UI.
- **Out of scope for this plan:** Live turn-by-turn navigation (Start navigation, voice, off-route); that remains a separate effort.
