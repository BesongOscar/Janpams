/**
 * Normalization Layer (Nominatim-Compatible)
 * 
 * Ported from web's docs/src/lib/geocoding/normalization.ts
 * Implements city/neighborhood selection with priority matching Nominatim output.
 */

import { SettlementResult, SettlementCandidate } from './settlementResolver';
import { AdminResult } from './adminResolver';

// ===== TYPES =====

export interface NormalizedLocation {
  city: string | null;
  citySource: 'settlement' | 'admin' | null;
  neighborhood: string | null;
  neighborhoodSource: 'settlement' | 'admin' | null;
}

// ===== HELPER: Get best candidate =====

function getBestCandidate(candidates: SettlementCandidate[]): SettlementCandidate | null {
  if (candidates.length === 0) return null;

  // Prefer contained, then closest
  const contained = candidates.filter(c => c.isContained);
  if (contained.length > 0) {
    // Return the closest contained
    return contained.reduce((best, c) => c.distance < best.distance ? c : best);
  }

  // No contained, return closest
  return candidates[0]; // Already sorted by distance
}

// ===== MAIN NORMALIZATION (Step 7) =====

export interface NormalizationOptions {
  /** Admin boundaries result */
  admin: AdminResult;
  /** Settlement places result */
  settlements: SettlementResult;
}

/**
 * Normalize city and neighborhood from admin + settlement data
 * 
 * Implements Mbukanji v2 rules for village promotion/demotion
 */
export function normalizeLocation(options: NormalizationOptions): NormalizedLocation {
  const { admin, settlements } = options;

  const result: NormalizedLocation = {
    city: null,
    citySource: null,
    neighborhood: null,
    neighborhoodSource: null,
  };

  // ===== CITY SELECTION =====
  // Priority: city_district > city > town > village

  let chosenCity: SettlementCandidate | null = null;

  // 1) city_district
  chosenCity = getBestCandidate(settlements.cityDistricts);

  // 2) city
  if (!chosenCity) {
    chosenCity = getBestCandidate(settlements.cities);
  }

  // 3) town
  if (!chosenCity) {
    chosenCity = getBestCandidate(settlements.towns);
  }

  // 4) village (promoted to city if no other option)
  if (!chosenCity) {
    chosenCity = getBestCandidate(settlements.villages);
  }

  if (chosenCity) {
    result.city = chosenCity.place.name;
    result.citySource = 'settlement';
    console.log(`[Normalization] City from settlement: "${result.city}" (${chosenCity.place.place})`);
  } else if (admin.city) {
    // Fallback to admin.city
    result.city = admin.city.name;
    result.citySource = 'admin';
    console.log(`[Normalization] City from admin: "${result.city}"`);
  }

  // ===== NEIGHBORHOOD SELECTION =====
  // Priority per Nominatim: suburb > neighbourhood > quarter > postcode > village (if ≠ city)

  let chosenNeighborhood: SettlementCandidate | null = null;

  // 1) suburb (Nominatim primary - e.g., "Small-Soppo" in Buea)
  chosenNeighborhood = getBestCandidate(settlements.suburbs);

  // 2) neighbourhood (more granular, secondary)
  if (!chosenNeighborhood) {
    chosenNeighborhood = getBestCandidate(settlements.neighbourhoods);
  }

  // 3) quarter (regional neighborhood type)
  if (!chosenNeighborhood) {
    chosenNeighborhood = getBestCandidate(settlements.quarters);
  }

  // 4) postcode (fallback)
  if (!chosenNeighborhood) {
    chosenNeighborhood = getBestCandidate(settlements.postcodes);
  }

  // 5) village ONLY IF:
  //    - village exists
  //    - chosen city exists
  //    - village.name ≠ chosen city.name
  if (!chosenNeighborhood) {
    const bestVillage = getBestCandidate(settlements.villages);
    if (bestVillage && result.city && bestVillage.place.name !== result.city) {
      // Village is demoted to neighborhood since city exists and names differ
      chosenNeighborhood = bestVillage;
      console.log(`[Normalization] Village demoted to neighborhood: "${bestVillage.place.name}" (city="${result.city}")`);
    }
  }

  // 6) hamlet (final fallback per spec priority #6)
  //    - Only if no other neighborhood found
  //    - Only if hamlet.name ≠ city.name
  if (!chosenNeighborhood) {
    const bestHamlet = getBestCandidate(settlements.hamlets);
    if (bestHamlet && bestHamlet.place.name !== result.city) {
      chosenNeighborhood = bestHamlet;
      console.log(`[Normalization] Hamlet used as neighborhood: "${bestHamlet.place.name}"`);
    }
  }

  if (chosenNeighborhood) {
    result.neighborhood = chosenNeighborhood.place.name;
    result.neighborhoodSource = 'settlement';
    console.log(`[Normalization] Neighborhood from settlement: "${result.neighborhood}" (${chosenNeighborhood.place.place})`);
  } else if (admin.neighborhood) {
    // Fallback to admin.neighborhood
    result.neighborhood = admin.neighborhood.name;
    result.neighborhoodSource = 'admin';
    console.log(`[Normalization] Neighborhood from admin: "${result.neighborhood}"`);
  }

  return result;
}

// ===== ADDRESS TEXT NORMALIZATION (Phase 7.3) =====

/**
 * Normalize address text for geocoding and display.
 * Trim, collapse internal whitespace, optionally strip accents.
 * Used by getAddressComponents and address format; no network.
 */
export function normalizeAddressText(
  value: string | null | undefined,
  options?: { stripAccents?: boolean }
): string {
  if (value == null || typeof value !== 'string') return '';
  let s = value.trim().replace(/\s+/g, ' ');
  if (options?.stripAccents) {
    s = s.normalize('NFD').replace(/\p{Mc}|\p{Mn}/gu, '');
  }
  return s;
}

// ===== LOCALE DETECTION =====

/**
 * Detect user locale for neighborhood suffix formatting
 * Returns 'en', 'fr', or 'pt' based on device settings
 * 
 * Note: Mobile implementation will use expo-localization
 */
export function detectLocale(): 'en' | 'fr' | 'pt' {
  // Phase 2: Default to 'en'
  // Phase 3: Will integrate with expo-localization
  // const locale = Localization.locale;
  // const langCode = locale.split('-')[0].toLowerCase();
  // if (langCode === 'fr') return 'fr';
  // if (langCode === 'pt') return 'pt';
  return 'en';
}
