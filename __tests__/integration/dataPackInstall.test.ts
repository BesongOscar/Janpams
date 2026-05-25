/**
 * Integration Tests: Data pack install with POIs and route_cache (Phase 6.3)
 *
 * Verifies: POIs and route_cache rows after "install"; search index contains POIs.
 *
 * Note: These tests use the real DB (initDB/deleteDB). In Jest/Node, expo-sqlite
 * can fail (path undefined). Run on device/emulator or with a full expo-sqlite mock to execute.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initDB, deleteDB, closeDB, getDB } from '../../lib/db/database';
import { batchCreate } from '../../lib/db/pois';
import { cacheRoute, getRouteCacheStats } from '../../lib/routing/routeCache';
import { buildPackIndex } from '../../lib/search/searchIndex';
import type { POIRecord } from '../../lib/db/schemas';

const TEST_PACK_ID = 'test-pack-cm-001';
const TEST_PACK_VERSION = '1.0.0';
const COUNTRY_CODE = 'CM';

describe('Data pack install (POIs + route_cache)', () => {
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

  it('should store POIs and route_cache rows for a pack', async () => {
    const pois: POIRecord[] = [
      {
        id: 'poi-test-1',
        lat: 4.16,
        lon: 9.24,
        name: 'Test Hospital',
        category: 'health',
        subcategory: 'hospital',
        tier: 1,
        tags: {},
        stabilityScore: 80,
        packId: TEST_PACK_ID,
        countryCode: COUNTRY_CODE,
        cached_at: new Date().toISOString(),
      },
    ];
    const inserted = await batchCreate(pois);
    expect(inserted).toBe(1);

    const start: [number, number] = [9.23, 4.15];
    const end: [number, number] = [9.25, 4.17];
    const path: [number, number][] = [start, [9.24, 4.16], end];
    await cacheRoute(start, end, path, 2500, {
      packId: TEST_PACK_ID,
      source: 'valhalla_local',
      quality: 1,
    });

    const stats = await getRouteCacheStats();
    expect(stats.totalRoutes).toBeGreaterThanOrEqual(1);
  });

  it('should index POIs in search and return them via search_items', async () => {
    const pois: POIRecord[] = [
      {
        id: 'poi-search-1',
        lat: 4.16,
        lon: 9.24,
        name: 'City Hall',
        category: 'government',
        subcategory: 'town_hall',
        tier: 1,
        tags: {},
        stabilityScore: 90,
        packId: TEST_PACK_ID,
        countryCode: COUNTRY_CODE,
        cached_at: new Date().toISOString(),
      },
    ];
    await batchCreate(pois);

    const poisForSearch = pois.map(p => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      category: p.category,
      subcategory: p.subcategory,
      tier: p.tier,
      stabilityScore: p.stabilityScore,
    }));

    const { itemCount } = await buildPackIndex(
      TEST_PACK_ID,
      TEST_PACK_VERSION,
      [], // no streets
      undefined, // no admins
      COUNTRY_CODE,
      poisForSearch
    );
    expect(itemCount).toBe(1);

    const db = await getDB();
    const placeItems = await db.getAllAsync<{ itemId: string; type: string; label: string }>(
      "SELECT itemId, type, label FROM search_items WHERE type = 'place' AND packId = ?",
      [TEST_PACK_ID]
    );
    expect(placeItems.length).toBe(1);
    expect(placeItems[0].label).toBe('City Hall');
    expect(placeItems[0].itemId).toBe('poi:poi-search-1');
  });
});
