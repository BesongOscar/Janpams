/**
 * Address Calculation Utilities
 *
 * Ported from web's docs/src/lib/createLocationAddress.ts
 * Handles house number calculation, street side detection, and address formatting
 * Matches web implementation exactly for algorithm parity.
 *
 * Spec reference (Phase 9):
 * - Implementation guide: docs/Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide.md
 * - Web reference: docs/src/lib/createLocationAddress.ts
 */

import { getGridCenter } from '@janpams/core/pluscode';
import type { StreetSegment, StreetDirectionLock } from './db/schemas';
import { resolveStreetGeometry } from './streetGeometry';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Street {
  id: string;
  name: string;
  osm_id?: number;
  geometry: [number, number][]; // [lat, lon] pairs
  direction_locked?: boolean;
}

export interface AddressData {
  houseNumber: number;
  street: string;
  chainage: string;
  chainageIndex?: number; // Ordinal position: floor(chainage / 14m)
  side?: 'L' | 'R';
  spacing: number;
  displayAddress: string;
  unitType?: string; // e.g., "Apt", "Suite", "Unit"
  unitNumber?: string; // e.g., "206"
  noStreetFound?: boolean; // True when no street nearby but region data exists
  // Adaptive projection metadata
  orientation?: 'vertical' | 'horizontal' | 'diagonal';
  projectionType?: 'horizontal' | 'vertical' | 'perpendicular';
  // Non-street-facing / Compound metadata
  distanceToStreet?: number; // Distance in meters from Plus Code centroid to snap point
  isNonStreetFacing?: boolean; // True if distanceToStreet > NON_STREET_FACING_THRESHOLD
  osmData?: {
    businessName?: string | null;
    neighborhood: string | null;
    city: string;
    region: string;
    region_code: string | null;
    country: string;
  };
}

/**
 * Non-Street-Facing Threshold (meters)
 * Properties beyond this distance trigger compound workflow
 */
export const NON_STREET_FACING_THRESHOLD = 30;

export type StreetOrientation = 'vertical' | 'horizontal' | 'diagonal';
export type ProjectionType = 'horizontal' | 'vertical' | 'perpendicular';

export interface OrientationResult {
  orientation: StreetOrientation;
  aspectRatio: number;
  deltaLat: number;
  deltaLon: number;
}

