/**
 * Street Selection Algorithm - Access Reality First
 *
 * Replaces simple distance-based selection with access-reality-first algorithm.
 * Ported from docs/src/lib/streetSelection.ts. All data from SQLite + in-memory; no network.
 * Phase 2: selectStreets, findInterveningStreets, findStreetIntersection, scoring.
 * Phase 3: Uses findConnectedStreetSegments + mergeSegmentGeometries for merged geometry.
 *
 * Spec reference (Phase 9):
 * - Implementation guide: docs/Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide.md
 * - Web reference: docs/src/lib/streetSelection.ts
 */

import { queryAll, parseJSON } from './db';
import type { StreetSegment } from './db/schemas';
import {
  expandBbox,
  isPointInBbox,
  getStreetDisplayName,
  findConnectedStreetSegments,
  mergeSegmentGeometries,
  normalizeBbox,
  type Bbox,
  type SegmentWithGeometry,
} from './streetGeometryUtils';
import { normalizeStreetKey, getMergeAnchorFromLock } from './streetDirectionService';
import { haversineDistance } from './createLocationAddress';
import { adaptiveProjection, type AdaptiveProjectionResult } from './createLocationAddress';

// ===== CONFIG =====

export interface StreetSelectionConfig {
  urbanRadius: number;
  ruralRadius: number;
  maxFrontageCandidateDistanceUrban: number;
  maxFrontageCandidateDistanceRural: number;
  cornerAlternateMaxDistance: number;
  cornerAlternateMaxAngle: number;
  context: 'urban' | 'rural';
}

export const DEFAULT_CONFIG: StreetSelectionConfig = {
  urbanRadius: 60,
  ruralRadius: 100,
  maxFrontageCandidateDistanceUrban: 60,
  maxFrontageCandidateDistanceRural: 100,
  cornerAlternateMaxDistance: 25,
  cornerAlternateMaxAngle: 90,
  context: 'urban',
};

// ===== REJECTION REASONS =====

export type RejectionReason =
  | 'INTERVENING_STREET'
  | 'BARRIER_BLOCK'
  | 'BARRIER_PENALTY'
  | 'TOO_FAR'
  | 'ORIENTATION_INVALID'
  | 'NO_INTERSECTION';

export interface RejectedStreet {
  segmentId: string;
  streetName: string;
  reason: RejectionReason;
  distance: number;
  geometry?: [number, number][];
}

// ===== CANDIDATE & RESULT =====

export interface CandidateStreet {
  segment: SegmentWithGeometry;
  distance: number;
  distanceScore: number;
  projectionPoint: [number, number];
  hasInterveningStreet: boolean;
  interveningStreetIds: string[];
  enclosureScore: number;
  roadClassTieBreaker: number;
  totalScore: number;
  side: 'L' | 'R';
}

export interface ActiveStreetData {
  name: string;
  segment_id: string;
  distance: number;
  side: 'L' | 'R';
  isUnnamed: boolean;
  geometry: [number, number][];
  projectionPoint: [number, number];
  streetType: string;
}

export type AccessType = 'FRONTAGE' | 'NON_FRONTAGE_ACCESS';

export interface StreetSelectionResult {
  activeStreet: ActiveStreetData | null;
  candidateStreets: ActiveStreetData[];
  cornerAlternateStreets: ActiveStreetData[];
  alternateStreets: ActiveStreetData[];
  accessType: AccessType;
  rejectedStreets: RejectedStreet[];
  allCandidates: CandidateStreet[];
}

// ===== HAVERSINE (segment geometry is [lon, lat]) =====

function haversineLonLat(a: [number, number], b: [number, number]): number {
  return haversineDistance([a[1], a[0]], [b[1], b[0]]);
}

// ===== GEOMETRY HELPERS =====

function findNearestPointOnStreetAdaptive(
  location: [number, number],
  geometry: [number, number][]
): { point: [number, number]; distance: number; segmentIndex: number; projectionResult: AdaptiveProjectionResult } {
  const centroidLatLon: [number, number] = [location[1], location[0]];
  const geometryLatLon = geometry.map(([lon, lat]) => [lat, lon] as [number, number]);
  const projectionResult = adaptiveProjection(centroidLatLon, geometryLatLon);
  const pointLonLat: [number, number] = [projectionResult.snapPoint[1], projectionResult.snapPoint[0]];
  return {
    point: pointLonLat,
    distance: projectionResult.distance,
    segmentIndex: projectionResult.segmentIndex,
    projectionResult,
  };
}

