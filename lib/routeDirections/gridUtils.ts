/**
 * Plus Code grid alignment and bounds helpers for route-directions map.
 * Extracted from route-directions.tsx for maintainability.
 */

// G-square cell size (~14.3m at ~4° lat)
const G_SQUARE_LAT_SIZE = 0.0001288;
const G_SQUARE_LNG_SIZE = 0.0001292;
const G_SQUARE_LAT_HALF = 0.0000644;
const G_SQUARE_LNG_HALF = 0.0000646;
const GRID_ALIGNMENT_OFFSET_LAT = -0.000022;
const GRID_ALIGNMENT_OFFSET_LNG = -0.000023;
const GRID_NUDGE_LAT = 0.00004;
const GRID_NUDGE_LNG = -0.000055;

export function snapToPlusCodeGrid(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
  const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;
  const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
  const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);
  const snappedLat =
    latCellIndex * G_SQUARE_LAT_SIZE +
    G_SQUARE_LAT_HALF +
    GRID_ALIGNMENT_OFFSET_LAT;
  const snappedLng =
    lngCellIndex * G_SQUARE_LNG_SIZE +
    G_SQUARE_LNG_HALF +
    GRID_ALIGNMENT_OFFSET_LNG;
  return { lat: snappedLat, lng: snappedLng };
}

export function getGridCellBounds(
  lat: number,
  lng: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
} {
  const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
  const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;
  const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
  const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);
  const minLat =
    latCellIndex * G_SQUARE_LAT_SIZE + GRID_ALIGNMENT_OFFSET_LAT;
  const maxLat = minLat + G_SQUARE_LAT_SIZE;
  const minLng =
    lngCellIndex * G_SQUARE_LNG_SIZE + GRID_ALIGNMENT_OFFSET_LNG;
  const maxLng = minLng + G_SQUARE_LNG_SIZE;
  const centerLat = minLat + G_SQUARE_LAT_HALF + GRID_NUDGE_LAT;
  const centerLng = minLng + G_SQUARE_LNG_HALF + GRID_NUDGE_LNG;
  return {
    minLat: minLat + GRID_NUDGE_LAT,
    maxLat: maxLat + GRID_NUDGE_LAT,
    minLng: minLng + GRID_NUDGE_LNG,
    maxLng: maxLng + GRID_NUDGE_LNG,
    centerLat,
    centerLng,
  };
}
