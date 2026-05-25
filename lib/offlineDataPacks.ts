/**
 * Offline Data Packs
 *
 * Ported from web's docs/src/lib/offlineDataPacks.ts
 * Manages street geometry and admin boundary data for offline reverse geocoding.
 *
 * Phase 2: Uses selectStreets() (access-reality + scoring) for street selection.
 * Phase 3: Will add findConnectedStreetSegments + mergeSegmentGeometries.
 */

import { queryAll, parseJSON } from './db';
import type { StreetSegment, AdminBoundary, DataPackManifest } from './db/schemas';
import { offlineReverseGeocode } from './geocoding/reverseGeocode';
import { getAddressComponentsSync, type OSMStyleAddress } from './geocoding/getAddressComponents';
import { calculateHouseNumberSync } from './createLocationAddress';
import type { Street } from './createLocationAddress';
import { haversineDistance } from './createLocationAddress';
import { createStreetKey } from './streetGeometry';
import { selectStreets, detectContext, determineSide, type RejectedStreet, type AccessType, type CandidateStreet } from './streetSelection';
export type { RejectedStreet, AccessType } from './streetSelection';
import {
  type Bbox,
  type SegmentWithGeometry,
  type MergeGeometryOptions,
  isPointInBbox,
  expandBbox,
  distanceToSegment,
  getStreetDisplayName,
  arePointsConnected,
  findConnectedStreetSegments,
  mergeSegmentGeometries,
  normalizeBbox,
} from './streetGeometryUtils';

export type { AdminBoundary, DataPackManifest };




// ===== STREET OPERATIONS =====

/**
 * Find closest street segments within radius
 */
export async function findClosestStreets(
  lat: number,
  lon: number,
  maxDistance: number = 60
): Promise<Array<{ segment: SegmentWithGeometry; distance: number; projectionPoint: [number, number] }>> {
  const allSegments = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments'
  );
  if (allSegments.length === 0) {
    console.warn('[findClosestStreets] street_segments table is empty; ensure a region pack is downloaded.');
  }

  const expandDeg = maxDistance / 111000; // ~meters to degrees
  const segments: SegmentWithGeometry[] = allSegments.map((s) => {
    const b = normalizeBbox(parseJSON(s.bbox));
    const expanded: Bbox = {
      minLat: b.minLat - expandDeg,
      maxLat: b.maxLat + expandDeg,
      minLon: b.minLon - expandDeg,
      maxLon: b.maxLon + expandDeg,
    };
    return {
      ...s,
      geometry: parseJSON<[number, number][]>(s.geometry) ?? [],
      bbox: expanded,
    };
  });

  const candidates: Array<{ segment: SegmentWithGeometry; distance: number; projectionPoint: [number, number] }> = [];
  let bboxPassCount = 0;

  for (const segment of segments) {
    if (!segment.bbox || !isPointInBbox(lat, lon, segment.bbox)) {
      continue;
    }
    bboxPassCount += 1;

    let minDist = Infinity;
    let closestPoint: [number, number] = [lon, lat];

    for (let i = 0; i < segment.geometry.length - 1; i++) {
      const dist = distanceToSegment([lon, lat], segment.geometry[i], segment.geometry[i + 1]);
      if (dist < minDist) {
        minDist = dist;
        const [x1, y1] = segment.geometry[i];
        const [x2, y2] = segment.geometry[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy)));
        closestPoint = [x1 + t * dx, y1 + t * dy];
      }
    }

    if (minDist <= maxDistance) {
      candidates.push({ segment, distance: minDist, projectionPoint: closestPoint });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const result = candidates.slice(0, 5);
  if (result.length === 0 && allSegments.length > 0) {
    console.warn('[findClosestStreets] No streets within', maxDistance, 'm of', [lat, lon], '| segments:', allSegments.length, 'bboxPass:', bboxPassCount, 'withinDist:', candidates.length);
  }
  return result;
}

// ===== TYPES =====

