/**
 * useNavigationCore — React hook that provides NavigationCore singleton
 * and reactive state from the Zustand navigation store.
 *
 * Drop-in replacement for the existing useNavigation hook (Phase 4).
 */

import { useRef, useCallback, useEffect } from 'react';
import type {
  NavigationIntent,
  NavSession,
  NavigationState,
  NavigationFailureCode,
  Coordinate,
  GpsPoint,
  GPSQuality,
} from '@janpams/core/navigation';
import {
  useNavigationStore,
  useNavigationSession,
  useNavState,
  useIsNavigating,
  useNavigationError,
  type NavigationETAInfo,
} from '@/lib/store/navigationStore';
import { NavigationCore, type NavigationCoreGpsService } from '@/lib/navigation/core';
import { ValhallaAdapter } from '@/lib/navigation/engine/valhallaAdapter';
import { MobilePackManager } from '@/lib/navigation/packs/packManager';
import { MobileRouteNormalizer } from '@/lib/navigation/engine/routeNormalizer';
import { MobileOffRouteDetector } from '@/lib/navigation/rerouting/offRouteDetector';
import { MobileReroutePolicy } from '@/lib/navigation/rerouting/reroutePolicy';
import { gpsService } from '@/lib/navigation/gpsService';

// ---------------------------------------------------------------------------
// GPS adapter — bridge existing GPSService to the NavigationCoreGpsService
// ---------------------------------------------------------------------------

class GpsServiceAdapter implements NavigationCoreGpsService {
  async getCurrentPosition(): Promise<GpsPoint> {
    const pos = await gpsService.getCurrentPosition();
    return {
      lat: pos.coords.lat,
      lon: pos.coords.lon,
      accuracyM: pos.accuracy,
      speedMps: pos.speed ?? undefined,
      headingDeg: pos.heading ?? undefined,
      timestamp: pos.timestamp,
    };
  }

  async subscribe(
    onLocation: (point: GpsPoint) => void,
    onError?: (error: unknown) => void,
  ): Promise<{ remove: () => void }> {
    try {
      await gpsService.start((pos) => {
        onLocation({
          lat: pos.coords.lat,
          lon: pos.coords.lon,
          accuracyM: pos.accuracy,
          speedMps: pos.speed ?? undefined,
          headingDeg: pos.heading ?? undefined,
          timestamp: pos.timestamp,
        });
      });
    } catch (err) {
      onError?.(err);
    }

    return {
      remove: () => {
        gpsService.stop();
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let coreInstance: NavigationCore | null = null;

function getOrCreateCore(): NavigationCore {
  if (coreInstance) return coreInstance;

  const engine = new ValhallaAdapter();
  const packManager = new MobilePackManager(engine);
  const routeNormalizer = new MobileRouteNormalizer();
  const offRouteDetector = new MobileOffRouteDetector();
  const reroutePolicy = new MobileReroutePolicy();
  const gpsAdapter = new GpsServiceAdapter();
  const store = useNavigationStore.getState();

  coreInstance = new NavigationCore({
    engine,
    packManager,
    gps: gpsAdapter,
    routeNormalizer,
    offRouteDetector,
    reroutePolicy,
    store,
  });

  return coreInstance;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseNavigationCoreResult {
  startNavigation: (intent: NavigationIntent) => Promise<NavSession | null>;
  startWithPrecomputedRoute: (
    intent: NavigationIntent,
    routeData: { path: [number, number][]; distance: number; duration?: number },
  ) => Promise<NavSession | null>;
  confirmStart: () => Promise<void>;
  stop: () => Promise<void>;
  reroute: () => Promise<void>;

  session: NavSession | null;
  state: NavigationState;
  snappedPosition: Coordinate | null;
  eta: NavigationETAInfo | null;
  currentManeuverIndex: number;
  gpsQuality: GPSQuality | null;
  currentSpeed: number;
  isNavigating: boolean;
  isOffRoute: boolean;
  error: { code: NavigationFailureCode; message: string } | null;
  isFollowingMap: boolean;
  isVoiceMuted: boolean;
  setFollowingMap: (v: boolean) => void;
  setVoiceMuted: (v: boolean) => void;
}

export function useNavigationCore(): UseNavigationCoreResult {
  const coreRef = useRef<NavigationCore>(getOrCreateCore());

  // Reactive state from store
  const session = useNavigationSession();
  const state = useNavState();
  const isNav = useIsNavigating();
  const navError = useNavigationError();
  const snappedPosition = useNavigationStore((s) => s.snappedPosition);
  const eta = useNavigationStore((s) => s.eta);
  const currentManeuverIndex = useNavigationStore(
    (s) => s.currentManeuverIndex,
  );
  const gpsQuality = useNavigationStore((s) => s.gpsQuality);
  const currentSpeed = useNavigationStore((s) => s.currentSpeed);
  const isFollowingMap = useNavigationStore((s) => s.isFollowingMap);
  const isVoiceMuted = useNavigationStore((s) => s.isVoiceMuted);
  const setFollowingMap = useNavigationStore((s) => s.setFollowingMap);
  const setVoiceMuted = useNavigationStore((s) => s.setVoiceMuted);

  const isOffRoute =
    session?.state === 'OFF_ROUTE_RECALCULATING' ?? false;

  // Actions
  const startNavigation = useCallback(
    async (intent: NavigationIntent): Promise<NavSession | null> => {
      const session = await coreRef.current.start(intent);
      return session;
    },
    [],
  );

  const startWithPrecomputedRoute = useCallback(
    async (
      intent: NavigationIntent,
      routeData: {
        path: [number, number][];
        distance: number;
        duration?: number;
      },
    ): Promise<NavSession | null> => {
      const session = await coreRef.current.startWithPrecomputedRoute(
        intent,
        routeData,
      );
      return session;
    },
    [],
  );

  const confirmStart = useCallback(async () => {
    await coreRef.current.confirmStartNavigation();
  }, []);

  const stop = useCallback(async () => {
    await coreRef.current.stop();
  }, []);

  const reroute = useCallback(async () => {
    await coreRef.current.rerouteFromCurrentLocation();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      coreRef.current.stop().catch(() => {});
    };
  }, []);

  return {
    startNavigation,
    startWithPrecomputedRoute,
    confirmStart,
    stop,
    reroute,
    session,
    state,
    snappedPosition,
    eta,
    currentManeuverIndex,
    gpsQuality,
    currentSpeed,
    isNavigating: isNav,
    isOffRoute,
    error: navError
      ? { code: navError.failureCode, message: navError.failureMessage }
      : null,
    isFollowingMap,
    isVoiceMuted,
    setFollowingMap,
    setVoiceMuted,
  };
}
