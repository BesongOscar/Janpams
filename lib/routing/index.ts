/**
 * Routing API — single entry for "get route from A to B"
 *
 * Phase 3: uses generateRoutePath (cache → Dijkstra → fallback).
 * Phase 4: tries Valhalla when ready (packId + tiles), then generateRoutePath.
 */

import { generateRoutePath, type RoutePathResult, type RoutePathOptions } from '../routePath';
import { isValhallaReady, getValhallaRoute } from '../valhalla/initValhalla';

export { isValhallaReady } from '../valhalla/initValhalla';

export type { RoutePathResult, RoutePathOptions } from '../routePath';

export { cacheRoute, findCachedRoute, findCachedRouteReverse, findAndTrimCachedRoute, getRoutesForPack, clearRoutesForPack, getRouteCacheStats, routeCoordHash } from './routeCache';

/** Start or end point as [lon, lat] */
export type RoutePoint = [number, number];

/** Valhalla costing: auto | bicycle | pedestrian (and optionally bus for transit). */
export type ValhallaCosting = 'auto' | 'bicycle' | 'pedestrian' | 'bus';

/** Avoid toggles keyed like web (highways, toll-roads, ferries, unpaved). */
export type AvoidSettings = Record<string, boolean>;

export interface GetRouteOptions extends Omit<RoutePathOptions, 'projectedStart' | 'projectedStreetId'> {
  /** Valhalla costing (default 'auto'). */
  costing?: ValhallaCosting;
  /** Fastest vs shortest route. */
  routePreference?: 'fastest' | 'shortest';
  /** Avoid options for Valhalla costing_options. */
  avoidSettings?: AvoidSettings;
  /** Optional waypoints [lon, lat][] for multi-stop (Valhalla). */
  waypoints?: [number, number][];
}

export interface GetRouteResult {
  path: [number, number][];
  distance: number;
  success: boolean;
  /** Optional steps for turn-by-turn UI (Phase 4: Valhalla maneuvers) */
  steps?: RouteStep[];
  debug?: RoutePathResult['debug'];
}

export interface RouteStep {
  type: 'start' | 'arrive' | 'turn' | 'continue';
  instruction?: string;
  distance?: number;
  coordinate?: [number, number];
}

/**
 * Get a route from start to end.
 * Phase 4: if packId is set and Valhalla is ready, try Valhalla first; else use generateRoutePath (cache → Dijkstra → fallback).
 */
export async function getRoute(
  start: RoutePoint,
  end: RoutePoint,
  options?: GetRouteOptions
): Promise<GetRouteResult> {
  const [startLon, startLat] = start;
  const [endLon, endLat] = end;
  const packId = options?.packId;

  if (packId) {
    try {
      const ready = await isValhallaReady(packId);
      if (ready) {
        const valhallaResult = await getValhallaRoute(start, end, {
          costing: options?.costing,
          routePreference: options?.routePreference,
          avoidSettings: options?.avoidSettings,
          waypoints: options?.waypoints,
        });
        if (valhallaResult && valhallaResult.path.length >= 2) {
          let steps: RouteStep[];
          if (valhallaResult.maneuvers?.length) {
            steps = valhallaResult.maneuvers.map((m, i) => {
              const coord = m.location ? [m.location.lon, m.location.lat] as [number, number] : undefined;
              const type = (m.type === 'depart' ? 'start' : m.type === 'arrive' ? 'arrive' : 'turn') as RouteStep['type'];
              return { type, instruction: m.instruction, distance: m.distance, coordinate: coord };
            });
            if (steps[0]?.type !== 'start' && valhallaResult.path[0]) steps.unshift({ type: 'start', instruction: 'Start', coordinate: valhallaResult.path[0] });
            if (steps[steps.length - 1]?.type !== 'arrive' && valhallaResult.path[valhallaResult.path.length - 1]) steps.push({ type: 'arrive', instruction: 'Arrive', coordinate: valhallaResult.path[valhallaResult.path.length - 1], distance: valhallaResult.distance });
          } else {
            steps = [
              { type: 'start', instruction: 'Start', coordinate: valhallaResult.path[0] },
              { type: 'arrive', instruction: 'Arrive', coordinate: valhallaResult.path[valhallaResult.path.length - 1], distance: valhallaResult.distance },
            ];
          }
          return {
            path: valhallaResult.path,
            distance: valhallaResult.distance,
            success: true,
            steps,
            debug: { algorithm: 'valhalla' },
          };
        }
      }
    } catch (err) {
      console.warn('[Routing] Valhalla route failed, using fallback:', err);
    }
  }

  // Fallback: with waypoints, compute each leg and merge (Valhalla supports multi-stop natively above).
  const waypoints = options?.waypoints ?? [];
  if (waypoints.length > 0) {
    const points: RoutePoint[] = [start, ...waypoints, end];
    const mergedPath: RoutePoint[] = [];
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [aLon, aLat] = points[i];
      const [bLon, bLat] = points[i + 1];
      const leg = await generateRoutePath(aLon, aLat, bLon, bLat, options);
      if (!leg.success || leg.path.length < 2) {
        return {
          path: leg.path,
          distance: leg.distance,
          success: false,
          steps: [],
          debug: leg.debug,
        };
      }
      const segment = i === 0 ? leg.path : leg.path.slice(1);
      mergedPath.push(...segment);
      totalDistance += leg.distance;
    }
    const steps: RouteStep[] =
      mergedPath.length >= 2
        ? [
            { type: 'start', instruction: 'Start', coordinate: mergedPath[0] },
            { type: 'arrive', instruction: 'Arrive', coordinate: mergedPath[mergedPath.length - 1], distance: totalDistance },
          ]
        : [];
    return {
      path: mergedPath,
      distance: totalDistance,
      success: true,
      steps,
      debug: { algorithm: 'fallback_multi' },
    };
  }

  const result = await generateRoutePath(startLon, startLat, endLon, endLat, options);
  const steps: RouteStep[] = [];
  if (result.path.length >= 2) {
    steps.push({ type: 'start', instruction: 'Start', coordinate: result.path[0] });
    steps.push({ type: 'arrive', instruction: 'Arrive', coordinate: result.path[result.path.length - 1], distance: result.distance });
  }
  return {
    path: result.path,
    distance: result.distance,
    success: result.success,
    steps,
    debug: result.debug,
  };
}
