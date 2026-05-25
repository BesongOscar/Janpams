/**
 * Offline Map Tile Caching
 * 
 * Downloads, stores, and serves OSM map tiles for offline use
 */

import { getDB, stringifyJSON, parseJSON } from '../db';
import type { TileCache } from '../db/schemas';
import { OSM_TILE_SERVERS } from '@/constants/mapTiles';

// ===== CONSTANTS =====

const TILE_SIZE = 256;
const MAX_CACHE_SIZE_MB = 500; // Maximum cache size in MB
const TILE_EXPIRY_DAYS = 30; // Tiles expire after 30 days

// ===== TILE URL HELPERS =====

/**
 * Get tile URL for given coordinates and zoom level
 */
function getTileUrl(x: number, y: number, z: number, serverIndex: number = 0): string {
  const server = OSM_TILE_SERVERS[serverIndex % OSM_TILE_SERVERS.length];
  return server.replace('{z}', z.toString()).replace('{x}', x.toString()).replace('{y}', y.toString());
}

/**
 * Convert lat/lon to tile coordinates
 */
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number; z: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

/**
 * Get all tiles for a bounding box and zoom range
 */
function getTilesForBbox(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  minZoom: number,
  maxZoom: number
): Array<{ x: number; y: number; z: number }> {
  const tiles: Array<{ x: number; y: number; z: number }> = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const minTile = latLonToTile(bbox.maxLat, bbox.minLon, z);
    const maxTile = latLonToTile(bbox.minLat, bbox.maxLon, z);

    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

// ===== TILE DOWNLOAD =====

/**
 * Download a single tile
 */
async function downloadTile(x: number, y: number, z: number): Promise<ArrayBuffer | null> {
  let lastError: Error | null = null;

  // Try each server
  for (let i = 0; i < OSM_TILE_SERVERS.length; i++) {
    try {
      const url = getTileUrl(x, y, z, i);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      // Try next server
    }
  }

  console.log(`[TileCache] Failed to download tile ${z}/${x}/${y}:`, lastError);
  return null;
}

/**
 * Download tiles for a region
 */
export async function downloadTilesForRegion(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  minZoom: number = 10,
  maxZoom: number = 16,
  onProgress?: (progress: number) => void
): Promise<{ downloaded: number; failed: number }> {
  const tiles = getTilesForBbox(bbox, minZoom, maxZoom);
  const total = tiles.length;
  let downloaded = 0;
  let failed = 0;

  console.log(`[TileCache] Downloading ${total} tiles for region...`);

  // Download in batches to avoid overwhelming the network
  const batchSize = 10;
  for (let i = 0; i < tiles.length; i += batchSize) {
    const batch = tiles.slice(i, i + batchSize);
    const promises = batch.map(async (tile) => {
      const data = await downloadTile(tile.x, tile.y, tile.z);
      if (data) {
        await storeTile(tile.x, tile.y, tile.z, data);
        downloaded++;
      } else {
        failed++;
      }
    });

    await Promise.all(promises);

    const progress = ((i + batch.length) / total) * 100;
    onProgress?.(progress);
  }

  console.log(`[TileCache] Downloaded ${downloaded} tiles, ${failed} failed`);
  return { downloaded, failed };
}

// ===== TILE STORAGE =====

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Store tile in database
 */
async function storeTile(x: number, y: number, z: number, data: ArrayBuffer): Promise<void> {
  const db = await getDB();
  const url = getTileUrl(x, y, z);
  
  // Convert ArrayBuffer to base64 for storage
  const base64 = arrayBufferToBase64(data);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TILE_EXPIRY_DAYS);

  await db.runAsync(
    `INSERT OR REPLACE INTO tile_cache (url, blob, cached_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    [
      url,
      base64,
      new Date().toISOString(),
      expiresAt.toISOString(),
    ]
  );
}

/**
 * Get cached tile
 */
export async function getCachedTile(x: number, y: number, z: number): Promise<ArrayBuffer | null> {
  const db = await getDB();
  const url = getTileUrl(x, y, z);

  const result = await db.getFirstAsync<TileCache & { blob: string }>(
    'SELECT * FROM tile_cache WHERE url = ? AND (expires_at IS NULL OR expires_at > ?)',
    [url, new Date().toISOString()]
  );

  if (!result) {
    return null;
  }

  // Convert base64 back to ArrayBuffer
  return base64ToArrayBuffer(result.blob);
}

/**
 * Check if tile is cached
 */
export async function isTileCached(x: number, y: number, z: number): Promise<boolean> {
  const db = await getDB();
  const url = getTileUrl(x, y, z);

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tile_cache WHERE url = ? AND (expires_at IS NULL OR expires_at > ?)',
    [url, new Date().toISOString()]
  );

  return (result?.count || 0) > 0;
}

// ===== CACHE MANAGEMENT =====

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalTiles: number;
  cacheSizeMB: number;
  expiredTiles: number;
}> {
  const db = await getDB();

  const [totalResult, expiredResult] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM tile_cache'),
    db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM tile_cache WHERE expires_at IS NOT NULL AND expires_at <= ?',
      [new Date().toISOString()]
    ),
  ]);

  // Estimate cache size (rough calculation)
  const totalTiles = totalResult?.count || 0;
  const estimatedSizePerTile = 20; // KB per tile (average)
  const cacheSizeMB = (totalTiles * estimatedSizePerTile) / 1024;

  return {
    totalTiles,
    cacheSizeMB,
    expiredTiles: expiredResult?.count || 0,
  };
}

/**
 * Clean expired tiles
 */
export async function cleanExpiredTiles(): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    'DELETE FROM tile_cache WHERE expires_at IS NOT NULL AND expires_at <= ?',
    [new Date().toISOString()]
  );

  return result.changes || 0;
}

/**
 * Clear all cached tiles
 */
export async function clearTileCache(): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM tile_cache', []);
}

/**
 * Manage cache size (remove oldest tiles if over limit)
 */
export async function manageCacheSize(): Promise<number> {
  const stats = await getCacheStats();

  if (stats.cacheSizeMB <= MAX_CACHE_SIZE_MB) {
    return 0;
  }

  // Remove oldest tiles until under limit
  const db = await getDB();
  const tilesToRemove = Math.ceil((stats.cacheSizeMB - MAX_CACHE_SIZE_MB) / (20 / 1024)); // 20KB per tile

  const result = await db.runAsync(
    `DELETE FROM tile_cache 
     WHERE url IN (
       SELECT url FROM tile_cache 
       ORDER BY cached_at ASC 
       LIMIT ?
     )`,
    [tilesToRemove]
  );

  return result.changes || 0;
}
