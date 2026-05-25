skeleton files for the **Google Maps-style split architecture**.

They are designed to work with the `navigation.contract.ts` and `navigation.core.ts` 

---

# 1) `apps/mobile/src/navigation/engine/valhallaMobile.adapter.ts`

```ts
import type {
  NavigationEngine,
  RouteRequest,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

/**
 * Replace this import with your actual native package import.
 * Example:
 * import { createValhallaMobileRouter } from "mbukanji-valhalla-mobile";
 */
type NativeValhallaRouter = {
  init(): Promise<void>;
  loadPack(packPath: string, options?: { checksum?: string }): Promise<void>;
  routeWithManeuvers(requestId: string, request: RouteRequest): Promise<unknown | null>;
  cancel(requestId: string): Promise<void>;
};

export interface ValhallaMobileAdapterDeps {
  createRouter: () => NativeValhallaRouter;
}

export class ValhallaMobileAdapter implements NavigationEngine {
  private router: NativeValhallaRouter | null = null;
  private readonly createRouter: () => NativeValhallaRouter;

  constructor(deps: ValhallaMobileAdapterDeps) {
    this.createRouter = deps.createRouter;
  }

  private requireRouter(): NativeValhallaRouter {
    if (!this.router) {
      this.router = this.createRouter();
    }
    return this.router;
  }

  async init(): Promise<void> {
    const router = this.requireRouter();
    await router.init();
  }

  async loadPack(
    packPath: string,
    options?: { checksum?: string }
  ): Promise<void> {
    const router = this.requireRouter();
    await router.loadPack(packPath, options);
  }

  async routeWithManeuvers(
    requestId: string,
    request: RouteRequest
  ): Promise<unknown | null> {
    const router = this.requireRouter();
    return router.routeWithManeuvers(requestId, request);
  }

  async cancel(requestId: string): Promise<void> {
    const router = this.requireRouter();
    await router.cancel(requestId);
  }
}
```

---

# 2) `apps/mobile/src/navigation/engine/routeNormalizer.ts`

```ts
import type {
  Maneuver,
  RouteNormalizer,
  RouteSummary,
  ValhallaRouteResult,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

type RawValhallaLegManeuver = {
  type?: string | number;
  instruction?: string;
  length?: number;
  time?: number;
  begin_shape_index?: number;
  end_shape_index?: number;
};

type RawValhallaTripLeg = {
  maneuvers?: RawValhallaLegManeuver[];
};

type RawValhallaRoute = {
  path?: [number, number][];
  distance?: number;
  duration?: number;
  maneuvers?: Maneuver[];
  trip?: {
    legs?: RawValhallaTripLeg[];
    summary?: {
      length?: number;
      time?: number;
    };
  };
};

export class DefaultRouteNormalizer implements RouteNormalizer {
  normalize(raw: unknown): ValhallaRouteResult {
    const route = raw as RawValhallaRoute | null | undefined;

    if (!route) {
      throw new Error("Route normalization failed: empty route payload.");
    }

    const path = this.extractPath(route);
    const maneuvers = this.extractManeuvers(route);

    const distance =
      typeof route.distance === "number"
        ? route.distance
        : typeof route.trip?.summary?.length === "number"
        ? route.trip.summary.length * 1000
        : 0;

    const duration =
      typeof route.duration === "number"
        ? route.duration
        : typeof route.trip?.summary?.time === "number"
        ? route.trip.summary.time
        : undefined;

    return {
      path,
      distance,
      duration,
      maneuvers,
    };
  }

  summarize(route: ValhallaRouteResult): RouteSummary {
    return {
      distanceM: route.distance,
      durationS: route.duration,
      maneuverCount: route.maneuvers?.length ?? 0,
    };
  }

  private extractPath(route: RawValhallaRoute): [number, number][] {
    if (Array.isArray(route.path)) {
      return route.path;
    }

    return [];
  }

  private extractManeuvers(route: RawValhallaRoute): Maneuver[] {
    if (Array.isArray(route.maneuvers)) {
      return route.maneuvers;
    }

    const legManeuvers = route.trip?.legs?.flatMap((leg) => leg.maneuvers ?? []) ?? [];

    return legManeuvers.map((m) => ({
      type: String(m.type ?? "unknown"),
      instruction: m.instruction,
      distance:
        typeof m.length === "number" ? m.length * 1000 : undefined,
      duration:
        typeof m.time === "number" ? m.time : undefined,
    }));
  }
}
```

---

# 3) `apps/mobile/src/navigation/rerouting/offRouteDetector.ts`

