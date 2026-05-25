/**
 * Route Cache Management (SQLite)
 *
 * Stores and retrieves pre-computed routes for offline use.
 * Routes are cached during data pack download; used as primary routing source.
 * Matches web's routeCache API (apps/core/mbukanji-maps/src/lib/routing/routeCache.ts).
 */

import { haversineLonLat } from '@janpams/core';
import { getDB } from '../db/database';
import { queryAll, queryFirst, execute, parseJSON, stringifyJSON } from '../db/helpers';
import type { CachedRoute, RouteSource, RouteQuality } from '../db/schemas';

const COORDINATE_TOLERANCE = 30;
const BATCH_SIZE = 50;

/** Distance in meters between two [lon, lat] points (E3: shared core). */
const haversineMeters = haversineLonLat;

/**
 * Generate a deterministic hash for route lookup (5 decimal places ~1m precision)
 */
export function routeCoordHash(start: [number, number], end: [number, number]): string {
  const s = `${start[0].toFixed(5)},${start[1].toFixed(5)}`;
  const e = `${end[0].toFixed(5)},${end[1].toFixed(5)}`;
  return `route_${s}_${e}`;
}

function rowToCachedRoute(row: Record<string, unknown>): CachedRoute {
  return {
    id: row.id as string,
    startCoord: parseJSON(row.startCoord as string) as [number, number],
    endCoord: parseJSON(row.endCoord as string) as [number, number],
    startPOIId: row.startPOIId as string | undefined,
    endPOIId: row.endPOIId as string | undefined,
    path: parseJSON(row.path as string) as [number, number][],
    distance: row.distance as number,
    duration: row.duration as number | undefined,
    source: row.source as RouteSource,
    quality: row.quality as RouteQuality,
    packId: row.packId as string,
    cachedAt: row.cachedAt as string,
    expiresAt: row.expiresAt as string | undefined,
  };
}

/**
 * Store a single route in the cache
 */
export async function cacheRoute(
  startCoord: [number, number],
  endCoord: [number, number],
  path: [number, number][],
  distance: number,
  options: {
    startPOIId?: string;
    endPOIId?: string;
    duration?: number;
    source: CachedRoute['source'];
    quality: CachedRoute['quality'];
    packId: string;
  }
): Promise<void> {
  const db = await getDB();
  const id = routeCoordHash(startCoord, endCoord);
  const cachedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO route_cache (id, startCoord, endCoord, startPOIId, endPOIId, path, distance, duration, source, quality, packId, cachedAt, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      stringifyJSON(startCoord),
      stringifyJSON(endCoord),
      options.startPOIId ?? null,
      options.endPOIId ?? null,
      stringifyJSON(path),
      distance,
      options.duration ?? null,
      options.source,
      options.quality,
      options.packId,
      cachedAt,
      null,
    ]
  );
}

/**
 * Store multiple routes in batch (used during data pack download)
 */