export interface AdaptiveProjectionResult {
  snapPoint: [number, number];
  segmentIndex: number;
  distance: number;
  orientation: StreetOrientation;
  projectionType: ProjectionType;
  noValidProjection: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate haversine distance between two points in meters
 */
export function haversineDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ============================================================================
// STREET ORIENTATION DETECTION
// ============================================================================

/**
 * Calculate the dominant orientation of a street.
 * 
 * Uses the bounding box aspect ratio to determine if the street runs
 * primarily North-South (vertical), East-West (horizontal), or at ~45° (diagonal).
 * 
 * Thresholds:
 * - aspectRatio < 0.9 → vertical (N-S dominant)
 * - aspectRatio > 1.1 → horizontal (E-W dominant)
 * - 0.9 ≤ aspectRatio ≤ 1.1 → diagonal (~45°)
 */
export function calculateStreetOrientation(
  geometry: [number, number][]
): OrientationResult {
  const lats = geometry.map(p => p[0]);
  const lons = geometry.map(p => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const deltaLat = maxLat - minLat;
  const deltaLon = maxLon - minLon;

  // Calculate aspect ratio (with protection against division by zero)
  const aspectRatio = deltaLat > 0.000001
    ? deltaLon / deltaLat
    : (deltaLon > 0 ? Infinity : 1);

  // Determine orientation based on aspect ratio
  let orientation: StreetOrientation;
  if (aspectRatio < 0.9) {
    orientation = 'vertical'; // More N-S than E-W
  } else if (aspectRatio > 1.1) {
    orientation = 'horizontal'; // More E-W than N-S
  } else {
    orientation = 'diagonal'; // Approximately 45°
  }

  console.log('[Orientation] deltaLat:', deltaLat.toFixed(6), 'deltaLon:', deltaLon.toFixed(6),
    'aspectRatio:', aspectRatio.toFixed(2), '→', orientation);

  return {
    orientation,
    aspectRatio,
    deltaLat,
    deltaLon,
  };
}

// ============================================================================
// HORIZONTAL INTERSECTION (for Vertical Streets)
// ============================================================================

/**
 * Find where a horizontal (East-West) line from the centroid intersects a line segment.
 */
function horizontalIntersectionWithSegment(
  centroid: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): [number, number] | null {
  const [centroidLat, _centroidLon] = centroid;
  const [lat1, lon1] = segStart;
  const [lat2, lon2] = segEnd;

  // Check if the segment spans the centroid's latitude
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);

  // Use small epsilon for floating point comparison
  const epsilon = 1e-10;
  if (centroidLat < minLat - epsilon || centroidLat > maxLat + epsilon) {
    return null; // Horizontal line doesn't intersect this segment
  }

  // Handle perfectly horizontal segments (lat1 ≈ lat2)
  if (Math.abs(lat2 - lat1) < epsilon) {
    // Segment is horizontal - return the midpoint of the segment
    return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
  }

  // Linear interpolation to find longitude at centroid's latitude
  const t = (centroidLat - lat1) / (lat2 - lat1);
  const intersectLon = lon1 + t * (lon2 - lon1);

  return [centroidLat, intersectLon];
}

/**
 * Find the horizontal intersection point on a street geometry.
 */
function findHorizontalSnapPoint(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } | null {
  let bestSnapPoint: [number, number] | null = null;
  let bestSegmentIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < geometry.length - 1; i++) {
    const intersection = horizontalIntersectionWithSegment(centroid, geometry[i], geometry[i + 1]);

    if (intersection) {
      const dist = haversineDistance(centroid, intersection);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSnapPoint = intersection;
        bestSegmentIndex = i;
      }
    }
  }

  if (bestSnapPoint === null) {
    console.warn('[Horizontal Snap] No horizontal intersection found. Centroid:', centroid);
    return null;
  }

  console.log('[Horizontal Snap] Found intersection at segment', bestSegmentIndex, 'point:', bestSnapPoint, 'distance:', bestDistance.toFixed(1), 'm');

  return { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance };
}

// ============================================================================
// VERTICAL INTERSECTION (for Horizontal Streets)
// ============================================================================

/**
 * Find where a vertical (North-South) line from the centroid intersects a line segment.
 */
function verticalIntersectionWithSegment(
  centroid: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): [number, number] | null {
  const [_centroidLat, centroidLon] = centroid;
  const [lat1, lon1] = segStart;
  const [lat2, lon2] = segEnd;

  // Check if the segment spans the centroid's longitude
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);

  // Use small epsilon for floating point comparison
  const epsilon = 1e-10;
  if (centroidLon < minLon - epsilon || centroidLon > maxLon + epsilon) {
    return null; // Vertical line doesn't intersect this segment
  }

  // Handle perfectly vertical segments (lon1 ≈ lon2)
  if (Math.abs(lon2 - lon1) < epsilon) {
    // Segment is vertical - return the midpoint of the segment
    return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
  }

  // Linear interpolation to find latitude at centroid's longitude
  const t = (centroidLon - lon1) / (lon2 - lon1);
  const intersectLat = lat1 + t * (lat2 - lat1);

  return [intersectLat, centroidLon];
}

/**
 * Find the vertical intersection point on a street geometry.
 */
function findVerticalSnapPoint(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } | null {
  let bestSnapPoint: [number, number] | null = null;
  let bestSegmentIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < geometry.length - 1; i++) {
    const intersection = verticalIntersectionWithSegment(centroid, geometry[i], geometry[i + 1]);

    if (intersection) {
      const dist = haversineDistance(centroid, intersection);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSnapPoint = intersection;
        bestSegmentIndex = i;
      }
    }
  }

  if (bestSnapPoint === null) {
    console.warn('[Vertical Snap] No vertical intersection found. Centroid:', centroid);
    return null;
  }

  console.log('[Vertical Snap] Found intersection at segment', bestSegmentIndex, 'point:', bestSnapPoint, 'distance:', bestDistance.toFixed(1), 'm');

  return { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance };
}

