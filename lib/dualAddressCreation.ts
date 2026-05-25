/**
 * Dual Address Creation — when user edits a street name during address creation,
 * create both the official (API/OSM) address and the user-suggested address.
 *
 * Flow:
 * 1. User picks location → street name resolved from OSM/offline data
 * 2. User edits street name → triggers dual creation on save
 * 3. Official address: name_source = 'api_official'
 * 4. Suggested address: name_source = 'user_suggested', linked_address_id → official
 * 5. Street name suggestion added to suggestions queue
 */

import { createAddress } from '@/lib/db/addresses';
import { createStreetNameSuggestion } from '@/lib/db/suggestions';
import { upsertAddressItem } from '@/lib/search/searchIndex';
import type { Address, AddressNameSource } from '@/lib/db/schemas';

export interface DualCreateParams {
  baseAddress: Omit<Address, 'id' | 'local_id' | 'name_source' | 'linked_address_id' | 'street_suggestion_id'>;
  originalStreetName: string;
  suggestedStreetName: string;
  streetSegmentId?: string;
  lat: number;
  lon: number;
}

export interface DualCreateResult {
  officialAddress: Address;
  suggestedAddress: Address;
  suggestionId: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function createDualAddresses(
  params: DualCreateParams,
): Promise<DualCreateResult> {
  const {
    baseAddress,
    originalStreetName,
    suggestedStreetName,
    streetSegmentId,
    lat,
    lon,
  } = params;

  const now = new Date().toISOString();
  const officialId = generateId();
  const suggestedId = generateId();
  const suggestionId = generateId();

  // 1. Create the official address (original API/OSM name)
  const officialAddress: Address = {
    ...baseAddress,
    id: officialId,
    local_id: officialId,
    street_name: originalStreetName,
    name_source: 'api_official' as AddressNameSource,
    linked_address_id: suggestedId,
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  // 2. Create the user-suggested address
  const suggestedAddress: Address = {
    ...baseAddress,
    id: suggestedId,
    local_id: suggestedId,
    street_name: suggestedStreetName,
    name_source: 'user_suggested' as AddressNameSource,
    linked_address_id: officialId,
    street_suggestion_id: suggestionId,
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  // 3. Save both addresses
  await createAddress(officialAddress);
  await createAddress(suggestedAddress);

  // 4. Create the street name suggestion for community review
  await createStreetNameSuggestion({
    id: suggestionId,
    street_segment_id: streetSegmentId,
    original_name: originalStreetName,
    suggested_name: suggestedStreetName,
    location: JSON.stringify({ lat, lon }),
    status: 'pending',
    created_at: now,
  });

  // 5. Index both addresses for search
  try {
    await upsertAddressItem(officialAddress);
    await upsertAddressItem(suggestedAddress);
  } catch (e) {
    console.warn('[DualCreate] Failed to index addresses:', e);
  }

  return { officialAddress, suggestedAddress, suggestionId };
}

/**
 * Check if the user edited the street name (case-insensitive, trimmed comparison).
 */
export function didUserEditStreetName(
  original: string | null | undefined,
  current: string,
): boolean {
  if (!original) return !!current.trim();
  return original.trim().toLowerCase() !== current.trim().toLowerCase();
}
