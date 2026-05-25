/**
 * Navigation module — re-exports shared core types/policies + mobile-specific services.
 */

// Shared types and pure-logic services from @janpams/core
export type {
  Coords,
  Route,
  RouteSource,
  NavigationRoute,
  NavigationStep,
  ManeuverType,
  NavigationDestination,
  DestinationType,
  MatchResult,
  ETAResult,
  ETAConfidence,
  OffRouteAction,
  OffRouteActionType,
  GPSPosition,
  GPSQuality,
  NavigationSession,
} from '@janpams/core/navigation';

export { OffRoutePolicy, offRoutePolicy } from '@janpams/core/navigation';
export { ETATracker, etaTracker } from '@janpams/core/navigation';

// Mobile-specific services (platform: expo-location, geometry)
export { MatchService, matchService } from './matchService';
export { GPSService, gpsService, type GPSCallback } from './gpsService';
