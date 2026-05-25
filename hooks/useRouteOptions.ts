/**
 * useRouteOptions — transport mode, route preferences, and multi-stop state.
 *
 * Manages the route planning UI state that feeds into the routing engine.
 */

import { useState, useCallback } from 'react';

export type TransportMode = 'car' | 'bike' | 'walk';

export interface RoutePreferences {
  avoidHighways: boolean;
  avoidTolls: boolean;
  avoidUnpaved: boolean;
  avoidFerries: boolean;
  avoidUturns: boolean;
  routeType: 'fastest' | 'shortest';
}

export interface Waypoint {
  id: string;
  label: string;
  coordinates: [number, number] | null;
}

const DEFAULT_PREFERENCES: RoutePreferences = {
  avoidHighways: false,
  avoidTolls: false,
  avoidUnpaved: false,
  avoidFerries: false,
  avoidUturns: false,
  routeType: 'fastest',
};

const MAX_STOPS = 5;

function generateWaypointId(): string {
  return `wp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Valhalla costing model for each transport mode.
 */
export function getValhallaCostingModel(mode: TransportMode): string {
  switch (mode) {
    case 'car': return 'auto';
    case 'bike': return 'bicycle';
    case 'walk': return 'pedestrian';
  }
}

export function useRouteOptions() {
  const [mode, setMode] = useState<TransportMode>('car');
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFERENCES);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const togglePreference = useCallback(
    (key: keyof Omit<RoutePreferences, 'routeType'>) => {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  const setRouteType = useCallback((type: 'fastest' | 'shortest') => {
    setPreferences(prev => ({ ...prev, routeType: type }));
  }, []);

  // --- Multi-stop management ---
  const addWaypoint = useCallback(() => {
    setWaypoints(prev => {
      if (prev.length >= MAX_STOPS) return prev;
      return [...prev, { id: generateWaypointId(), label: '', coordinates: null }];
    });
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints(prev => prev.filter(w => w.id !== id));
  }, []);

  const updateWaypoint = useCallback(
    (id: string, update: Partial<Omit<Waypoint, 'id'>>) => {
      setWaypoints(prev =>
        prev.map(w => (w.id === id ? { ...w, ...update } : w)),
      );
    },
    [],
  );

  const reorderWaypoints = useCallback((fromIndex: number, toIndex: number) => {
    setWaypoints(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, removed);
      return copy;
    });
  }, []);

  const clearWaypoints = useCallback(() => setWaypoints([]), []);

  const canAddWaypoint = waypoints.length < MAX_STOPS;

  /**
   * Build the ordered list of coordinates for routing: [origin, ...stops, destination].
   * Returns null if any coordinate is missing.
   */
  const getOrderedCoordinates = useCallback(
    (
      origin: [number, number] | null,
      destination: [number, number] | null,
    ): [number, number][] | null => {
      if (!origin || !destination) return null;
      const stops = waypoints
        .map(w => w.coordinates)
        .filter((c): c is [number, number] => c !== null);
      if (stops.length !== waypoints.length) return null;
      return [origin, ...stops, destination];
    },
    [waypoints],
  );

  return {
    mode,
    setMode,
    preferences,
    togglePreference,
    setRouteType,

    waypoints,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    reorderWaypoints,
    clearWaypoints,
    canAddWaypoint,
    getOrderedCoordinates,
  };
}
