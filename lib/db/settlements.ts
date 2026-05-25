/**
 * Settlement Places Database Operations
 * 
 * Operations for settlement places table (cities, towns, villages, neighborhoods).
 * Matches web's settlement place operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's settlement place operations)
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute, exists, count, parseJSON, stringifyJSON } from './helpers';
import type { SettlementPlace, SettlementPlaceType } from './schemas';

/**
 * Create a settlement place
 * Uses INSERT OR REPLACE to handle duplicates gracefully (matches IndexedDB .put() behavior)
 */
export async function createSettlementPlace(place: SettlementPlace): Promise<void> {
  const db = await getDB();
  
  const sql = `
    INSERT OR REPLACE INTO settlement_places (
      id, packId, name, name_en, name_fr, place,
      lat, lon, osm_id, osm_type,
      polygon, bbox, geoCell,
      source, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.runAsync(sql, [
    place.id,
    place.packId,
    place.name,
    place.name_en || null,
    place.name_fr || null,
    place.place,
    place.lat,
    place.lon,
    place.osm_id || null,
    place.osm_type || null,
    place.polygon ? stringifyJSON(place.polygon) : null,
    place.bbox ? stringifyJSON(place.bbox) : null,
    place.geoCell || null,
    place.source,
    place.cached_at,
  ]);
}

/**
 * Get settlement place by ID
 */
export async function getSettlementPlaceById(id: string): Promise<SettlementPlace | null> {
  const result = await queryFirst<SettlementPlace & { polygon?: string; bbox?: string }>(
    'SELECT * FROM settlement_places WHERE id = ?',
    [id]
  );
  
  if (!result) return null;
  
  return {
    ...result,
    polygon: result.polygon ? parseJSON<[number, number][]>(result.polygon) : undefined,
    bbox: result.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(result.bbox)
      : undefined,
  } as SettlementPlace;
}

/**
 * Get settlement places by pack ID
 */
export async function getSettlementPlacesByPack(packId: string): Promise<SettlementPlace[]> {
  const results = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
    'SELECT * FROM settlement_places WHERE packId = ?',
    [packId]
  );
  
  return results.map(place => ({
    ...place,
    polygon: place.polygon ? parseJSON<[number, number][]>(place.polygon) : undefined,
    bbox: place.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(place.bbox)
      : undefined,
  })) as SettlementPlace[];
}

/**
 * Get settlement places by type
 */
export async function getSettlementPlacesByType(placeType: SettlementPlaceType): Promise<SettlementPlace[]> {
  const results = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
    'SELECT * FROM settlement_places WHERE place = ?',
    [placeType]
  );
  
  return results.map(place => ({
    ...place,
    polygon: place.polygon ? parseJSON<[number, number][]>(place.polygon) : undefined,
    bbox: place.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(place.bbox)
      : undefined,
  })) as SettlementPlace[];
}

/**
 * Get settlement places by geo cell (for spatial indexing)
 */
export async function getSettlementPlacesByGeoCell(geoCell: string): Promise<SettlementPlace[]> {
  const results = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
    'SELECT * FROM settlement_places WHERE geoCell = ?',
    [geoCell]
  );
  
  return results.map(place => ({
    ...place,
    polygon: place.polygon ? parseJSON<[number, number][]>(place.polygon) : undefined,
    bbox: place.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(place.bbox)
      : undefined,
  })) as SettlementPlace[];
}

/**
 * Find nearest settlement places to a point (distance-based query)
 */
export async function findNearestSettlementPlaces(
  lat: number,
  lon: number,
  limit: number = 10,
  placeType?: SettlementPlaceType
): Promise<SettlementPlace[]> {
  let sql = `
    SELECT *, 
      (6371000 * acos(
        cos(radians(?)) * cos(radians(lat)) * 
        cos(radians(lon) - radians(?)) + 
        sin(radians(?)) * sin(radians(lat))
      )) AS distance
    FROM settlement_places
  `;
  
  const params: unknown[] = [lat, lon, lat];
  
  if (placeType) {
    sql += ' WHERE place = ?';
    params.push(placeType);
  }
  
  sql += ' ORDER BY distance ASC LIMIT ?';
  params.push(limit);
  
  const results = await queryAll<SettlementPlace & { polygon?: string; bbox?: string; distance: number }>(
    sql,
    params
  );
  
  return results.map(place => ({
    ...place,
    polygon: place.polygon ? parseJSON<[number, number][]>(place.polygon) : undefined,
    bbox: place.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(place.bbox)
      : undefined,
  })) as SettlementPlace[];
}

/**
 * Search settlement places by name
 */
export async function searchSettlementPlacesByName(searchTerm: string): Promise<SettlementPlace[]> {
  const results = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
    `SELECT * FROM settlement_places 
     WHERE name LIKE ? OR name_en LIKE ? OR name_fr LIKE ?
     LIMIT 50`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
  );
  
  return results.map(place => ({
    ...place,
    polygon: place.polygon ? parseJSON<[number, number][]>(place.polygon) : undefined,
    bbox: place.bbox
      ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(place.bbox)
      : undefined,
  })) as SettlementPlace[];
}

/**
 * Update a settlement place
 */
export async function updateSettlementPlace(id: string, updates: Partial<SettlementPlace>): Promise<void> {
  const db = await getDB();
  
  const fields: string[] = [];
  const values: unknown[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      if (key === 'polygon' || key === 'bbox') {
        fields.push(`${key} = ?`);
        values.push(value ? stringifyJSON(value) : null);
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
  });
  
  if (fields.length === 0) {
    return;
  }
  
  values.push(id);
  
  const sql = `UPDATE settlement_places SET ${fields.join(', ')} WHERE id = ?`;
  await db.runAsync(sql, values);
}

/**
 * Delete a settlement place
 */
export async function deleteSettlementPlace(id: string): Promise<void> {
  await execute('DELETE FROM settlement_places WHERE id = ?', [id]);
}

/**
 * Count settlement places
 */
export async function countSettlementPlaces(
  where?: { packId?: string; place?: string; geoCell?: string }
): Promise<number> {
  if (where) {
    return count('settlement_places', where);
  }
  return count('settlement_places');
}

/**
 * Batch create settlement places
 */
export async function batchCreateSettlementPlaces(places: SettlementPlace[]): Promise<void> {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    for (const place of places) {
      await createSettlementPlace(place);
    }
  });
}

/**
 * Delete all settlement places (for data pack uninstall)
 */
export async function deleteAllSettlementPlaces(): Promise<void> {
  await execute('DELETE FROM settlement_places', []);
}

/**
 * Delete settlement places by pack ID (for data pack uninstall)
 */
export async function deleteSettlementPlacesByPack(packIds: string[]): Promise<void> {
  if (packIds.length === 0) return;
  
  // Delete settlements that have any of the pack IDs
  const placeholders = packIds.map(() => '?').join(',');
  await execute(`DELETE FROM settlement_places WHERE packId IN (${placeholders})`, packIds);
}
