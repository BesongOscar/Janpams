/**
 * In-memory LRU cache for Valhalla route results (F1).
 * Key = stable JSON of request (locations + costing + options). Max 100 entries, evict oldest-first.
 */

import type { ValhallaRouteRequest, ValhallaRouteResult } from './ValhallaProvider';

const MAX_ENTRIES = 100;

const cache = new Map<string, ValhallaRouteResult | null>();
const keyOrder: string[] = [];

function cacheKey(req: ValhallaRouteRequest): string {
  return JSON.stringify({
    locations: req.locations,
    costing: req.costing,
    directions_type: req.directions_type ?? 'maneuvers',
    costing_options: req.costing_options ?? {},
  });
}

export function getCachedRoute(req: ValhallaRouteRequest): ValhallaRouteResult | null | undefined {
  const k = cacheKey(req);
  return cache.get(k);
}

export function setCachedRoute(req: ValhallaRouteRequest, result: ValhallaRouteResult | null): void {
  const k = cacheKey(req);
  if (cache.has(k)) {
    cache.set(k, result);
    return;
  }
  while (cache.size >= MAX_ENTRIES && keyOrder.length > 0) {
    const oldest = keyOrder.shift();
    if (oldest != null) cache.delete(oldest);
  }
  keyOrder.push(k);
  cache.set(k, result);
}

/** Clear the route cache (e.g. when Valhalla provider is re-initialized or a new pack is installed). */
export function clearRouteCache(): void {
  cache.clear();
  keyOrder.length = 0;
}
