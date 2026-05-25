/**
 * ReroutePolicy — stateful decision logic for whether to trigger a reroute.
 *
 * Prevents reroute spam by enforcing:
 * - Minimum cooldown between reroutes
 * - Minimum off-route duration before first reroute
 * - No re-trigger while already recalculating
 */

import type {
  ReroutePolicy as IReroutePolicy,
  NavSession,
  GpsPoint,
  OffRouteResult,
  RerouteDecision,
} from '@janpams/core/navigation';

const DEFAULT_COOLDOWN_MS = 10_000;
const DEFAULT_OFF_ROUTE_DELAY_MS = 5_000;

export class MobileReroutePolicy implements IReroutePolicy {
  private lastRerouteTime = 0;
  private offRouteStartTime = 0;

  private readonly cooldownMs: number;
  private readonly offRouteDelayMs: number;

  constructor(options?: {
    cooldownMs?: number;
    offRouteDelayMs?: number;
  }) {
    this.cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.offRouteDelayMs = options?.offRouteDelayMs ?? DEFAULT_OFF_ROUTE_DELAY_MS;
  }

  shouldReroute(args: {
    session: NavSession;
    current: GpsPoint;
    offRoute: OffRouteResult;
    now: number;
  }): RerouteDecision {
    const { session, offRoute, now } = args;

    if (!offRoute.isOffRoute) {
      this.offRouteStartTime = 0;
      return { shouldReroute: false };
    }

    if (session.state === 'OFF_ROUTE_RECALCULATING') {
      return { shouldReroute: false };
    }

    if (now - this.lastRerouteTime < this.cooldownMs) {
      return { shouldReroute: false };
    }

    if (this.offRouteStartTime === 0) {
      this.offRouteStartTime = now;
    }

    const offRouteDuration = now - this.offRouteStartTime;
    if (offRouteDuration < this.offRouteDelayMs) {
      return { shouldReroute: false };
    }

    this.lastRerouteTime = now;
    this.offRouteStartTime = 0;
    return { shouldReroute: true, reason: 'OFF_ROUTE' };
  }

  reset(): void {
    this.lastRerouteTime = 0;
    this.offRouteStartTime = 0;
  }
}