function findNearestPointOnStreetPerpendicular(
  location: [number, number],
  geometry: [number, number][]
): { point: [number, number]; distance: number; segmentIndex: number } {
  let minDist = Infinity;
  let nearestPoint: [number, number] = geometry[0];
  let segmentIndex = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const start = geometry[i];
    const end = geometry[i + 1];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((location[0] - start[0]) * dx + (location[1] - start[1]) * dy) / lenSq));
    }
    const projPoint: [number, number] = [start[0] + t * dx, start[1] + t * dy];
    const dist = haversineLonLat(location, projPoint);
    if (dist < minDist) {
      minDist = dist;
      nearestPoint = projPoint;
      segmentIndex = i;
    }
  }
  return { point: nearestPoint, distance: minDist, segmentIndex };
}

function lineSegmentIntersection(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
): [number, number] | null {
  const dxa = a2[0] - a1[0];
  const dya = a2[1] - a1[1];
  const dxb = b2[0] - b1[0];
  const dyb = b2[1] - b1[1];
  const denom = dxa * dyb - dya * dxb;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((b1[0] - a1[0]) * dyb - (b1[1] - a1[1]) * dxb) / denom;
  const u = ((b1[0] - a1[0]) * dya - (b1[1] - a1[1]) * dxa) / denom;
  const eps = 0.01;
  if (t >= eps && t <= 1 - eps && u >= eps && u <= 1 - eps) {
    return [a1[0] + t * dxa, a1[1] + t * dya];
  }
  return null;
}

function findInterveningStreets(
  location: [number, number],
  projectionPoint: [number, number],
  candidateSegmentId: string,
  candidateDistance: number,
  allStreets: SegmentWithGeometry[]
): string[] {
  const interveningIds: string[] = [];
  for (const street of allStreets) {
    if (street.id === candidateSegmentId) continue;
    for (let i = 0; i < street.geometry.length - 1; i++) {
      const intersection = lineSegmentIntersection(
        location,
        projectionPoint,
        street.geometry[i],
        street.geometry[i + 1]
      );
      if (intersection) {
        const crossedStreetDistance = haversineLonLat(location, intersection);
        if (crossedStreetDistance < candidateDistance * 0.95) {
          if (!interveningIds.includes(street.id)) interveningIds.push(street.id);
        }
        break;
      }
    }
  }
  return interveningIds;
}

const T_JUNCTION_TOLERANCE_METERS = 15;

export function findStreetIntersection(
  geometry1: [number, number][],
  geometry2: [number, number][]
): [number, number] | null {
  for (let i = 0; i < geometry1.length - 1; i++) {
    for (let j = 0; j < geometry2.length - 1; j++) {
      const intersection = lineSegmentIntersection(
        geometry1[i],
        geometry1[i + 1],
        geometry2[j],
        geometry2[j + 1]
      );
      if (intersection) return intersection;
    }
  }
  const endpoints1 = [geometry1[0], geometry1[geometry1.length - 1]];
  for (const endpoint of endpoints1) {
    const { point, distance } = findNearestPointOnStreetPerpendicular(endpoint, geometry2);
    if (distance <= T_JUNCTION_TOLERANCE_METERS) return point;
  }
  const endpoints2 = [geometry2[0], geometry2[geometry2.length - 1]];
  for (const endpoint of endpoints2) {
    const { point, distance } = findNearestPointOnStreetPerpendicular(endpoint, geometry1);
    if (distance <= T_JUNCTION_TOLERANCE_METERS) return point;
  }
  return null;
}

