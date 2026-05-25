/**
 * Integration Tests: Route path — cached route and Dijkstra (Phase 6.3)
 *
 * (1) generateRoutePath with cached route returns path (cached).
 * (2) generateRoutePath without cache uses Dijkstra when street segments exist.
 *
 * Note: Requires real SQLite (expo-sqlite). In Jest/Node the DB path can be undefined.
 * Run on device/emulator or with a full expo-sqlite mock to execute.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initDB, deleteDB, closeDB } from '../../lib/db/database';
import { cacheRoute } from '../../lib/routing/routeCache';
import { generateRoutePath } from '../../lib/routePath';
import { createStreetSegment } from '../../lib/db/streetSegments';
import type { StreetSegment } from '../../lib/db/schemas';

const PACK_ID = 'test-pack-route';

function makeBbox(coords: [number, number][]): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const lats = coords.map(c => c[1]);
  const lons = coords.map(c => c[0]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

describe('Route path integration', () => {
  beforeEach(async () => {
    try {
      await deleteDB();
    } catch {
      // deleteDB may fail in Jest (expo-sqlite path)
    }
    await initDB();
  });

  afterEach(async () => {
    await closeDB();
    try {
      await deleteDB();
    } catch {
      // deleteDB may fail in Jest (expo-sqlite path); ignore
    }
  });

  it('should return path from cached route (generateRoutePath with cache)', async () => {
    const startLon = 9.23;
    const startLat = 4.15;
    const endLon = 9.25;
    const endLat = 4.17;
    const start: [number, number] = [startLon, startLat];
    const end: [number, number] = [endLon, endLat];
    const path: [number, number][] = [start, [9.24, 4.16], end];

    await cacheRoute(start, end, path, 2500, {
      packId: PACK_ID,
      source: 'valhalla_local',
      quality: 1,
    });

    const result = await generateRoutePath(startLon, startLat, endLon, endLat, { packId: PACK_ID });

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    expect(result.debug?.algorithm).toBe('cached');
    expect(result.distance).toBe(2500);
  });

  it('should use Dijkstra when no cached route (street segments in bbox)', async () => {
    // Two segments: A->B and B->C so there is a path from A to C
    const lonA = 9.22;
    const latA = 4.14;
    const lonB = 9.24;
    const latB = 4.16;
    const lonC = 9.26;
    const latC = 4.18;

    const geom1: [number, number][] = [[lonA, latA], [lonB, latB]];
    const geom2: [number, number][] = [[lonB, latB], [lonC, latC]];

    const seg1: StreetSegment = {
      id: 'street-seg-1',
      name: 'Street One',
      street_type: 'primary',
      oneway: false,
      geometry: JSON.stringify(geom1),
      bbox: JSON.stringify(makeBbox(geom1)),
      spacing_constant: 20,
      numbering_direction: 'ascending',
      source: 'osm',
      cached_at: new Date().toISOString(),
      region_id: PACK_ID,
    };
    const seg2: StreetSegment = {
      id: 'street-seg-2',
      name: 'Street Two',
      street_type: 'primary',
      oneway: false,
      geometry: JSON.stringify(geom2),
      bbox: JSON.stringify(makeBbox(geom2)),
      spacing_constant: 20,
      numbering_direction: 'ascending',
      source: 'osm',
      cached_at: new Date().toISOString(),
      region_id: PACK_ID,
    };

    await createStreetSegment(seg1);
    await createStreetSegment(seg2);

    const result = await generateRoutePath(lonA, latA, lonC, latC, { packId: PACK_ID, maxDistance: 2000 });

    expect(result.success).toBe(true);
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    expect(['dijkstra', 'direct']).toContain(result.debug?.algorithm);
  });
});
