/**
 * Data Pack Manager
 * 
 * Manages installation, uninstallation, and updates of data packs
 */

import { getDB, initDB } from '../db';
import { getDataPackManifestById, deleteDataPackManifest } from '../db/dataPacks';
import { deleteStreetSegmentsByRegion } from '../db/streetSegments';
import { deleteAdminBoundariesByPack } from '../db/adminBoundaries';
import { deleteSettlementPlacesByPack } from '../db/settlements';
import { deleteByPack as deletePOIsByPack } from '../db/pois';
import { clearRoutesForPack } from '../routing/routeCache';
import { removePackIndex } from '../search/searchIndex';
import { getInstalledPacks as getInstalledPacksFromJapa, setPackState, getPackState } from '../japaState';
import { clearValhallaTilesForPack } from '../valhalla/tileStorage';
import { downloadDataPack } from './downloader';
import type { DataPackManifest } from '../db/schemas';

// ===== TYPES =====

export interface PackStats {
  streetCount: number;
  boundaryCount: number;
  settlementCount: number;
  // Total number of routes (not yet tracked in mobile DB, placeholder for UI parity)
  routeCount: number;
  packCount: number;
}

// ===== PACK MANAGEMENT =====

/**
 * Install a data pack
 */
export async function installPack(
  regionCode: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  console.log(`[PackManager] Installing pack: ${regionCode}`);
  
  // Check if already installed (JAPA: only INSTALLED state)
  const state = await getPackState(regionCode);
  if (state === 'INSTALLED') {
    const existing = await getDataPackManifestById(regionCode);
    if (existing) {
      console.log(`[PackManager] Pack ${regionCode} already installed`);
      onProgress?.(100);
      return;
    }
  }

  // Download and install
  await downloadDataPack(regionCode, onProgress, false);
  console.log(`[PackManager] Pack ${regionCode} installed successfully`);
}

/**
 * Uninstall a data pack
 */
export async function uninstallPack(regionCode: string): Promise<void> {
  console.log(`[PackManager] Uninstalling pack: ${regionCode}`);

  // Remove search index for this pack first
  try {
    await removePackIndex(regionCode);
  } catch (e) {
    console.warn('[PackManager] Failed to remove search index:', e);
  }

  // Delete POIs and route cache (Phase 1)
  try {
    await deletePOIsByPack(regionCode);
    await clearRoutesForPack(regionCode);
  } catch (e) {
    console.warn('[PackManager] Failed to delete POIs/routes:', e);
  }

  // Delete street segments
  await deleteStreetSegmentsByRegion(regionCode);

  // Delete admin boundaries
  await deleteAdminBoundariesByPack([regionCode]);

  // Delete settlement places
  await deleteSettlementPlacesByPack([regionCode]);

  // Phase 4: clear Valhalla tiles for pack
  try {
    await clearValhallaTilesForPack(regionCode);
  } catch (e) {
    console.warn('[PackManager] Failed to clear Valhalla tiles:', e);
  }

  // Delete manifest and clear pack state
  await deleteDataPackManifest(regionCode);
  await setPackState(regionCode, 'NOT_INSTALLED');

  console.log(`[PackManager] Pack ${regionCode} uninstalled successfully`);
}

/**
 * Update a data pack
 */
export async function updatePack(
  regionCode: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  console.log(`[PackManager] Updating pack: ${regionCode}`);

  // Uninstall existing pack
  await uninstallPack(regionCode);

  // Download new version
  await downloadDataPack(regionCode, onProgress, true);

  console.log(`[PackManager] Pack ${regionCode} updated successfully`);
}

/**
 * Get all installed packs (JAPA: only INSTALLED state)
 */
export async function getInstalledPacks(): Promise<DataPackManifest[]> {
  return getInstalledPacksFromJapa();
}

/**
 * Get pack info
 */