export interface OfflineReverseGeocodeResult {
  street: {
    name: string;
    segment_id: string;
    distance: number;
    side: 'L' | 'R';
    isUnnamed: boolean;
  } | null;
  activeStreet: {
    name: string;
    segment_id: string;
    distance: number;
    side: 'L' | 'R';
    isUnnamed: boolean;
    geometry: [number, number][];
    projectionPoint: [number, number];
    streetType?: string;
  } | null;
  nearbyStreets: Array<{
    name: string;
    segment_id: string;
    distance: number;
    side: 'L' | 'R';
    isUnnamed: boolean;
    geometry: [number, number][];
    projectionPoint: [number, number];
    streetType?: string;
  }>;
  admin: {
    neighborhood: string | null;
    city: string | null;
    county: string | null;
    region: string | null;
    region_code: string | null;
    country: string | null;
    country_code: string | null;
  };
  houseNumber: number | null;
  chainage: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** Stable key for the active street (for direction lock on save) */
  streetKey?: string;
  /** Phase 2: Rejection reasons for debugging (e.g. INTERVENING_STREET, TOO_FAR) */
  rejectedStreets?: RejectedStreet[];
  /** Phase 2: How the active street was chosen (FRONTAGE vs NON_FRONTAGE_ACCESS) */
  accessType?: AccessType;
  /** Web parity: debug data for dev visualization (street selection panel) */
  debugData?: {
    allCandidates: CandidateStreet[];
    rejectedStreets: RejectedStreet[];
  };
  /** OSM-style address from geocode; use with getAddressComponentsSync for single source of truth */
  osmStyleAddress?: OSMStyleAddress;
}

/**
 * Resolve street address with offline geocoding.
 * Web parity: useAccessRealityAlgorithm true = selectStreets (access-reality); false = legacy findClosestStreets.
 */
