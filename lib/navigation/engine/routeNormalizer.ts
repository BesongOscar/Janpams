/**
 * RouteNormalizer — converts raw engine output into the canonical
 * ValhallaRouteResult shape from the navigation contract.
 *
 * Handles both Valhalla engine output and fallback route sources
 * (Dijkstra / cached) so downstream code always gets a
 * uniform shape with path, distance, duration, and maneuvers.
 */

import type {
  RouteNormalizer as IRouteNormalizer,
  ValhallaRouteResult,
  RouteSummary,
  Maneuver,
} from '@janpams/core/navigation';

interface RawManeuver {
  type?: string;
  instruction?: string;
  distance?: number;
  duration?: number;
  location?: { lat: number; lon: number };
}

interface RawRouteResult {
  path?: [number, number][];
  distance?: number;
  duration?: number;
  maneuvers?: RawManeuver[];
}

export class MobileRouteNormalizer implements IRouteNormalizer {
  /**
   * Normalize raw engine output into the canonical ValhallaRouteResult.
   * Adds synthetic depart/arrive maneuvers when missing.
   */
  normalize(raw: unknown): ValhallaRouteResult {
    const src = raw as RawRouteResult | null;
    if (!src || !src.path || src.path.length < 2) {
      throw new Error('Cannot normalize: route has no valid path');
    }

    const path = src.path;
    const distance = src.distance ?? 0;
    const duration = src.duration;

    const maneuvers = this.normalizeManeuvers(
      src.maneuvers ?? [],
      path,
      distance,
    );

    return { path, distance, duration, maneuvers };
  }

  summarize(route: ValhallaRouteResult): RouteSummary {
    return {
      distanceM: route.distance,
      durationS: route.duration,
      maneuverCount: route.maneuvers?.length ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private normalizeManeuvers(
    raw: RawManeuver[],
    path: [number, number][],
    totalDistance: number,
  ): Maneuver[] {
    if (raw.length === 0) {
      return this.synthesizeManeuvers(path, totalDistance);
    }

    const maneuvers: Maneuver[] = raw.map((m) => ({
      type: m.type ?? 'unknown',
      instruction: m.instruction,
      distance: m.distance,
      duration: m.duration,
      location: m.location
        ? { lat: m.location.lat, lon: m.location.lon }
        : undefined,
    }));

    // Ensure a depart maneuver at the start
    if (maneuvers[0]?.type !== 'depart') {
      const startPt = path[0];
      maneuvers.unshift({
        type: 'depart',
        instruction: 'Start',
        distance: 0,
        location: { lat: startPt[1], lon: startPt[0] },
      });
    }

    // Ensure an arrive maneuver at the end
    const last = maneuvers[maneuvers.length - 1];
    if (last?.type !== 'arrive' && last?.type !== 'destination') {
      const endPt = path[path.length - 1];
      maneuvers.push({
        type: 'arrive',
        instruction: 'Arrive',
        distance: totalDistance,
        location: { lat: endPt[1], lon: endPt[0] },
      });
    }

    return maneuvers;
  }

  /** Create minimal depart → arrive maneuvers when none are provided. */
  private synthesizeManeuvers(
    path: [number, number][],
    totalDistance: number,
  ): Maneuver[] {
    const startPt = path[0];
    const endPt = path[path.length - 1];
    return [
      {
        type: 'depart',
        instruction: 'Start',
        distance: 0,
        location: { lat: startPt[1], lon: startPt[0] },
      },
      {
        type: 'arrive',
        instruction: 'Arrive',
        distance: totalDistance,
        location: { lat: endPt[1], lon: endPt[0] },
      },
    ];
  }
}