// ============================================================================
// PERPENDICULAR PROJECTION (for Diagonal Streets)
// ============================================================================

/**
 * Project a point onto the nearest position on a line segment.
 */
function projectPointOntoSegment(
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): [number, number] {
  const [px, py] = point;
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return segStart; // Degenerate segment
  }

  // Calculate projection parameter t (clamped to [0, 1] to stay on segment)
  const t = Math.max(0, Math.min(1,
    ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
  ));

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Find the perpendicular projection point on a street geometry.
 */
function findPerpendicularSnapPoint(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } {
  let bestSnapPoint: [number, number] = geometry[0];
  let bestSegmentIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < geometry.length - 1; i++) {
    const projected = projectPointOntoSegment(centroid, geometry[i], geometry[i + 1]);
    const dist = haversineDistance(centroid, projected);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestSnapPoint = projected;
      bestSegmentIndex = i;
    }
  }

  console.log('[Perpendicular Snap] Found at segment', bestSegmentIndex, 'point:', bestSnapPoint, 'distance:', bestDistance.toFixed(1), 'm');

  return { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance };
}

// ============================================================================
// ADAPTIVE PROJECTION (Unified Function)
// ============================================================================

/**
 * Apply adaptive projection based on street orientation.
 * 
 * Projection rules:
 * - Vertical streets (N-S) → Horizontal projection (E-W ray)
 * - Horizontal streets (E-W) → Vertical projection (N-S ray)
 * - Diagonal streets (~45°) → Perpendicular projection (nearest point)
 */
export function adaptiveProjection(
  centroid: [number, number],
  geometry: [number, number][]
): AdaptiveProjectionResult {
  // 1. Determine street orientation
  const { orientation } = calculateStreetOrientation(geometry);

  // 2. Apply appropriate projection
  let result: { snapPoint: [number, number]; segmentIndex: number; distance: number } | null = null;
  let projectionType: ProjectionType;

  switch (orientation) {
    case 'vertical':
      projectionType = 'horizontal';
      result = findHorizontalSnapPoint(centroid, geometry);
      break;
    case 'horizontal':
      projectionType = 'vertical';
      result = findVerticalSnapPoint(centroid, geometry);
      break;
    case 'diagonal':
      projectionType = 'perpendicular';
      result = findPerpendicularSnapPoint(centroid, geometry);
      break;
  }

  // 3. If no valid intersection found, return noValidProjection flag
  if (!result) {
    console.warn('[Adaptive Projection] NO VALID PROJECTION for', orientation,
      'street. Centroid:', centroid, 'is outside street extent.');

    // Return a "no valid projection" result - caller should re-select street
    return {
      snapPoint: geometry[0], // Placeholder, not to be used
      segmentIndex: 0,
      distance: Infinity,
      orientation,
      projectionType,
      noValidProjection: true,
    };
  }

  console.log('[Adaptive Projection] orientation:', orientation, 'projection:', projectionType,
    'snapPoint:', result.snapPoint, 'distance:', result.distance.toFixed(1), 'm');

  return {
    ...result,
    orientation,
    projectionType,
    noValidProjection: false,
  };
}

// ============================================================================
// STREET GEOMETRY RESOLUTION
// ============================================================================

/**
 * Get resolved street geometry for address calculation.
 * Uses direction lock when provided; otherwise raw OSM order.
 * Single source of truth: delegates to resolveStreetGeometry (streetGeometry.ts).
 */
export function getResolvedGeometry(
  street: Street,
  directionLock?: StreetDirectionLock | null
): {
  start: [number, number];
  end: [number, number];
  orientedGeometry: [number, number][];
} {
  const resolved = resolveStreetGeometry(street, directionLock);
  return {
    start: resolved.start,
    end: resolved.end,
    orientedGeometry: resolved.geometry,
  };
}

