/**
 * useNavigation — live navigation state management hook.
 *
 * Orchestrates GPS tracking, route snapping, ETA, off-route detection.
 * Screens call startNavigation(route) and get real-time state updates.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  matchService,
  gpsService,
  etaTracker,
  offRoutePolicy,
  type Route,
  type MatchResult,
  type ETAResult,
  type OffRouteAction,
  type GPSPosition,
  type GPSQuality,
  type Coords,
} from '@/lib/navigation';
import { ETATracker } from '@janpams/core/navigation';

export interface NavigationState {
  isNavigating: boolean;
  snappedPosition: Coords | null;
  /** Raw GPS position (for reroute from current location). */
  currentPosition: Coords | null;
  matchResult: MatchResult | null;
  eta: ETAResult | null;
  offRouteAction: OffRouteAction | null;
  gpsQuality: GPSQuality | null;
  currentSpeed: number;
  currentStepIndex: number;
  progress: number;
  formattedETA: string;
  formattedDistance: string;
}

const INITIAL_STATE: NavigationState = {
  isNavigating: false,
  snappedPosition: null,
  currentPosition: null,
  matchResult: null,
  eta: null,
  offRouteAction: null,
  gpsQuality: null,
  currentSpeed: 0,
  currentStepIndex: 0,
  progress: 0,
  formattedETA: '',
  formattedDistance: '',
};

export function useNavigation() {
  const [state, setState] = useState<NavigationState>(INITIAL_STATE);
  const routeRef = useRef<Route | null>(null);
  const stepProgressRef = useRef<number[]>([]);

  const handleGPSUpdate = useCallback((pos: GPSPosition) => {
    const route = routeRef.current;
    if (!route) return;

    const match = matchService.snapToRoute(pos.coords, route);
    const speed = pos.speed ?? 0;
    const eta = etaTracker.calculateETA(match, speed);
    const offRoute = offRoutePolicy.handleDeviation(match, true);
    const quality = gpsService.getQuality();

    // Advance step index based on progress
    let stepIndex = 0;
    for (let i = 0; i < stepProgressRef.current.length; i++) {
      if (match.progress >= stepProgressRef.current[i]) {
        stepIndex = i + 1;
      }
    }

    setState({
      isNavigating: true,
      snappedPosition: match.snappedPoint,
      currentPosition: pos.coords,
      matchResult: match,
      eta,
      offRouteAction: offRoute,
      gpsQuality: quality,
      currentSpeed: speed,
      currentStepIndex: stepIndex,
      progress: match.progress,
      formattedETA: ETATracker.formatETA(eta.etaSeconds),
      formattedDistance: ETATracker.formatDistance(match.remainingDistance),
    });
  }, []);

  const startNavigation = useCallback(
    async (route: Route, stepCoordinates?: [number, number][]) => {
      routeRef.current = route;
      etaTracker.reset();
      offRoutePolicy.reset();

      // Pre-compute step progress markers
      if (stepCoordinates && stepCoordinates.length > 0) {
        const totalDist = route.distance || 1;
        stepProgressRef.current = stepCoordinates.map(coord => {
          const stepMatch = matchService.snapToRoute(
            { lon: coord[0], lat: coord[1] },
            route,
          );
          return stepMatch.progress;
        });
      } else {
        stepProgressRef.current = [];
      }

      await gpsService.start(handleGPSUpdate);
      setState(prev => ({ ...prev, isNavigating: true }));
    },
    [handleGPSUpdate],
  );

  const stopNavigation = useCallback(() => {
    gpsService.stop();
    routeRef.current = null;
    stepProgressRef.current = [];
    etaTracker.reset();
    offRoutePolicy.reset();
    setState(INITIAL_STATE);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gpsService.stop();
    };
  }, []);

  return {
    ...state,
    startNavigation,
    stopNavigation,
  };
}
