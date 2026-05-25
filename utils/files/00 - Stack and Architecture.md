Below is the updated stack and architecture based on the **Google Maps-style split**:

* **Web** does **not** do active turn-by-turn
* **Mobile** owns real navigation
* only **contracts, schemas, and reusable geo utilities** are shared

---

# Updated Tech Stack for JanGo Navigation

## 1) Product model

### Web application

Purpose:

* route planning
* address search
* map exploration
* route preview
* location-plan viewing
* QR generation / display

### Mobile application

Purpose:

* active turn-by-turn navigation
* real-time GPS tracking
* voice guidance
* QR scan → navigate
* rerouting
* arrival handling

This is the core architectural decision.

---

# 2) Mobile stack

## App framework

**React Native + Expo Dev Client**

Why:

* supports native modules
* fits your current mobile path
* required for native Valhalla integration, GPS, camera, and filesystem access

---

## Routing engine

**`mbukanji-valhalla-mobile`**

This is the mobile routing engine and should remain **mobile-only**.

Responsibilities:

* initialize native routing engine
* load regional pack
* compute route with maneuvers
* cancel active request

---

## Map rendering

**MapLibre React Native**

Recommended package:

* `@maplibre/maplibre-react-native`

Responsibilities:

* render basemap / offline tiles
* show route polyline
* show user location
* follow camera
* render markers for destination / route context

---

## Location / GPS

**expo-location**

Responsibilities:

* permission flow
* foreground location tracking
* heading
* current location updates for navigation progression

---

## QR scanning

Prefer current Expo camera stack rather than older barcode-only packages.

Recommended:

* **Expo Camera** with barcode / QR scanning support

Responsibilities:

* scan JanPAMS QR payloads
* decode navigation destination
* launch QR navigation flow

---

## Local database

**SQLite** as primary offline app store

Use for:

* packs registry
* pack metadata
* saved destinations
* route history
* QR scan history
* cached route summaries
* offline events / audit
* sync queue if needed later

This is the main local persistence layer.

---

## Fast key-value cache

**MMKV** optional, not primary

Use only for:

* current profile
* voice enabled flag
* last used mode
* active session id
* small UI preferences

So the stack is not “MMKV instead of SQLite.”
It is:

* **SQLite first**
* **MMKV optionally for tiny hot state**

---

## State management

**Redux Toolkit**

Why this now fits best:

* more structured for a growing offline-first app
* better for multi-dev teams
* predictable state transitions
* stronger debugging
* fits pack lifecycle + permissions + navigation session + QR flows

Use Redux Toolkit for:

* navigation session state
* route preview state
* pack availability / download state
* GPS permission state
* QR parsing flow
* navigation UI state where global coordination matters

---

## Geometry / route math

**Turf.js**

Use for:

* nearest point on line
* off-route distance
* straight-line fallback distance
* bearing
* route geometry helpers

---

## Voice guidance

**react-native-tts**

Use for:

* next-turn announcements
* reroute announcement
* arrival announcement

Can be phase 1 or phase 1.5.

---

## File storage

**expo-file-system**

Use for:

* pack files
* pack manifests
* downloaded artifacts related to navigation

---

# 3) Shared stack across platforms

These should be shared between web and mobile:

## Shared contracts/types

* route result types
* QR payload types
* coordinate types
* pack manifest types
* destination card models

## Shared geo utilities

* coordinate validation
* distance helpers
* bearing helpers
* bbox helpers
* generic geometry utilities that do not depend on mobile runtime

## Shared QR schema/parser

Critical because web/backend may generate QR, while mobile consumes QR.

## Shared pack contracts

Pack id, manifest structure, version fields, compatibility flags

---

# Final updated stack summary

| Layer                 | Choice                         |
| --------------------- | ------------------------------ |
| Mobile framework      | React Native + Expo Dev Client |
| Mobile routing engine | `mbukanji-valhalla-mobile`     |
| Mobile maps           | MapLibre React Native          |
| GPS                   | `expo-location`                |
| QR scanning           | Expo Camera QR scanning        |
| Primary offline DB    | SQLite                         |
| Optional hot cache    | MMKV                           |
| State management      | Redux Toolkit                  |
| Geometry              | Turf.js                        |
| Voice                 | `react-native-tts`             |
| File storage          | `expo-file-system`             |

