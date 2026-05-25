Below is the rewritten **Turn-by-Turn Navigation Implementation Contract (JanGo)** with **Mode 3 removed**. It explicitly supports only:

* **Mode 1: Standard Navigation**
* **Mode 2: QR Navigation**

---

# Turn-by-Turn Navigation Implementation Contract (JanGo)

## 0) Scope and goals

### Goals

1. Deliver reliable **turn-by-turn navigation** inside JanGo (maneuvers, next-turn UI, rerouting).
2. Support **two launch modes** (Standard / QR) using the **same navigation core** (no duplicated logic).
3. Remain **offline-first**:

   * Full functionality offline when the correct **region pack** is installed.
   * Graceful fallback when packs are missing (no hard crashes).
4. Keep routing outputs in a **canonical format** so Web + Mobile can share UI logic and parity tests.

### Non-goals (v1)

* Live traffic
* Lane guidance
* Multi-stop routing
* Server-required rerouting

---

## 1) Supported features (must)

### 1.1 Turn-by-turn essentials (both modes)

* Route preview (distance, ETA, polyline)
* Start / stop navigation session
* Maneuver list (instruction list)
* Next-turn banner (instruction + distance remaining)
* Off-route detection + reroute (offline)
* Arrival detection
* Optional voice guidance hook (device TTS recommended)

### 1.2 QR-driven navigation (Mode 2)

* Scan QR offline
* Parse QR payload into a **Destination Card**
* Start navigation from QR
* Pack missing → “Download pack” prompt + fallback guidance option

### 1.3 Offline pack management

* Download and store region packs
* Select correct pack for destination coordinate
* Validate pack presence + basic integrity
* Load pack into routing engine

---

## 2) System model

### 2.1 Navigation Session = State Machine

Both modes must drive a single `NavigationSession` state machine:

**States**

* `IDLE`
* `RESOLVING_CONTEXT` (resolve destination + pack selection)
* `ROUTE_PREVIEW_READY`
* `NAVIGATING`
* `OFF_ROUTE_RECALCULATING`
* `ARRIVED`
* `FAILED` (with reason codes)

This ensures QR navigation is not a separate navigation implementation—only a different “intent source”.

### 2.2 Canonical Route Shape

All engine responses must be normalized into:

```ts
interface ValhallaRouteResult {
  path: [lon:number, lat:number][];
  distance: number;       // meters
  duration?: number;      // seconds
  maneuvers?: Array<{
    type: string;
    instruction?: string;
    distance?: number;    // meters
    duration?: number;    // seconds
    location?: { lat:number; lon:number };
  }>;
}
```

This shape is the only source of truth for:

* polyline rendering
* maneuvers list
* next-turn banner
* voice prompts
* reroute progression

---

## 3) Mode definitions (inputs to the same core)

### Mode 1 — Standard Navigation

**Entry points**

* “Navigate” from Address Card
* “Navigate” from POI / Search result
* Map long-press → “Navigate here”

**Session seed**

* Start = `MyLocation` (default) or user-selected start point
* Destination = coordinate + label
* Policy = routing profile (car / walk / moto)

### Mode 2 — QR Navigation

**Entry points**

* QR scan from camera
* Open QR image

**QR resolves into**

* Destination coordinate + label (+ optional pack hint + optional verification payload)

**Session seed**

* Start = `MyLocation` (default) or user-selected start point
* Destination = from QR payload
* Policy = routing profile (default: car)

---

## 4) Core components and responsibilities

### 4.1 Routing engine adapter (mobile)

Mobile must use **`mbukanji-valhalla-mobile`** as routing engine.

**Required functions**

* `init(): Promise<void>`
* `loadPack(packPath: string, options?: { checksum?: string }): Promise<void>`
* `routeWithManeuvers(requestId: string, request: RouteRequest): Promise<ValhallaRouteResult | null>`
* `cancel(requestId: string): Promise<void>`

### 4.2 Pack Manager

Responsible for:

* listing installed packs
* mapping coordinates → pack id (`resolvePackForLatLon`)
* validating pack integrity (manifest exists + required files exist)
* loading pack (`engine.loadPack(packPath)`)
* exposing pack status to UI (installed / missing / needs-update)

### 4.3 Navigation Core

Responsible for:

* session state machine
* GPS subscription lifecycle
* off-route detection
* reroute logic + request cancellation
* maneuver progression + “next maneuver” calculations
* arrival detection
* optional voice guidance scheduling hooks

### 4.4 Mode Orchestrators (thin)

Each mode only:

* builds a `NavigationIntent`
* calls `NavigationCore.start(intent)`

No routing logic allowed inside mode modules.

---

## 5) Data contracts

### 5.1 NavigationIntent

```ts
type NavMode = 'STANDARD' | 'QR';

interface NavigationIntent {
  mode: NavMode;
  start:
    | { type: 'MY_LOCATION' }
    | { type: 'COORD'; lat:number; lon:number; label?:string };

  destination: {
    lat:number;
    lon:number;
    label?:string;
    addressId?:string;
    qrId?:string;
  };

  routingProfile: 'car' | 'walk' | 'motor_scooter';
  packHint?: string; // e.g., "CM-SW"
  verify?: { payload: string; sig: string; kid: string }; // optional v1
}
```

