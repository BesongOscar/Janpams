/* =========================================================
 * Mobile Navigation Core
 * JanGo / JanPAMS
 *
 * Google Maps-style split architecture:
 * - Web does route planning / preview
 * - Mobile owns active turn-by-turn navigation
 *
 * This file is the mobile orchestration layer.
 * It coordinates:
 * - pack resolution/loading
 * - route computation
 * - GPS subscription
 * - off-route detection
 * - rerouting
 * - session lifecycle
 * - apps/mobile/src/navigation/core/navigation.core.ts
 * ======================================================= */

import type {
  GpsPoint,
  GpsService,
  NavigationCoreListener,
  NavigationEngine,
  NavigationFailureCode,
  NavigationIntent,
  NavigationSession,
  OffRouteDetector,
  PackManager,
  ReroutePolicy,
  RouteNormalizer,
  RouteRequest,
  RoutingProfile,
  ValhallaRouteResult,
} from "../../../../packages/core/navigation-types/src/navigation.contract";

export interface AppDispatchLike {
  (action: unknown): unknown;
}

export interface NavigationCoreDeps {
  engine: NavigationEngine;
  packManager: PackManager;
  gps: GpsService;
  routeNormalizer: RouteNormalizer;
  offRouteDetector: OffRouteDetector;
  reroutePolicy: ReroutePolicy;
  dispatch?: AppDispatchLike;
  now?: () => number;
  uuid?: () => string;
  arrivalThresholdM?: number;
}

export interface NavigationCorePublicApi {
  init(): Promise<void>;
  start(intent: NavigationIntent): Promise<NavigationSession>;
  confirmStartNavigation(): Promise<NavigationSession>;
  stop(): Promise<void>;
  rerouteFromCurrentLocation(reason?: string): Promise<NavigationSession | null>;
  getSession(): NavigationSession | null;
  subscribe(listener: NavigationCoreListener): () => void;
  handleLocationUpdate(point: GpsPoint): Promise<void>;
}

type SubscriptionHandle = { remove: () => void };

const DEFAULT_ARRIVAL_THRESHOLD_M = 20;

export class NavigationCore implements NavigationCorePublicApi {
  private readonly engine: NavigationEngine;
  private readonly packManager: PackManager;
  private readonly gps: GpsService;
  private readonly routeNormalizer: RouteNormalizer;
  private readonly offRouteDetector: OffRouteDetector;
  private readonly reroutePolicy: ReroutePolicy;
  private readonly dispatch?: AppDispatchLike;
  private readonly now: () => number;
  private readonly uuid: () => string;
  private readonly arrivalThresholdM: number;

  private session: NavigationSession | null = null;
  private listeners = new Set<NavigationCoreListener>();
  private gpsSubscription: SubscriptionHandle | null = null;
  private engineInitialized = false;

