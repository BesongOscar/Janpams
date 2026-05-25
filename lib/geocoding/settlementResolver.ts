/**
 * Settlement Resolver (Nominatim-Compatible)
 * 
 * Ported from web's docs/src/lib/geocoding/settlementResolver.ts
 * Implements the "second tree" for city/neighborhood resolution
 * using settlement places (city, town, village, suburb, etc.)
 */

import { getDB, queryAll, parseJSON } from '../db';
import type { SettlementPlace, SettlementPlaceType } from '../db/schemas';

// ===== RANK TABLE (per spec) =====
// Lower rank = higher priority

export const SETTLEMENT_RANKS: Record<string, number> = {
  // Admin boundaries
  'admin_level_10': 9,
  'admin_level_8': 25,
  'admin_level_6': 45,
  'admin_level_4': 65,

  // Settlement places
  'neighbourhood': 10,
  'neighborhood': 10, // US spelling alias
  'quarter': 11,
  'suburb': 12,
  'village': 20,
  'hamlet': 22,
  'town': 30,
  'city': 40,
  'city_district': 8, // Higher priority than neighbourhood
  'postcode': 15,
};

// ===== DISTANCE THRESHOLDS (per spec) =====

export const DISTANCE_THRESHOLDS: Record<string, number> = {
  'neighbourhood': 250,
  'neighborhood': 250,
  'quarter': 350,
  'suburb': 1000,
  'village': 2000,    // Spec: 2000m, Cameroon tuning may increase
  'hamlet': 1500,
  'town': 5000,
  'city': 15000,
  'city_district': 500,
  'postcode': 500,
  'admin_level_10': 500,
  'admin_level_8': 10000,
  'admin_level_6': 30000,
  'admin_level_4': 50000,
};

// ===== TYPES =====

export interface SettlementCandidate {
  place: SettlementPlace;
  distance: number; // meters from query point
  isContained: boolean; // true if query point is inside polygon
  rank: number; // from SETTLEMENT_RANKS
  score: number; // rank × 1000 + distance (used for fallback)
}

export interface SettlementResult {
  /** Candidates grouped by type */
  cities: SettlementCandidate[];
  towns: SettlementCandidate[];
  villages: SettlementCandidate[];
  hamlets: SettlementCandidate[];
  suburbs: SettlementCandidate[];
  neighbourhoods: SettlementCandidate[];
  quarters: SettlementCandidate[];
  cityDistricts: SettlementCandidate[];
  postcodes: SettlementCandidate[];

  /** All candidates sorted by score (for unified selection) */
  allCandidates: SettlementCandidate[];

  /** Best contained candidate (polygon containment priority) */
  bestContained: SettlementCandidate | null;

  /** Best fallback candidate (by score when no containment) */
  bestFallback: SettlementCandidate | null;
}

export interface SettlementResolverOptions {
  /** Maximum search radius in meters (default 15000) */
  maxRadius?: number;
  /** Maximum candidates to consider (default 200) */
  maxCandidates?: number;
  /** Filter to specific pack(s) */
  packIds?: string[];
  /** Cameroon tuning: increase village threshold (default false) */
  cameroonTuning?: boolean;
}

// ===== SPATIAL UTILITIES =====

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Point-in-polygon check
 */
function isPointInPolygon(
  lat: number,
  lon: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if point is in bbox
 */
function isPointInBbox(
  lat: number,
  lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

/**
 * Generate geo cell for spatial indexing (1° grid cells)
 */
export function getGeoCell(lat: number, lon: number): string {
  const latCell = Math.floor(lat);
  const lonCell = Math.floor(lon);
  return `${latCell}_${lonCell}`;
}

/**
 * Get neighboring geo cells for a point
 */
function getNeighboringCells(lat: number, lon: number): string[] {
  const latCell = Math.floor(lat);
  const lonCell = Math.floor(lon);
  const cells: string[] = [];

  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      cells.push(`${latCell + dLat}_${lonCell + dLon}`);
    }
  }

  return cells;
}

// ===== SCORING =====

/**
 * Get rank for a settlement place type
 */
export function getRank(placeType: string): number {
  return SETTLEMENT_RANKS[placeType] ?? 50; // Default rank for unknown types
}

/**
 * Get distance threshold for a settlement place type
 */
export function getDistanceThreshold(placeType: string, cameroonTuning: boolean = false): number {
  let threshold = DISTANCE_THRESHOLDS[placeType] ?? 5000;

  // Cameroon tuning: increase village threshold to 3000m
  if (cameroonTuning && placeType === 'village') {
    threshold = 3000;
  }

  return threshold;
}

/**
 * Calculate score using unified formula: rank × 1000 + distance
 * Lower score = better match
 */
export function calculateScore(rank: number, distance: number): number {
  return rank * 1000 + distance;
}

// ===== MAIN RESOLVER =====

/**
 * Find settlement places near a point
 * 
 * Strategy per spec:
 * 1. Collect candidates within max radius
 * 2. Polygon containment pass - prefer contained candidates
 * 3. If no containment, use distance fallback with score formula
 * 4. Apply per-type distance thresholds
 * 5. Return grouped by type AND sorted all-candidates list
 */
