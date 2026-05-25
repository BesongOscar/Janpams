/**
 * OffRouteDetector — pure function to evaluate whether the user
 * is off-route based on distance from the route polyline.
 *
 * No internal state, no side effects. Uses the existing MatchService
 * for snapping.
 */

import type {
  OffRouteDetector as IOffRouteDetector,
  GpsPoint,
  ValhallaRouteResult,
  RoutingProfile,
  OffRouteResult,
} from '@janpams/core/navigation';
import { matchService, type Route } from '@janpams/core/navigation';

const THRESHOLDS_M: Record<RoutingProfile, number> = {
  car: 35,
  motor_scooter: 30,
  walk: 20,
};

export class MobileOffRouteDetector implements IOffRouteDetector {
  evaluate(args: {
    current: GpsPoint;
    route: ValhallaRouteResult;
    profile: RoutingProfile;
  }): OffRouteResult {
    const { current, route, profile } = args;
    const thresholdM = THRESHOLDS_M[profile] ?? THRESHOLDS_M.car;

    const asRoute: Route = {
      path: route.path,
      distance: route.distance,
      source: 'precomputed',
    };

    const match = matchService.snapToRoute(
      { lon: current.lon, lat: current.lat },
      asRoute,
    );

    return {
      isOffRoute: match.distanceToRoute > thresholdM,
      distanceToRouteM: match.distanceToRoute,
      thresholdM,
    };
  }
}