```ts
import type {
  GpsPoint,
  OffRouteDetector,
  OffRouteResult,
  RoutingProfile,
  ValhallaRouteResult,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

export interface OffRouteDetectorDeps {
  pointToPolylineDistanceM?: (
    point: GpsPoint,
    path: [number, number][]
  ) => number;
}

export class DefaultOffRouteDetector implements OffRouteDetector {
  private readonly pointToPolylineDistanceM?: (
    point: GpsPoint,
    path: [number, number][]
  ) => number;

  constructor(deps: OffRouteDetectorDeps = {}) {
    this.pointToPolylineDistanceM = deps.pointToPolylineDistanceM;
  }

  evaluate(args: {
    current: GpsPoint;
    route: ValhallaRouteResult;
    profile: RoutingProfile;
  }): OffRouteResult {
    const thresholdM = this.thresholdForProfile(args.profile);
    const distanceToRouteM = this.computeDistanceToRoute(
      args.current,
      args.route
    );

    return {
      isOffRoute: distanceToRouteM > thresholdM,
      distanceToRouteM,
      thresholdM,
    };
  }

  private thresholdForProfile(profile: RoutingProfile): number {
    switch (profile) {
      case "walk":
        return 20;
      case "motor_scooter":
        return 25;
      case "car":
      default:
        return 35;
    }
  }

  private computeDistanceToRoute(
    current: GpsPoint,
    route: ValhallaRouteResult
  ): number {
    if (!route.path.length) return Number.POSITIVE_INFINITY;

    if (this.pointToPolylineDistanceM) {
      return this.pointToPolylineDistanceM(current, route.path);
    }

    // Placeholder fallback:
    // Uses nearest route point, not nearest line segment.
    let best = Number.POSITIVE_INFINITY;

    for (const [lon, lat] of route.path) {
      const d = this.approxDistanceMeters(current.lat, current.lon, lat, lon);
      if (d < best) best = d;
    }

    return best;
  }

  private approxDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
```

---

# 4) `apps/mobile/src/navigation/rerouting/reroutePolicy.ts`

```ts
import type {
  GpsPoint,
  NavigationSession,
  OffRouteResult,
  RerouteDecision,
  ReroutePolicy,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

export interface DefaultReroutePolicyDeps {
  minSecondsBetweenReroutes?: number;
}

export class DefaultReroutePolicy implements ReroutePolicy {
  private readonly minSecondsBetweenReroutes: number;

  constructor(deps: DefaultReroutePolicyDeps = {}) {
    this.minSecondsBetweenReroutes = deps.minSecondsBetweenReroutes ?? 8;
  }

  shouldReroute(args: {
    session: NavigationSession;
    current: GpsPoint;
    offRoute: OffRouteResult;
    now: number;
  }): RerouteDecision {
    const { session, offRoute, now } = args;

    if (!session.activeRoute) {
      return {
        shouldReroute: true,
        reason: "INITIAL_ROUTE_MISSING",
      };
    }

    if (session.state === "OFF_ROUTE_RECALCULATING") {
      return { shouldReroute: false };
    }

    if (!offRoute.isOffRoute) {
      return { shouldReroute: false };
    }

    const lastUpdatedAt = session.lastUpdatedAt ?? 0;
    const elapsedSeconds = Math.max(0, (now - lastUpdatedAt) / 1000);

    if (elapsedSeconds < this.minSecondsBetweenReroutes) {
      return { shouldReroute: false };
    }

    return {
      shouldReroute: true,
      reason: "OFF_ROUTE",
    };
  }
}
```

---

# 5) `apps/mobile/src/navigation/gps/gps.service.ts`

```ts
import * as Location from "expo-location";
import type {
  GpsPoint,
  GpsService,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

export class ExpoGpsService implements GpsService {
  async getCurrentPosition(): Promise<GpsPoint> {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission not granted.");
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracyM: pos.coords.accuracy ?? undefined,
      speedMps: pos.coords.speed ?? undefined,
      headingDeg: pos.coords.heading ?? undefined,
      timestamp: pos.timestamp,
    };
  }

  async subscribe(
    onLocation: (point: GpsPoint) => void,
    onError?: (error: unknown) => void
  ): Promise<{ remove: () => void }> {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission not granted.");
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (pos) => {
        try {
          onLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracyM: pos.coords.accuracy ?? undefined,
            speedMps: pos.coords.speed ?? undefined,
            headingDeg: pos.coords.heading ?? undefined,
            timestamp: pos.timestamp,
          });
        } catch (error) {
          onError?.(error);
        }
      }
    );

    return {
      remove: () => sub.remove(),
    };
  }
}
```

---

# 6) `apps/mobile/src/navigation/packs/packManager.ts`