  constructor(deps: NavigationCoreDeps) {
    this.engine = deps.engine;
    this.packManager = deps.packManager;
    this.gps = deps.gps;
    this.routeNormalizer = deps.routeNormalizer;
    this.offRouteDetector = deps.offRouteDetector;
    this.reroutePolicy = deps.reroutePolicy;
    this.dispatch = deps.dispatch;
    this.now = deps.now ?? (() => Date.now());
    this.uuid =
      deps.uuid ??
      (() =>
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    this.arrivalThresholdM =
      deps.arrivalThresholdM ?? DEFAULT_ARRIVAL_THRESHOLD_M;
  }

  public async init(): Promise<void> {
    if (this.engineInitialized) return;

    try {
      await this.engine.init();
      this.engineInitialized = true;
    } catch (error) {
      this.failCurrentSession("ENGINE_INIT_FAILED", this.errorMessage(error));
      throw error;
    }
  }

  public getSession(): NavigationSession | null {
    return this.session;
  }

  public subscribe(listener: NavigationCoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Starts the navigation flow up to route preview.
   * This does NOT yet begin the active GPS-following navigation loop.
   */
  public async start(intent: NavigationIntent): Promise<NavigationSession> {
    await this.init();
    await this.stopActiveGpsSubscription();
    await this.cancelActiveRequest();

    const session: NavigationSession = {
      id: this.uuid(),
      state: "RESOLVING_CONTEXT",
      intent,
      rerouteCount: 0,
      startedAt: this.now(),
      lastUpdatedAt: this.now(),
    };

    this.session = session;
    this.emitSessionChanged();

    try {
      const start = await this.resolveStartCoordinate(intent);
      const packResolution = await this.packManager.resolvePackForIntent(intent);

      if (packResolution.status !== "RESOLVED" || !packResolution.resolvedPack) {
        return this.failAndReturn(
          this.mapPackFailure(packResolution.status),
          packResolution.reason ?? "Unable to resolve offline navigation pack."
        );
      }

      await this.packManager.ensurePackLoaded(packResolution.resolvedPack);

      const requestId = this.uuid();
      this.updateSession({
        activeRequestId: requestId,
        activePackId: packResolution.resolvedPack.packId,
      });

      const request: RouteRequest = {
        locations: [
          start,
          {
            lat: intent.destination.lat,
            lon: intent.destination.lon,
          },
        ],
        costing: this.mapRoutingProfileToCosting(intent.routingProfile),
        directions_type: "maneuvers",
      };

      const rawRoute = await this.engine.routeWithManeuvers(requestId, request);

      if (!rawRoute) {
        return this.failAndReturn(
          "ROUTE_NOT_FOUND",
          "No route found for the requested destination."
        );
      }

      const normalizedRoute = this.routeNormalizer.normalize(rawRoute);
      const summary = this.routeNormalizer.summarize(normalizedRoute);

      this.updateSession({
        state: "ROUTE_PREVIEW_READY",
        activeRoute: normalizedRoute,
        summary,
        activeRequestId: undefined,
        lastUpdatedAt: this.now(),
      });

      this.emitPreviewReady();
      return this.requireSession();
    } catch (error) {
      return this.failAndReturn("UNKNOWN", this.errorMessage(error));
    }
  }

  /**
   * Starts active turn-by-turn mode after preview confirmation.
   * UI should call this when the user taps "Start".
   */
  public async confirmStartNavigation(): Promise<NavigationSession> {
    const session = this.requireSession();

    if (!session.activeRoute) {
      return this.failAndReturn(
        "INVALID_REQUEST",
        "Cannot start active navigation without a route."
      );
    }

    if (session.state !== "ROUTE_PREVIEW_READY") {
      return this.failAndReturn(
        "INVALID_REQUEST",
        `Cannot confirm navigation from state ${session.state}.`
      );
    }

    await this.startGpsSubscription();

    this.updateSession({
      state: "NAVIGATING",
      lastUpdatedAt: this.now(),
    });

    this.emitNavigating();
    return this.requireSession();
  }

  public async stop(): Promise<void> {
    await this.stopActiveGpsSubscription();
    await this.cancelActiveRequest();

    this.session = {
      id: this.uuid(),
      state: "IDLE",
      intent: {
        mode: "STANDARD",
        start: { type: "MY_LOCATION" },
        destination: { lat: 0, lon: 0, label: undefined },
        routingProfile: "car",
      },
      startedAt: this.now(),
      lastUpdatedAt: this.now(),
      rerouteCount: 0,
    };

    this.emitSessionChanged();
  }

  public async rerouteFromCurrentLocation(
    _reason = "MANUAL_REROUTE"
  ): Promise<NavigationSession | null> {
    const session = this.session;
    if (!session) return null;

    try {
      const current = await this.gps.getCurrentPosition();
      return await this.recomputeRouteFrom(current);
    } catch (error) {
      this.failCurrentSession("GPS_UNAVAILABLE", this.errorMessage(error));
      return this.session;
    }
  }

  /**
   * Main location update hook.
   * Wire this from GPS subscription or background location updates.
   */
  public async handleLocationUpdate(point: GpsPoint): Promise<void> {
    const session = this.session;
    if (!session) return;
    if (!session.activeRoute) return;
    if (
      session.state !== "NAVIGATING" &&
      session.state !== "OFF_ROUTE_RECALCULATING"
    ) {
      return;
    }

    if (this.hasArrived(point, session.activeRoute)) {
      this.updateSession({
        state: "ARRIVED",
        lastUpdatedAt: this.now(),
      });
      await this.stopActiveGpsSubscription();
      this.emitArrived();
      return;
    }

    const offRoute = this.offRouteDetector.evaluate({
      current: point,
      route: session.activeRoute,
      profile: session.intent.routingProfile,
    });

    const decision = this.reroutePolicy.shouldReroute({
      session,
      current: point,
      offRoute,
      now: this.now(),
    });

    if (!decision.shouldReroute) {
      this.emitSessionChanged();
      return;
    }

    this.updateSession({
      state: "OFF_ROUTE_RECALCULATING",
      lastUpdatedAt: this.now(),
    });

    await this.recomputeRouteFrom(point);
  }

  /* ======================================================
   * Internal orchestration
   * ==================================================== */

  private async recomputeRouteFrom(
    current: GpsPoint
  ): Promise<NavigationSession> {
    const session = this.requireSession();

    await this.cancelActiveRequest();

    const requestId = this.uuid();
    this.updateSession({
      activeRequestId: requestId,
      state: "OFF_ROUTE_RECALCULATING",
      lastUpdatedAt: this.now(),
    });

    try {
      const request: RouteRequest = {
        locations: [
          { lat: current.lat, lon: current.lon },
          {
            lat: session.intent.destination.lat,
            lon: session.intent.destination.lon,
          },
        ],
        costing: this.mapRoutingProfileToCosting(session.intent.routingProfile),
        directions_type: "maneuvers",
      };

      const rawRoute = await this.engine.routeWithManeuvers(requestId, request);

      if (!rawRoute) {
        return this.failAndReturn(
          "ROUTE_NOT_FOUND",
          "Unable to recompute route from current location."
        );
      }

      const normalizedRoute = this.routeNormalizer.normalize(rawRoute);
      const summary = this.routeNormalizer.summarize(normalizedRoute);

      this.updateSession({
        activeRoute: normalizedRoute,
        summary,
        state: "NAVIGATING",
        activeRequestId: undefined,
        rerouteCount: (session.rerouteCount ?? 0) + 1,
        lastUpdatedAt: this.now(),
      });

      this.emitNavigating();
      return this.requireSession();
    } catch (error) {
      return this.failAndReturn("UNKNOWN", this.errorMessage(error));
    }
  }

  private async resolveStartCoordinate(
    intent: NavigationIntent
  ): Promise<{ lat: number; lon: number }> {
    if (intent.start.type === "COORD") {
      return {
        lat: intent.start.lat,
        lon: intent.start.lon,
      };
    }

    const current = await this.gps.getCurrentPosition();
    return {
      lat: current.lat,
      lon: current.lon,
    };
  }

  private async startGpsSubscription(): Promise<void> {
    await this.stopActiveGpsSubscription();

    this.gpsSubscription = await this.gps.subscribe(
      async (point) => {
        await this.handleLocationUpdate(point);
      },
      (error) => {
        this.failCurrentSession("GPS_UNAVAILABLE", this.errorMessage(error));
      }
    );
  }

  private async stopActiveGpsSubscription(): Promise<void> {
    if (!this.gpsSubscription) return;
    this.gpsSubscription.remove();
    this.gpsSubscription = null;
  }

  private async cancelActiveRequest(): Promise<void> {
    const requestId = this.session?.activeRequestId;
    if (!requestId) return;

    try {
      await this.engine.cancel(requestId);
    } catch {
      // Swallow cancellation errors to avoid blocking session cleanup.
    }

    this.updateSession({
      activeRequestId: undefined,
      lastUpdatedAt: this.now(),
    });
  }

  private updateSession(patch: Partial<NavigationSession>): void {
    const current = this.requireSession();
    this.session = {
      ...current,
      ...patch,
    };
    this.emitSessionChanged();
  }

  private requireSession(): NavigationSession {
    if (!this.session) {
      throw new Error("Navigation session is not initialized.");
    }
    return this.session;
  }

  private emitSessionChanged(): void {
    const session = this.session;
    if (!session) return;

    if (this.dispatch) {
      this.dispatch({
        type: "navigation/sessionChanged",
        payload: session,
      });
    }

    for (const listener of this.listeners) {
      listener.onSessionChanged?.(session);
    }
  }

  private emitPreviewReady(): void {
    const session = this.requireSession();
    for (const listener of this.listeners) {
      listener.onPreviewReady?.(session);
    }
  }

  private emitNavigating(): void {
    const session = this.requireSession();
    for (const listener of this.listeners) {
      listener.onNavigating?.(session);
    }
  }

  private emitArrived(): void {
    const session = this.requireSession();
    for (const listener of this.listeners) {
      listener.onArrived?.(session);
    }
  }

  private emitFailed(): void {
    const session = this.requireSession();
    for (const listener of this.listeners) {
      listener.onFailed?.(session);
    }
  }

  private failCurrentSession(
    code: NavigationFailureCode,
    message: string
  ): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      state: "FAILED",
      failureCode: code,
      failureMessage: message,
      activeRequestId: undefined,
      lastUpdatedAt: this.now(),
    };

    this.emitSessionChanged();
    this.emitFailed();
  }

