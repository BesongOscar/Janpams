/**
 * Spatial Queries for SQLite
 * 
 * Implements spatial queries for nearest streets, boundary containment,
 * distance calculations, and bounding box queries
 */

import { getDB, parseJSON } from '../db';
import type { StreetSegment, AdminBoundary } from '../db/schemas';

// ===== DISTANCE CALCULATIONS =====

/**
 * Calculate haversine distance between two points (in meters)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance from point to line segment (in meters)
 */
export function distanceToSegment(
  pointLat: number,
  pointLon: number,
  segmentStart: [number, number],
  segmentEnd: [number, number]
): number {
  const [startLat, startLon] = segmentStart;
  const [endLat, endLon] = segmentEnd;

  // Calculate vector from start to end
  const dx = endLon - startLon;
  const dy = endLat - startLat;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is a point
    return haversineDistance(pointLat, pointLon, startLat, startLon);
  }

  // Calculate projection parameter
  const t = Math.max(0, Math.min(1, ((pointLon - startLon) * dx + (pointLat - startLat) * dy) / lengthSquared));

  // Calculate closest point on segment
  const closestLon = startLon + t * dx;
  const closestLat = startLat + t * dy;

  return haversineDistance(pointLat, pointLon, closestLat, closestLon);
}

// ===== BOUNDING BOX HELPERS =====

/**
 * Check if point is in bounding box
 */
export function isPointInBbox(
  lat: number,
  lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/**
 * Calculate bounding box from coordinates
 */
export function calculateBbox(coords: [number, number][]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  if (coords.length === 0) {
    return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
  }

  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  let minLon = coords[0][0];
  let maxLon = coords[0][0];

  for (const [lon, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  return { minLat, maxLat, minLon, maxLon };
}

// ===== POINT IN POLYGON =====

/**
 * Check if point is in polygon using ray casting algorithm
 */
export function isPointInPolygon(
  lat: number,
  lon: number,
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// ===== NEAREST STREET QUERIES =====

/**
 * Find nearest street segments to a point
 */
export async function findNearestStreets(
  lat: number,
  lon: number,
  maxDistance: number = 1000,
  limit: number = 10
): Promise<Array<StreetSegment & { distance: number }>> {
  const db = await getDB();

  // Query streets in approximate bounding box first (faster)
  const bboxExpansion = maxDistance / 111000; // Rough conversion: 1 degree ≈ 111km
  const results = await db.getAllAsync<StreetSegment & { bbox: string }>(
    `SELECT * FROM street_segments 
     WHERE json_extract(bbox, '$.minLat') <= ? 
       AND json_extract(bbox, '$.maxLat') >= ?
       AND json_extract(bbox, '$.minLon') <= ?
       AND json_extract(bbox, '$.maxLon') >= ?
     LIMIT ?`,
    [
      lat + bboxExpansion,
      lat - bboxExpansion,
      lon + bboxExpansion,
      lon - bboxExpansion,
      limit * 10, // Get more candidates for distance filtering
    ]
  );

  // Calculate actual distances and sort
  const streetsWithDistance = results
    .map(street => {
      const geometry = parseJSON<[number, number][]>(street.geometry) || [];
      if (geometry.length < 2) return null;

      // Find minimum distance to any segment of the street
      let minDistance = Infinity;
      for (let i = 0; i < geometry.length - 1; i++) {
        const distance = distanceToSegment(
          lat,
          lon,
          geometry[i],
          geometry[i + 1]
        );
        minDistance = Math.min(minDistance, distance);
      }

      if (minDistance > maxDistance) return null;

      return {
        ...street,
        distance: minDistance,
      };
    })
    .filter((s): s is StreetSegment & { distance: number } => s !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return streetsWithDistance;
}

// ===== BOUNDARY CONTAINMENT =====

/**
 * Find admin boundaries containing a point
 */
export async function findContainingBoundaries(
  lat: number,
  lon: number,
  level?: 'country' | 'region' | 'county' | 'city' | 'neighborhood'
): Promise<AdminBoundary[]> {
  const db = await getDB();

  let sql = `
    SELECT * FROM admin_boundaries 
    WHERE json_extract(bbox, '$.minLat') <= ? 
      AND json_extract(bbox, '$.maxLat') >= ?
      AND json_extract(bbox, '$.minLon') <= ?
      AND json_extract(bbox, '$.maxLon') >= ?
  `;
  const params: unknown[] = [lat, lat, lon, lon];

  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }

  sql += ' ORDER BY admin_level ASC, area ASC';

  const results = await db.getAllAsync<AdminBoundary & { polygon: string; bbox: string }>(
    sql,
    params
  );

  // Filter by actual polygon containment (more accurate than bbox)
  const containing: AdminBoundary[] = [];
  for (const boundary of results) {
    const polygon = parseJSON<[number, number][]>(boundary.polygon) || [];
    if (polygon.length > 0 && isPointInPolygon(lat, lon, polygon)) {
      containing.push(boundary);
    }
  }

  return containing;
}

// ===== BOUNDING BOX QUERIES =====

/**
 * Find streets in bounding box
 */
export async function findStreetsInBbox(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  limit: number = 100
): Promise<StreetSegment[]> {
  const db = await getDB();

  const results = await db.getAllAsync<StreetSegment & { bbox: string }>(
    `SELECT * FROM street_segments 
     WHERE json_extract(bbox, '$.minLat') <= ? 
       AND json_extract(bbox, '$.maxLat') >= ?
       AND json_extract(bbox, '$.minLon') <= ?
       AND json_extract(bbox, '$.maxLon') >= ?
     LIMIT ?`,
    [bbox.maxLat, bbox.minLat, bbox.maxLon, bbox.minLon, limit]
  );

  return results;
}

/**
 * Find boundaries in bounding box
 */
export async function findBoundariesInBbox(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  level?: 'country' | 'region' | 'county' | 'city' | 'neighborhood'
): Promise<AdminBoundary[]> {
  const db = await getDB();

  let sql = `
    SELECT * FROM admin_boundaries 
    WHERE json_extract(bbox, '$.minLat') <= ? 
      AND json_extract(bbox, '$.maxLat') >= ?
      AND json_extract(bbox, '$.minLon') <= ?
      AND json_extract(bbox, '$.maxLon') >= ?
  `;
  const params: unknown[] = [bbox.maxLat, bbox.minLat, bbox.maxLon, bbox.minLon];

  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }

  const results = await db.getAllAsync<AdminBoundary & { polygon: string; bbox: string }>(
    sql,
    params
  );

  return results;
}