```ts
import type {
  NavigationIntent,
  PackManager,
  PackManifest,
  PackResolutionResult,
  ResolvedPack,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

export interface PackRegistryRepository {
  findInstalledPackById(packId: string): Promise<ResolvedPack | null>;
  findInstalledPackByCoordinate(lat: number, lon: number): Promise<ResolvedPack | null>;
}

export interface PackCompatibilityService {
  isCompatible(manifest?: PackManifest): boolean;
}

export interface MobilePackManagerDeps {
  registry: PackRegistryRepository;
  compatibility: PackCompatibilityService;
  loadPack: (resolvedPack: ResolvedPack) => Promise<void>;
}

export class MobilePackManager implements PackManager {
  private readonly registry: PackRegistryRepository;
  private readonly compatibility: PackCompatibilityService;
  private readonly loadPackFn: (resolvedPack: ResolvedPack) => Promise<void>;

  constructor(deps: MobilePackManagerDeps) {
    this.registry = deps.registry;
    this.compatibility = deps.compatibility;
    this.loadPackFn = deps.loadPack;
  }

  async resolvePackForIntent(
    intent: NavigationIntent
  ): Promise<PackResolutionResult> {
    let resolvedPack: ResolvedPack | null = null;

    if (intent.packHint) {
      resolvedPack = await this.registry.findInstalledPackById(intent.packHint);
    }

    if (!resolvedPack) {
      resolvedPack = await this.registry.findInstalledPackByCoordinate(
        intent.destination.lat,
        intent.destination.lon
      );
    }

    if (!resolvedPack) {
      return {
        status: "MISSING",
        reason: "No installed pack found for destination.",
      };
    }

    if (!this.compatibility.isCompatible(resolvedPack.manifest)) {
      return {
        status: "INCOMPATIBLE",
        packId: resolvedPack.packId,
        reason: "Installed pack is incompatible with current routing engine.",
      };
    }

    return {
      status: "RESOLVED",
      packId: resolvedPack.packId,
      resolvedPack,
    };
  }

  async ensurePackLoaded(resolvedPack: ResolvedPack): Promise<void> {
    await this.loadPackFn(resolvedPack);
  }
}
```

---

# 7) `apps/mobile/src/navigation/redux/navigation.slice.ts`

```ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  NavigationFailureCode,
  NavigationSession,
} from "../../../../../packages/core/navigation-types/src/navigation.contract";

export interface NavigationReduxState {
  session: NavigationSession | null;
  isNavigating: boolean;
  lastFailureCode?: NavigationFailureCode;
}

const initialState: NavigationReduxState = {
  session: null,
  isNavigating: false,
  lastFailureCode: undefined,
};

const navigationSlice = createSlice({
  name: "navigation",
  initialState,
  reducers: {
    sessionChanged(state, action: PayloadAction<NavigationSession>) {
      state.session = action.payload;
      state.isNavigating =
        action.payload.state === "NAVIGATING" ||
        action.payload.state === "OFF_ROUTE_RECALCULATING";
      state.lastFailureCode = action.payload.failureCode;
    },

    clearNavigationState(state) {
      state.session = null;
      state.isNavigating = false;
      state.lastFailureCode = undefined;
    },
  },
});

export const {
  sessionChanged,
  clearNavigationState,
} = navigationSlice.actions;

export default navigationSlice.reducer;
```

---

# 8) Important fix to apply in `navigation.core.ts`

Because the Redux slice now exists, update the dispatch action from this:

```ts
this.dispatch({
  type: "navigation/sessionChanged",
  payload: session,
});
```

to your actual slice action import later, ideally:

```ts
import { sessionChanged } from "../redux/navigation.slice";
```

and then:

```ts
this.dispatch?.(sessionChanged(session));
```

That is the cleaner Redux Toolkit pattern.

---

# 9) What is still intentionally incomplete

These skeletons are good for architecture and onboarding, but a few pieces still need real implementation:

### `routeNormalizer.ts`

Needs to be aligned to the **actual output format** of `mbukanji-valhalla-mobile`.

### `offRouteDetector.ts`

Should eventually use:

* Turf nearest-point-on-line, or
* your shared geo helpers

instead of nearest route point approximation.

### `packManager.ts`

Needs a real `PackRegistryRepository`, likely backed by:

* SQLite
* filesystem manifests
* installed pack metadata

### `gps.service.ts`

May later need:

* background-safe behavior
* lower battery modes
* configurable intervals by profile

### `navigation.core.ts`

Still needs:

* next maneuver progression logic
* voice prompt hooks
* route history persistence
* malformed QR failure wiring from launcher flow

---

# 10) Recommended next files

The next best files to generate are:

1. `apps/mobile/src/navigation/qr/qrNavigationLauncher.ts`
2. `apps/mobile/src/navigation/packs/packRegistry.repository.ts`
3. `apps/mobile/src/navigation/packs/packLoader.ts`
4. `apps/mobile/src/navigation/gps/gpsPermission.ts`
5. `apps/mobile/src/navigation/ui/screens/ActiveNavigationScreen.tsx`
6. `apps/mobile/src/navigation/ui/components/NextTurnBanner.tsx`

The most important next one is **`qrNavigationLauncher.ts`**, because it completes the second supported mode.