export async function getPackInfo(regionCode: string): Promise<DataPackManifest | null> {
  return getDataPackManifestById(regionCode);
}

/**
 * Get pack statistics
 * 
 * Reference: Web's getPackStats() - counts from IndexedDB stores
 * Mobile version queries SQLite tables with defensive error handling
 */
export async function getPackStats(): Promise<PackStats> {
  try {
    // Ensure DB is ready before querying
    const db = await getDB();
    
    // Query all stats in parallel (like web does)
    const [streetResult, boundaryResult, settlementResult, routeResult, packResult] = await Promise.all([
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM street_segments')
        .catch(error => {
          console.log('[PackManager] Error counting street_segments:', error);
          return null;
        }),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM admin_boundaries')
        .catch(error => {
          console.log('[PackManager] Error counting admin_boundaries:', error);
          return null;
        }),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM settlement_places')
        .catch(error => {
          console.log('[PackManager] Error counting settlement_places:', error);
          return null;
        }),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM route_cache')
        .catch(error => {
          console.log('[PackManager] Error counting route_cache:', error);
          return null;
        }),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM data_packs')
        .catch(error => {
          console.log('[PackManager] Error counting data_packs:', error);
          return null;
        }),
    ]);

    // Log raw results for debugging
    console.log('[PackManager] Raw query results:', {
      streetResult,
      boundaryResult,
      settlementResult,
      routeResult,
      packResult,
    });

    const stats = {
      streetCount: streetResult?.count ?? 0,
      boundaryCount: boundaryResult?.count ?? 0,
      settlementCount: settlementResult?.count ?? 0,
      routeCount: routeResult?.count ?? 0,
      packCount: packResult?.count ?? 0,
    };

    console.log('[PackManager] Pack stats fetched:', stats);
    return stats;
  } catch (error: any) {
    // If any table is missing, try re-initializing the DB and retry
    const errorMessage = typeof error?.message === 'string' ? error.message : String(error);
    const missingTablePatterns = [
      'no such table: street_segments',
      'no such table: admin_boundaries',
      'no such table: settlement_places',
      'no such table: data_packs',
    ];
    
    const isMissingTable = missingTablePatterns.some(pattern => errorMessage.includes(pattern));
    
    if (isMissingTable) {
      console.warn('[PackManager] Missing offline data tables, re-initializing DB before fetching stats...');
      await initDB();

      // Retry with fresh DB connection
      const db = await getDB();
      const [streetResult, boundaryResult, settlementResult, routeResult, packResult] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM street_segments')
          .catch(error => {
            console.log('[PackManager] Error counting street_segments (retry):', error);
            return { count: 0 };
          }),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM admin_boundaries')
          .catch(error => {
            console.log('[PackManager] Error counting admin_boundaries (retry):', error);
            return { count: 0 };
          }),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM settlement_places')
          .catch(error => {
            console.log('[PackManager] Error counting settlement_places (retry):', error);
            return { count: 0 };
          }),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM route_cache')
          .catch(error => {
            console.log('[PackManager] Error counting route_cache (retry):', error);
            return { count: 0 };
          }),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM data_packs')
          .catch(error => {
            console.log('[PackManager] Error counting data_packs (retry):', error);
            return { count: 0 };
          }),
      ]);

      const stats = {
        streetCount: streetResult?.count ?? 0,
        boundaryCount: boundaryResult?.count ?? 0,
        settlementCount: settlementResult?.count ?? 0,
        routeCount: routeResult?.count ?? 0,
        packCount: packResult?.count ?? 0,
      };

      console.log('[PackManager] Pack stats fetched (after retry):', stats);
      return stats;
    }

    // For other errors, return zeros rather than throwing (graceful degradation)
    console.log('[PackManager] Error fetching pack stats:', error);
    return {
      streetCount: 0,
      boundaryCount: 0,
      settlementCount: 0,
      routeCount: 0,
      packCount: 0,
    };
  }
}
