/**
 * NavigationCore — mobile navigation session orchestrator.
 *
 * Coordinates pack resolution, route computation, GPS subscription,
 * off-route detection, rerouting, and session lifecycle.
 *
 * All state is pushed into the Zustand navigationStore so UI components
 * can subscribe reactively.
 */

import type {
  NavigationEngine,
  NavigationIntent,
  NavSession,
  NavigationFailureCode,
  NavigationCoreListener,
  GpsPoint,
  RouteRequest,
  RoutingProfile,
  ValhallaRouteResult,
  RouteNormalizer,
  OffRouteDetector,
  ReroutePolicy,
  Coordinate,
} from '@janpams/core/navigation';
import {
  matchService,
  etaTracker,
  ETATracker,
  toCoords,
} from '@janpams/core/navigation';
import { transition } from '@janpams/core/navigation';
import type { MobilePackManager } from './packs/packManager';
import type { NavigationStoreActions, NavigationETAInfo } from '../store/navigationStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavigationCoreDeps {
  engine: NavigationEngine;
  packManager: MobilePackManager;
  gps: NavigationCoreGpsService;
  routeNormalizer: RouteNormalizer;
  offRouteDetector: OffRouteDetector;
  reroutePolicy: ReroutePolicy;
  store: NavigationStoreActions;
  now?: () => number;
  uuid?: () => string;
  arrivalThresholdM?: number;
}

/** Minimal GPS service interface expected by NavigationCore. */
export interface NavigationCoreGpsService {
  getCurrentPosition(): Promise<GpsPoint>;
  subscribe(
    onLocation: (point: GpsPoint) => void,
    onError?: (error: unknown) => void,
  ): Promise<{ remove: () => void }>;
}

type SubscriptionHandle = { remove: () => void };

const DEFAULT_ARRIVAL_M = 20;

// ---------------------------------------------------------------------------
// NavigationCore
// ---------------------------------------------------------------------------

export class NavigationCore {
  private readonly engine: NavigationEngine;
  private readonly packManager: MobilePackManager;
  private readonly gps: NavigationCoreGpsService;
  private readonly normalizer: RouteNormalizer;
  private readonly offRouteDetector: OffRouteDetector;
  private readonly reroutePolicy: ReroutePolicy;
  private readonly store: NavigationStoreActions;
  private readonly now: () => number;
  private readonly uuid: () => string;
  private readonly arrivalM: number;

  private session: NavSession | null = null;
  private listeners = new Set<NavigationCoreListener>();
  private gpsSubscription: SubscriptionHandle | null = null;
  private engineReady = false;

  constructor(deps: NavigationCoreDeps) {
    this.engine = deps.engine;
    this.packManager = deps.packManager;
    this.gps = deps.gps;
    this.normalizer = deps.routeNormalizer;
    this.offRouteDetector = deps.offRouteDetector;
    this.reroutePolicy = deps.reroutePolicy;
    this.store = deps.store;
    this.now = deps.now ?? (() => Date.now());
    this.uuid =
      deps.uuid ??
      (() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    this.arrivalM = deps.arrivalThresholdM ?? DEFAULT_ARRIVAL_M;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.engineReady) return;
    try {
      await this.engine.init();
      this.engineReady = true;
    } catch (err) {
      this.failSession('ENGINE_INIT_FAILED', errorMsg(err));
      throw err;
    }
  }

  getSession(): NavSession | null {
    return this.session;
  }

