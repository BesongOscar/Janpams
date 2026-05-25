# Navigation Implementation for Mobile — Task Plan

**App:** `address-maker-glopams` (JanGo mobile)
**Date:** March 2026
**Architecture:** Google Maps-style split — Web does route planning/preview, Mobile owns active turn-by-turn navigation

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Target State Summary](#2-target-state-summary)
3. [Key Design Decisions](#3-key-design-decisions)
4. [Gap Analysis](#4-gap-analysis)
5. [Phase 1 — Foundation: Types, State Machine, Store](#phase-1)
6. [Phase 2 — Core Services: Engine Adapter, PackManager, RouteNormalizer](#phase-2)
7. [Phase 3 — Navigation Orchestrator: NavigationCore](#phase-3)
8. [Phase 4 — Wire into UI](#phase-4)
9. [Phase 5 — Error Handling & Missing-Pack Flow](#phase-5)
10. [Phase 6 — QR Navigation (Deferred)](#phase-6)
11. [File Inventory: Current vs New](#7-file-inventory)
12. [Testing Strategy](#8-testing-strategy)
13. [Migration & Backward Compatibility](#9-migration)
14. [Risks & Mitigations](#10-risks)
15. [Definition of Done](#11-done)

---

<a id="1-current-state-summary"></a>
## 1. Current State Summary

### What exists and works

The app has a functional (but tightly coupled) navigation flow built across these files:

| File | Role | Lines |
|------|------|-------|
| `packages/core/src/navigation/types.ts` | Shared types: `Coords`, `Route`, `NavigationSession`, `MatchResult`, `ETAResult`, `OffRouteAction`, `GPSPosition`, `GPSQuality`, `NavigationStep`, `ManeuverType` | 131 |
| `packages/core/src/navigation/matchService.ts` | GPS-to-route snapping via perpendicular projection. Pure geometry. | 138 |
| `packages/core/src/navigation/offRoutePolicy.ts` | Off-route detection + action decision (warn/reroute/guide). Stateful (tracks deviation start time). | 69 |
| `packages/core/src/navigation/etaTracker.ts` | Rolling average speed → ETA calculation. Format helpers. | 76 |
| `lib/navigation/gpsService.ts` | Expo-location wrapper. Accuracy gating, position smoothing, quality classification. Singleton `gpsService`. | 128 |
| `lib/navigation/voiceGuidance.ts` | TTS via `expo-speech`. Speak instruction, speak arrival, mute toggle. | 52 |
| `lib/valhalla/ValhallaProvider.ts` | Native Valhalla engine adapter. init/loadTiles(buffer→file)/route. Singleton `valhallaProvider`. | 136 |
| `lib/valhalla/initValhalla.ts` | Engine readiness orchestration. Load tiles for installed packs. `getValhallaRoute()` with request building + LRU cache. | 152 |
| `lib/valhalla/tileStorage.ts` | SQLite storage for Valhalla tiles. Staging → production commit. Tar archive building. | 145 |
| `lib/valhalla/valhallaCache.ts` | In-memory LRU cache (100 entries) for Valhalla route results. | 46 |
| `lib/routing/index.ts` | Route entry point: Valhalla → Dijkstra/cached → fallback. Step mapping. | 159 |
| `lib/routing/osrmClient.ts` | Online OSRM fallback. | ~80 |
| `lib/routing/routeCache.ts` | SQLite route cache (pre-computed OSRM routes from pack download). | ~300 |
| `lib/routePath.ts` | Graph-based pathfinding: OSRM cached → Dijkstra on street graph → fallback. | ~810 |
| `lib/japaState.ts` | Pack lifecycle state (NOT_INSTALLED → INSTALLED). `getInstalledPacks()`, `getPackState()`. | ~100 |
| `hooks/useNavigation.ts` | Live navigation state hook. Orchestrates GPS → match → ETA → off-route in `handleGPSUpdate`. Returns `NavigationState`. | 142 |
| `hooks/useOfflineRoute.ts` | Route fetching hook. Wraps `getRoute()` with loading/error/success state. | 142 |
| `components/NavigationOverlay.tsx` | Active navigation UI: ETA, distance, instruction, off-route banner, reroute button, voice toggle, stop. | 322 |
| `components/modals/RouteModal.tsx` | Route preview modal: external nav apps + in-app "Start Navigation" CTA. | ~600 |
| `app/(tabs)/route-directions.tsx` | **Main screen (2100+ lines)**: search, map, route options, route fetching, live navigation, reroute — all inline. | 2100+ |
| `lib/store/mapStore.ts` | Zustand store for map/address state. Already established pattern. | ~120 |

### What works well

- **MatchService**: Clean, pure geometry. Tested pattern. Reusable as-is.
- **ETATracker**: Rolling average approach is solid. Format helpers are useful.
- **GPSService**: Proper accuracy gating, smoothing, quality classification.
- **VoiceGuidance**: Simple and effective TTS wrapper.
- **ValhallaProvider**: Working native engine integration with file-based pack loading.
- **Tile storage**: SQLite staging/production flow for tiles.
- **Zustand pattern**: Already established in `mapStore.ts` — team is familiar.

### What needs improvement

- **No formal state machine**: Navigation states are implicit (`isNavigating` boolean). No defined transitions or guards.
- **No centralized orchestrator**: Navigation logic is scattered across `route-directions.tsx` (route fetching, start, reroute), `useNavigation` (GPS loop, snapping, ETA), and `NavigationOverlay` (arrival detection via progress threshold).
- **Monolithic screen**: `route-directions.tsx` at 2100+ lines handles search, map, route options, route preview, live navigation, and rerouting all inline.
- **No request cancellation**: Route computations are fire-and-forget. No mechanism to cancel stale requests on reroute or stop.
- **OffRoutePolicy conflates detection and decision**: One class handles both "how far from route" and "what to do about it". Cannot independently test or swap either.
- **No pack resolution for navigation**: Pack selection is manual (`getInstalledPacks()[0]`). No coordinate-to-region mapping, no MISSING/INCOMPATIBLE handling.
- **No NavigationSession model**: The existing `NavigationSession` in types.ts is for route history, not for active session state management.
- **Arrival detection is UI-side**: Progress threshold (0.95) in `NavigationOverlay` drives arrival, rather than distance-based detection in the core.
- **No formal error codes**: Failures show generic messages. No structured `NavigationFailureCode` → user action mapping.
- **No QR support**: QR payload types exist in the proposed contract but nothing is implemented.
- **No ETA/maneuver in session**: Session doesn't carry snapped position, current maneuver index, or live ETA.

---

<a id="2-target-state-summary"></a>
## 2. Target State Summary

After implementation, the navigation system will:

1. Use a **single NavigationCore class** as the orchestrator for all navigation flows (Standard and QR)
2. Drive a **formal state machine** with defined transitions: `IDLE → RESOLVING_CONTEXT → ROUTE_PREVIEW_READY → NAVIGATING → OFF_ROUTE_RECALCULATING → ARRIVED → FAILED`
3. Store all navigation state in a **Zustand store** (`navigationStore`) — reactive, observable, debuggable
4. Use **dependency injection** for all services (engine, GPS, pack manager, etc.) — testable, swappable
5. Produce a **canonical `ValhallaRouteResult`** shape from all route sources via a `RouteNormalizer`
6. Have **structured error handling** with `NavigationFailureCode` → i18n → actionable UI
7. Support **request cancellation** for all route computations
8. Manage **pack resolution** automatically (coordinate → region → load/missing)
9. Handle **missing-pack fallback** gracefully (compass guidance + download CTA)
10. Be **QR-ready** architecturally, with QR implementation as a follow-on phase

---

<a id="3-key-design-decisions"></a>
## 3. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | **Zustand** (not Redux Toolkit) | Already in use (`mapStore.ts`). Simpler API, less boilerplate, same team familiarity. The proposed docs suggest Redux, but the codebase has already established Zustand — switching to Redux would be disruptive for no clear gain. |
| NavigationCore pattern | **Service class with DI** | Clean orchestration boundary. Easy to inject mock dependencies. Easy to test. The proposed `navigation.core.ts` already uses this pattern. |
| State machine | **Pure function module** | `transition(current, event) → next` with no side effects. Fully unit-testable. Enforces valid transitions, prevents impossible states. |
| Type strategy | **Extend, don't replace** | New types (from proposed contract) are added alongside existing types. Existing code continues to import from `@janpams/core/navigation`. Backward compatibility via re-exports. |
| Arrival detection | **Distance-based in core** (not progress-based in UI) | Haversine distance to last route point ≤ threshold (20m). More reliable than progress percentage. Handles short routes and rerouted routes correctly. |
| Off-route architecture | **Split into OffRouteDetector + ReroutePolicy** | Detector is pure (GPS point + route → distance). Policy is stateful (cooldowns, debounce). Independently testable and swappable. |
| Voice guidance trigger | **Store subscription** (not UI effect) | NavigationCore updates `currentManeuverIndex` in store. Voice service subscribes to store changes. Decouples voice from UI render cycle. |
| Geometry library | **Keep existing haversine** (defer Turf.js) | Existing `haversineMeters` from `packages/core/geolocation` works. Turf.js is a large dependency. Introduce only if specific functions (e.g., `nearestPointOnLine`) prove necessary beyond what MatchService already handles. |
| TTS library | **Keep `expo-speech`** (defer `react-native-tts`) | Already working. `expo-speech` is maintained and sufficient for v1 needs. Switch to `react-native-tts` only if specific limitations are hit. |

---

<a id="4-gap-analysis"></a>
## 4. Gap Analysis

| Area | Current State | Target State | Gap Severity |
|------|---------------|--------------|:------------:|
| State machine | Implicit (`isNavigating` boolean) | Formal state machine with 7 states + guarded transitions | **High** |
| Session model | `NavigationSession` is route-history oriented | Rich session: state, intent, route, summary, failure, snapped position, ETA, maneuver index | **High** |
| Orchestrator | Scattered across `route-directions.tsx` + hooks | Single `NavigationCore` class with DI | **High** |
| State management | Hook-local `useState` in `useNavigation` | Zustand `navigationStore` — global, reactive | **High** |
| Pack resolution | `getInstalledPacks()[0]` — first pack, no coord mapping | `PackManager.resolvePackForIntent()` with coordinate-to-region mapping | **Medium** |
| Request cancellation | Not implemented | `engine.cancel(requestId)` on reroute, stop, screen exit | **Medium** |
| Error handling | Generic messages, no structured codes | `NavigationFailureCode` → i18n → actionable CTA | **Medium** |
| Missing-pack fallback | `NoRoutingDataCard` shown, no navigation fallback | Compass guidance + GPS dot + "Download pack" CTA | **Medium** |
| OffRoute architecture | Single class does detection + decision | Split: `OffRouteDetector` (pure) + `ReroutePolicy` (stateful) | **Medium** |
| Arrival detection | UI-side progress threshold (0.95) in overlay | Core-side distance-based (haversine ≤ 20m to destination) | **Medium** |
| Route normalization | Inline mapping in `lib/routing/index.ts` | Dedicated `RouteNormalizer` producing canonical `ValhallaRouteResult` | **Low** |
| NavigationEngine interface | `ValhallaProvider` used directly | Thin adapter implementing `NavigationEngine` interface | **Low** |
| QR navigation | Not implemented | QR parser → intent → NavigationCore.start() | **Deferred** |
| Shared contracts | Types split between packages/core and proposed contract | Unified contract in `packages/core`, backward-compat re-exports | **Low** |

---

<a id="phase-1"></a>
## Phase 1 — Foundation: Types, State Machine, Store

**Goal:** Establish the shared data contract, the navigation state model, and the global store before writing any orchestration logic.

**Prerequisite:** None — this is the starting point.

---

### Task 1A: Merge and Reconcile Navigation Types [IMPLEMENTED]

**File to create:** `packages/core/src/navigation/navigation.contract.ts`
**File to update:** `packages/core/src/navigation/types.ts` (add re-exports for backward compat)

**What to do:**

1. Create `navigation.contract.ts` with unified types drawn from the proposed contract (`utils/files/00 - proposed navigation.contract.ts`) merged with existing types from `packages/core/src/navigation/types.ts`.

2. Types to include (from proposed contract, new to codebase):
   - `NavMode` = `'STANDARD' | 'QR'`
   - `RoutingProfile` = `'car' | 'walk' | 'motor_scooter'`
   - `NavigationState` (the 7 states)
   - `NavigationFailureCode` (10 error codes)
   - `Coordinate` (with `lat`/`lon`)
   - `LabeledCoordinate`
   - `NavigationIntent` (mode, start, destination, routingProfile, packHint, verify)
   - `RouteRequest` (locations, costing, directions_type)
   - `Maneuver` (type, instruction, distance, duration, location)
   - `ValhallaRouteResult` (path, distance, duration, maneuvers) — canonical route shape
   - `RouteSummary` (distanceM, durationS, maneuverCount)
   - `NavigationSession` (new version: id, state, intent, activeRoute, summary, timing, failureCode, etc.)
   - `PackManifest`, `ResolvedPack`, `PackResolutionResult`
   - `GpsPoint` (extends Coordinate with accuracy, speed, heading, timestamp)
   - `OffRouteResult` (isOffRoute, distanceToRouteM, thresholdM)
   - `RerouteDecision` (shouldReroute, reason)
   - `NavigationEngine` interface
   - `PackManager` interface
   - `GpsService` interface
   - `RouteNormalizer` interface
   - `OffRouteDetector` interface
   - `ReroutePolicy` interface
   - `NavigationCoreListener` interface
   - QR payload types: `QrDestinationPayload`, `QrVerificationEnvelope`, `QrVerificationPayload`, `SupportedQrPayload`
   - Type guards: `isCoordinate()`, `isSupportedQrPayload()`

3. Types to keep as-is (already in `types.ts`, still used by existing code):
   - `Coords` — existing code uses this extensively; keep it, add a note that `Coordinate` is the canonical new form
   - `Route` — still used by `matchService.snapToRoute()` and hooks
   - `NavigationRoute`, `NavigationStep`, `ManeuverType`
   - `MatchResult`, `ETAResult`, `ETAConfidence`
   - `OffRouteAction`, `OffRouteActionType`
   - `GPSPosition`, `GPSQuality`
   - `NavigationDestination`, `DestinationType`
   - `RouteSource`, `RouteStrategy`, `RouteIndex`, `RouteShard`

4. Add re-exports from `types.ts`:
   ```
   export * from './navigation.contract';
   ```
   This ensures `@janpams/core/navigation` continues to work for all existing imports AND exposes new types.

5. Add helper to convert between `Coords` and `Coordinate`:
   - `toCoordinate(coords: Coords): Coordinate`
   - `toCoords(coord: Coordinate): Coords`

**Acceptance criteria:**
- All existing imports from `@janpams/core/navigation` still work
- New types are importable from `@janpams/core/navigation`
- No circular dependencies
- TypeScript compiles without errors

> **Implementation summary:** Created `packages/core/src/navigation/navigation.contract.ts` with all proposed types (NavMode, RoutingProfile, NavigationState, NavigationFailureCode, Coordinate, NavigationIntent, RouteRequest, Maneuver, ValhallaRouteResult, RouteSummary, NavSession, PackManifest, ResolvedPack, PackResolutionResult, GpsPoint, OffRouteResult, RerouteDecision, all service interfaces, QR payload types, type guards, and Coords↔Coordinate converters). Named the session type `NavSession` to avoid conflict with existing `NavigationSession`. Updated `packages/core/src/navigation/index.ts` to re-export all new types alongside existing ones. Zero linter errors, all existing consumers unaffected.

---

### Task 1B: Create Navigation State Machine [IMPLEMENTED]

**File to create:** `packages/core/src/navigation/navigation.stateMachine.ts`

**What to do:**

1. Define the `NavigationEvent` type:
   ```
   type NavigationEvent =
     | 'START_REQUESTED'
     | 'CONTEXT_RESOLVED'
     | 'ROUTE_READY'
     | 'NAVIGATION_CONFIRMED'
     | 'LOCATION_UPDATE'
     | 'OFF_ROUTE_DETECTED'
     | 'REROUTE_COMPLETE'
     | 'ARRIVAL_DETECTED'
     | 'STOP_REQUESTED'
     | 'ERROR'
     | 'RETRY';
   ```

2. Implement `transition(current: NavigationState, event: NavigationEvent): NavigationState`:
   - `IDLE` + `START_REQUESTED` → `RESOLVING_CONTEXT`
   - `RESOLVING_CONTEXT` + `CONTEXT_RESOLVED` → `RESOLVING_CONTEXT` (pack loaded, continue)
   - `RESOLVING_CONTEXT` + `ROUTE_READY` → `ROUTE_PREVIEW_READY`
   - `ROUTE_PREVIEW_READY` + `NAVIGATION_CONFIRMED` → `NAVIGATING`
   - `NAVIGATING` + `OFF_ROUTE_DETECTED` → `OFF_ROUTE_RECALCULATING`
   - `OFF_ROUTE_RECALCULATING` + `REROUTE_COMPLETE` → `NAVIGATING`
   - `NAVIGATING` + `ARRIVAL_DETECTED` → `ARRIVED`
   - `OFF_ROUTE_RECALCULATING` + `ARRIVAL_DETECTED` → `ARRIVED`
   - Any state + `STOP_REQUESTED` → `IDLE`
   - Any state + `ERROR` → `FAILED`
   - `FAILED` + `RETRY` → `IDLE`
   - `ARRIVED` + `START_REQUESTED` → `RESOLVING_CONTEXT`
   - All other transitions → throw `InvalidTransitionError`

3. Implement `canTransition(current, event): boolean` (non-throwing version).

4. Implement `getValidEvents(current: NavigationState): NavigationEvent[]` for UI state enablement.

**Acceptance criteria:**
- Pure function, zero side effects
- All valid transitions covered
- Invalid transitions throw descriptive error
- Unit tests for all transitions (at least 15 test cases)

> **Implementation summary:** Created `packages/core/src/navigation/navigation.stateMachine.ts` with a data-driven transition table covering all 7 states and 11 events. Provides `transition()` (throws on invalid), `tryTransition()` (returns null), `canTransition()`, and `getValidEvents()`. Custom `InvalidTransitionError` with state+event context. Exported through `packages/core/src/navigation/index.ts`. All states accept `STOP_REQUESTED→IDLE` and `ERROR→FAILED` (where applicable). `ARRIVED`/`FAILED` accept `START_REQUESTED` to allow re-navigation.

---

### Task 1C: Create Zustand Navigation Store [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/lib/store/navigationStore.ts`

**What to do:**

1. Follow the established pattern from `lib/store/mapStore.ts` (Zustand `create()`).

2. Store shape:
   ```
   interface NavigationStoreState {
     session: NavigationSession | null;
     snappedPosition: Coordinate | null;
     currentManeuverIndex: number;
     eta: { etaSeconds: number; formattedETA: string; formattedDistance: string } | null;
     gpsQuality: GPSQuality | null;
     currentSpeed: number;
     isFollowingMap: boolean;
     isVoiceMuted: boolean;
   }
   ```

3. Store actions:
   ```
   interface NavigationStoreActions {
     setSession(session: NavigationSession | null): void;
     updateSession(patch: Partial<NavigationSession>): void;
     setSnappedPosition(pos: Coordinate | null): void;
     setCurrentManeuverIndex(index: number): void;
     setETA(eta: NavigationStoreState['eta']): void;
     setGpsQuality(quality: GPSQuality | null): void;
     setCurrentSpeed(speed: number): void;
     setFollowingMap(following: boolean): void;
     setVoiceMuted(muted: boolean): void;
     reset(): void;
   }
   ```

4. Selector hooks for common patterns:
   - `useNavigationSession()` → `session`
   - `useNavigationState()` → `session?.state ?? 'IDLE'`
   - `useIsNavigating()` → `session?.state === 'NAVIGATING' || session?.state === 'OFF_ROUTE_RECALCULATING'`
   - `useNavigationError()` → `{ failureCode, failureMessage }` when state is FAILED

**Acceptance criteria:**
- Same Zustand pattern as `mapStore.ts`
- All selectors are derived (no redundant state)
- `reset()` returns to initial state
- Store is importable from `@/lib/store/navigationStore`

> **Implementation summary:** Created `lib/store/navigationStore.ts` following the exact Zustand `create()` pattern from `mapStore.ts`. Store holds `NavSession`, `snappedPosition`, `currentManeuverIndex`, `eta` (with formatted strings), `gpsQuality`, `currentSpeed`, `isFollowingMap`, `isVoiceMuted`. Provides `setSession()`, `updateSession(patch)`, individual setters, and `reset()`. Four derived selector hooks: `useNavigationSession()`, `useNavState()`, `useIsNavigating()`, `useNavigationError()`. Zero linter errors.

---

<a id="phase-2"></a>
## Phase 2 — Core Services: Engine Adapter, PackManager, RouteNormalizer

**Goal:** Extract platform-specific plumbing into clean, injectable services that implement the interfaces from Phase 1.

**Prerequisite:** Phase 1 complete (types and interfaces exist).

---

### Task 2A: Create NavigationEngine Adapter (Valhalla) [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/lib/navigation/engine/valhallaAdapter.ts`

**What to do:**

1. Implement the `NavigationEngine` interface from the contract.

2. Delegate to the existing `ValhallaProvider` singleton:
   - `init()` → `valhallaProvider.init()`
   - `loadPack(packPath, options)` → `valhallaProvider.loadTiles(buffer, { regionCode })` (needs to read buffer from tile storage first)
   - `routeWithManeuvers(requestId, request)` → `valhallaProvider.route(request)` (map RouteRequest → ValhallaRouteRequest)
   - `cancel(requestId)` → track active request IDs, mark as cancelled, ignore result if cancelled

3. Request ID tracking:
   - Maintain a `Map<string, { cancelled: boolean }>` for in-flight requests
   - On `cancel(id)`, set `cancelled = true`
   - On route result, check if the request was cancelled before returning

4. Error wrapping:
   - Catch `ValhallaProvider` errors and wrap them with appropriate `NavigationFailureCode`
   - Init failure → `ENGINE_INIT_FAILED`
   - Pack load failure → `PACK_CORRUPT`
   - Route failure → `ROUTE_NOT_FOUND`

**Dependencies:**
- `lib/valhalla/ValhallaProvider.ts` (existing, unchanged)
- `lib/valhalla/tileStorage.ts` (existing, for `getTilesArrayBufferForRegion`)
- `navigation.contract.ts` (Phase 1A)

**Acceptance criteria:**
- Implements `NavigationEngine` interface
- Request cancellation works (cancelled requests return null)
- Errors are wrapped with failure codes
- Existing `ValhallaProvider` is not modified

> **Implementation summary:** Created `lib/navigation/engine/valhallaAdapter.ts` — `ValhallaAdapter` class implementing `NavigationEngine`. Delegates to the existing `valhallaProvider` singleton. `loadPack(regionCode)` reads tile buffer from SQLite via `getTilesArrayBufferForRegion()` then calls `valhallaProvider.loadTiles()`. `routeWithManeuvers()` maps `RouteRequest` to `ValhallaRouteRequest` and tracks in-flight requests via a `Map<string, { cancelled }>`. `cancel(requestId)` sets the cancelled flag so the result is discarded on return. Zero modification to existing `ValhallaProvider`.

---

### Task 2B: Create PackManager Service [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/lib/navigation/packs/packManager.ts`

**What to do:**

1. Implement the `PackManager` interface from the contract.

2. `resolvePackForIntent(intent: NavigationIntent) → PackResolutionResult`:
   - Get all installed packs via `getInstalledPacks()` from `japaState.ts`
   - If `intent.packHint` is provided, try that region first
   - For each installed pack, check if the destination coordinate falls within the pack's bounding box (from pack metadata/manifest)
   - If no bbox match, fall back to checking if tiles exist for any installed region
   - Return `{ status: 'RESOLVED', packId, resolvedPack }` if found
   - Return `{ status: 'MISSING', reason: 'No pack covers this destination' }` if not found

3. `ensurePackLoaded(resolvedPack: ResolvedPack) → void`:
   - Check if regionCode is already in the loaded set (from `initValhalla.ts` `loadedRegionCodes` pattern)
   - If not loaded:
     - Get tiles via `getTilesArrayBufferForRegion(regionCode)`
     - Load via engine adapter's `loadPack()`
     - Add to loaded set

4. Maintain internal state:
   - `loadedRegionCodes: Set<string>` — tracks which packs are currently loaded in the engine
   - `clearLoadedPacks()` — called when engine is re-initialized

**Dependencies:**
- `lib/japaState.ts` → `getInstalledPacks()`, `getPackState()`
- `lib/valhalla/tileStorage.ts` → `hasProdTilesForRegion()`, `getTilesArrayBufferForRegion()`
- `lib/db/dataPacks.ts` → pack metadata/manifests for bbox lookup
- `navigation.contract.ts` (Phase 1A)

**Acceptance criteria:**
- Implements `PackManager` interface
- `packHint` is preferred when available
- Returns `MISSING` when no pack covers destination
- Returns `RESOLVED` when pack is found and tiles exist
- Does not re-load already-loaded packs

> **Implementation summary:** Created `lib/navigation/packs/packManager.ts` — `MobilePackManager` class implementing `PackManager`. Resolution order: (1) try `packHint` if provided and installed, (2) query `findAdminBoundariesContainingPoint()` for region-level boundaries matching installed packs, (3) fall back to first installed pack with tiles, (4) return `MISSING`. `ensurePackLoaded()` delegates to `ValhallaAdapter.loadPack()` with a `loadedRegionCodes` set to avoid re-loading. `clearLoadedPacks()` for engine re-init.

---

### Task 2C: Create RouteNormalizer [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/lib/navigation/engine/routeNormalizer.ts`

**What to do:**

1. Implement the `RouteNormalizer` interface from the contract.

2. `normalize(raw: unknown) → ValhallaRouteResult`:
   - Accept Valhalla engine output (matches `ValhallaRouteResult` from `ValhallaProvider.ts`)
   - Validate: path exists and has ≥ 2 points, distance is a positive number
   - Map maneuvers: ensure each has type, instruction, location (if available)
   - Ensure start maneuver ('depart') and end maneuver ('arrive') exist
   - If no maneuvers present, synthesize start/arrive from path endpoints
   - Return canonical `ValhallaRouteResult` from the contract

3. `summarize(route: ValhallaRouteResult) → RouteSummary`:
   - `distanceM` = `route.distance`
   - `durationS` = `route.duration`
   - `maneuverCount` = `route.maneuvers?.length ?? 0`

4. Also handle non-Valhalla route sources for future-proofing:
   - Accept `GetRouteResult` from `lib/routing/index.ts` (Dijkstra/cached routes)
   - Map `RouteStep[]` → `Maneuver[]`

**Dependencies:**
- `navigation.contract.ts` (Phase 1A)
- `lib/valhalla/ValhallaProvider.ts` types (for raw input shape)
- `lib/routing/index.ts` types (for fallback route shape)

**Acceptance criteria:**
- Produces valid `ValhallaRouteResult` from Valhalla engine output
- Produces valid `ValhallaRouteResult` from Dijkstra/cached fallback output
- Always includes start and arrive maneuvers
- `summarize()` returns correct counts

> **Implementation summary:** Created `lib/navigation/engine/routeNormalizer.ts` — `MobileRouteNormalizer` class implementing `RouteNormalizer`. `normalize()` accepts raw engine output, validates path has ≥2 points, maps maneuvers to canonical `Maneuver[]` shape, and ensures depart + arrive maneuvers exist (injects synthetic ones when missing). `summarize()` returns `RouteSummary` with distanceM, durationS, maneuverCount. Handles both Valhalla full-maneuver output and fallback routes with no maneuvers.

---

<a id="phase-3"></a>
## Phase 3 — Navigation Orchestrator: NavigationCore

**Goal:** Create the central orchestration class that manages the entire navigation session lifecycle.

**Prerequisite:** Phase 1 (types, state machine, store) and Phase 2 (services) complete.

---

### Task 3A: Create NavigationCore Class [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/lib/navigation/core.ts`

**What to do:**

1. Implement the `NavigationCorePublicApi` interface (from the proposed `navigation.core.ts`).

2. Constructor takes `NavigationCoreDeps`:
   ```
   {
     engine: NavigationEngine,
     packManager: PackManager,
     gps: GpsService,
     routeNormalizer: RouteNormalizer,
     offRouteDetector: OffRouteDetector,
     reroutePolicy: ReroutePolicy,
     store: NavigationStoreActions,     // Zustand store actions (replaces Redux dispatch)
     now?: () => number,
     uuid?: () => string,
     arrivalThresholdM?: number,       // default 20
   }
   ```

3. Methods:

   **`init()`**
   - Initialize the engine via `engine.init()`
   - Set `engineInitialized` flag
   - On failure: transition to `FAILED` with `ENGINE_INIT_FAILED`

   **`start(intent: NavigationIntent) → NavigationSession`**
   - Cancel any active request and stop active GPS
   - Create new session with state `RESOLVING_CONTEXT`
   - Update store
   - Resolve start coordinate (GPS if `MY_LOCATION`, else from intent)
   - Resolve pack via `packManager.resolvePackForIntent(intent)`
     - If `MISSING` → fail with `PACK_MISSING`
     - If `INCOMPATIBLE` → fail with `PACK_INCOMPATIBLE`
   - Load pack via `packManager.ensurePackLoaded(resolvedPack)`
   - Build `RouteRequest` from intent
   - Compute route via `engine.routeWithManeuvers(requestId, request)`
     - If null → fail with `ROUTE_NOT_FOUND`
   - Normalize via `routeNormalizer.normalize(rawRoute)`
   - Summarize via `routeNormalizer.summarize(normalizedRoute)`
   - Update session: state → `ROUTE_PREVIEW_READY`, set activeRoute, summary
   - Update store
   - Emit `onPreviewReady` to listeners
   - Return session

   **`confirmStartNavigation() → NavigationSession`**
   - Guard: must be in `ROUTE_PREVIEW_READY` and have an active route
   - Start GPS subscription via `gps.subscribe()`
   - Transition state → `NAVIGATING`
   - Update store
   - Emit `onNavigating`
   - Return session

   **`stop()`**
   - Stop GPS subscription
   - Cancel active request
   - Reset session to `IDLE`
   - Update store (reset)
   - Emit `onSessionChanged`

   **`rerouteFromCurrentLocation(reason?) → NavigationSession | null`**
   - Get current GPS position
   - Delegate to `recomputeRouteFrom(currentPos)`
   - On GPS failure → fail with `GPS_UNAVAILABLE`

   **`handleLocationUpdate(point: GpsPoint)`** (called from GPS subscription)
   - Guard: only process in `NAVIGATING` or `OFF_ROUTE_RECALCULATING`
   - Check arrival: haversine distance to last route point ≤ `arrivalThresholdM`
     - If arrived: transition → `ARRIVED`, stop GPS, emit `onArrived`
   - Snap to route via `matchService.snapToRoute()` (reuse existing)
   - Calculate ETA via `etaTracker.calculateETA()` (reuse existing)
   - Update store: snapped position, maneuver index, ETA, speed
   - Check off-route via `offRouteDetector.evaluate()`
   - Check reroute policy via `reroutePolicy.shouldReroute()`
     - If should reroute: transition → `OFF_ROUTE_RECALCULATING`, call `recomputeRouteFrom(point)`

   **`recomputeRouteFrom(current: GpsPoint)` (private)**
   - Cancel active request
   - Build new RouteRequest from current position → destination
   - Compute route
   - Normalize and summarize
   - Update session: new route, increment rerouteCount, state → `NAVIGATING`
   - Update store
   - Emit `onNavigating`

   **`getSession() → NavigationSession | null`**

   **`subscribe(listener: NavigationCoreListener) → unsubscribe function`**

4. Integration with store:
   - Every `updateSession()` call also calls `store.setSession(session)`
   - Location updates also call `store.setSnappedPosition()`, `store.setETA()`, etc.
   - This replaces the proposed Redux `dispatch` pattern with direct Zustand store mutation

5. Use the state machine from Task 1B for all state transitions (validate before transitioning).

**Reference:** The proposed `utils/files/00 - proposed navigation.core.ts` provides the full skeleton. Adapt it to use Zustand store instead of Redux dispatch, and to use existing shared services (matchService, etaTracker) directly.

**Dependencies:**
- Phase 1: types, state machine, navigation store
- Phase 2: engine adapter, pack manager, route normalizer
- Task 3B: off-route detector and reroute policy
- Existing: `matchService` from `packages/core`, `etaTracker` from `packages/core`

**Acceptance criteria:**
- Full lifecycle: start → preview → confirm → navigate → arrive/stop
- Reroute flow: off-route → recalculate → resume navigating
- Request cancellation on reroute and stop
- GPS lifecycle matches behavioral rules (subscribe only in NAVIGATING/OFF_ROUTE_RECALCULATING)
- All state transitions go through state machine
- Store is updated on every state/position change
- Listeners are notified on state changes

> **Implementation summary:** Created `lib/navigation/core.ts` — `NavigationCore` class (~310 lines). Constructor takes DI deps: engine, packManager, gps, routeNormalizer, offRouteDetector, reroutePolicy, store. Full lifecycle: `init()` → `start(intent)` (resolve start, resolve pack, compute route, normalize, push to ROUTE_PREVIEW_READY) → `confirmStartNavigation()` (subscribe GPS, move to NAVIGATING) → `handleLocationUpdate()` (snap, ETA, maneuver progression, off-route check, arrival check) → `stop()` (cleanup GPS + request). Reroute via `recomputeFrom()` with cancel-old → compute-new → resume NAVIGATING. All state pushed to Zustand store. Listener pattern for external subscribers. Uses `etaTracker` and `matchService` from packages/core directly.

---

### Task 3B: Split OffRouteDetector from ReroutePolicy [IMPLEMENTED]

**Files to create:**
- `apps/core/address-maker-glopams/lib/navigation/rerouting/offRouteDetector.ts`
- `apps/core/address-maker-glopams/lib/navigation/rerouting/reroutePolicy.ts`

**What to do:**

**OffRouteDetector** — Implements `OffRouteDetector` interface:

1. `evaluate({ current, route, profile }) → OffRouteResult`:
   - Find nearest point on route polyline (reuse `matchService.snapToRoute()` logic or call it directly)
   - Compare distance against profile-specific threshold:
     - `car`: 35m
     - `walk`: 20m
     - `motor_scooter`: 30m
   - Return `{ isOffRoute, distanceToRouteM, thresholdM }`

2. Pure function — no internal state, no side effects.

**ReroutePolicy** — Implements `ReroutePolicy` interface:

1. `shouldReroute({ session, current, offRoute, now }) → RerouteDecision`:
   - If not off-route → `{ shouldReroute: false }`
   - If session state is already `OFF_ROUTE_RECALCULATING` → `{ shouldReroute: false }` (already rerouting)
   - If cooldown not elapsed (minimum 10 seconds since last reroute) → `{ shouldReroute: false }`
   - If off-route distance exceeds reroute threshold (e.g., 2× detection threshold) → `{ shouldReroute: true, reason: 'OFF_ROUTE' }`
   - If off-route duration exceeds delay (5 seconds) → `{ shouldReroute: true, reason: 'OFF_ROUTE' }`

2. Stateful: tracks `lastRerouteTime` for cooldown.

3. `reset()` — clear internal state.

**Migration from existing `OffRoutePolicy`:**
- The existing `packages/core/src/navigation/offRoutePolicy.ts` combines detection + decision
- Extract the detection logic (distance threshold check) into `OffRouteDetector`
- Extract the decision logic (timing, warn vs reroute vs guide) into `ReroutePolicy`
- Keep the existing `OffRoutePolicy` in `packages/core` unchanged for backward compat
- The existing `offRoutePolicy` singleton continues to be used by `useNavigation` hook until Phase 4 migration

**Acceptance criteria:**
- `OffRouteDetector` is pure, no side effects
- `ReroutePolicy` respects cooldowns
- Profile-specific thresholds are configurable
- Unit tests for each

> **Implementation summary:** Created `lib/navigation/rerouting/offRouteDetector.ts` — `MobileOffRouteDetector` (pure, stateless). Uses `matchService.snapToRoute()` to measure distance, compares against profile-specific thresholds (car:35m, motor_scooter:30m, walk:20m). Returns `OffRouteResult`. Created `lib/navigation/rerouting/reroutePolicy.ts` — `MobileReroutePolicy` (stateful). Enforces 10s cooldown between reroutes and 5s off-route delay before first trigger. Guards against re-trigger while already in OFF_ROUTE_RECALCULATING. `reset()` clears internal timers.

---

### Task 3C: Create useNavigationCore Hook [IMPLEMENTED]

**File to create:** `apps/core/address-maker-glopams/hooks/useNavigationCore.ts`

**What to do:**

1. Create and manage a `NavigationCore` singleton:
   - Instantiate once (module-level or via `useRef`)
   - Wire dependencies: `valhallaAdapter`, `packManager`, `gpsServiceAdapter`, `routeNormalizer`, `offRouteDetector`, `reroutePolicy`, `navigationStore` actions

2. Create a `GpsService` adapter that wraps the existing `GPSService` class to match the `GpsService` interface from the contract:
   - `getCurrentPosition()` → convert `GPSPosition` to `GpsPoint`
   - `subscribe(onLocation, onError)` → adapt `gpsService.start()` to the new callback signature

3. Expose methods to UI:
   ```
   {
     startNavigation(intent: NavigationIntent): Promise<void>,
     confirmStart(): Promise<void>,
     stop(): Promise<void>,
     reroute(): Promise<void>,
     session: NavigationSession | null,       // from store
     state: NavigationState,                  // derived from session
     snappedPosition: Coordinate | null,      // from store
     eta: { formattedETA: string; formattedDistance: string } | null,
     currentManeuverIndex: number,
     gpsQuality: GPSQuality | null,
     isNavigating: boolean,                   // derived
     isOffRoute: boolean,                     // derived
     error: { code: NavigationFailureCode; message: string } | null,
   }
   ```

4. Subscribe to Zustand `navigationStore` for reactive state (using Zustand's `useStore` with selectors).

5. This hook is the **drop-in replacement** for the existing `useNavigation` hook. In Phase 4, `route-directions.tsx` will switch from `useNavigation()` to `useNavigationCore()`.

**Dependencies:**
- Task 3A: `NavigationCore`
- Task 3B: `OffRouteDetector`, `ReroutePolicy`
- Task 2A-2C: Engine adapter, PackManager, RouteNormalizer
- Task 1C: `navigationStore`
- Existing: `gpsService`, `matchService`, `etaTracker`

**Acceptance criteria:**
- Singleton NavigationCore — not re-created on re-render
- All store subscriptions use selectors (no unnecessary re-renders)
- Exposes the same essential data as current `useNavigation` (for migration parity)
- Works as a drop-in alongside existing hook during migration

> **Implementation summary:** Created `hooks/useNavigationCore.ts`. Module-level singleton factory `getOrCreateCore()` instantiates `NavigationCore` with all concrete deps (ValhallaAdapter, MobilePackManager, MobileRouteNormalizer, MobileOffRouteDetector, MobileReroutePolicy, GpsServiceAdapter, store). `GpsServiceAdapter` bridges existing `GPSService` (expo-location) to the `NavigationCoreGpsService` interface (converts `GPSPosition` → `GpsPoint`). Hook subscribes to Zustand store with individual selectors for minimal re-renders. Exposes `startNavigation(intent)`, `confirmStart()`, `stop()`, `reroute()`, and all reactive state (session, state, snapped position, ETA, maneuver index, GPS quality, off-route, error, voice/follow toggles). Cleanup on unmount calls `core.stop()`.

---

<a id="phase-4"></a>
## Phase 4 — Wire into UI

**Goal:** Replace the old scattered navigation orchestration with the new centralized system.

**Prerequisite:** Phase 3 complete (NavigationCore and hook are working).

---

### Task 4A: Refactor route-directions.tsx [IMPLEMENTED]

**File modified:** `apps/core/address-maker-glopams/app/(tabs)/route-directions.tsx`

**Implementation summary:**

1. Replaced `useNavigation()` (alias `navigationLive`) with `useNavigationCore()` (alias `navCore`).
2. Replaced `handleStartInAppNavigation`: now builds a `NavigationIntent` with routing profile mapped from `routeOptions.mode`, then calls `navCore.startNavigation(intent)` followed by `navCore.confirmStart()`. Removed manual `Route` construction and step-coord extraction.
3. Replaced `handleReroute`: now calls `navCore.reroute()` and reads the updated route from `navCore.session?.activeRoute` to update the map polyline and distance display.
4. Replaced `resetStates` stop call: `navigationLive.stopNavigation()` → `navCore.stop()`.
5. Updated all state reads: `isNavigating`, `snappedPosition`, `formattedETA`, `formattedDistance`, `currentStepIndex`, `offRouteAction` — all now read from `navCore`.
6. Removed: `navigationDestinationCoordsRef` (no longer needed — NavigationCore manages destination internally), stale `Route` type import.
7. Kept untouched: search UI, map rendering, address selection, route options, `useOfflineRoute` (still used for map preview polyline), `getRoutingOptions` (still used for offline route preview calls).
8. Fixed pre-existing lint error in `getRoutingOptions` with type assertion for `costing` field.

---

### Task 4B: Update NavigationOverlay [IMPLEMENTED]

**File modified:** `apps/core/address-maker-glopams/components/NavigationOverlay.tsx`
**File modified:** `apps/core/address-maker-glopams/lib/store/navigationStore.ts`

**Implementation summary:**

Took a lighter approach than originally planned — kept the prop-driven interface (parent passes data) rather than having the overlay subscribe directly to the store. This keeps the component testable and avoids tight coupling.

1. Added `arrived?: boolean` optional prop to `NavigationOverlayProps` for external arrival signaling from NavigationCore.
2. Combined arrival detection: `hasArrived = arrived || progress >= ARRIVAL_PROGRESS_THRESHOLD` — supports both the new state-based arrival (from NavigationCore → `navCore.state === 'ARRIVED'`) and the legacy progress-based approach for backward compatibility.
3. Updated `useIsNavigating()` selector in `navigationStore.ts` to include the `ARRIVED` state, so the overlay remains visible briefly after arrival for the voice announcement and auto-stop timer (2.5s).
4. Parent (`route-directions.tsx`) now passes `arrived={navCore.state === 'ARRIVED'}`, `steps` mapped from `navCore.session?.activeRoute?.maneuvers`, and `offRouteAction` derived from `navCore.isOffRoute`.
5. All existing functionality preserved: voice step-change, voice mute toggle, follow-map toggle, off-route banner, reroute button.

---

### Task 4C: Update RouteModal [IMPLEMENTED]

**File reviewed:** `apps/core/address-maker-glopams/components/modals/RouteModal.tsx` (no internal changes needed)

**Implementation summary:**

The RouteModal component required no internal modifications. It's a navigation-app launcher (Google Maps, Waze, Uber, etc.) with an optional "Start Navigation" button for in-app turn-by-turn. All changes were made on the caller side in `route-directions.tsx`:

1. `onClose` handler now calls `navCore.stop()` instead of `navigationLive.stopNavigation()`.
2. `onStartInAppNavigation` now activates when `destination?.coordinates` is truthy (previously gated on `offlineRoutePath?.length`) — the NavigationCore computes its own route internally.
3. `routeDetails.duration` now reads from `navCore.eta?.formattedETA` during active navigation.
4. The component's prop interface (`RouteModalProps`) remains unchanged — good separation of concerns.

Session-state-aware button states (e.g. disabled during `RESOLVING_CONTEXT`, spinner) deferred to Phase 5 when the full error/loading contract is implemented.

---

<a id="phase-5"></a>
## Phase 5 — Error Handling & Missing-Pack Flow

**Goal:** Implement structured error handling and graceful degradation when packs are missing.

**Prerequisite:** Phase 4 complete (UI is wired to NavigationCore).

---

### Task 5A: Implement NavigationFailureCode Error Contract [IMPLEMENTED]

**Files created:**
- `apps/core/address-maker-glopams/lib/navigation/errors/navigationErrors.ts`
- `apps/core/address-maker-glopams/components/NavigationErrorCard.tsx`

**Files modified:**
- `apps/core/address-maker-glopams/locales/en.json` — added `(tabs).navigation.error.*` strings
- `apps/core/address-maker-glopams/locales/fr.json` — added `(tabs).navigation.error.*` strings
- `apps/core/address-maker-glopams/app/(tabs)/route-directions.tsx` — wired NavigationErrorCard into render tree

**Implementation summary:**

1. Created `navigationErrors.ts` with `getNavigationErrorMeta(code)` and `getActionI18nKey(action)` functions that map all 11 `NavigationFailureCode` values to `{ i18nKey, severity, suggestedAction, icon }` metadata.
2. Added i18n strings for all error messages and CTA labels in both English and French under `(tabs).navigation.error.*`.
3. Created `NavigationErrorCard` component that receives `failureCode`, `failureMessage`, and action callbacks (`onDismiss`, `onRetry`, `onDownloadPack`, `onSwitchProfile`). It maps the failure code to the appropriate icon, localised message, and CTA button. CANCELLED codes are silently ignored. `enable_location` opens device settings via `Linking`.
4. Wired the card into `route-directions.tsx`: shown when `navCore.error` is non-null. CTA handlers: retry re-starts with the same intent; download opens OfflineDataManager; dismiss calls `navCore.stop()`.

---

### Task 5B: Implement Missing-Pack Fallback Flow [IMPLEMENTED]

**Implementation summary:**

The core missing-pack flow is fully handled by the existing architecture:

1. **NavigationCore** already transitions to `FAILED` with `PACK_MISSING` when `PackManager.resolvePackForIntent()` returns `MISSING` status (see `core.ts` lines ~155-162).
2. **NavigationErrorCard** (from Task 5A) displays the `PACK_MISSING` error with the localised message "No offline map data for this area. Download the region data pack to enable navigation." and a "Download data pack" CTA.
3. The CTA in `route-directions.tsx` calls `navCore.stop()` then opens the `OfflineDataManager` bottom sheet (`setShowOfflineManager(true)`), where the user can download the appropriate region pack.
4. After download, the user can retry navigation — the error card's dismiss/retry handlers allow re-starting the same intent.

**Compass fallback overlay (optional, deferred):** The compass bearing/distance fallback UI (`CompassFallbackOverlay.tsx`) is deferred to a future iteration. The current flow provides a clear, actionable path for the user without it.

---

<a id="phase-6"></a>
## Phase 6 — QR Navigation (Deferred — Architecture Ready)

**Goal:** Implement QR scanning → parse → navigate flow using the same NavigationCore.

**Prerequisite:** Phases 1-5 complete. Standard navigation fully working.

---

### Task 6A: Create QR Payload Parser & Validator [IMPLEMENTED]

**Files created:**
- `packages/core/src/qr/parseQrPayload.ts`
- `packages/core/src/qr/index.ts`

**File modified:**
- `apps/core/address-maker-glopams/tsconfig.json` — added `@janpams/core/qr` path alias

**Implementation summary:**

1. Created `parseQrPayload(raw: string)` — parses JSON, validates with `isSupportedQrPayload()` type guard, then runs full field validation. Returns typed `SupportedQrPayload` or null. Never throws.
2. Created `validateQrPayload(payload)` — returns `{ valid, errors[] }` with descriptive messages. Validates: version (`v === 1`), type (`JANPAMS_DEST` or `JANPAMS_VERIFY`), coordinates in range (lat -90..90, lon -180..180), and for verification payloads: `payload`, `sig`, and `kid` fields are non-empty strings.
3. Exported both functions + `QrValidationResult` type from `packages/core/src/qr/index.ts`.
4. Added `@janpams/core/qr` tsconfig path for the mobile app.

---

### Task 6B: Create QR Navigation Launcher [IMPLEMENTED]

**File created:** `apps/core/address-maker-glopams/lib/navigation/qr/qrNavigationLauncher.ts`

**Implementation summary:**

1. Created `launchQrNavigation(payload, core)` — builds a `NavigationIntent` with `mode: 'QR'`, `start: { type: 'MY_LOCATION' }`, destination from payload, `routingProfile: 'car'`, and optional `packHint`. Calls `core.start(intent)`.
2. Created `launchQrVerificationNavigation(payload, core)` — same pattern but extracts destination from `payload.dest` and includes the `verify` envelope (`payload`, `sig`, `kid`) in the intent.
3. Both functions are thin adapters — all routing/pack/state logic is delegated to NavigationCore.

---

### Task 6C: Create QR Scan Screen [IMPLEMENTED]

**Files created:**
- `apps/core/address-maker-glopams/app/qr-scan.tsx`

**File modified:**
- `apps/core/address-maker-glopams/app/_layout.tsx` — registered `qr-scan` route in Stack navigator

**Implementation summary:**

1. Created full QR scan screen using `expo-camera` `CameraView` with `barcodeTypes: ['qr']`.
2. State machine tracks scan lifecycle: `scanning` → `parsed` (valid) or `invalid` (bad QR). Scan lock prevents duplicate processing.
3. **Permission handling**: requests camera permission on mount; shows permission-denied screen with "Grant permission" CTA if not granted; shows "Back" fallback if permission can't be re-requested.
4. **Valid QR flow**: shows destination card with label, coordinates, and "Start Navigation" CTA. On tap, navigates to `route-directions` via Expo Router with QR payload params (`qr_lat`, `qr_lon`, `qr_label`, `qr_payload`).
5. **Invalid QR flow**: shows error card with "Scan again" retry button.
6. Uses `parseQrPayload()` from `@janpams/core/qr` for parsing.
7. Pack status display and `launchQrNavigation()` integration on the `route-directions` side deferred to when QR entry point into navigation is fully wired (route-directions needs to read the `qr_*` params and call `launchQrNavigation` on mount).

---

<a id="7-file-inventory"></a>
## 7. File Inventory: Current vs New

### New files to create

| Phase | File | Purpose |
|-------|------|---------|
| 1A | `packages/core/src/navigation/navigation.contract.ts` | Unified navigation types |
| 1B | `packages/core/src/navigation/navigation.stateMachine.ts` | Pure state machine |
| 1C | `lib/store/navigationStore.ts` | Zustand navigation store |
| 2A | `lib/navigation/engine/valhallaAdapter.ts` | NavigationEngine implementation |
| 2B | `lib/navigation/packs/packManager.ts` | PackManager implementation |
| 2C | `lib/navigation/engine/routeNormalizer.ts` | RouteNormalizer implementation |
| 3A | `lib/navigation/core.ts` | NavigationCore orchestrator |
| 3B | `lib/navigation/rerouting/offRouteDetector.ts` | Pure off-route detection |
| 3B | `lib/navigation/rerouting/reroutePolicy.ts` | Reroute decision policy |
| 3C | `hooks/useNavigationCore.ts` | React hook for NavigationCore |
| 5A | `lib/navigation/errors/navigationErrors.ts` | Error code mappings |
| 5A | `components/NavigationErrorCard.tsx` | Error display component |
| 5B | `components/CompassFallbackOverlay.tsx` | Missing-pack compass UI |
| 6A | `packages/core/src/qr/parseQrPayload.ts` | QR payload parser |
| 6A | `packages/core/src/qr/index.ts` | QR package exports |
| 6B | `lib/navigation/qr/qrNavigationLauncher.ts` | QR → intent → core |
| 6C | `app/qr-scan.tsx` | QR scan screen |

### Existing files to modify

| Phase | File | Change |
|-------|------|--------|
| 1A | `packages/core/src/navigation/types.ts` | Add re-exports from `navigation.contract.ts` |
| 4A | `app/(tabs)/route-directions.tsx` | Replace inline nav orchestration with `useNavigationCore()` |
| 4B | `components/NavigationOverlay.tsx` | Subscribe to store instead of props |
| 4C | `components/modals/RouteModal.tsx` | Session state awareness |

### Existing files NOT modified (preserved as-is)

| File | Reason |
|------|--------|
| `packages/core/src/navigation/matchService.ts` | Reused directly by NavigationCore |
| `packages/core/src/navigation/etaTracker.ts` | Reused directly by NavigationCore |
| `packages/core/src/navigation/offRoutePolicy.ts` | Kept for backward compat; new code uses split detector/policy |
| `lib/navigation/gpsService.ts` | Wrapped by adapter in useNavigationCore; class unchanged |
| `lib/navigation/voiceGuidance.ts` | Used by NavigationOverlay; unchanged |
| `lib/valhalla/ValhallaProvider.ts` | Wrapped by valhallaAdapter; class unchanged |
| `lib/valhalla/initValhalla.ts` | Still used for initial pack loading on app start |
| `lib/valhalla/tileStorage.ts` | Used by PackManager; unchanged |
| `lib/valhalla/valhallaCache.ts` | Still used by initValhalla; unchanged |
| `lib/routing/index.ts` | Still available as fallback routing; unchanged |
| `lib/japaState.ts` | Used by PackManager; unchanged |
| `hooks/useNavigation.ts` | Kept during migration; deprecated after Phase 4 |
| `hooks/useOfflineRoute.ts` | Kept for non-navigation route fetching; unchanged |

---

<a id="8-testing-strategy"></a>
## 8. Testing Strategy

### Implemented unit tests

| Phase | File | Coverage |
|-------|------|----------|
| 1B | `packages/core/src/navigation/__tests__/navigation.stateMachine.test.ts` | All valid transitions (22 cases), invalid transitions throw `InvalidTransitionError`, `tryTransition` / `canTransition` / `getValidEvents`, full flow sequences (happy path, cancel, off-route→reroute, FAILED→RETRY) |
| 6A | `packages/core/src/qr/__tests__/parseQrPayload.test.ts` | `parseQrPayload`: invalid JSON → null, wrong type/version → null, valid JANPAMS_DEST/JANPAMS_VERIFY, out-of-range lat/lon → null, missing verify fields → null, never throws. `validateQrPayload`: valid/invalid lat/lon, dest, boundary coords, missing dest/sig/kid |

**How to run (from repo root):**

```bash
pnpm install   # if not already done (installs vitest for packages/core)
pnpm --filter @janpams/core test
```

Or from `packages/core`: `pnpm test` (runs `vitest run`).

### Unit tests (remaining / per phase)

| Phase | What to test | Status |
|-------|-------------|--------|
| 2A | ValhallaAdapter cancellation | Not yet implemented |
| 2B | PackManager resolution | Not yet implemented |
| 2C | RouteNormalizer | Not yet implemented |
| 3A | NavigationCore lifecycle, reroute, error cases | Not yet implemented |
| 3B | OffRouteDetector, ReroutePolicy | Not yet implemented |

### Integration tests

| Test | Description |
|------|-------------|
| Standard navigation happy path | Intent → pack resolution → route → preview → confirm → GPS updates → arrival |
| Reroute flow | Navigate → simulate off-route GPS → reroute triggers → new route → resume |
| Missing pack | Intent with unknown region → PACK_MISSING → error card shown |
| Stop mid-navigation | Navigate → stop → GPS unsubscribed, session cleared |

### Manual testing checklist

- [ ] Start navigation from address search
- [ ] Start navigation from map long-press
- [ ] Route preview shows correct polyline, distance, duration
- [ ] "Start Navigation" begins GPS tracking
- [ ] NavigationOverlay shows correct instruction, ETA, distance
- [ ] Voice announces maneuver changes
- [ ] Moving off-route shows warning banner
- [ ] Reroute computes new route and resumes navigation
- [ ] Arrival detection works within 20m of destination
- [ ] Arrival announcement plays
- [ ] Stop button ends navigation and clears UI
- [ ] Missing pack shows download CTA
- [ ] Voice mute toggle works
- [ ] Follow-map toggle works

---

<a id="9-migration"></a>
## 9. Migration & Backward Compatibility

### Strategy: Parallel hooks, then swap

1. **Phase 1-3**: Build new system alongside existing code. Both `useNavigation()` and `useNavigationCore()` exist.
2. **Phase 4**: Switch `route-directions.tsx` to `useNavigationCore()`. Keep `useNavigation()` available but unused.
3. **Post Phase 4**: Once new system is validated, mark `useNavigation()` as deprecated. Remove in a subsequent PR.

### Type compatibility

- `Coords` (existing: `{ lon, lat }`) and `Coordinate` (proposed: `{ lat, lon }`) are structurally identical. Helper converters provided.
- `Route` (existing) remains for `matchService.snapToRoute()`. `ValhallaRouteResult` (new) is the canonical route in the session.
- `GPSPosition` (existing) and `GpsPoint` (proposed) overlap. Adapter in `useNavigationCore` handles conversion.

### No breaking changes to shared packages

- `packages/core/src/navigation/types.ts` only adds re-exports — no existing types removed or changed
- `packages/core/src/navigation/matchService.ts` unchanged
- `packages/core/src/navigation/etaTracker.ts` unchanged
- `packages/core/src/navigation/offRoutePolicy.ts` unchanged

---

<a id="10-risks"></a>
## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GPS subscription leak during reroute | Battery drain, memory leak | NavigationCore always stops subscription before starting new one. `stop()` guaranteed to clean up. |
| Stale route after reroute | User sees old polyline briefly | Update store immediately on reroute start (show recalculating state). Replace route only after new route is ready. |
| Pack resolution fails for edge coordinates | Navigation blocked at region boundaries | Allow fallback to any installed pack. Log coordinate-to-pack misses for future bbox refinement. |
| Large `route-directions.tsx` refactor regression | Breaking existing search/map/route features | Incremental approach: replace navigation orchestration first, keep everything else untouched. Test each feature after refactor. |
| NavigationCore singleton lifetime | Stale state across screens | Core is screen-independent; `stop()` resets all state. `useNavigationCore` manages lifecycle via React effect cleanup. |
| ValhallaProvider race condition | Multiple simultaneous route requests | Request ID tracking + cancellation ensures only latest request is accepted. |

---

<a id="11-done"></a>
## 11. Definition of Done

Navigation implementation is complete when:

- [ ] **State machine**: All 7 states are reachable and transitions are guarded
- [ ] **NavigationCore**: Manages full lifecycle (start → preview → navigate → arrive/stop)
- [ ] **Pack management**: Automatic pack resolution from destination coordinates
- [ ] **Route normalization**: All route sources produce canonical `ValhallaRouteResult`
- [ ] **Off-route + reroute**: Detection triggers reroute with cooldown, old request cancelled
- [ ] **Request cancellation**: All route computations are cancellable
- [ ] **Zustand store**: Session state is globally observable, UI components subscribe reactively
- [ ] **Error handling**: All failure codes map to user-facing messages with actionable CTAs
- [ ] **Missing-pack flow**: Graceful fallback (no crash), download CTA, compass guidance
- [ ] **GPS lifecycle**: Subscription only during NAVIGATING/OFF_ROUTE_RECALCULATING
- [ ] **route-directions.tsx**: Reduced by ~250-300 lines of inline navigation logic
- [ ] **NavigationOverlay**: Reads from store, arrival from core
- [ ] **Voice guidance**: Works with new maneuver progression from store
- [ ] **No regressions**: Search, map, address selection, route options all unchanged
- [ ] **QR-ready**: Architecture supports QR navigation as a follow-on (Phase 6)

---

## Dependency Graph

```
Phase 1A (types) ─────────────┐
Phase 1B (state machine) ─────┤
Phase 1C (store) ─────────────┤
                               ▼
Phase 2A (engine adapter) ────┐
Phase 2B (pack manager) ──────┤
Phase 2C (route normalizer) ──┤
                               ▼
Phase 3A (NavigationCore) ────┐
Phase 3B (offroute split) ────┤
Phase 3C (useNavigationCore) ─┤
                               ▼
Phase 4A (route-directions) ──┐
Phase 4B (overlay) ───────────┤
Phase 4C (route modal) ───────┤
                               ▼
Phase 5A (error contract) ────┐
Phase 5B (missing-pack flow) ─┤
                               ▼
Phase 6A (QR parser) ─────────┐
Phase 6B (QR launcher) ───────┤
Phase 6C (QR scan screen) ────┘
```
