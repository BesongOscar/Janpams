/**
 * Plus Code Grid Utilities
 * Uses @janpams/core/pluscode for grid bounds and neighbor cells; app-specific
 * helpers (polygon, restriction checks, bbox) remain here.
 */

import {
  getGridBounds as coreGetGridBounds,
  getNeighborGrids as coreGetNeighborGrids,
  isSameGridCell as coreIsSameGridCell,
  type GridBounds,
} from '@janpams/core/pluscode';

const GRID_SIZE = 0.000125; // ~14m x 14m at equator (G-square size), must match core

export type { GridBounds };

export const getGridBounds = coreGetGridBounds;

/** Get 8 neighbor grid bounds for a center (lat, lon). App-friendly signature. */
export function getNeighborGrids(centerLat: number, centerLon: number): GridBounds[] {
  const bounds = coreGetGridBounds(centerLat, centerLon);
  return coreGetNeighborGrids(bounds);
}

/** Check if two (lat, lon) points are in the same grid cell. App-friendly signature. */
export function isSameGridCell(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): boolean {
  return coreIsSameGridCell(
    coreGetGridBounds(lat1, lon1),
    coreGetGridBounds(lat2, lon2)
  );
}

/**
 * Convert grid bounds to GeoJSON Polygon coordinates
 */
export function gridBoundsToPolygon(bounds: GridBounds): number[][] {
  return [
    [bounds.sw[1], bounds.sw[0]], // SW
    [bounds.ne[1], bounds.sw[0]], // SE
    [bounds.ne[1], bounds.ne[0]], // NE
    [bounds.sw[1], bounds.ne[0]], // NW
    [bounds.sw[1], bounds.sw[0]], // Close polygon
  ];
}

/**
 * Check if a click is in one of the 8 neighbor cells (not the center).
 * Used for basic_user restriction: they may only tap neighbor cells, not the center.
 */
export function isClickInNeighborCellOnly(
  clickLat: number,
  clickLon: number,
  centerLat: number,
  centerLon: number
): boolean {
  const centerBounds = getGridBounds(centerLat, centerLon);
  const clickBounds = getGridBounds(clickLat, clickLon);
  const latDiff = Math.abs(clickBounds.sw[0] - centerBounds.sw[0]);
  const lonDiff = Math.abs(clickBounds.sw[1] - centerBounds.sw[1]);
  const inNineCell = latDiff <= GRID_SIZE * 1.1 && lonDiff <= GRID_SIZE * 1.1;
  const notCenter = !isSameGridCell(clickLat, clickLon, centerLat, centerLon);
  return inNineCell && notCenter;
}

/**
 * Bounding box of the 9-cell neighborhood (center + 8 neighbors).
 * Used for restriction overlay hole.
 */
export function getNineCellBbox(
  centerLat: number,
  centerLon: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const center = getGridBounds(centerLat, centerLon);
  return {
    minLat: center.sw[0] - GRID_SIZE,
    maxLat: center.ne[0] + GRID_SIZE,
    minLng: center.sw[1] - GRID_SIZE,
    maxLng: center.ne[1] + GRID_SIZE,
  };
}