// ============================================================================
// PLUS CODE CENTROID
// ============================================================================

/**
 * Plus Code grid size constant (~13.9m at equator)
 */
const PLUS_CODE_GRID_SIZE = 0.000125; // degrees

/**
 * Plus Code grid size in meters (~14m at equator)
 * Used for chainage-based ordinal calculation
 */
const PLUS_CODE_GRID_SIZE_METERS = 14;

/**
 * Compute the centroid of the Active Plus Code grid cell for a given point.
 * This is the stable reference point used for house number calculation.
 */
function getActivePlusCodeCentroid(lat: number, lon: number): [number, number] {
  const gridSize = 0.000125; // ~14m x 14m at equator
  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLon = Math.floor(lon / gridSize) * gridSize;

  // Centroid is the center of the grid cell
  const centroidLat = gridLat + (gridSize / 2);
  const centroidLon = gridLon + (gridSize / 2);

  console.log('[Plus Code Centroid] Input:', [lat, lon], '→ Grid centroid:', [centroidLat, centroidLon]);

  return [centroidLat, centroidLon];
}

// ============================================================================
// CHAINAGE CALCULATION
// ============================================================================

/**
 * Compute chainage and Plus Code ordinal position along street
 * 
 * Uses ADAPTIVE PROJECTION based on street orientation.
 * CHAINAGE-BASED ORDINAL: plusCodeOrdinal = floor(chainage / 14m)
 */
function computeChainage(
  centroid: [number, number],
  orientedGeometry: [number, number][]
): {
  chainage: number;
  totalLength: number;
  snappedPoint: [number, number];
  closestSegmentIndex: number;
  orientation: StreetOrientation;
  projectionType: ProjectionType;
  plusCodeOrdinal: number;
  noValidProjection: boolean;
} {
  // ADAPTIVE PROJECTION: Select projection method based on street orientation
  const projectionResult = adaptiveProjection(centroid, orientedGeometry);

  const { snapPoint, segmentIndex, orientation, projectionType, noValidProjection } = projectionResult;

  // If no valid projection, return early with invalid state
  if (noValidProjection) {
    console.warn('[Chainage Debug] NO VALID PROJECTION - cannot compute chainage');
    return {
      chainage: 0,
      totalLength: 0,
      snappedPoint: snapPoint,
      closestSegmentIndex: 0,
      orientation,
      projectionType,
      plusCodeOrdinal: 0,
      noValidProjection: true,
    };
  }

  // Sum distances from start to the beginning of the snap segment
  let chainage = 0;
  const segmentDistances: number[] = [];
  for (let i = 0; i < segmentIndex; i++) {
    const segDist = haversineDistance(orientedGeometry[i], orientedGeometry[i + 1]);
    segmentDistances.push(segDist);
    chainage += segDist;
  }

  // Add distance from segment start to snap point
  const snapDist = haversineDistance(orientedGeometry[segmentIndex], snapPoint);
  chainage += snapDist;

  // Calculate total street length
  let totalLength = 0;
  for (let i = 0; i < orientedGeometry.length - 1; i++) {
    totalLength += haversineDistance(orientedGeometry[i], orientedGeometry[i + 1]);
  }

  // CHAINAGE-BASED ORDINAL: floor(chainage / 14m)
  const plusCodeOrdinal = Math.floor(chainage / PLUS_CODE_GRID_SIZE_METERS);

  console.log('[Chainage Debug] ═══════════════════════════════════════');
  console.log('[Chainage Debug] Centroid:', centroid);
  console.log('[Chainage Debug] Street has', orientedGeometry.length, 'points,', orientedGeometry.length - 1, 'segments');
  console.log('[Chainage Debug] Orientation:', orientation, '| Projection:', projectionType);
  console.log('[Chainage Debug] Snap point landed on segment:', segmentIndex);
  console.log('[Chainage Debug] Snap point coords:', snapPoint);
  console.log('[Chainage Debug] Distance from segment', segmentIndex, 'start to snap:', snapDist.toFixed(2), 'm');
  if (segmentDistances.length > 0) {
    console.log('[Chainage Debug] Previous segment distances:', segmentDistances.map(d => d.toFixed(2) + 'm').join(' + '));
  }
  console.log('[Chainage Debug] TOTAL CHAINAGE (metric):', chainage.toFixed(2), 'm');
  console.log('[Chainage Debug] CHAINAGE-BASED ORDINAL:', plusCodeOrdinal, `(floor(${chainage.toFixed(1)}/${PLUS_CODE_GRID_SIZE_METERS}))`);
  console.log('[Chainage Debug] Total street length:', totalLength.toFixed(1), 'm');
  console.log('[Chainage Debug] ═══════════════════════════════════════');

  return {
    chainage,
    totalLength,
    snappedPoint: snapPoint,
    closestSegmentIndex: segmentIndex,
    orientation,
    projectionType,
    plusCodeOrdinal,
    noValidProjection: false,
  };
}

