/**
 * POI (Point of Interest) Database Operations
 *
 * Matches web's POI store: batch create, delete by pack, get by pack.
 * Used during data pack download and for search index building.
 */

import { getDB } from './database';
import { queryAll, execute, parseJSON, stringifyJSON } from './helpers';
import type { POIRecord } from './schemas';

const BATCH_SIZE = 100;

/**
 * Insert POIs in batches (used after data pack download)
 */
export async function batchCreate(pois: POIRecord[]): Promise<number> {
  if (pois.length === 0) return 0;
  const db = await getDB();
  const sql = `
    INSERT OR REPLACE INTO pois (
      id, osm_id, osm_type, lat, lon, name, name_en, name_fr, brand, operator,
      category, subcategory, tier, tags, stabilityScore, packId, countryCode, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  let inserted = 0;
  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const batch = pois.slice(i, i + BATCH_SIZE);
    for (const p of batch) {
      await db.runAsync(sql, [
        p.id,
        p.osm_id ?? null,
        p.osm_type ?? null,
        p.lat,
        p.lon,
        p.name ?? '',
        p.name_en ?? null,
        p.name_fr ?? null,
        p.brand ?? null,
        p.operator ?? null,
        p.category,
        p.subcategory,
        p.tier,
        stringifyJSON(p.tags),
        p.stabilityScore,
        p.packId,
        p.countryCode,
        p.cached_at,
      ]);
      inserted++;
    }
  }
  return inserted;
}

/**
 * Delete all POIs for a data pack (on uninstall)
 */
export async function deleteByPack(packId: string): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync('DELETE FROM pois WHERE packId = ?', [packId]);
  const count = result.changes ?? 0;
  if (count > 0) {
    console.log(`[POIs] Deleted ${count} POIs for pack ${packId}`);
  }
  return count;
}

function rowToPOIRecord(row: Record<string, unknown>): POIRecord {
  return {
    id: row.id as string,
    osm_id: row.osm_id as number | undefined,
    osm_type: row.osm_type as 'node' | 'way' | 'relation' | undefined,
    lat: row.lat as number,
    lon: row.lon as number,
    name: (row.name as string) ?? '',
    name_en: row.name_en as string | undefined,
    name_fr: row.name_fr as string | undefined,
    brand: row.brand as string | undefined,
    operator: row.operator as string | undefined,
    category: row.category as POIRecord['category'],
    subcategory: (row.subcategory as string) ?? '',
    tier: row.tier as POIRecord['tier'],
    tags: (parseJSON(row.tags as string) as POIRecord['tags']) ?? {},
    stabilityScore: row.stabilityScore as number,
    packId: row.packId as string,
    countryCode: row.countryCode as string,
    cached_at: row.cached_at as string,
  };
}

/**
 * Get all POIs for a data pack (for search index build)
 */
export async function getByPackId(packId: string): Promise<POIRecord[]> {
  const rows = await queryAll<Record<string, unknown>>(
    'SELECT * FROM pois WHERE packId = ? ORDER BY id',
    [packId]
  );
  return rows.map(rowToPOIRecord);
}

/** Options for getNearestPOI (Phase 6.2) */
export interface GetNearestPOIOptions {
  packIds?: string[];
  maxRadiusMeters?: number;
}

/** Nearest POI result for reverse geocode display */
export interface NearestPOIResult {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  distanceMeters: number;
}

/**
 * Get the nearest POI to a point (Phase 6.2). Used by reverse geocode when includePOI is true.
 */
export async function getNearestPOI(
  lat: number,
  lon: number,
  options: GetNearestPOIOptions = {}
): Promise<NearestPOIResult | null> {
  const { packIds, maxRadiusMeters = 500 } = options;
  const deg = maxRadiusMeters / 111000;
  const minLat = lat - deg;
  const maxLat = lat + deg;
  const minLon = lon - deg / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const maxLon = lon + deg / Math.max(0.01, Math.cos((lat * Math.PI) / 180));

  let rows: Record<string, unknown>[];
  if (packIds?.length) {
    const placeholders = packIds.map(() => '?').join(',');
    rows = await queryAll<Record<string, unknown>>(
      `SELECT * FROM pois WHERE packId IN (${placeholders}) AND lat >= ? AND lat <= ? AND lon >= ? AND lon <= ?`,
      [...packIds, minLat, maxLat, minLon, maxLon]
    );
  } else {
    rows = await queryAll<Record<string, unknown>>(
      'SELECT * FROM pois WHERE lat >= ? AND lat <= ? AND lon >= ? AND lon <= ?',
      [minLat, maxLat, minLon, maxLon]
    );
  }

  if (rows.length === 0) return null;

  const { haversineDistance } = await import('../search/spatialQueries');
  let nearest: POIRecord | null = null;
  let nearestDist = Infinity;

  for (const row of rows) {
    const poi = rowToPOIRecord(row);
    const d = haversineDistance(lat, lon, poi.lat, poi.lon);
    if (d < nearestDist && d <= maxRadiusMeters) {
      nearestDist = d;
      nearest = poi;
    }
  }

  if (!nearest) return null;
  return {
    id: nearest.id,
    name: nearest.name || nearest.name_en || nearest.name_fr || '',
    category: nearest.category,
    subcategory: nearest.subcategory,
    distanceMeters: nearestDist,
  };
}
