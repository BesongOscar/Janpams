/**
 * Offline Reverse Geocode (Nominatim-Compatible)
 * 
 * Ported from web's docs/src/lib/geocoding/reverseGeocode.ts
 * Returns a Nominatim-compatible address object with separate fields
 * for suburb, neighbourhood, village, hamlet, city, town, etc.
 */

import { findAdminBoundaries, AdminResult } from './adminResolver';
import { findSettlements, SettlementResult, SettlementResolverOptions, SettlementCandidate } from './settlementResolver';
import { getNearestPOI } from '../db/pois';
import type { NearestPOIResult } from '../db/pois';

// ===== TYPES =====

/**
 * OSM-style address object (Nominatim-compatible structure)
 */
export interface OSMStyleAddress {
  // Settlement places (granular to broad)
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;

  // Admin boundaries
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;

  // Postal
  postcode?: string;

  // Road (populated by street resolver, not here)
  road?: string;
}

/**
 * Confidence scoring per spec
 */
export type ConfidenceMethod = 'polygon' | 'proximity' | 'fallback';

export interface ConfidenceInfo {
  score: number; // 0.0 - 1.0
  method: ConfidenceMethod;
}

/**
 * Full geocode result with Nominatim-compatible address
 */
export interface OfflineGeocodeResult {
  /** OSM-style address object (Nominatim-compatible structure) */
  address: OSMStyleAddress;

  /** Confidence scoring */
  confidence: ConfidenceInfo;

  /** Raw admin boundaries (for debugging) */
  rawAdmin: AdminResult;

  /** Raw settlement result (for debugging) */
  rawSettlements: SettlementResult;

  /** Best settlement candidate used */
  bestCandidate: SettlementCandidate | null;

  /** Nearest POI when includePOI is true (Phase 6.2) */
  nearestPOI?: NearestPOIResult | null;
}

export interface OfflineGeocodeOptions {
  /** Filter to specific data pack(s) */
  packIds?: string[];
  /** Maximum search radius in meters */
  maxRadius?: number;
  /** Maximum settlement candidates */
  maxCandidates?: number;
  /** Enable Cameroon-specific tuning */
  cameroonTuning?: boolean;
  /** Include nearest POI in result (Phase 6.2) */
  includePOI?: boolean;
  /** Max radius for nearest POI in meters */
  poiMaxRadius?: number;
}

// ===== CONFIDENCE SCORING =====

const CONFIDENCE_SCORES: Record<ConfidenceMethod, number> = {
  polygon: 0.95,
  proximity: 0.70,
  fallback: 0.40,
};

function calculateConfidence(candidate: SettlementCandidate | null): ConfidenceInfo {
  if (!candidate) {
    return { score: CONFIDENCE_SCORES.fallback, method: 'fallback' };
  }

  if (candidate.isContained) {
    return { score: CONFIDENCE_SCORES.polygon, method: 'polygon' };
  }

  // Proximity-based - scale by distance
  const baseScore = CONFIDENCE_SCORES.proximity;
  const distancePenalty = Math.min(candidate.distance / 5000, 0.3); // Max 30% penalty
  return {
    score: Math.max(0.4, baseScore - distancePenalty),
    method: 'proximity',
  };
}

// ===== HELPER: Get best candidate by type =====