  subscribe(listener: NavigationCoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start the navigation flow up to route preview.
   * Does NOT begin active GPS tracking — call `confirmStartNavigation()` for that.
   */
  async start(intent: NavigationIntent): Promise<NavSession> {
    await this.init();
    await this.cleanup();

    const session: NavSession = {
      id: this.uuid(),
      state: 'RESOLVING_CONTEXT',
      intent,
      rerouteCount: 0,
      startedAt: this.now(),
      lastUpdatedAt: this.now(),
    };
    this.setSession(session);

    try {
      // Resolve start coordinate
      const startCoord = await this.resolveStart(intent);

      // Resolve pack
      const packResult =
        await this.packManager.resolvePackForIntent(intent);
      if (
        packResult.status !== 'RESOLVED' ||
        !packResult.resolvedPack
      ) {
        return this.failAndReturn(
          packResult.status === 'INCOMPATIBLE'
            ? 'PACK_INCOMPATIBLE'
            : 'PACK_MISSING',
          packResult.reason ?? 'Unable to resolve offline navigation pack.',
        );
      }

      await this.packManager.ensurePackLoaded(packResult.resolvedPack);

      // Compute route
      const requestId = this.uuid();
      this.patchSession({
        activeRequestId: requestId,
        activePackId: packResult.resolvedPack.packId,
      });

      const request: RouteRequest = {
        locations: [
          startCoord,
          { lat: intent.destination.lat, lon: intent.destination.lon },
        ],
        costing: profileToCosting(intent.routingProfile),
        directions_type: 'maneuvers',
      };

      const raw = await this.engine.routeWithManeuvers(requestId, request);
      if (!raw) {
        return this.failAndReturn(
          'ROUTE_NOT_FOUND',
          'No route found for the requested destination.',
        );
      }

      const route = this.normalizer.normalize(raw);
      const summary = this.normalizer.summarize(route);

      this.patchSession({
        state: 'ROUTE_PREVIEW_READY',
        activeRoute: route,
        summary,
        activeRequestId: undefined,
        lastUpdatedAt: this.now(),
      });

      this.emit('onPreviewReady');
      return this.requireSession();
    } catch (err) {
      return this.failAndReturn('UNKNOWN', errorMsg(err));
    }
  }

  /**
   * Start navigation using an already-computed route (e.g. from Dijkstra or offline fetch).
   * Use when the engine fails (e.g. Valhalla not available on Android) but the Plan flow
   * already has a route from "Let's go". Puts session in ROUTE_PREVIEW_READY; call
   * confirmStartNavigation() to begin active navigation and show the overlay.
   */
  async startWithPrecomputedRoute(
    intent: NavigationIntent,
    routeData: { path: [number, number][]; distance: number; duration?: number },
  ): Promise<NavSession> {
    await this.init();
    await this.cleanup();

    const session: NavSession = {
      id: this.uuid(),
      state: 'RESOLVING_CONTEXT',
      intent,
      rerouteCount: 0,
      startedAt: this.now(),
      lastUpdatedAt: this.now(),
    };
    this.setSession(session);

    try {
      await this.resolveStart(intent);
    } catch {
      // Continue with precomputed route even if GPS resolution fails (e.g. permissions)
    }

    const { path, distance, duration } = routeData;
    if (!path?.length || path.length < 2) {
      return this.failAndReturn(
        'ROUTE_NOT_FOUND',
        'Precomputed route has no valid path.',
      );
    }

    const raw = { path, distance, duration };
    const route = this.normalizer.normalize(raw);
    const summary = this.normalizer.summarize(route);

    this.patchSession({
      state: 'ROUTE_PREVIEW_READY',
      activeRoute: route,
      summary,
      lastUpdatedAt: this.now(),
    });

    this.emit('onPreviewReady');
    return this.requireSession();
  }

  /**
   * Begin active GPS-following navigation (after preview confirmation).
   */
  async confirmStartNavigation(): Promise<NavSession> {
    const s = this.requireSession();
    if (s.state !== 'ROUTE_PREVIEW_READY' || !s.activeRoute) {
      return this.failAndReturn(
        'INVALID_REQUEST',
        'Cannot start navigation without a previewed route.',
      );
    }

    etaTracker.reset();
    this.reroutePolicy.reset();

    await this.startGps();

    this.patchSession({
      state: 'NAVIGATING',
      lastUpdatedAt: this.now(),
    });
    this.emit('onNavigating');
    return this.requireSession();
  }

  async stop(): Promise<void> {
    await this.cleanup();
    this.store.reset();
    this.session = null;
    this.emitChanged();
  }

  async rerouteFromCurrentLocation(
    _reason = 'MANUAL_REROUTE',
  ): Promise<NavSession | null> {
    if (!this.session) return null;
    try {
      const current = await this.gps.getCurrentPosition();
      return await this.recomputeFrom(current);
    } catch (err) {
      this.failSession('GPS_UNAVAILABLE', errorMsg(err));
      return this.session;
    }
  }

  /**
   * Process a GPS location update during active navigation.
   */
  async handleLocationUpdate(point: GpsPoint): Promise<void> {
    const s = this.session;
    if (!s?.activeRoute) return;
    if (s.state !== 'NAVIGATING' && s.state !== 'OFF_ROUTE_RECALCULATING') {
      return;
    }

    // Check arrival
    if (this.hasArrived(point, s.activeRoute)) {
      this.patchSession({
        state: 'ARRIVED',
        lastUpdatedAt: this.now(),
      });
      await this.stopGps();
      this.emit('onArrived');
      return;
    }

    // Snap to route + compute ETA
    const coords = toCoords({ lat: point.lat, lon: point.lon });
    const match = matchService.snapToRoute(coords, {
      path: s.activeRoute.path,
      distance: s.activeRoute.distance,
      source: 'precomputed',
    });

    const speed = point.speedMps ?? 0;
    const eta = etaTracker.calculateETA(match, speed);

    // Advance maneuver index
    let maneuverIdx = 0;
    if (s.activeRoute.maneuvers) {
      for (let i = 0; i < s.activeRoute.maneuvers.length; i++) {
        const mLoc = s.activeRoute.maneuvers[i].location;
        if (!mLoc) continue;
        const mMatch = matchService.snapToRoute(
          { lon: mLoc.lon, lat: mLoc.lat },
          { path: s.activeRoute.path, distance: s.activeRoute.distance, source: 'precomputed' },
        );
        if (match.progress >= mMatch.progress) {
          maneuverIdx = i;
        }
      }
    }

    // Push to store
    this.store.setSnappedPosition({
      lat: match.snappedPoint.lat,
      lon: match.snappedPoint.lon,
    });
    this.store.setCurrentManeuverIndex(maneuverIdx);
    this.store.setETA({
      etaSeconds: eta.etaSeconds,
      formattedETA: ETATracker.formatETA(eta.etaSeconds),
      formattedDistance: ETATracker.formatDistance(match.remainingDistance),
    } satisfies NavigationETAInfo);
    this.store.setCurrentSpeed(speed);

    // Off-route check
    const offRoute = this.offRouteDetector.evaluate({
      current: point,
      route: s.activeRoute,
      profile: s.intent.routingProfile,
    });

    const decision = this.reroutePolicy.shouldReroute({
      session: s,
      current: point,
      offRoute,
      now: this.now(),
    });

    if (decision.shouldReroute) {
      this.patchSession({
        state: 'OFF_ROUTE_RECALCULATING',
        lastUpdatedAt: this.now(),
      });
      await this.recomputeFrom(point);
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async recomputeFrom(current: GpsPoint): Promise<NavSession> {
    const s = this.requireSession();
    await this.cancelActiveRequest();

    const requestId = this.uuid();
    this.patchSession({
      activeRequestId: requestId,
      state: 'OFF_ROUTE_RECALCULATING',
      lastUpdatedAt: this.now(),
    });

    try {
      const request: RouteRequest = {
        locations: [
          { lat: current.lat, lon: current.lon },
          { lat: s.intent.destination.lat, lon: s.intent.destination.lon },
        ],
        costing: profileToCosting(s.intent.routingProfile),
        directions_type: 'maneuvers',
      };

      const raw = await this.engine.routeWithManeuvers(requestId, request);
      if (!raw) {
        return this.failAndReturn(
          'ROUTE_NOT_FOUND',
          'Unable to recompute route from current location.',
        );
      }

      const route = this.normalizer.normalize(raw);
      const summary = this.normalizer.summarize(route);

      this.patchSession({
        activeRoute: route,
        summary,
        state: 'NAVIGATING',
        activeRequestId: undefined,
        rerouteCount: (s.rerouteCount ?? 0) + 1,
        lastUpdatedAt: this.now(),
      });

      this.emit('onNavigating');
      return this.requireSession();
    } catch (err) {
      return this.failAndReturn('UNKNOWN', errorMsg(err));
    }
  }

  private async resolveStart(
    intent: NavigationIntent,
  ): Promise<Coordinate> {
    if (intent.start.type === 'COORD') {
      return { lat: intent.start.lat, lon: intent.start.lon };
    }
    const pos = await this.gps.getCurrentPosition();
    return { lat: pos.lat, lon: pos.lon };
  }

  // -- GPS --

  private async startGps(): Promise<void> {
    await this.stopGps();
    this.gpsSubscription = await this.gps.subscribe(
      (point) => {
        this.handleLocationUpdate(point).catch((err) =>
          console.warn('[NavigationCore] location update error:', err),
        );
      },
      (err) => {
        this.failSession('GPS_UNAVAILABLE', errorMsg(err));
      },
    );
  }

  private async stopGps(): Promise<void> {
    this.gpsSubscription?.remove();
    this.gpsSubscription = null;
  }

  // -- Request cancellation --

  private async cancelActiveRequest(): Promise<void> {
    const id = this.session?.activeRequestId;
    if (!id) return;
    try {
      await this.engine.cancel(id);
    } catch {
      // swallow — don't block session cleanup
    }
    this.patchSession({ activeRequestId: undefined });
  }

  private async cleanup(): Promise<void> {
    await this.stopGps();
    await this.cancelActiveRequest();
  }

  // -- Session management --

  private setSession(session: NavSession): void {
    this.session = session;
    this.store.setSession(session);
    this.emitChanged();
  }

  private patchSession(patch: Partial<NavSession>): void {
    if (!this.session) return;
    this.session = { ...this.session, ...patch };
    this.store.setSession(this.session);
    this.emitChanged();
  }

  private requireSession(): NavSession {
    if (!this.session) throw new Error('Navigation session is not initialized.');
    return this.session;
  }

  private failSession(code: NavigationFailureCode, message: string): void {
    if (!this.session) return;
    this.patchSession({
      state: 'FAILED',
      failureCode: code,
      failureMessage: message,
      activeRequestId: undefined,
      lastUpdatedAt: this.now(),
    });
    this.emit('onFailed');
  }

  private failAndReturn(
    code: NavigationFailureCode,
    message: string,
  ): NavSession {
    this.failSession(code, message);
    return this.requireSession();
  }

  // -- Arrival --

  private hasArrived(point: GpsPoint, route: ValhallaRouteResult): boolean {
    const last = route.path[route.path.length - 1];
    if (!last) return false;
    const [destLon, destLat] = last;
    return approxDistanceM(point.lat, point.lon, destLat, destLon) <= this.arrivalM;
  }

  // -- Listener emission --

  private emitChanged(): void {
    if (!this.session) return;
    for (const l of this.listeners) l.onSessionChanged?.(this.session);
  }

  private emit(
    event: 'onPreviewReady' | 'onNavigating' | 'onArrived' | 'onFailed',
  ): void {
    this.emitChanged();
    if (!this.session) return;
    for (const l of this.listeners) l[event]?.(this.session);
  }
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function profileToCosting(profile: RoutingProfile): string {
  switch (profile) {
    case 'walk':
      return 'pedestrian';
    case 'motor_scooter':
      return 'motor_scooter';
    case 'car':
    default:
      return 'auto';
  }
}

function approxDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function errorMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown navigation error.';
}
