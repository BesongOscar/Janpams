/**
 * JAPA pack lifecycle state (Phase 2).
 *
 * Storage zones:
 * - TMP: In-memory or blob during fetch/unpack. No DB store; callers must not hold
 *   references across rollback or after purge.
 * - STG: Staging SQLite tables (_stg, pack_staging).
 * - PROD: Production tables (street_segments, admin_boundaries, settlement_places, pois, data_packs, route_cache).
 *
 * Matches web: apps/core/mbukanji-maps/src/lib/japaState.ts
 */

import { getDB } from './db/database';
import { queryAll, queryFirst, execute } from './db/helpers';
import type { PackState, PackStateRecord, DataPackManifest } from './db/schemas';

/** Set lifecycle state for a region. Creates record if missing. */
export async function setPackState(regionCode: string, state: PackState): Promise<void> {
  const db = await getDB();
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO pack_state (regionCode, state, updatedAt) VALUES (?, ?, ?)`,
    [regionCode, state, updatedAt]
  );
}

/** Get current lifecycle state for a region. Returns NOT_INSTALLED if no record. */
export async function getPackState(regionCode: string): Promise<PackState> {
  try {
    const row = await queryFirst<PackStateRecord>('SELECT * FROM pack_state WHERE regionCode = ?', [regionCode]);
    return row?.state ?? 'NOT_INSTALLED';
  } catch {
    return 'NOT_INSTALLED';
  }
}

/**
 * Purge all TMP and STG data for a region (JAPA cleanup/retry).
 * Clears staging tables only. If state is not INSTALLED, sets state to NOT_INSTALLED.
 * Phase 4: also clears Valhalla staging for the region.
 */
export async function purgeTmpAndStagingForRegion(regionCode: string): Promise<void> {
  const db = await getDB();

  // street_segments_stg: delete by region_id
  await execute('DELETE FROM street_segments_stg WHERE region_id = ?', [regionCode]);
  // admin_boundaries_stg, settlement_places_stg, pois_stg: delete by packId
  await execute('DELETE FROM admin_boundaries_stg WHERE packId = ?', [regionCode]);
  await execute('DELETE FROM settlement_places_stg WHERE packId = ?', [regionCode]);
  await execute('DELETE FROM pois_stg WHERE packId = ?', [regionCode]);
  // pack_staging: manifest keyed by id (regionCode)
  await execute('DELETE FROM pack_staging WHERE id = ?', [regionCode]);

  const { clearValhallaStagingForPack } = await import('./valhalla/tileStorage');
  await clearValhallaStagingForPack(regionCode);

  const current = await getPackState(regionCode);
  if (current !== 'INSTALLED') {
    await setPackState(regionCode, 'NOT_INSTALLED');
  }
}

/**
 * JAPA cleanup on restart: purge STG for every region that is not INSTALLED.
 * Call once on app init to avoid orphaned staging data after crash or close during install.
 */
export async function cleanupStagingOnRestart(): Promise<void> {
  try {
    const rows = await queryAll<PackStateRecord>('SELECT * FROM pack_state');
    for (const record of rows) {
      if (record.state !== 'INSTALLED') {
        await purgeTmpAndStagingForRegion(record.regionCode);
        await setPackState(record.regionCode, 'NOT_INSTALLED');
      }
    }
  } catch (e) {
    console.warn('[japaState] cleanupStagingOnRestart failed:', e);
  }
}

/**
 * Return manifests for packs in INSTALLED state only (JAPA visibility rule).
 * Legacy: if pack_state table is missing or empty, return all data_packs for backward compat.
 */
export async function getInstalledPacks(): Promise<DataPackManifest[]> {
  const { getAllDataPackManifests } = await import('./db/dataPacks');
  const allPacks = await getAllDataPackManifests();
  try {
    const allState = await queryAll<PackStateRecord>('SELECT * FROM pack_state');
    if (allState.length === 0) return allPacks;
    const stateByRegion = new Map(allState.map(r => [r.regionCode, r.state]));
    return allPacks.filter(p => (stateByRegion.get(p.id) ?? 'INSTALLED') === 'INSTALLED');
  } catch {
    return allPacks;
  }
}