function getBestByType(
  candidates: SettlementCandidate[],
  placeTypes: string[]
): SettlementCandidate | null {
  for (const type of placeTypes) {
    const matching = candidates.filter(c => c.place.place === type);
    if (matching.length > 0) {
      // Return best (already sorted by containment/score)
      return matching[0];
    }
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Perform offline reverse geocoding with Nominatim-compatible output
 * 
 * Strategy:
 * 1. Resolve admin boundaries (country, region, county)
 * 2. Skip settlement resolution if no country boundary found
 * 3. Resolve settlements with scoring
 * 4. Populate separate address fields (don't collapse into city/neighborhood)
 * 5. Let consumer (getAddressComponents) apply priority logic
 */
export async function offlineReverseGeocode(
  lat: number,
  lon: number,
  options: OfflineGeocodeOptions = {}
): Promise<OfflineGeocodeResult> {
  const {
    packIds,
    maxRadius = 15000,
    maxCandidates = 200,
    cameroonTuning = false,
    includePOI = false,
    poiMaxRadius = 500,
  } = options;

  console.log(`[ReverseGeocode] Starting for (${lat}, ${lon})`);

  // Step 1: Resolve admin boundaries
  const adminResult = await findAdminBoundaries(lat, lon, { packIds });

  // Step 2: If no country boundary found, skip settlement resolution entirely
  // to avoid returning settlements from a different region/country
  if (!adminResult.country) {
    console.log('[ReverseGeocode] No country boundary found - skipping settlement resolution');
    const address: OSMStyleAddress = {};
    const result: OfflineGeocodeResult = {
      address,
      confidence: { score: 0, method: 'fallback' },
      rawAdmin: adminResult,
      rawSettlements: null as any,
      bestCandidate: null,
      nearestPOI: null,
    };
    return result;
  }

  // Step 3: Resolve settlements with scoring
  const settlementOptions: SettlementResolverOptions = {
    packIds,
    maxRadius,
    maxCandidates,
    cameroonTuning,
  };
  const settlementResult = await findSettlements(lat, lon, settlementOptions);

  // Step 4: Build OSM-style address (Nominatim-compatible structure)
  // Populate each field separately - don't collapse
  const address: OSMStyleAddress = {};

  // Admin boundaries
  if (adminResult.country) {
    address.country = adminResult.country.name;
    address.country_code = adminResult.country.country_code || undefined;
  }
  if (adminResult.region) {
    address.state = adminResult.region.name;
  }
  if (adminResult.county) {
    address.county = adminResult.county.name;
  }

  // Settlement places - populate each type separately
  // Find best candidate for each type
  const allCandidates = settlementResult.allCandidates;

  // City-level settlements
  const bestCity = getBestByType(allCandidates, ['city']);
  if (bestCity) address.city = bestCity.place.name;

  const bestTown = getBestByType(allCandidates, ['town']);
  if (bestTown) address.town = bestTown.place.name;

  const bestVillage = getBestByType(allCandidates, ['village']);
  if (bestVillage) address.village = bestVillage.place.name;

  const bestCityDistrict = getBestByType(allCandidates, ['city_district']);
  if (bestCityDistrict) address.city_district = bestCityDistrict.place.name;

  // Neighborhood-level settlements
  const bestSuburb = getBestByType(allCandidates, ['suburb']);
  if (bestSuburb) address.suburb = bestSuburb.place.name;

  const bestNeighbourhood = getBestByType(allCandidates, ['neighbourhood', 'neighborhood']);
  if (bestNeighbourhood) address.neighbourhood = bestNeighbourhood.place.name;

  const bestQuarter = getBestByType(allCandidates, ['quarter']);
  if (bestQuarter) address.quarter = bestQuarter.place.name;

  const bestHamlet = getBestByType(allCandidates, ['hamlet']);
  if (bestHamlet) address.hamlet = bestHamlet.place.name;

  const bestPostcode = getBestByType(allCandidates, ['postcode']);
  if (bestPostcode) address.postcode = bestPostcode.place.name;

  // Fallback: use admin boundaries for city if no settlements found
  if (!address.city && !address.town && !address.village) {
    if (adminResult.city) {
      address.city = adminResult.city.name;
    }
  }

  // Fallback: use admin boundaries for neighborhood if no settlements found
  if (!address.suburb && !address.neighbourhood && !address.quarter) {
    if (adminResult.neighborhood) {
      address.neighbourhood = adminResult.neighborhood.name;
    }
  }

  // Step 5: Calculate confidence
  const bestCandidate = settlementResult.bestContained || settlementResult.bestFallback;
  const confidence = calculateConfidence(bestCandidate);

  let nearestPOI: NearestPOIResult | null = null;
  if (includePOI) {
    nearestPOI = await getNearestPOI(lat, lon, { packIds, maxRadiusMeters: poiMaxRadius });
  }

  const result: OfflineGeocodeResult = {
    address,
    confidence,
    rawAdmin: adminResult,
    rawSettlements: settlementResult,
    bestCandidate,
    nearestPOI: includePOI ? nearestPOI : undefined,
  };

  console.log('[ReverseGeocode] Final result:', {
    address,
    confidence,
    bestCandidate: bestCandidate?.place.name || null,
  });

  return result;
}