// ============================================================================
// SIDE OF STREET DETECTION
// ============================================================================

/**
 * Determine which side of street the property is on
 * 
 * Uses cross-product of:
 * 1. Street direction vector (segment start → end)
 * 2. Vector from snap point (I) to Plus Code centroid
 */
function determineSideOfStreet(
  centroid: [number, number],
  snapPoint: [number, number],
  orientedGeometry: [number, number][],
  closestSegmentIndex: number
): 'L' | 'R' {
  const segStart = orientedGeometry[closestSegmentIndex];
  const segEnd = orientedGeometry[closestSegmentIndex + 1];

  // Direction vector of the segment (in the Start→End direction)
  const dirLat = segEnd[0] - segStart[0];
  const dirLon = segEnd[1] - segStart[1];

  // Vector from snap point (I) to centroid
  const toCentroidLat = centroid[0] - snapPoint[0];
  const toCentroidLon = centroid[1] - snapPoint[1];

  // Cross product: streetDir × (I → centroid)
  // Positive = centroid is to the left of the street direction
  // Negative = centroid is to the right
  const cross = dirLon * toCentroidLat - dirLat * toCentroidLon;

  console.log('[Side Determination] snapPoint:', snapPoint, '→ centroid:', centroid,
    'cross:', cross.toFixed(6), '→', cross > 0 ? 'LEFT' : 'RIGHT');

  return cross > 0 ? 'L' : 'R';
}

// ============================================================================
// STREET RE-SELECTION FOR VALID PROJECTION
// ============================================================================

/**
 * Try to project a centroid onto a street and check if it's valid.
 */
export function tryProjectionOnStreet(
  centroid: [number, number],
  street: Street,
  directionLock?: StreetDirectionLock | null
): AdaptiveProjectionResult | null {
  const { orientedGeometry } = getResolvedGeometry(street, directionLock);
  const result = adaptiveProjection(centroid, orientedGeometry);

  if (result.noValidProjection) {
    return null;
  }

  return result;
}

/**
 * Find a street from nearby candidates where the centroid can be validly projected.
 * When getDirectionLock is provided, uses it so geometry respects direction lock when available.
 */
