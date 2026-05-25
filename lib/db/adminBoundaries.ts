/**
 * Admin Boundaries Database Operations
 * 
 * Operations for administrative boundaries table (countries, regions, cities, neighborhoods).
 * Matches web's admin boundary operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's admin boundary operations)
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute, exists, count, parseJSON, stringifyJSON } from './helpers';
import type { AdminBoundary } from './schemas';

/**
 * Create an admin boundary
 * Uses INSERT OR REPLACE to handle duplicates gracefully (matches IndexedDB .put() behavior)
 */
export async function createAdminBoundary(boundary: AdminBoundary): Promise<void> {
  const db = await getDB();
  
  const sql = `
    INSERT OR REPLACE INTO admin_boundaries (
      id, osm_id, osm_type, name, name_en, name_fr,
      level, admin_level,
      polygon, bbox, area,
      parent_id, country_code, packId, token,
      source, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.runAsync(sql, [
    boundary.id,
    boundary.osm_id || null,
    boundary.osm_type || null,
    boundary.name,
    boundary.name_en || null,
    boundary.name_fr || null,
    boundary.level,
    boundary.admin_level,
    stringifyJSON(boundary.polygon),
    stringifyJSON(boundary.bbox),
    boundary.area || null,
    boundary.parent_id || null,
    boundary.country_code,
    boundary.packId || null,
    boundary.token || null,
    boundary.source,
    boundary.cached_at,
  ]);
}

/**
 * Get admin boundary by ID
 */
export async function getAdminBoundaryById(id: string): Promise<AdminBoundary | null> {
  const result = await queryFirst<AdminBoundary & { polygon: string; bbox: string }>(
    'SELECT * FROM admin_boundaries WHERE id = ?',
    [id]
  );
  
  if (!result) return null;
  
  return {
    ...result,
    polygon: parseJSON<[number, number][]>(result.polygon) || [],
    bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(result.bbox) || {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
    },
  } as AdminBoundary;
}

/**
 * Get admin boundaries by level
 */
export async function getAdminBoundariesByLevel(
  level: 'country' | 'region' | 'county' | 'city' | 'neighborhood'
): Promise<AdminBoundary[]> {
  const results = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(
    'SELECT * FROM admin_boundaries WHERE level = ?',
    [level]
  );
  
  return results.map(boundary => ({
    ...boundary,
    polygon: parseJSON<[number, number][]>(boundary.polygon) || [],
    bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(boundary.bbox) || {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
    },
  })) as AdminBoundary[];
}

/**
 * Get admin boundaries by parent ID
 */
export async function getAdminBoundariesByParent(parentId: string): Promise<AdminBoundary[]> {
  const results = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(
    'SELECT * FROM admin_boundaries WHERE parent_id = ?',
    [parentId]
  );
  
  return results.map(boundary => ({
    ...boundary,
    polygon: parseJSON<[number, number][]>(boundary.polygon) || [],
    bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(boundary.bbox) || {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
    },
  })) as AdminBoundary[];
}

/**
 * Get admin boundaries by country code
 */
export async function getAdminBoundariesByCountry(countryCode: string): Promise<AdminBoundary[]> {
  const results = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(
    'SELECT * FROM admin_boundaries WHERE country_code = ?',
    [countryCode]
  );
  
  return results.map(boundary => ({
    ...boundary,
    polygon: parseJSON<[number, number][]>(boundary.polygon) || [],
    bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(boundary.bbox) || {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
    },
  })) as AdminBoundary[];
}

/**
 * Check if a point is within an admin boundary polygon
 * Note: This is a simplified check using bbox. For accurate polygon containment,
 * consider using a spatial extension or implementing point-in-polygon algorithm
 */
export async function findAdminBoundariesContainingPoint(
  lat: number,
  lon: number,
  level?: 'country' | 'region' | 'county' | 'city' | 'neighborhood'
): Promise<AdminBoundary[]> {
  let sql = `
    SELECT * FROM admin_boundaries 
    WHERE json_extract(bbox, '$.minLat') <= ? 
      AND json_extract(bbox, '$.maxLat') >= ?
      AND json_extract(bbox, '$.minLon') <= ?
      AND json_extract(bbox, '$.maxLon') >= ?
  `;
  const params: unknown[] = [lat, lat, lon, lon];
  
  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }
  
  sql += ' ORDER BY admin_level ASC, area ASC';
  
  const results = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(sql, params);
  
  return results.map(boundary => ({
    ...boundary,
    polygon: parseJSON<[number, number][]>(boundary.polygon) || [],
    bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(boundary.bbox) || {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
    },
  })) as AdminBoundary[];
}

/**
 * Update an admin boundary
 */
export async function updateAdminBoundary(id: string, updates: Partial<AdminBoundary>): Promise<void> {
  const db = await getDB();
  
  const fields: string[] = [];
  const values: unknown[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      if (key === 'polygon' || key === 'bbox') {
        fields.push(`${key} = ?`);
        values.push(stringifyJSON(value));
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
  
  const sql = `UPDATE admin_boundaries SET ${fields.join(', ')} WHERE id = ?`;
  await db.runAsync(sql, values);
}

/**
 * Delete an admin boundary
 */
export async function deleteAdminBoundary(id: string): Promise<void> {
  await execute('DELETE FROM admin_boundaries WHERE id = ?', [id]);
}

/**
 * Count admin boundaries
 */
export async function countAdminBoundaries(
  where?: { level?: string; parent_id?: string; country_code?: string }
): Promise<number> {
  if (where) {
    return count('admin_boundaries', where);
  }
  return count('admin_boundaries');
}

/**
 * Batch create admin boundaries
 */
export async function batchCreateAdminBoundaries(boundaries: AdminBoundary[]): Promise<void> {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    for (const boundary of boundaries) {
      await createAdminBoundary(boundary);
    }
  });
}

/**
 * Delete all admin boundaries (for data pack uninstall)
 */
export async function deleteAllAdminBoundaries(): Promise<void> {
  await execute('DELETE FROM admin_boundaries', []);
}

/**
 * Delete admin boundaries by pack ID (for data pack uninstall)
 */
export async function deleteAdminBoundariesByPack(packIds: string[]): Promise<void> {
  if (packIds.length === 0) return;
  
  // Delete boundaries that have any of the pack IDs
  const placeholders = packIds.map(() => '?').join(',');
  await execute(`DELETE FROM admin_boundaries WHERE packId IN (${placeholders})`, packIds);
}
