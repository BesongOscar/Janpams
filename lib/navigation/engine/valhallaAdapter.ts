/**
 * Valhalla engine adapter — implements NavigationEngine interface
 * by delegating to the existing ValhallaProvider singleton.
 *
 * Adds request-id tracking + cancellation support.
 */

import type {
  NavigationEngine,
  RouteRequest as ContractRouteRequest,
} from '@janpams/core/navigation';
import {
  valhallaProvider,
  type ValhallaRouteRequest,
} from '../../valhalla/ValhallaProvider';
import {
  getTilesArrayBufferForRegion,
} from '../../valhalla/tileStorage';

interface InFlightRequest {
  cancelled: boolean;
}

export class ValhallaAdapter implements NavigationEngine {
  private inFlight = new Map<string, InFlightRequest>();
  private initDone = false;

  async init(): Promise<void> {
    if (this.initDone && valhallaProvider.isReady()) return;
    await valhallaProvider.init();
    this.initDone = true;
  }

  /**
   * Load a pack by regionCode. Reads the tile buffer from SQLite storage
   * and delegates to ValhallaProvider.loadTiles().
   */
  async loadPack(
    regionCode: string,
    _options?: { checksum?: string },
  ): Promise<void> {
    const buffer = await getTilesArrayBufferForRegion(regionCode);
    if (!buffer) {
      throw new Error(`No tile data found for region: ${regionCode}`);
    }
    await valhallaProvider.loadTiles(buffer, { regionCode });
  }

  /**
   * Compute a route with maneuvers. Returns the raw engine result
   * (normalized by RouteNormalizer downstream).
   *
   * If the request was cancelled before the engine responds, returns null.
   */
  async routeWithManeuvers(
    requestId: string,
    request: ContractRouteRequest,
  ): Promise<unknown | null> {
    const tracker: InFlightRequest = { cancelled: false };
    this.inFlight.set(requestId, tracker);

    try {
      const valhallaReq: ValhallaRouteRequest = {
        locations: request.locations.map((l) => ({ lat: l.lat, lon: l.lon })),
        costing: request.costing ?? 'auto',
        directions_type: request.directions_type ?? 'maneuvers',
      };

      const result = await valhallaProvider.route(valhallaReq);

      if (tracker.cancelled) return null;

      return result;
    } finally {
      this.inFlight.delete(requestId);
    }
  }

  async cancel(requestId: string): Promise<void> {
    const tracker = this.inFlight.get(requestId);
    if (tracker) {
      tracker.cancelled = true;
    }
  }
}