export async function resolveStreetAddress(
  lat: number,
  lon: number,
  maxStreetDistance: number = 60,
  useAccessRealityAlgorithm: boolean = true
): Promise<OfflineReverseGeocodeResult> {
  const geocodeResult = await offlineReverseGeocode(lat, lon, { cameroonTuning: true });
  const components = getAddressComponentsSync(geocodeResult.address);
  const admin = geocodeResult.rawAdmin;

  if (useAccessRealityAlgorithm) {
  const context = await detectContext(lat, lon);
  const selectionResult = await selectStreets(lat, lon, {
    context,
    urbanRadius: 60,
    ruralRadius: 100,
    maxFrontageCandidateDistanceUrban: 60,
    maxFrontageCandidateDistanceRural: 100,
    cornerAlternateMaxDistance: 25,
    cornerAlternateMaxAngle: 90,
  });

  const activeStreet = selectionResult.activeStreet;
  const nearbyStreets = selectionResult.candidateStreets;

  const result: OfflineReverseGeocodeResult = {
    street: null,
    activeStreet: null,
    nearbyStreets,
    admin: {
      neighborhood: components.neighborhood,
      city: components.city,
      county: admin.county?.name ?? null,
      region: components.state ?? admin.region?.name ?? null,
      region_code: admin.region?.token ?? null,
      country: components.country ?? admin.country?.name ?? null,
      country_code: components.country_code ?? admin.country?.country_code ?? null,
    },
    houseNumber: null,
    chainage: null,
    confidence: 'low',
    rejectedStreets: selectionResult.rejectedStreets,
    accessType: selectionResult.accessType,
    debugData: {
      allCandidates: selectionResult.allCandidates,
      rejectedStreets: selectionResult.rejectedStreets,
    },
    osmStyleAddress: geocodeResult.address,
  };

  if (activeStreet) {
    const distance = activeStreet.distance;

    result.street = {
      name: activeStreet.name,
      segment_id: activeStreet.segment_id,
      distance,
      side: activeStreet.side,
      isUnnamed: activeStreet.isUnnamed,
    };
    result.activeStreet = activeStreet;

    // createLocationAddress expects geometry as [lat, lon][]
    const streetForCalc: Street = {
      id: activeStreet.segment_id,
      name: activeStreet.name,
      osm_id: parseInt(activeStreet.segment_id.split('-')[0], 10) || 0,
      geometry: activeStreet.geometry.map(([lonCoord, latCoord]) => [latCoord, lonCoord] as [number, number]),
      direction_locked: false,
    };

    const nearbyStreetsForCalc = nearbyStreets
      .filter((s) => s.segment_id !== activeStreet.segment_id)
      .map((s) => ({
        id: s.segment_id,
        name: s.name,
        osm_id: parseInt(s.segment_id.split('-')[0], 10) || 0,
        geometry: s.geometry.map(([lonCoord, latCoord]) => [latCoord, lonCoord] as [number, number]),
        direction_locked: false,
      }));

    const streetKey = createStreetKey(streetForCalc);
    // Match web: do NOT pass directionLock into house number calculation so we use raw OSM
    // geometry order (same as web). This ensures same spot produces same numbers as web.
    const calculatedAddress = calculateHouseNumberSync(lat, lon, streetForCalc, {
      nearbyStreets: nearbyStreetsForCalc,
    });

    if (calculatedAddress) {
      result.houseNumber = calculatedAddress.houseNumber;
      result.chainage = parseFloat(calculatedAddress.chainage);
      if (calculatedAddress.side) {
        result.street.side = calculatedAddress.side;
        if (result.activeStreet) result.activeStreet.side = calculatedAddress.side;
      }
      if (calculatedAddress.street !== activeStreet.name) {
        result.street.name = calculatedAddress.street;
        if (result.activeStreet) result.activeStreet.name = calculatedAddress.street;
      }
    }

    result.confidence = distance < 20 ? 'high' : distance < 40 ? 'medium' : 'low';
    result.streetKey = streetKey;
  }

  return result;
  }

  // === LEGACY ALGORITHM (distance-based, web parity) ===
  const streets = await findClosestStreets(lat, lon, maxStreetDistance);
  const closestStreet = streets[0] ?? null;

  const nearbyStreetsLegacy: OfflineReverseGeocodeResult['nearbyStreets'] = streets.map(
    ({ segment, distance, projectionPoint }) => {
      const startIdx = 0;
      const endIdx = Math.min(1, segment.geometry.length - 1);
      const side = determineSide([lon, lat], segment.geometry[startIdx], segment.geometry[endIdx]);
      return {
        name: getStreetDisplayName(segment),
        segment_id: segment.id,
        distance,
        side,
        isUnnamed: !segment.name && !segment.ref,
        geometry: segment.geometry,
        projectionPoint,
        streetType: segment.street_type,
      };
    }
  );

  const resultLegacy: OfflineReverseGeocodeResult = {
    street: null,
    activeStreet: null,
    nearbyStreets: nearbyStreetsLegacy,
    admin: {
      neighborhood: components.neighborhood,
      city: components.city,
      county: admin.county?.name ?? null,
      region: components.state ?? admin.region?.name ?? null,
      region_code: admin.region?.token ?? null,
      country: components.country ?? admin.country?.name ?? null,
      country_code: components.country_code ?? admin.country?.country_code ?? null,
    },
    houseNumber: null,
    chainage: null,
    confidence: 'low',
    osmStyleAddress: geocodeResult.address,
  };

  if (closestStreet) {
    const { segment, distance, projectionPoint } = closestStreet;
    const startIdx = 0;
    const endIdx = Math.min(1, segment.geometry.length - 1);
    const side = determineSide([lon, lat], segment.geometry[startIdx], segment.geometry[endIdx]);

    resultLegacy.street = {
      name: getStreetDisplayName(segment),
      segment_id: segment.id,
      distance,
      side,
      isUnnamed: !segment.name && !segment.ref,
    };

    let fullStreetGeometry = segment.geometry;
    try {
      const connectedSegments = await findConnectedStreetSegments(segment);
      if (connectedSegments.length > 1) {
        fullStreetGeometry = mergeSegmentGeometries(connectedSegments);
      }
    } catch (e) {
      console.warn('[resolveStreetAddress] Legacy merge failed:', e);
    }

    resultLegacy.activeStreet = {
      name: getStreetDisplayName(segment),
      segment_id: segment.id,
      distance,
      side,
      isUnnamed: !segment.name && !segment.ref,
      geometry: fullStreetGeometry,
      projectionPoint,
      streetType: segment.street_type,
    };

    const streetForCalc: Street = {
      id: segment.id,
      name: getStreetDisplayName(segment),
      osm_id: parseInt(segment.id.split('-')[0], 10) || 0,
      geometry: fullStreetGeometry.map(([lonCoord, latCoord]) => [latCoord, lonCoord] as [number, number]),
      direction_locked: false,
    };

    const nearbyStreetsForCalc = streets
      .filter((s) => s.segment.id !== segment.id)
      .map((s) => ({
        id: s.segment.id,
        name: getStreetDisplayName(s.segment),
        osm_id: parseInt(s.segment.id.split('-')[0], 10) || 0,
        geometry: s.segment.geometry.map(([lonCoord, latCoord]) => [latCoord, lonCoord] as [number, number]),
        direction_locked: false,
      }));

    const calculatedAddress = calculateHouseNumberSync(lat, lon, streetForCalc, {
      nearbyStreets: nearbyStreetsForCalc,
    });
    if (calculatedAddress) {
      resultLegacy.houseNumber = calculatedAddress.houseNumber;
      resultLegacy.chainage = parseFloat(calculatedAddress.chainage);
      if (resultLegacy.street) resultLegacy.street.side = calculatedAddress.side;
      if (resultLegacy.activeStreet) resultLegacy.activeStreet.side = calculatedAddress.side;
      if (calculatedAddress.street !== getStreetDisplayName(segment)) {
        if (resultLegacy.street) resultLegacy.street.name = calculatedAddress.street;
        if (resultLegacy.activeStreet) resultLegacy.activeStreet.name = calculatedAddress.street;
      }
    }
    resultLegacy.confidence = distance < 20 ? 'high' : distance < 40 ? 'medium' : 'low';
    resultLegacy.streetKey = createStreetKey(streetForCalc);
  }

  return resultLegacy;
}