export async function findSettlements(
  lat: number,
  lon: number,
  options: SettlementResolverOptions = {}
): Promise<SettlementResult> {
  const {
    maxRadius = 15000,
    maxCandidates = 200,
    packIds,
    cameroonTuning = false,
  } = options;

  // Try to load settlements using geo cell index first
  let settlements: SettlementPlace[] = [];
  const nearbyCells = getNeighboringCells(lat, lon);

  try {
    // Query by geo cell for efficiency
    for (const cell of nearbyCells) {
      const cellSettlements = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
        'SELECT * FROM settlement_places WHERE geoCell = ?',
        [cell]
      );
      settlements.push(...cellSettlements.map(s => ({
        ...s,
        polygon: s.polygon ? parseJSON<[number, number][]>(s.polygon) : undefined,
        bbox: s.bbox ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(s.bbox) : undefined,
      })) as SettlementPlace[]);
    }
  } catch (e) {
    // Fallback to full scan if index not available
    console.warn('[SettlementResolver] by-geoCell index not available, using full scan');
    const allSettlements = await queryAll<SettlementPlace & { polygon?: string; bbox?: string }>(
      'SELECT * FROM settlement_places'
    );
    settlements = allSettlements.map(s => ({
      ...s,
      polygon: s.polygon ? parseJSON<[number, number][]>(s.polygon) : undefined,
      bbox: s.bbox ? parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(s.bbox) : undefined,
    })) as SettlementPlace[];
  }

  // Filter by packId if specified
  if (packIds && packIds.length > 0) {
    settlements = settlements.filter(s => packIds.includes(s.packId));
  }

  const result: SettlementResult = {
    cities: [],
    towns: [],
    villages: [],
    hamlets: [],
    suburbs: [],
    neighbourhoods: [],
    quarters: [],
    cityDistricts: [],
    postcodes: [],
    allCandidates: [],
    bestContained: null,
    bestFallback: null,
  };

  const candidates: SettlementCandidate[] = [];

  for (const place of settlements) {
    // Check containment first if polygon exists
    let isContained = false;
    if (place.polygon && place.polygon.length >= 3) {
      if (place.bbox && !isPointInBbox(lat, lon, place.bbox)) {
        // Quick skip if outside bbox
      } else {
        isContained = isPointInPolygon(lat, lon, place.polygon);
      }
    }

    // Calculate distance
    const distance = haversineDistance(lat, lon, place.lat, place.lon);

    // Get rank and threshold for this place type
    const rank = getRank(place.place);
    const threshold = getDistanceThreshold(place.place, cameroonTuning);

    // Include if contained OR within per-type threshold
    if (isContained || distance <= threshold) {
      const score = calculateScore(rank, distance);
      candidates.push({ place, distance, isContained, rank, score });
    }
  }

  // Sort candidates:
  // 1. Contained first (polygon containment priority)
  // 2. Among contained, by rank (lower = better)
  // 3. Among same rank, by distance
  // For non-contained, by score (rank × 1000 + distance)
  candidates.sort((a, b) => {
    // Contained always wins
    if (a.isContained && !b.isContained) return -1;
    if (!a.isContained && b.isContained) return 1;

    // Both contained or both not contained
    if (a.isContained && b.isContained) {
      // Among contained, lower rank wins
      if (a.rank !== b.rank) return a.rank - b.rank;
      // Same rank, closer wins
      return a.distance - b.distance;
    }

    // Neither contained - use unified score
    return a.score - b.score;
  });

  // Take top candidates
  const topCandidates = candidates.slice(0, maxCandidates);
  result.allCandidates = topCandidates;

  // Find best contained and best fallback
  const containedCandidates = topCandidates.filter(c => c.isContained);
  if (containedCandidates.length > 0) {
    result.bestContained = containedCandidates[0]; // Already sorted by rank
  }

  const fallbackCandidates = topCandidates.filter(c => !c.isContained);
  if (fallbackCandidates.length > 0) {
    result.bestFallback = fallbackCandidates[0]; // Already sorted by score
  }

  // Group by type
  for (const candidate of topCandidates) {
    const placeType = candidate.place.place;

    switch (placeType) {
      case 'city':
        result.cities.push(candidate);
        break;
      case 'town':
        result.towns.push(candidate);
        break;
      case 'village':
        result.villages.push(candidate);
        break;
      case 'hamlet':
        result.hamlets.push(candidate);
        break;
      case 'suburb':
        result.suburbs.push(candidate);
        break;
      case 'neighbourhood':
      case 'neighborhood':
        result.neighbourhoods.push(candidate);
        break;
      case 'quarter':
        result.quarters.push(candidate);
        break;
      case 'city_district':
        result.cityDistricts.push(candidate);
        break;
      case 'postcode':
        result.postcodes.push(candidate);
        break;
    }
  }

  console.log('[SettlementResolver] Found candidates:', {
    cities: result.cities.length,
    towns: result.towns.length,
    villages: result.villages.length,
    hamlets: result.hamlets.length,
    suburbs: result.suburbs.length,
    neighbourhoods: result.neighbourhoods.length,
    quarters: result.quarters.length,
    cityDistricts: result.cityDistricts.length,
    postcodes: result.postcodes.length,
    bestContained: result.bestContained?.place.name || null,
    bestFallback: result.bestFallback?.place.name || null,
  });

  return result;
}