---

# Redesigned Folder Structure

This structure follows the **Google Maps-style split architecture**.

## Monorepo-level layout

```txt
packages/
  core/
    geo/
      src/
        coordinates.ts
        distance.ts
        bearing.ts
        polyline.ts
        validation.ts
      index.ts

    navigation-types/
      src/
        navigation.contract.ts
        route.types.ts
        qr.types.ts
        pack.types.ts
        error.types.ts
      index.ts

    qr/
      src/
        parseQrPayload.ts
        validateQrPayload.ts
        buildQrPayload.ts
      index.ts

    packs/
      src/
        manifest.types.ts
        manifest.validation.ts
        packCompatibility.ts
        resolvePackId.ts
      index.ts

apps/
  web/
    src/
      features/
        routing-preview/
        qr-generation/
        address-view/
        location-plan/

  mobile/
    src/
      navigation/
        core/
          navigation.core.ts
          navigation.stateMachine.ts
          navigation.selectors.ts
          navigation.types.local.ts

        engine/
          valhallaMobile.adapter.ts
          routeNormalizer.ts

        rerouting/
          offRouteDetector.ts
          reroutePolicy.ts
          nearestPointOnRoute.ts

        gps/
          gps.service.ts
          heading.service.ts
          gpsPermission.ts

        packs/
          packManager.ts
          packRegistry.repository.ts
          packLoader.ts

        qr/
          qrNavigationLauncher.ts

        voice/
          navigationVoice.service.ts

        storage/
          navigationSession.repository.ts
          routeHistory.repository.ts
          qrScanHistory.repository.ts

        redux/
          navigation.slice.ts
          navigation.thunks.ts
          navigation.listeners.ts

        ui/
          screens/
            NavigationPreviewScreen.tsx
            ActiveNavigationScreen.tsx
            QrDestinationScreen.tsx
          components/
            NextTurnBanner.tsx
            RouteSummaryCard.tsx
            NavigationControls.tsx
            ReRouteBanner.tsx
```

---

# Why this structure is better

## 1) Mobile navigation stays truly mobile

Everything specific to:

* GPS loop
* rerouting
* voice
* active navigation
* native engine

lives only in `apps/mobile/src/navigation`.

## 2) Shared contracts cannot drift

Web, backend, and mobile can all agree on:

* QR payload
* destination object
* pack manifest
* route result shape

## 3) Web remains simpler

Web can still:

* preview routes
* generate QR
* show destination cards
  without inheriting mobile-only complexity.

---

# Redesigned `navigation.core.ts` Plan

Now that we are following the split architecture, `navigation.core.ts` should be **mobile orchestration logic**, not a cross-platform abstraction layer.

## What `navigation.core.ts` should do

It should act as the **navigation session orchestrator** for mobile.

Responsibilities:

* accept a `NavigationIntent`
* resolve start location
* resolve destination
* resolve and load correct pack
* request route from mobile engine
* normalize route
* transition session state
* start GPS tracking
* trigger off-route checks
* reroute when necessary
* stop session cleanly

## What it should not do

It should **not**:

* render UI
* directly manage map camera
* implement QR scanning
* define shared contract types
* parse raw QR payload itself
* own SQLite schema definitions

Those belong elsewhere.

---

# Proposed responsibility split for `navigation.core.ts`

## `navigation.core.ts`

Main orchestration service/class.

Methods:

* `start(intent)`
* `stop()`
* `rerouteFromCurrentLocation()`
* `getSession()`
* `subscribe(listener)`

Coordinates:

* engine adapter
* pack manager
* GPS service
* reroute policy
* Redux dispatch hooks or callback hooks

---

## `navigation.stateMachine.ts`

Pure state transition rules.

Example states:

* `IDLE`
* `RESOLVING_CONTEXT`
* `ROUTE_PREVIEW_READY`
* `NAVIGATING`
* `OFF_ROUTE_RECALCULATING`
* `ARRIVED`
* `FAILED`

This file should be mostly pure and testable.

---

## `valhallaMobile.adapter.ts`

Thin wrapper over `mbukanji-valhalla-mobile`.

Methods:

* `init`
* `loadPack`
* `routeWithManeuvers`
* `cancel`

No business logic beyond adapting the native engine.

