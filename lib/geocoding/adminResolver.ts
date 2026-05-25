/**
 * Admin Boundary Resolver (Nominatim-Compatible)
 * Slot mapping from @janpams/core/geocoding; DB and spatial logic stay here.
 */

import { adminLevelToSlot as adminLevelToSlotCore, slotFromPlaceTag, type AdminSlot } from '@janpams/core/geocoding';
import { getDB, queryAll, parseJSON } from '../db';
import type { AdminBoundary } from '../db/schemas';

export type { AdminSlot };
export const adminLevelToSlot = adminLevelToSlotCore;

export interface AdminResult {
  country: AdminBoundary | null;
  region: AdminBoundary | null;
  county: AdminBoundary | null;
  city: AdminBoundary | null;
  neighborhood: AdminBoundary | null;
}

// ===== DETERMINISTIC TIE-BREAKING (Step 3) =====

/**
 * OSM type ranking for tie-breaking
 * relation > way > node (lower is better)
 */
function osmTypeRank(osmType?: 'node' | 'way' | 'relation'): number {
  if (osmType === 'relation') return 1;
  if (osmType === 'way') return 2;
  if (osmType === 'node') return 3;
  return 4; // unknown
}

/**
 * Determine if candidate is a better choice than current for the same slot
 * 
 * Tie-break ladder (per spec):
 * 1) Higher admin_level wins (more specific)
 * 2) If both have area: smaller area wins
 * 3) Prefer relation over way over node
 * 4) Smallest numeric osm_id wins (stable fallback)
 */
export function isBetterBoundary(
  candidate: AdminBoundary,
  current: AdminBoundary | null
): boolean {
  if (!current) return true;

  // 1) Higher admin_level wins (more specific boundary)
  if (candidate.admin_level > current.admin_level) return true;
  if (candidate.admin_level < current.admin_level) return false;

  // 2) If both have area: smaller area wins
  if (candidate.area !== undefined && current.area !== undefined) {
    if (candidate.area < current.area) return true;
    if (candidate.area > current.area) return false;
  } else if (candidate.area !== undefined) {
    // Candidate has area, current doesn't - prefer candidate
    return true;
  } else if (current.area !== undefined) {
    // Current has area, candidate doesn't - keep current
    return false;
  }

  // 3) Prefer relation over way over node
  const candidateRank = osmTypeRank(candidate.osm_type);
  const currentRank = osmTypeRank(current.osm_type);
  if (candidateRank < currentRank) return true;
  if (candidateRank > currentRank) return false;

  // 4) Smallest osm_id wins (stable fallback)
  const candidateOsmId = candidate.osm_id ?? Infinity;
  const currentOsmId = current.osm_id ?? Infinity;
  return candidateOsmId < currentOsmId;
}

// ===== SPATIAL UTILITIES =====

/**
 * Check if a point is inside a bounding box
 */
function isPointInBbox(
  lat: number,
  lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

/**
 * Ray casting algorithm for point-in-polygon
 */
function isPointInPolygon(
  lat: number,
  lon: number,
  polygon: [number, number][] // [lon, lat] pairs
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]; // lon, lat
    const [xj, yj] = polygon[j];

    if (((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// ===== MAIN RESOLVER (Steps 3-4) =====

export interface FindAdminBoundariesOptions {
  /** Filter to specific pack(s) - if empty, searches all */
  packIds?: string[];
}

/**
 * Find admin boundaries containing a point with deterministic selection
 * 
 * Key changes from original:
 * 1. Computes slot from admin_level, not stored boundary.level
 * 2. Uses isBetterBoundary for deterministic winner selection
 * 3. Supports packId filtering for multi-pack isolation
 */
export async function findAdminBoundaries(
  lat: number,
  lon: number,
  options: FindAdminBoundariesOptions = {}
): Promise<AdminResult> {
  const db = await getDB();

  // Step 4: Filter by packId if specified
  let boundaries: AdminBoundary[];

  if (options.packIds && options.packIds.length > 0) {
    // Query by packId
    const allResults: AdminBoundary[] = [];
    for (const packId of options.packIds) {
      const packBoundaries = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(
        'SELECT * FROM admin_boundaries WHERE packId = ?',
        [packId]
      );
      allResults.push(...packBoundaries.map(b => ({
        ...b,
        polygon: parseJSON<[number, number][]>(b.polygon) || [],
        bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(b.bbox) || {
          minLat: 0,
          maxLat: 0,
          minLon: 0,
          maxLon: 0,
        },
      })) as AdminBoundary[]);
    }
    boundaries = allResults;
  } else {
    // Get all boundaries
    const results = await queryAll<AdminBoundary & { polygon: string; bbox: string }>(
      'SELECT * FROM admin_boundaries'
    );
    boundaries = results.map(b => ({
      ...b,
      polygon: parseJSON<[number, number][]>(b.polygon) || [],
      bbox: parseJSON<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>(b.bbox) || {
        minLat: 0,
        maxLat: 0,
        minLon: 0,
        maxLon: 0,
      },
    })) as AdminBoundary[];
  }

  const result: AdminResult = {
    country: null,
    region: null,
    county: null,
    city: null,
    neighborhood: null,
  };

  for (const boundary of boundaries) {
    // Quick bbox check
    if (!isPointInBbox(lat, lon, boundary.bbox)) {
      continue;
    }

    // Point-in-polygon check
    if (!isPointInPolygon(lat, lon, boundary.polygon)) {
      continue;
    }

    // Step 2: Compute slot from admin_level (ignore stored boundary.level)
    const slot = adminLevelToSlot(boundary.admin_level);

    // Step 3: Deterministic selection
    if (isBetterBoundary(boundary, result[slot])) {
      result[slot] = boundary;
      console.log(`[AdminResolver] Selected: slot="${slot}", name="${boundary.name}", admin_level=${boundary.admin_level}, area=${boundary.area || 'N/A'}`);
    }
  }

  console.log('[AdminResolver] Final result:', {
    country: result.country ? `${result.country.name} (admin_level=${result.country.admin_level})` : null,
    region: result.region ? `${result.region.name} (admin_level=${result.region.admin_level})` : null,
    county: result.county ? `${result.county.name} (admin_level=${result.county.admin_level})` : null,
    city: result.city ? `${result.city.name} (admin_level=${result.city.admin_level})` : null,
    neighborhood: result.neighborhood ? `${result.neighborhood.name} (admin_level=${result.neighborhood.admin_level})` : null,
  });

  return result;
}

/**
 * Get admin level for storing boundaries (used during pack download).
 * Uses core slotFromPlaceTag + adminLevelToSlot for consistent mapping.
 */
export function getAdminLevelForStorage(adminLevel: number, place?: string): AdminBoundary['level'] {
  const fromPlace = place ? slotFromPlaceTag(place) : null;
  return fromPlace ?? adminLevelToSlot(adminLevel);
}
