/**
 * Init Valhalla routing on app start (Phase 4).
 * Load tiles for installed packs; getRoute uses Valhalla when ready and falls back to route path.
 */

import { getInstalledPacks } from '../japaState';
import { getPackState } from '../japaState';
import {
  hasProdTilesForRegion,
  getTilesArrayBufferForRegion,
} from './tileStorage';
import { getCachedRoute, setCachedRoute, clearRouteCache } from './valhallaCache';
import type { ValhallaRouteResult } from './ValhallaProvider';

export interface ValhallaRoutingOptions {
  getInstalledPacks: () => Promise<{ id: string }[]>;
  getPackState: (regionCode: string) => Promise<string>;
  getGlueUrls: () => { wasmUrl: string; jsGlueUrl: string } | Promise<{ wasmUrl: string; jsGlueUrl: string }>;
  getRouteProvider: () => { init: (urls?: { wasmUrl: string; jsGlueUrl: string }) => Promise<void>; loadTiles: (buf: ArrayBuffer, options?: { regionCode?: string }) => Promise<void>; route: (req: import('./ValhallaProvider').ValhallaRouteRequest) => Promise<ValhallaRouteResult | null>; isReady: () => boolean };
}

let routingOptions: ValhallaRoutingOptions | null = null;
let initPromise: Promise<boolean> | null = null;
const loadedRegionCodes = new Set<string>();

export function initValhallaRouting(options: ValhallaRoutingOptions): void {
  routingOptions = options;
}

export function clearValhallaInit(): void {
  initPromise = null;
  loadedRegionCodes.clear();
  clearRouteCache();
}

async function ensureRouterReady(): Promise<boolean> {
  if (initPromise !== null) return initPromise;
  if (!routingOptions) {
    initPromise = Promise.resolve(false);
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const urls = await Promise.resolve(routingOptions!.getGlueUrls());
      const provider = routingOptions!.getRouteProvider();
      await provider.init(urls);
      return provider.isReady();
    } catch (err) {
      console.warn('[Valhalla] ensureRouterReady failed:', err);
      return false;
    }
  })();
  return initPromise;
}

async function loadTilesForNewPacks(): Promise<void> {
  if (!routingOptions) return;
  const provider = routingOptions.getRouteProvider();
  const packs = await routingOptions.getInstalledPacks();
  for (const pack of packs) {
    const regionCode = pack.id;
    if (loadedRegionCodes.has(regionCode)) continue;
    const state = await getPackState(regionCode);
    if (state !== 'INSTALLED') continue;
    if (!(await hasProdTilesForRegion(regionCode))) continue;
    const buffer = await getTilesArrayBufferForRegion(regionCode);
    if (!buffer) continue;
    try {
      await provider.loadTiles(buffer, { regionCode });
      loadedRegionCodes.add(regionCode);
    } catch (err) {
      console.warn(`[Valhalla] loadTiles for ${regionCode} failed:`, err);
    }
  }
}

export async function loadTilesForNewPacksIfReady(): Promise<void> {
  if (!routingOptions || initPromise === null) return;
  await initPromise;
  const provider = routingOptions.getRouteProvider();
  if (!provider.isReady()) return;
  await loadTilesForNewPacks();
}

export async function isValhallaReady(regionCode: string): Promise<boolean> {
  if (!routingOptions) return false;
  if ((await getPackState(regionCode)) !== 'INSTALLED') return false;
  if (!(await hasProdTilesForRegion(regionCode))) return false;
  if (initPromise !== null) await initPromise;
  return routingOptions.getRouteProvider().isReady();
}

export interface GetValhallaRouteOptions {
  costing?: string;
  routePreference?: 'fastest' | 'shortest';
  avoidSettings?: Record<string, boolean>;
  waypoints?: [number, number][];
}

function buildValhallaRequest(
  start: [number, number],
  end: [number, number],
  options?: GetValhallaRouteOptions
): import('./ValhallaProvider').ValhallaRouteRequest {
  const [startLon, startLat] = start;
  const [endLon, endLat] = end;
  const locations = [
    { lat: startLat, lon: startLon },
    ...((options?.waypoints ?? []).map(([lon, lat]) => ({ lat, lon }))),
    { lat: endLat, lon: endLon },
  ];
  const costing = options?.costing ?? 'auto';
  const request: import('./ValhallaProvider').ValhallaRouteRequest = {
    locations,
    costing,
    directions_type: 'maneuvers',
  };
  const profileOptions: Record<string, unknown> = {};
  if (options?.routePreference === 'shortest') {
    profileOptions.use_distance = 1.0;
  }
  if (options?.avoidSettings?.['highways']) profileOptions.use_highways = 0.0;
  if (options?.avoidSettings?.['toll-roads']) profileOptions.use_tolls = 0.0;
  if (options?.avoidSettings?.['ferries']) profileOptions.use_ferry = 0.0;
  if (options?.avoidSettings?.['unpaved']) profileOptions.exclude_unpaved = true;
  if (options?.avoidSettings?.['u-turns']) (profileOptions as Record<string, unknown>).avoid_uturn = true;

  if (Object.keys(profileOptions).length > 0) {
    request.costing_options = { [costing]: profileOptions };
  }
  return request;
}

export async function getValhallaRoute(
  start: [number, number],
  end: [number, number],
  options?: GetValhallaRouteOptions | string
): Promise<ValhallaRouteResult | null> {
  if (!routingOptions) return null;
  await ensureRouterReady();
  const provider = routingOptions.getRouteProvider();
  if (!provider.isReady()) return null;
  const opts: GetValhallaRouteOptions | undefined =
    typeof options === 'string' ? { costing: options } : options;
  const request = buildValhallaRequest(start, end, opts);
  const cached = getCachedRoute(request);
  if (cached !== undefined) return cached;
  const result = await provider.route(request);
  setCachedRoute(request, result);
  return result;
}