export async function cacheRoutesBatch(
  routes: Array<{
    startCoord: [number, number];
    endCoord: [number, number];
    path: [number, number][];
    distance: number;
    startPOIId?: string;
    endPOIId?: string;
    duration?: number;
    source: CachedRoute['source'];
    quality: CachedRoute['quality'];
    packId: string;
  }>
): Promise<number> {
  if (routes.length === 0) return 0;
  const db = await getDB();
  const cachedAt = new Date().toISOString();
  const sql = `INSERT OR REPLACE INTO route_cache (id, startCoord, endCoord, startPOIId, endPOIId, path, distance, duration, source, quality, packId, cachedAt, expiresAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  let stored = 0;
  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    const batch = routes.slice(i, i + BATCH_SIZE);
    for (const r of batch) {
      const id = routeCoordHash(r.startCoord, r.endCoord);
      await db.runAsync(sql, [
        id,
        stringifyJSON(r.startCoord),
        stringifyJSON(r.endCoord),
        r.startPOIId ?? null,
        r.endPOIId ?? null,
        stringifyJSON(r.path),
        r.distance,
        r.duration ?? null,
        r.source,
        r.quality,
        r.packId,
        cachedAt,
        null,
      ]);
      stored++;
    }
  }
  return stored;
}

/**
 * Find a cached route by exact hash
 */
export async function findCachedRouteByHash(
  start: [number, number],
  end: [number, number]
): Promise<CachedRoute | null> {
  const id = routeCoordHash(start, end);
  const row = await queryFirst<Record<string, unknown>>('SELECT * FROM route_cache WHERE id = ?', [id]);
  return row ? rowToCachedRoute(row) : null;
}

/**
 * Find a cached route with coordinate tolerance
 */
export async function findCachedRoute(
  start: [number, number],
  end: [number, number],
  toleranceMeters: number = COORDINATE_TOLERANCE
): Promise<CachedRoute | null> {
  const exact = await findCachedRouteByHash(start, end);
  if (exact) return exact;
  const all = await queryAll<Record<string, unknown>>('SELECT * FROM route_cache');
  let best: CachedRoute | null = null;
  let bestQuality = Infinity;
  for (const row of all) {
    const route = rowToCachedRoute(row);
    const startDist = haversineMeters(start, route.startCoord);
    const endDist = haversineMeters(end, route.endCoord);
    if (startDist <= toleranceMeters && endDist <= toleranceMeters && route.quality < bestQuality) {
      best = route;
      bestQuality = route.quality;
    }
  }
  return best;
}

/**
 * Find a cached route in reverse direction
 */
export async function findCachedRouteReverse(
  start: [number, number],
  end: [number, number],
  toleranceMeters: number = COORDINATE_TOLERANCE
): Promise<CachedRoute | null> {
  const reverse = await findCachedRoute(end, start, toleranceMeters);
  if (!reverse) return null;
  return {
    ...reverse,
    startCoord: reverse.endCoord,
    endCoord: reverse.startCoord,
    path: [...reverse.path].reverse(),
  };
}

/**
 * Get all cached routes for a data pack
 */
export async function getRoutesForPack(packId: string): Promise<CachedRoute[]> {
  const rows = await queryAll<Record<string, unknown>>('SELECT * FROM route_cache WHERE packId = ?', [packId]);
  return rows.map(rowToCachedRoute);
}

/**
 * Delete all cached routes for a data pack (on uninstall)
 */
export async function clearRoutesForPack(packId: string): Promise<number> {
  const result = await execute('DELETE FROM route_cache WHERE packId = ?', [packId]);
  const count = result.changes ?? 0;
  if (count > 0) {
    console.log(`[RouteCache] Deleted ${count} cached routes for pack ${packId}`);
  }
  return count;
}

/**
 * Route cache statistics
 */
export async function getRouteCacheStats(): Promise<{
  totalRoutes: number;
  byQuality: { high: number; dijkstra: number; other: number };
  byPack: Record<string, number>;
}> {
  const rows = await queryAll<Record<string, unknown>>('SELECT * FROM route_cache');
  const byQuality = { high: 0, dijkstra: 0, other: 0 };
  const byPack: Record<string, number> = {};
  for (const row of rows) {
    const q = row.quality as number;
    if (q === 1) byQuality.high++;
    else if (q === 3) byQuality.dijkstra++;
    else byQuality.other++;
    const packId = row.packId as string;
    byPack[packId] = (byPack[packId] || 0) + 1;
  }
  return {
    totalRoutes: rows.length,
    byQuality,
    byPack,
  };
}

/**
 * Find a cached POI→centroid route and trim to target address (for navigation).
 * Phase 1: simple implementation that scans routes for this pack with start near landmark.
 */
export async function findAndTrimCachedRoute(
  start: [number, number],
  targetAddress: [number, number],
  startTolerance: number = 50
): Promise<{ path: [number, number][]; distance: number; trimmed: boolean } | null> {
  const rows = await queryAll<Record<string, unknown>>('SELECT * FROM route_cache WHERE quality = 1');
  const candidates: CachedRoute[] = [];
  for (const row of rows) {
    const route = rowToCachedRoute(row);
    if (haversineMeters(start, route.startCoord) <= startTolerance) {
      candidates.push(route);
      if (candidates.length >= 5) break;
    }
  }
  if (candidates.length === 0) return null;

  let bestPath: [number, number][] | null = null;
  let bestDistance = 0;
  let bestClosestDist = Infinity;

  for (const route of candidates) {
    let closestDist = Infinity;
    let closestIndex = -1;
    const step = route.path.length > 100 ? Math.floor(route.path.length / 50) : 1;
    for (let i = 0; i < route.path.length; i += step) {
      const d = haversineMeters(route.path[i], targetAddress);
      if (d < closestDist) {
        closestDist = d;
        closestIndex = i;
      }
    }
    if (step > 1 && closestIndex >= 0) {
      const startIdx = Math.max(0, closestIndex - step);
      const endIdx = Math.min(route.path.length - 1, closestIndex + step);
      for (let i = startIdx; i <= endIdx; i++) {
        const d = haversineMeters(route.path[i], targetAddress);
        if (d < closestDist) {
          closestDist = d;
          closestIndex = i;
        }
      }
    }
    if (closestDist < bestClosestDist && closestIndex > 0) {
      bestClosestDist = closestDist;
      const trimmedPath = route.path.slice(0, closestIndex + 1);
      let trimmedDistance = 0;
      for (let i = 0; i < trimmedPath.length - 1; i++) {
        trimmedDistance += haversineMeters(trimmedPath[i], trimmedPath[i + 1]);
      }
      const connectorDist = haversineMeters(trimmedPath[trimmedPath.length - 1], targetAddress);
      if (connectorDist > 10) {
        trimmedPath.push(targetAddress);
        trimmedDistance += connectorDist;
      }
      bestPath = trimmedPath;
      bestDistance = trimmedDistance;
    }
  }

  if (!bestPath) return null;
  return { path: bestPath, distance: bestDistance, trimmed: true };
}