function calculateStreetAngle(
  geometry1: [number, number][],
  geometry2: [number, number][]
): number {
  const mid1 = Math.floor(geometry1.length / 2);
  const dir1: [number, number] = [
    geometry1[Math.min(mid1 + 1, geometry1.length - 1)][0] - geometry1[mid1][0],
    geometry1[Math.min(mid1 + 1, geometry1.length - 1)][1] - geometry1[mid1][1],
  ];
  const mid2 = Math.floor(geometry2.length / 2);
  const dir2: [number, number] = [
    geometry2[Math.min(mid2 + 1, geometry2.length - 1)][0] - geometry2[mid2][0],
    geometry2[Math.min(mid2 + 1, geometry2.length - 1)][1] - geometry2[mid2][1],
  ];
  const len1 = Math.sqrt(dir1[0] ** 2 + dir1[1] ** 2);
  const len2 = Math.sqrt(dir2[0] ** 2 + dir2[1] ** 2);
  if (len1 === 0 || len2 === 0) return 0;
  const dot = (dir1[0] * dir2[0] + dir1[1] * dir2[1]) / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, Math.abs(dot)))) * (180 / Math.PI);
}

/** Web parity: point and line points are [lon, lat]. Used by legacy resolve path. */
export function determineSide(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): 'L' | 'R' {
  const cross =
    (lineEnd[0] - lineStart[0]) * (point[1] - lineStart[1]) -
    (lineEnd[1] - lineStart[1]) * (point[0] - lineStart[0]);
  return cross < 0 ? 'L' : 'R';
}

// ===== SCORING =====

const ROAD_CLASS_PRIORITY: Record<string, number> = {
  residential: 1.0,
  service: 0.95,
  living_street: 0.95,
  unclassified: 0.9,
  tertiary: 0.8,
  tertiary_link: 0.8,
  secondary: 0.6,
  secondary_link: 0.6,
  primary: 0.4,
  primary_link: 0.4,
  trunk: 0.2,
  trunk_link: 0.2,
  motorway: 0.1,
  motorway_link: 0.1,
};

function calculateDistanceScore(distance: number, maxRadius: number): number {
  if (distance >= maxRadius) return 0;
  return 1 - distance / maxRadius;
}

function calculateEnclosureScore(
  location: [number, number],
  projectionPoint: [number, number],
  _geometry: [number, number][],
  hasInterveningStreet: boolean
): number {
  if (hasInterveningStreet) return 0;
  const distance = haversineLonLat(location, projectionPoint);
  const baseScore = Math.exp(-distance / 30);
  return Math.min(1, baseScore);
}

function calculateRoadClassTieBreaker(streetType: string): number {
  return ROAD_CLASS_PRIORITY[streetType] ?? 0.5;
}

function calculateIntersectionProximityScore(
  location: [number, number],
  intersectionPoint: [number, number] | null,
  maxDistance: number
): number {
  if (!intersectionPoint) return 0;
  const distance = haversineLonLat(location, intersectionPoint);
  if (distance >= maxDistance) return 0;
  return 1 - distance / maxDistance;
}

// ===== MAIN: SELECT STREETS =====

