/**
 * Data Packs Database Operations
 * 
 * Operations for data pack manifests (downloaded offline data packs).
 * Matches web's data pack operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's data pack operations)
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute, exists, count } from './helpers';
import type { DataPackManifest } from './schemas';

/**
 * Create a data pack manifest
 */
export async function createDataPackManifest(manifest: DataPackManifest): Promise<void> {
  const db = await getDB();
  
  const sql = `
    INSERT INTO data_packs (
      id, name, region, country, version,
      street_count, boundary_count, settlement_count,
      settlement_place_count, poi_count, valhalla_tile_count,
      size_bytes, sha256,
      created_at, downloaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.runAsync(sql, [
    manifest.id,
    manifest.name,
    manifest.region,
    manifest.country,
    manifest.version,
    manifest.street_count,
    manifest.boundary_count,
    manifest.settlement_count || null,
    manifest.settlement_place_count ?? null,
    manifest.poi_count ?? null,
    manifest.valhalla_tile_count ?? null,
    manifest.size_bytes,
    manifest.sha256 || null,
    manifest.created_at,
    manifest.downloaded_at || null,
  ]);
}

/**
 * Get data pack manifest by ID
 */
export async function getDataPackManifestById(id: string): Promise<DataPackManifest | null> {
  return queryFirst<DataPackManifest>('SELECT * FROM data_packs WHERE id = ?', [id]);
}

/**
 * Get all data pack manifests
 * 
 * Reference: Web's getDownloadedPacks() - reads from data_packs store
 */
export async function getAllDataPackManifests(): Promise<DataPackManifest[]> {
  try {
    return await queryAll<DataPackManifest>('SELECT * FROM data_packs ORDER BY downloaded_at DESC');
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: data_packs')) {
      console.warn('[DataPacks] data_packs table missing, re-initializing DB...');
      const { initDB } = await import('./database');
      await initDB();
      // Retry the query
      return await queryAll<DataPackManifest>('SELECT * FROM data_packs ORDER BY downloaded_at DESC');
    }
    // For other errors, return empty array (graceful degradation)
    console.log('[DataPacks] Error fetching all manifests:', error);
    return [];
  }
}

/**
 * Get data pack manifests by country
 */
export async function getDataPackManifestsByCountry(country: string): Promise<DataPackManifest[]> {
  return queryAll<DataPackManifest>(
    'SELECT * FROM data_packs WHERE country = ? ORDER BY downloaded_at DESC',
    [country]
  );
}

/**
 * Get data pack manifests by region
 */
export async function getDataPackManifestsByRegion(region: string): Promise<DataPackManifest[]> {
  return queryAll<DataPackManifest>(
    'SELECT * FROM data_packs WHERE region = ? ORDER BY downloaded_at DESC',
    [region]
  );
}

/**
 * Update a data pack manifest
 */
export async function updateDataPackManifest(
  id: string,
  updates: Partial<DataPackManifest>
): Promise<void> {
  const db = await getDB();
  
  const fields: string[] = [];
  const values: unknown[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (fields.length === 0) {
    return;
  }
  
  values.push(id);
  
  const sql = `UPDATE data_packs SET ${fields.join(', ')} WHERE id = ?`;
  await db.runAsync(sql, values);
}

/**
 * Delete a data pack manifest
 */
export async function deleteDataPackManifest(id: string): Promise<void> {
  await execute('DELETE FROM data_packs WHERE id = ?', [id]);
}

/**
 * Check if data pack exists
 */
export async function dataPackExists(id: string): Promise<boolean> {
  return exists('data_packs', { id });
}

/**
 * Count data packs
 */
export async function countDataPacks(where?: { country?: string; region?: string }): Promise<number> {
  if (where) {
    return count('data_packs', where);
  }
  return count('data_packs');
}

/**
 * Mark data pack as downloaded
 */
export async function markDataPackDownloaded(id: string): Promise<void> {
  await execute('UPDATE data_packs SET downloaded_at = ? WHERE id = ?', [
    new Date().toISOString(),
    id,
  ]);
}
