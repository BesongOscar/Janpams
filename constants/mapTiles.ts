/**
 * Map Tile Configuration
 * OSM (OpenStreetMap) tile URLs for offline-first architecture
 * Matches web implementation tile configuration
 */

/**
 * OSM tile server URLs
 * Using standard OSM tile servers (same as web)
 */
export const OSM_TILE_SERVERS = [
  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

/**
 * Primary OSM tile URL template
 * Used as fallback or single server configuration
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Plus Code grid tile URL
 * Same as current implementation
 */
export const PLUS_CODE_GRID_TILE_URL =
  'https://a-grid.plus.codes/grid/tms/{z}/{x}/{y}.png?col=white';

/**
 * Map tile configuration
 */
export const MAP_TILE_CONFIG = {
  /**
   * OSM tile configuration
   */
  osm: {
    urlTemplate: OSM_TILE_SERVERS[0], // Use first server as primary
    maximumZ: 19,
    minimumZ: 0,
    tileSize: 256,
    flipY: false, // OSM uses standard XYZ scheme (not TMS)
  },
  /**
   * Plus Code grid tile configuration
   */
  plusCodeGrid: {
    urlTemplate: PLUS_CODE_GRID_TILE_URL,
    maximumZ: 19,
    minimumZ: 1,
    tileSize: 256,
    flipY: true, // Plus Code grid uses TMS scheme
    opacity: 0.8,
  },
} as const;