  private failAndReturn(
    code: NavigationFailureCode,
    message: string
  ): NavigationSession {
    this.failCurrentSession(code, message);
    return this.requireSession();
  }

  private mapRoutingProfileToCosting(profile: RoutingProfile): string {
    switch (profile) {
      case "walk":
        return "pedestrian";
      case "motor_scooter":
        return "motor_scooter";
      case "car":
      default:
        return "auto";
    }
  }

  private mapPackFailure(
    status: "MISSING" | "INCOMPATIBLE" | "RESOLVED"
  ): NavigationFailureCode {
    switch (status) {
      case "MISSING":
        return "PACK_MISSING";
      case "INCOMPATIBLE":
        return "PACK_INCOMPATIBLE";
      case "RESOLVED":
      default:
        return "UNKNOWN";
    }
  }

  /**
   * Placeholder arrival logic.
   * Replace with shared distance helper or Turf-based distance check.
   */
  private hasArrived(point: GpsPoint, route: ValhallaRouteResult): boolean {
    const last = route.path[route.path.length - 1];
    if (!last) return false;

    const [destLon, destLat] = last;
    const distanceM = this.approxDistanceMeters(
      point.lat,
      point.lon,
      destLat,
      destLon
    );

    return distanceM <= this.arrivalThresholdM;
  }

  /**
   * Placeholder only.
   * Replace later with shared geo utility from packages/core/geo.
   */
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
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown navigation error.";
  }
}