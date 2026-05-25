/**
 * Get Address Components (OSM-Style)
 *
 * Uses @janpams/core/geocoding for priority logic; performs geocoding in-app when needed.
 * Single source of truth: same city/neighborhood priority as web.
 */

import {
  getAddressComponentsFromOSM,
  normalizeAddressComponents,
  type AddressComponents,
  type OSMStyleAddress,
} from '@janpams/core/geocoding';
import { offlineReverseGeocode, type OfflineGeocodeOptions } from './reverseGeocode';

export type { AddressComponents, OSMStyleAddress };

export interface GetAddressComponentsRequest {
  latitude: number;
  longitude: number;
  /** Optional language preference */
  lang?: string;
  /** Optional pre-fetched OSM-style address (skip geocoding) */
  address?: OSMStyleAddress;
  /** Options for offline geocoding */
  geocodeOptions?: OfflineGeocodeOptions;
}

/**
 * Get address components (async): geocode then apply core priority logic.
 */
export async function getAddressComponents(
  request: GetAddressComponentsRequest
): Promise<AddressComponents> {
  const { latitude, longitude, address: preAddress, geocodeOptions } = request;
  const address: OSMStyleAddress = preAddress
    ? preAddress
    : (await offlineReverseGeocode(latitude, longitude, geocodeOptions)).address;
  const result = normalizeAddressComponents(getAddressComponentsFromOSM(address));
  console.log('[getAddressComponents] Result:', result);
  return result;
}

/**
 * Sync version: apply core priority logic to a pre-fetched OSM-style address.
 * Use after resolveStreetAddress so one geocode drives both street data and components.
 */
export function getAddressComponentsSync(address: OSMStyleAddress): AddressComponents {
  return normalizeAddressComponents(getAddressComponentsFromOSM(address));
}
