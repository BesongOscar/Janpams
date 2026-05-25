/**
 * Address Services
 *
 * Wires up dependencies for address lookup, allocation, and save.
 * Phase 8: Address services & hooks — offline first.
 * - checkLocation: local DB + checkLocationAddress with resolveStreetAddress
 * - allocateHouseNumber: resolveStreetAddress + getDirectionLock + allocateHouseNumberAsync
 * - createAddressWithDirectionLock: autoLockOnFirstAddress then SyncManager.createAddress
 */

import {
  checkLocationAddress,
  type AddressCheckResult,
  type NumberingContext,
} from './checkLocationAddress';
import {
  allocateHouseNumberAsync,
  type Street,
  type AddressData,
} from './createLocationAddress';
import { resolveStreetAddress } from './offlineDataPacks';
import { createStreetKey } from './streetGeometry';
import { getDirectionLock, autoLockOnFirstAddress } from './streetDirectionService';
import { getTakenHouseNumbers, reserveHouseNumber } from './db/addresses';
import type { Address } from './db/schemas';
import { SyncManager } from './syncManager';

// ===== CHECK LOCATION ADDRESS =====

/**
 * Check if a location has an address (wired service).
 * Uses resolveStreetAddress for offline reverse geocode; no network.
 */
export async function checkLocation(
  lat: number,
  lng: number,
  isOnline: boolean = false
): Promise<AddressCheckResult> {
  return checkLocationAddress({
    lat,
    lng,
    isOnline,
    offlineReverseGeocode: async (lat, lng) => {
      const result = await resolveStreetAddress(lat, lng);
      return {
        houseNumber: null, // Auto-calculated number is for create flow only, not check flow (web parity)
        road: result.street?.name ?? null,
        streetName: result.street?.name ?? null,
        displayAddress: result.street?.name ?? null,
        neighborhood: result.admin.neighborhood ?? null,
        city: result.admin.city ?? null,
        region: result.admin.region ?? null,
        region_code: result.admin.region_code ?? null,
        country: result.admin.country ?? null,
        country_code: result.admin.country_code ?? 'CM',
        osmWayId: result.street?.segment_id ?? null,
        osmData: {
          businessName: null,
          neighborhood: result.admin.neighborhood ?? null,
          city: result.admin.city ?? '',
          region: result.admin.region ?? '',
          region_code: result.admin.region_code ?? null,
          country: result.admin.country ?? 'CM',
          country_code: result.admin.country_code ?? 'CM',
        },
      };
    },
    onlineReverseGeocode: async () => null,
  });
}

// ===== ALLOCATE HOUSE NUMBER =====

/**
 * Allocate a unique house number for a location (wired service).
 * Uses resolveStreetAddress, getDirectionLock, allocateHouseNumberAsync.
 */
export async function allocateHouseNumber(
  lat: number,
  lon: number,
  numberingContext: NumberingContext
): Promise<AddressData | null> {
  const result = await resolveStreetAddress(lat, lon);
  if (!result.street || !result.activeStreet) return null;

  const street: Street = {
    id: result.activeStreet.segment_id,
    name: result.activeStreet.name,
    geometry: result.activeStreet.geometry.map(([lonCoord, latCoord]) => [
      latCoord,
      lonCoord,
    ] as [number, number]),
    direction_locked: false,
  };

  const streetKey =
    result.streetKey ?? numberingContext.streetKey ?? createStreetKey(street);
  const directionLock = await getDirectionLock(streetKey);

  return allocateHouseNumberAsync(lat, lon, street, {
    streetKey,
    getTakenHouseNumbers,
    reserveHouseNumber,
    directionLock: directionLock ?? undefined,
    externalHouseNumber: numberingContext.externalHouseNumber,
  });
}

// ===== CREATE ADDRESS (with direction lock) =====

/**
 * Create address and auto-lock street direction on first address.
 * Save flow must call autoLockOnFirstAddress; then store with correct street key.
 */
export async function createAddressWithDirectionLock(
  data: Omit<
    Address,
    'id' | 'local_id' | 'sync_status' | 'created_at' | 'updated_at'
  >,
  streetKey: string,
  lockedBy?: string
): Promise<Address> {
  await autoLockOnFirstAddress(streetKey, lockedBy);
  return SyncManager.createAddress(data);
}

// ===== CONVERT OFFLINE RESULT TO API SHAPE (for UI parity) =====

/**
 * Build addressesCheckAddressResponse-shaped object from our offline check result.
 * Lets the map tab show AddressFoundCard with the same shape as the API response.
 */
export function offlineResultToCheckResponse(
  result: AddressCheckResult,
  lat: number,
  lng: number,
  plusCode?: string | null,
  w3w?: string | null
): {
  formatted_address: string;
  latitude: string;
  longitude: string;
  global_code?: string;
  w3wAddress?: string | null;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  address_components: {
    house_number?: string;
    road?: string;
    neighbourhood?: string | null;
    city?: string;
    state?: string;
    country?: string;
    country_code?: string | null;
  };
} {
  const comp = result.rawGeoContext ?? {};
  let formatted_address: string;

  if (result.jangoMatch?.record) {
    const r = result.jangoMatch.record;
    const parts = [
      [r.house_number, r.street_name].filter(Boolean).join(' '),
      r.neighborhood,
      r.city,
      [r.region, r.country].filter(Boolean).join(', '),
    ].filter(Boolean);
    formatted_address = parts.join(', ');
  } else if (result.externalCandidate) {
    const e = result.externalCandidate;
    const parts = [
      e.houseNumber != null ? [e.houseNumber, e.road].filter(Boolean).join(' ') : e.road,
      e.neighborhood,
      e.city,
      [e.region ?? comp.region, e.country ?? comp.country].filter(Boolean).join(', '),
    ].filter(Boolean);
    formatted_address = parts.join(', ');
  } else {
    formatted_address = [comp.street, comp.city, comp.country].filter(Boolean).join(', ') || 'Address';
  }

  const houseNumber =
    result.jangoMatch?.record?.house_number != null
      ? String(result.jangoMatch.record.house_number)
      : result.externalCandidate?.houseNumber != null
        ? String(result.externalCandidate.houseNumber)
        : undefined;

  // Quality for UI badge: JanGo match = HIGH; OSM/external = their quality; else MEDIUM
  const quality =
    result.jangoMatch ? 'HIGH' : (result.externalCandidate?.quality ?? 'MEDIUM');

  return {
    formatted_address,
    latitude: String(lat),
    longitude: String(lng),
    global_code: plusCode ?? undefined,
    w3wAddress: w3w ?? undefined,
    quality,
    address_components: {
      house_number: houseNumber,
      road: result.externalCandidate?.road ?? result.rawGeoContext?.street ?? undefined,
      neighbourhood: result.rawGeoContext?.neighborhood ?? undefined,
      city: result.rawGeoContext?.city ?? comp.city ?? undefined,
      state: result.rawGeoContext?.region ?? comp.region ?? undefined,
      country: result.rawGeoContext?.country ?? comp.country ?? undefined,
      country_code: result.rawGeoContext?.country_code ?? comp.country_code ?? undefined,
    },
  };
}

// ===== RE-EXPORTS =====

export type { AddressCheckResult, NumberingContext } from './checkLocationAddress';
export type { AddressData, Street } from './createLocationAddress';