export function findStreetWithValidProjection(
  centroid: [number, number],
  candidateStreets: Street[],
  excludeStreet?: Street,
  getDirectionLock?: (street: Street) => StreetDirectionLock | null
): { street: Street; projection: AdaptiveProjectionResult } | null {
  console.log('[Street Re-selection] Searching', candidateStreets.length,
    'streets for valid projection. Centroid:', centroid);

  // Sort by distance to centroid for efficiency
  const sortedStreets = [...candidateStreets]
    .filter(s => s !== excludeStreet && s.id !== excludeStreet?.id)
    .map(street => {
      // Simple distance calculation (using first point as approximation)
      const dist = haversineDistance(centroid, street.geometry[0]);
      return { street, distance: dist };
    })
    .sort((a, b) => a.distance - b.distance);

  for (const { street, distance } of sortedStreets) {
    console.log('[Street Re-selection] Trying:', street.name, 'at', distance.toFixed(1), 'm');

    const directionLock = getDirectionLock?.(street) ?? undefined;
    const projection = tryProjectionOnStreet(centroid, street, directionLock);

    if (projection) {
      console.log('[Street Re-selection] SUCCESS! Found valid projection on:', street.name,
        'orientation:', projection.orientation, 'type:', projection.projectionType);
      return { street, projection };
    }

    console.log('[Street Re-selection] FAILED on:', street.name, '- no valid projection');
  }

  console.warn('[Street Re-selection] No street with valid projection found among',
    candidateStreets.length, 'candidates');
  return null;
}

// ============================================================================
// HOUSE NUMBER CALCULATION
// ============================================================================

/**
 * Calculate house number based on position along street (sync version)
 * Does NOT check for duplicates - use allocateHouseNumberAsync for uniqueness
 * 
 * IMPORTANT: Uses the Active Plus Code centroid as the reference point,
 * NOT the raw GPS/tap coordinates.
 * 
 * FORMULA (Chainage-Based Ordinal):
 * - plusCodeOrdinal = floor(chainage / 14m)
 * - houseNumber = plusCodeOrdinal × 2 + (1 if LEFT else 2)
 */
export function calculateHouseNumberSync(
  lat: number,
  lon: number,
  street: Street,
  options?: {
    nearbyStreets?: Street[];
    directionLock?: StreetDirectionLock | null;
    /** When re-selecting street, use this to pass direction lock per candidate when available */
    getDirectionLock?: (street: Street) => StreetDirectionLock | null;
  }
): AddressData | null {
  // Use Plus Code centroid as the reference point (not raw GPS/tap point)
  const centroid = getActivePlusCodeCentroid(lat, lon);

  const { orientedGeometry } = getResolvedGeometry(street, options?.directionLock);
  const chainageResult = computeChainage(centroid, orientedGeometry);

  // If no valid projection on this street, try to find an alternative
  if (chainageResult.noValidProjection) {
    console.warn('[House Number] NO VALID PROJECTION on', street.name,
      '- attempting street re-selection');

    // If nearby streets provided, try to find one with valid projection
    if (options?.nearbyStreets && options.nearbyStreets.length > 0) {
      const alternative = findStreetWithValidProjection(
        centroid,
        options.nearbyStreets,
        street,
        options.getDirectionLock
      );

      if (alternative) {
        console.log('[House Number] RE-SELECTED to:', alternative.street.name);
        // Recursively calculate with the new street (no lock for re-selected street)
        return calculateHouseNumberSync(lat, lon, alternative.street);
      }
    }

    // No alternative found - return null (truly no addressable street)
    console.log('[House Number] FAILED: No street with valid projection found');
    return null;
  }

  const { chainage, closestSegmentIndex, snappedPoint, orientation, projectionType, plusCodeOrdinal } = chainageResult;
  const side = determineSideOfStreet(centroid, snappedPoint, orientedGeometry, closestSegmentIndex);

  // Calculate distance from centroid to snap point (for non-street-facing detection)
  const distanceToStreet = haversineDistance(centroid, snappedPoint);
  const isNonStreetFacing = distanceToStreet > NON_STREET_FACING_THRESHOLD;

  if (isNonStreetFacing) {
    console.log('[House Number] ⚠️ NON-STREET-FACING detected! Distance:',
      distanceToStreet.toFixed(1), 'm > threshold:', NON_STREET_FACING_THRESHOLD, 'm');
  }

  // PLUS CODE ORDINAL FORMULA: Each grid cell = one ordinal position
  // houseNumber = ordinal × 2 + parity (1 for left, 2 for right)
  let houseNumber: number;
  if (side === 'L') {
    houseNumber = plusCodeOrdinal * 2 + 1;
  } else {
    houseNumber = plusCodeOrdinal * 2 + 2; // Even numbers on right
  }

  // Ensure minimum house number of 1
  houseNumber = Math.max(1, houseNumber);

  console.log('[House Number] street:', street.name, 'orientation:', orientation, 'projection:', projectionType,
    'chainage:', chainage.toFixed(1), 'm, plusCodeOrdinal:', plusCodeOrdinal, 'side:', side,
    '→ houseNumber:', houseNumber, '| distanceToStreet:', distanceToStreet.toFixed(1), 'm',
    isNonStreetFacing ? '(NON-STREET-FACING)' : '');

  return {
    houseNumber,
    street: street.name,
    chainage: chainage.toFixed(1),
    chainageIndex: plusCodeOrdinal, // Now represents Plus Code ordinal
    side,
    spacing: PLUS_CODE_GRID_SIZE * 111000, // ~13.9m (for info only)
    displayAddress: `${houseNumber} ${street.name}`,
    orientation,
    projectionType,
    distanceToStreet,
    isNonStreetFacing,
  };
}

