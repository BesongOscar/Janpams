/**
 * Tile Cache Module
 * 
 * Central export for tile caching functionality
 */

export {
  downloadTilesForRegion,
  getCachedTile,
  isTileCached,
  getCacheStats,
  cleanExpiredTiles,
  clearTileCache,
  manageCacheSize,
} from './cache';