export async function selectStreets(
  lat: number,
  lon: number,
  config: Partial<StreetSelectionConfig> = {}
): Promise<StreetSelectionResult> {
  const cfg: StreetSelectionConfig = { ...DEFAULT_CONFIG, ...config };
  const searchRadius = cfg.context === 'urban' ? cfg.urbanRadius : cfg.ruralRadius;
  const location: [number, number] = [lon, lat];

  const rows = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments'
  );
  const allSegments: SegmentWithGeometry[] = rows.map((r) => {
    const b = normalizeBbox(parseJSON(r.bbox));
    return {
      ...r,
      geometry: parseJSON<[number, number][]>(r.geometry) ?? [],
      bbox: b,
    };
  });

  const candidates: CandidateStreet[] = [];
  const rejectedStreets: RejectedStreet[] = [];

  for (const segment of allSegments) {
    const segmentBbox = expandBbox(segment.bbox, searchRadius);
    if (!isPointInBbox(lat, lon, segmentBbox)) continue;

    const { point: projectionPoint, distance, segmentIndex, projectionResult } =
      findNearestPointOnStreetAdaptive(location, segment.geometry);

    if (distance > searchRadius) {
      rejectedStreets.push({
        segmentId: segment.id,
        streetName: getStreetDisplayName(segment),
        reason: 'TOO_FAR',
        distance,
        geometry: segment.geometry,
      });
      continue;
    }

    const maxFrontageDistance =
      cfg.context === 'urban' ? cfg.maxFrontageCandidateDistanceUrban : cfg.maxFrontageCandidateDistanceRural;
    if (distance > maxFrontageDistance) {
      rejectedStreets.push({
        segmentId: segment.id,
        streetName: getStreetDisplayName(segment),
        reason: 'TOO_FAR',
        distance,
        geometry: segment.geometry,
      });
      continue;
    }

    const interveningStreetIds = findInterveningStreets(
      location,
      projectionPoint,
      segment.id,
      distance,
      allSegments
    );
    const hasInterveningStreet = interveningStreetIds.length > 0;

    if (hasInterveningStreet) {
      rejectedStreets.push({
        segmentId: segment.id,
        streetName: getStreetDisplayName(segment),
        reason: 'INTERVENING_STREET',
        distance,
        geometry: segment.geometry,
      });
      continue;
    }

    const distanceScore = calculateDistanceScore(distance, searchRadius);
    const enclosureScore = calculateEnclosureScore(
      location,
      projectionPoint,
      segment.geometry,
      hasInterveningStreet
    );
    const roadClassTieBreaker = calculateRoadClassTieBreaker(segment.street_type);
    const segStart = segment.geometry[segmentIndex];
    const segEnd = segment.geometry[Math.min(segmentIndex + 1, segment.geometry.length - 1)];
    const side = determineSide(location, segStart, segEnd);
    const totalScore = distanceScore * 0.5 + enclosureScore * 0.4 + roadClassTieBreaker * 0.1;

    candidates.push({
      segment,
      distance,
      distanceScore,
      projectionPoint,
      hasInterveningStreet,
      interveningStreetIds,
      enclosureScore,
      roadClassTieBreaker,
      totalScore,
      side,
    });
  }

  candidates.sort((a, b) => b.totalScore - a.totalScore);
  const allCandidatesSnapshot = [...candidates];

  let accessType: AccessType = 'FRONTAGE';
  let activeCandidate: CandidateStreet | null = null;

  if (candidates.length === 0) {
    const fallbackCandidates = rejectedStreets
      .filter((r) => r.reason === 'INTERVENING_STREET')
      .sort((a, b) => a.distance - b.distance);
    if (fallbackCandidates.length > 0) {
      const fallbackRejected = fallbackCandidates[0];
      const fallbackSegment = allSegments.find((s) => s.id === fallbackRejected.segmentId);
      if (fallbackSegment) {
        const { point: projectionPoint, distance, segmentIndex } = findNearestPointOnStreetAdaptive(
          location,
          fallbackSegment.geometry
        );
        const segStart = fallbackSegment.geometry[segmentIndex];
        const segEnd = fallbackSegment.geometry[Math.min(segmentIndex + 1, fallbackSegment.geometry.length - 1)];
        const side = determineSide(location, segStart, segEnd);
        activeCandidate = {
          segment: fallbackSegment,
          distance,
          distanceScore: calculateDistanceScore(distance, searchRadius),
          projectionPoint,
          hasInterveningStreet: true,
          interveningStreetIds: [],
          enclosureScore: 0,
          roadClassTieBreaker: calculateRoadClassTieBreaker(fallbackSegment.street_type),
          totalScore: 0,
          side,
        };
        accessType = 'NON_FRONTAGE_ACCESS';
      }
    }
    if (!activeCandidate) {
      return {
        activeStreet: null,
        candidateStreets: [],
        cornerAlternateStreets: [],
        alternateStreets: [],
        accessType: 'NON_FRONTAGE_ACCESS',
        rejectedStreets,
        allCandidates: allCandidatesSnapshot,
      };
    }
  } else {
    activeCandidate = candidates[0];
  }

  // Phase 3: merge connected segments with direction-lock anchor for deterministic geometry
  let activeGeometry = activeCandidate.segment.geometry;
  try {
    const connectedSegments = await findConnectedStreetSegments(activeCandidate.segment);
    const streetName = getStreetDisplayName(activeCandidate.segment);
    const streetKey = normalizeStreetKey(streetName);
    const { anchorPoint, shouldReverseAfterMerge } = await getMergeAnchorFromLock(
      connectedSegments,
      streetKey
    );
    if (connectedSegments.length > 1) {
      activeGeometry = mergeSegmentGeometries(connectedSegments, {
        anchorPoint,
        shouldReverseAfterMerge,
      });
    } else if (shouldReverseAfterMerge) {
      activeGeometry = [...activeCandidate.segment.geometry].reverse();
    }
  } catch (e) {
    console.warn('[StreetSelection] Merge failed, using single-segment geometry:', e);
  }

  const activeStreet: ActiveStreetData = {
    name: getStreetDisplayName(activeCandidate.segment),
    segment_id: activeCandidate.segment.id,
    distance: activeCandidate.distance,
    side: activeCandidate.side,
    isUnnamed: !activeCandidate.segment.name && !activeCandidate.segment.ref,
    geometry: activeGeometry,
    projectionPoint: activeCandidate.projectionPoint,
    streetType: activeCandidate.segment.street_type,
  };

  const candidateStreets: ActiveStreetData[] = [activeStreet];
  for (const candidate of candidates.slice(1)) {
    candidateStreets.push({
      name: getStreetDisplayName(candidate.segment),
      segment_id: candidate.segment.id,
      distance: candidate.distance,
      side: candidate.side,
      isUnnamed: !candidate.segment.name && !candidate.segment.ref,
      geometry: candidate.segment.geometry,
      projectionPoint: candidate.projectionPoint,
      streetType: candidate.segment.street_type,
    });
  }
  const limitedCandidateStreets = candidateStreets.slice(0, 5);

  const cornerAlternateStreets: ActiveStreetData[] = [];
  for (const candidate of candidates.slice(1)) {
    if (candidate.distance > cfg.cornerAlternateMaxDistance) continue;
    const intersectionPoint = findStreetIntersection(
      candidate.segment.geometry,
      activeCandidate.segment.geometry
    );
    if (!intersectionPoint) continue;
    const orientationAngle = calculateStreetAngle(
      candidate.segment.geometry,
      activeCandidate.segment.geometry
    );
    if (orientationAngle > cfg.cornerAlternateMaxAngle) continue;
    let altGeometry = candidate.segment.geometry;
    try {
      const connectedSegments = await findConnectedStreetSegments(candidate.segment);
      if (connectedSegments.length > 1) {
        altGeometry = mergeSegmentGeometries(connectedSegments);
      }
    } catch {
      // Use single-segment geometry if merge fails
    }
    cornerAlternateStreets.push({
      name: getStreetDisplayName(candidate.segment),
      segment_id: candidate.segment.id,
      distance: candidate.distance,
      side: candidate.side,
      isUnnamed: !candidate.segment.name && !candidate.segment.ref,
      geometry: altGeometry,
      projectionPoint: candidate.projectionPoint,
      streetType: candidate.segment.street_type,
    });
  }
  cornerAlternateStreets.sort((a, b) => a.distance - b.distance);
  const limitedCornerAlternates = cornerAlternateStreets.slice(0, 4);

  return {
    activeStreet,
    candidateStreets: limitedCandidateStreets,
    cornerAlternateStreets: limitedCornerAlternates,
    alternateStreets: limitedCornerAlternates,
    accessType,
    rejectedStreets,
    allCandidates: allCandidatesSnapshot,
  };
}

/**
 * Determine context (urban/rural) based on street density within rural radius.
 */
export async function detectContext(lat: number, lon: number): Promise<'urban' | 'rural'> {
  const rows = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments'
  );
  const allSegments: SegmentWithGeometry[] = rows.map((r) => {
    const b = normalizeBbox(parseJSON(r.bbox));
    return {
      ...r,
      geometry: parseJSON<[number, number][]>(r.geometry) ?? [],
      bbox: b,
    };
  });
  const CONTEXT_DETECTION_RADIUS = DEFAULT_CONFIG.ruralRadius;
  const searchBbox = expandBbox(
    { minLat: lat, maxLat: lat, minLon: lon, maxLon: lon },
    CONTEXT_DETECTION_RADIUS
  );
  let count = 0;
  for (const segment of allSegments) {
    const segmentBbox = expandBbox(segment.bbox, CONTEXT_DETECTION_RADIUS);
    if (!isPointInBbox(lat, lon, segmentBbox)) continue;
    const { distance } = findNearestPointOnStreetAdaptive([lon, lat], segment.geometry);
    if (distance <= CONTEXT_DETECTION_RADIUS) count++;
  }
  return count > 3 ? 'urban' : 'rural';
}