### 5.2 RouteRequest (engine request)

```ts
interface RouteRequest {
  locations: Array<{ lat:number; lon:number }>;
  costing?: string; // mapped from routingProfile
  directions_type?: 'none' | 'maneuvers';
}
```

### 5.3 QR Payload (minimum viable)

QR must decode offline to JSON (or compact base64 JSON).

```json
{
  "v": 1,
  "type": "JANPAMS_DEST",
  "lat": 4.153221,
  "lon": 9.242110,
  "label": "75 Borstal Street, Small Soppo",
  "pack_hint": "CM-SW"
}
```

Optional verification variant:

```json
{
  "v": 1,
  "type": "JANPAMS_VERIFY",
  "dest": { "lat": 4.153221, "lon": 9.242110, "label": "..." },
  "payload": "…",
  "sig": "…",
  "kid": "k1"
}
```

---

## 6) Behavioral rules (must)

### 6.1 Pack resolution (both modes)

1. Determine target pack:

   * use `packHint` if present (but validate by coordinate)
   * else `resolvePackForLatLon(destination)`
2. If pack installed:

   * `engine.loadPack(packPath)`
3. If pack missing:

   * show “Download pack” CTA
   * allow fallback guidance (see 6.2) or block navigation based on policy

### 6.2 Missing-pack fallback (must not crash)

If pack is missing, the app must offer one of the following (choose policy now, but implement plumbing):

**Fallback A (recommended)**: Compass guidance

* show bearing + straight-line distance
* keep GPS dot
* show “Download pack to enable turn-by-turn”

**Fallback B**: Block start

* show “Pack required” screen with download CTA

### 6.3 Route computation

* Always request maneuvers:

  * `directions_type = 'maneuvers'`
* Engine call:

  * `routeWithManeuvers(requestId, { locations:[start,dest], costing, directions_type })`

If engine returns null:

* surface `ROUTE_NOT_FOUND`
* suggest switching profile to walking

### 6.4 Off-route detection and reroute

Off-route trigger when:

* distance from current location to nearest route polyline segment > `OFF_ROUTE_THRESHOLD_M`

Suggested defaults (v1):

* car: 35m
* walk: 20m

Reroute flow:

1. transition → `OFF_ROUTE_RECALCULATING`
2. `cancel(oldRequestId)`
3. compute new route from current location → destination
4. replace active route + maneuvers
5. transition back → `NAVIGATING`

### 6.5 Request cancellation (hard requirement)

All route computations must be cancellable:

* new route request → cancel previous
* stop navigation → cancel active
* leaving navigation screen → cancel active (unless background nav is a planned feature)

### 6.6 GPS lifecycle rules

* GPS must be subscribed only in:

  * `NAVIGATING` / `OFF_ROUTE_RECALCULATING`
* GPS subscription must be released in:

  * `IDLE` / `ARRIVED` / `FAILED`

---

## 7) Error contract (UI + logging)

### Error codes

* `ENGINE_INIT_FAILED`
* `PACK_MISSING`
* `PACK_CORRUPT`
* `PACK_INCOMPATIBLE`
* `ROUTE_NOT_FOUND`
* `TIMEOUT`
* `CANCELLED`
* `INVALID_REQUEST`
* `GPS_UNAVAILABLE`
* `UNKNOWN`

### UI mapping (examples)

* `PACK_MISSING` → “Download offline map pack to enable navigation.”
* `ROUTE_NOT_FOUND` → “No route found. Try walking mode.”
* `GPS_UNAVAILABLE` → “Enable location services to start navigation.”

---

## 8) UI contract (minimum screens)

### Required UI surfaces

1. **Destination Card**

   * label, pack status, Start CTA
2. **Route Preview**

   * polyline, distance, ETA, routing profile switch, Start CTA
3. **Navigation Screen**

   * map + polyline
   * next-turn banner
   * remaining distance + ETA
   * reroute banner
4. **QR Scan Screen**

   * scan → destination card
5. **Pack Missing Screen/Modal**

   * download CTA + fallback guidance option (if enabled)

---

## 9) Telemetry and debugging (v1 lightweight)

Log locally (and optionally sync later):

* mode (STANDARD/QR)
* pack id + version
* route compute time
* reroute count
* failure codes

---

## 10) Acceptance tests (must pass)

### Standard mode

* With pack installed → route + maneuvers + navigation start
* Off-route → reroute works and old request cancelled
* Stop navigation → GPS unsubscribed and request cancelled

### QR mode

* QR opens destination card and starts navigation
* Missing pack triggers pack flow + fallback (or block, per policy)
* Invalid QR shows clear error (no crash)

---

# Definition of Done

Navigation is “done” when:

* both Standard + QR create the same `NavigationIntent`
* the same core state machine runs navigation for both modes
* routing uses `mbukanji-valhalla-mobile` and pack manager
* reroute and cancellation are stable
* app never crashes when pack is missing or QR is malformed

---

If you want, I can now produce the **docx-ready version** and/or the **developer-facing TypeScript contract file** (`navigation.contract.ts`) that the team can import and implement against.