/**
 * Async house number allocation with duplicate prevention
 * 
 * Note: This requires database integration for getTakenHouseNumbers and reserveHouseNumber.
 * For Phase 2, we'll implement a basic version that can be enhanced in Phase 3.
 */
export async function allocateHouseNumberAsync(
  lat: number,
  lon: number,
  street: Street,
  deps: {
    streetKey: string;
    getTakenHouseNumbers: (streetKey: string) => Promise<Set<number>>;
    reserveHouseNumber?: (input: {
      streetKey: string;
      houseNumber: number;
      lat: number;
      lon: number;
      source: 'JANGO_ASSIGNED' | 'OSM_OFFICIAL' | 'USER_CONFIRMED';
    }) => Promise<void>;
    externalHouseNumber?: number | null;
    directionLock?: StreetDirectionLock | null;
  }
): Promise<AddressData | null> {
  // First, calculate the base house number (with direction lock when provided)
  const baseResult = calculateHouseNumberSync(lat, lon, street, {
    directionLock: deps.directionLock,
  });

  if (!baseResult) {
    return null;
  }

  // If external house number provided, use it
  if (deps.externalHouseNumber) {
    return {
      ...baseResult,
      houseNumber: deps.externalHouseNumber,
    };
  }

  // Get taken house numbers
  const takenNumbers = await deps.getTakenHouseNumbers(deps.streetKey);

  // If base number is available, use it
  if (!takenNumbers.has(baseResult.houseNumber)) {
    // Reserve the number if reservation function provided
    if (deps.reserveHouseNumber) {
      await deps.reserveHouseNumber({
        streetKey: deps.streetKey,
        houseNumber: baseResult.houseNumber,
        lat,
        lon,
        source: 'JANGO_ASSIGNED',
      });
    }
    return baseResult;
  }

  // Find nearest available number with same parity (odd/even)
  const baseParity = baseResult.houseNumber % 2;
  const probeRange = 50; // Search up to 50 numbers away

  for (let offset = 1; offset <= probeRange; offset++) {
    // Try both directions
    for (const direction of [-1, 1]) {
      const candidate = baseResult.houseNumber + (offset * direction);
      if (candidate < 1) continue; // Skip negative numbers

      // Check parity match
      if (candidate % 2 !== baseParity) continue;

      // Check if available
      if (!takenNumbers.has(candidate)) {
        // Reserve the number if reservation function provided
        if (deps.reserveHouseNumber) {
          await deps.reserveHouseNumber({
            streetKey: deps.streetKey,
            houseNumber: candidate,
            lat,
            lon,
            source: 'JANGO_ASSIGNED',
          });
        }
        return {
          ...baseResult,
          houseNumber: candidate,
        };
      }
    }
  }

  // No available number found in range
  console.warn('[House Number] No available number found in range for', deps.streetKey);
  return baseResult; // Return base result anyway (caller can handle conflict)
}