---

## `routeNormalizer.ts`

Transforms engine output into canonical route shape from shared `navigation-types`.

This is important because engine output may evolve, but the app should depend on stable internal models.

---

## `offRouteDetector.ts`

Pure function or service to determine if current location is outside allowed route corridor.

Inputs:

* current GPS point
* active route polyline
* profile thresholds

Outputs:

* `isOffRoute`
* distance to route

---

## `reroutePolicy.ts`

Decides when rerouting should happen.

Needed so you avoid reroute spam.

Rules can include:

* minimum seconds since last reroute
* minimum distance deviation
* speed-aware thresholds
* no reroute during active recalculation

---

## `gps.service.ts`

Handles:

* subscribe
* unsubscribe
* normalized location objects
* update intervals

---

## `packManager.ts`

Handles:

* resolve pack from destination
* verify pack exists
* load pack
* return pack status

---

## `qrNavigationLauncher.ts`

Converts parsed QR payload into `NavigationIntent`.

This keeps QR concerns out of `navigation.core.ts`.

---

## `navigation.slice.ts`

Redux state for:

* session state
* active route
* next maneuver
* ETA/distance summary
* reroute status
* failure code

`navigation.core.ts` can dispatch into this slice, or emit callbacks that a thunk/listener consumes.

---

# Recommended design style for `navigation.core.ts`

## Option 1 — Service class

Best if you want a clean engine-like API.

Example shape:

```ts
class NavigationCore {
  constructor(deps: NavigationDeps) {}
  start(intent: NavigationIntent): Promise<void>
  stop(): Promise<void>
  rerouteFromCurrentLocation(): Promise<void>
  handleLocationUpdate(location: GpsPoint): Promise<void>
}
```

### Why I recommend this

* clean orchestration boundary
* easy to inject dependencies
* easy to test
* easier to keep mobile navigation logic contained

This is my preferred design.

---

## Option 2 — Redux thunk-heavy implementation

Possible, but I would not make Redux the entire navigation engine.

Why:

* GPS-driven orchestration becomes messy if everything is thunk-first
* cancellation and engine lifecycle are cleaner in a service class

## Best hybrid

* `navigation.core.ts` = service class
* Redux = state exposure layer

That is the best fit.

---

# Proposed dependency contract for `navigation.core.ts`

```ts
interface NavigationCoreDeps {
  engine: NavigationEngine;
  packManager: PackManager;
  gps: GpsService;
  reroutePolicy: ReroutePolicy;
  offRouteDetector: OffRouteDetector;
  routeNormalizer: RouteNormalizer;
  dispatch: AppDispatch;
  now: () => number;
  uuid: () => string;
}
```

This makes it highly testable.

---

# Suggested start flow inside `navigation.core.ts`

## Standard navigation

1. receive `NavigationIntent`
2. resolve current GPS if start is `MY_LOCATION`
3. resolve destination pack
4. load pack
5. compute route
6. normalize route
7. dispatch preview-ready state
8. start GPS tracking when user confirms navigation

## QR navigation

1. QR scanner decodes payload
2. shared QR parser validates payload
3. `qrNavigationLauncher.ts` creates `NavigationIntent`
4. `navigation.core.ts` runs same flow as Standard

That is exactly what you want:
different entry, same navigation engine.

---

# Suggested stop flow

1. cancel active engine request
2. unsubscribe GPS
3. clear transient session state
4. persist optional route history / session summary
5. move to `IDLE`

---

# Recommended implementation phases

## Phase 1

* Standard navigation
* QR navigation
* pack resolution
* route preview
* active turn-by-turn
* reroute
* stop flow

## Phase 2

* voice guidance
* persisted route history
* navigation recovery after app backgrounding
* richer QR verification

## Phase 3

* field-visit instrumentation
* advanced offline audit trail
* multi-destination workflows

---

# Final recommendation

## Updated stack

* **SQLite** primary offline DB
* **Redux Toolkit** state management
* **mobile-only navigation core**
* **shared contracts/utilities only**

## Updated architecture

* `apps/mobile/src/navigation` owns real navigation
* `packages/core/*` owns shared types, QR schema, geo helpers, pack contracts

## `navigation.core.ts`

Should be built as a **mobile service orchestrator**, not a cross-platform engine.

