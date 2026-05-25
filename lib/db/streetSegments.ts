/**
 * Street Segments Database Operations
 * 
 * Operations for street segments table (offline data pack streets).
 * Matches web's street segment operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's street segment operations)
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute, exists, count, parseJSON, stringifyJSON } from './helpers';
import type { StreetSegment } from './schemas';

/**
 * Create a street segment
 * Uses INSERT OR REPLACE to handle duplicates gracefully
 */
export async function createStreetSegment(segment: StreetSegment): Promise<void> {
  const db = await getDB();
  
  const sql = `
    INSERT OR REPLACE INTO street_segments (
      id, osm_id, name, name_en, name_fr, alt_name, ref,
      street_type, oneway, layer,
      geometry, bbox,
      spacing_constant, numbering_direction,
      city_id, region_id,
      source, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.runAsync(sql, [
    segment.id,
    segment.osm_id || null,
    segment.name,
    segment.name_en || null,
    segment.name_fr || null,
    segment.alt_name || null,
    segment.ref || null,
    segment.street_type,
    segment.oneway ? 1 : 0,
    segment.layer || null,
    stringifyJSON(segment.geometry),
    stringifyJSON(segment.bbox),
    segment.spacing_constant,
    segment.numbering_direction,
    segment.city_id || null,
    segment.region_id || null,
    segment.source,
    segment.cached_at,
  ]);
}

/**
 * Get street segment by ID
 */
export async function getStreetSegmentById(id: string): Promise<StreetSegment | null> {
  const result = await queryFirst<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments WHERE id = ?',
    [id]
  );
  
  if (!result) return null;
  
  const geometry = parseJSON<[number, number][]>(result.geometry) || [];
  const bbox = parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(result.bbox) || {
    minLat: 0,
    maxLat: 0,
    minLon: 0,
    maxLon: 0,
  };
  
  return {
    ...result,
    geometry: stringifyJSON(geometry), // Keep as string for type compatibility
    bbox: stringifyJSON(bbox), // Keep as string for type compatibility
  } as unknown as StreetSegment;
}

/**
 * Get street segments by region ID
 */
export async function getStreetSegmentsByRegion(regionId: string): Promise<StreetSegment[]> {
  const results = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments WHERE region_id = ?',
    [regionId]
  );
  
  // Return as-is since geometry and bbox are already strings in the database
  return results as unknown as StreetSegment[];
}

/**
 * Get street segments by city ID
 */
export async function getStreetSegmentsByCity(cityId: string): Promise<StreetSegment[]> {
  const results = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments WHERE city_id = ?',
    [cityId]
  );
  
  // Return as-is since geometry and bbox are already strings in the database
  return results as unknown as StreetSegment[];
}

/**
 * Get street segments within bounding box (spatial query)
 */
export async function getStreetSegmentsInBBox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<StreetSegment[]> {
  // Note: This is a simplified bbox query. For production, consider using spatial extensions
  const results = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    `SELECT * FROM street_segments 
     WHERE json_extract(bbox, '$.minLat') <= ? 
       AND json_extract(bbox, '$.maxLat') >= ?
       AND json_extract(bbox, '$.minLon') <= ?
       AND json_extract(bbox, '$.maxLon') >= ?`,
    [maxLat, minLat, maxLon, minLon]
  );
  
  // Return as-is since geometry and bbox are already strings in the database
  return results as unknown as StreetSegment[];
}

/**
 * Get street segments by name (fuzzy search)
 */
export async function searchStreetSegmentsByName(searchTerm: string): Promise<StreetSegment[]> {
  const results = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    `SELECT * FROM street_segments 
     WHERE name LIKE ? OR name_en LIKE ? OR name_fr LIKE ? OR alt_name LIKE ?
     LIMIT 50`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
  );
  
  // Return as-is since geometry and bbox are already strings in the database
  return results as unknown as StreetSegment[];
}

/**
 * Update a street segment
 */
export async function updateStreetSegment(id: string, updates: Partial<StreetSegment>): Promise<void> {
  const db = await getDB();
  
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      if (key === 'geometry' || key === 'bbox') {
        fields.push(`${key} = ?`);
        values.push(stringifyJSON(value));
      } else if (key === 'oneway') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(value as string | number | null);
      }
    }
  });
  
  if (fields.length === 0) {
    return;
  }
  
  values.push(id);
  
  const sql = `UPDATE street_segments SET ${fields.join(', ')} WHERE id = ?`;
  await db.runAsync(sql, values);
}

/**
 * Delete a street segment
 */
export async function deleteStreetSegment(id: string): Promise<void> {
  await execute('DELETE FROM street_segments WHERE id = ?', [id]);
}

/**
 * Count street segments
 */
export async function countStreetSegments(where?: { region_id?: string; city_id?: string }): Promise<number> {
  if (where) {
    return count('street_segments', where);
  }
  return count('street_segments');
}

/**
 * Batch create street segments
 */
export async function batchCreateStreetSegments(segments: StreetSegment[]): Promise<void> {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    for (const segment of segments) {
      await createStreetSegment(segment);
    }
  });
}

/**
 * Delete all street segments (for data pack uninstall)
 */
export async function deleteAllStreetSegments(): Promise<void> {
  await execute('DELETE FROM street_segments', []);
}

/**
 * Delete street segments by region (for data pack uninstall)
 */
export async function deleteStreetSegmentsByRegion(regionId: string): Promise<void> {
  await execute('DELETE FROM street_segments WHERE region_id = ?', [regionId]);
}
