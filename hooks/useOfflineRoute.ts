/**
 * Hook for offline route (Phase 5).
 * Calls getRoute(start, end) and returns path, distance, steps, success, loading, error.
 * Supports multi-stop: fetchRouteMulti(start, waypoints, end) for A→B→C→…→Z.
 */

import { useState, useCallback } from 'react';
import { getRoute } from '@/lib/routing';
import type { GetRouteResult, GetRouteOptions, RoutePoint, RouteStep } from '@/lib/routing';

const MAX_WAYPOINTS = 5;

interface UseOfflineRouteResult {
  path: [number, number][] | null;
  distance: number;
  steps: GetRouteResult['steps'];
  success: boolean;
  loading: boolean;
  error: string | null;
  fetchRoute: (start: RoutePoint, end: RoutePoint, options?: GetRouteOptions) => Promise<GetRouteResult | null>;
  /** Multi-stop: start → waypoints[0] → … → end. Waypoints are [lon, lat][]. Max 5. */
  fetchRouteMulti: (start: RoutePoint, waypoints: RoutePoint[], end: RoutePoint, options?: GetRouteOptions) => Promise<GetRouteResult | null>;
  reset: () => void;
}

const initialState = {
  path: null as [number, number][] | null,
  distance: 0,
  steps: undefined as GetRouteResult['steps'],
  success: false,
  error: null as string | null,
};

export function useOfflineRoute(): UseOfflineRouteResult {
  const [path, setPath] = useState<[number, number][] | null>(initialState.path);
  const [distance, setDistance] = useState(initialState.distance);
  const [steps, setSteps] = useState<GetRouteResult['steps']>(initialState.steps);
  const [success, setSuccess] = useState(initialState.success);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialState.error);

  const fetchRoute = useCallback(
    async (start: RoutePoint, end: RoutePoint, options?: GetRouteOptions): Promise<GetRouteResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await getRoute(start, end, options);
        setPath(result.path);
        setDistance(result.distance);
        setSteps(result.steps);
        setSuccess(result.success);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get route';
        setError(message);
        setSuccess(false);
        setPath(null);
        setDistance(0);
        setSteps(undefined);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchRouteMulti = useCallback(
    async (start: RoutePoint, waypoints: RoutePoint[], end: RoutePoint, options?: GetRouteOptions): Promise<GetRouteResult | null> => {
      const trimmed = waypoints.slice(0, MAX_WAYPOINTS);
      const points: RoutePoint[] = [start, ...trimmed, end];
      setLoading(true);
      setError(null);
      try {
        const mergedPath: [number, number][] = [];
        const mergedSteps: RouteStep[] = [];
        let totalDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
          const leg = await getRoute(points[i], points[i + 1], options);
          if (!leg.success || !leg.path?.length) {
            setError('One or more segments could not be routed');
            setSuccess(false);
            setPath(null);
            setDistance(0);
            setSteps(undefined);
            return null;
          }
          const pathSegment = i === 0 ? leg.path : leg.path.slice(1);
          mergedPath.push(...pathSegment);
          totalDistance += leg.distance;
          if (leg.steps?.length) {
            const stepsToAdd = i === 0 ? leg.steps : leg.steps.filter((s, idx) => idx > 0);
            mergedSteps.push(...stepsToAdd);
          }
        }
        if (mergedSteps.length === 0) {
          mergedSteps.push(
            { type: 'start', instruction: 'Start', coordinate: mergedPath[0] },
            { type: 'arrive', instruction: 'Arrive', coordinate: mergedPath[mergedPath.length - 1], distance: totalDistance },
          );
        }
        setPath(mergedPath);
        setDistance(totalDistance);
        setSteps(mergedSteps);
        setSuccess(true);
        return { path: mergedPath, distance: totalDistance, success: true, steps: mergedSteps };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get route';
        setError(message);
        setSuccess(false);
        setPath(null);
        setDistance(0);
        setSteps(undefined);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setPath(initialState.path);
    setDistance(initialState.distance);
    setSteps(initialState.steps);
    setSuccess(initialState.success);
    setError(initialState.error);
  }, []);

  return {
    path,
    distance,
    steps,
    success,
    loading,
    error,
    fetchRoute,
    fetchRouteMulti,
    reset,
  };
}
