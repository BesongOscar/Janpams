/**
 * Address Database Operations
 * 
 * CRUD operations for addresses table.
 * Matches web's address operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's address operations)
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute, exists, count, parseJSON, stringifyJSON } from './helpers';
import { logWrite, logSuccess } from './dbLogger';
import type { Address } from './schemas';
import { randomUUID } from '../randomUUID';

/** Ordered list of address columns for INSERT – must match sqlite-schema.ts addresses table */
const ADDRESS_INSERT_COLUMNS = [
  'id', 'local_id', 'house_number', 'extension', 'parent_address_id',
  'street_name', 'street_type', 'neighborhood', 'city', 'region', 'country',
  'latitude', 'longitude', 'plus_code',
  'side_of_street', 'chainage_meters', 'spacing_constant', 'distance_from_street',
  'business_name', 'property_category', 'property_type',
  'created_by', 'connection_type',
  'image_url', 'image_storage_path',
  'status', 'verified_at', 'verified_by',
  'name_source', 'linked_address_id', 'street_suggestion_id', 'neighborhood_suggestion_id',
  'sync_status', 'last_synced_at',
  'created_at', 'updated_at',
] as const;

/**
 * Create a new address
 */
export async function createAddress(address: Address): Promise<void> {
  const db = await getDB();
  const placeholders = ADDRESS_INSERT_COLUMNS.map(() => '?').join(', ');
  const columns = ADDRESS_INSERT_COLUMNS.join(', ');
  const sql = `INSERT INTO addresses (${columns}) VALUES (${placeholders})`;
  const params = ADDRESS_INSERT_COLUMNS.map((key) => {
    const v = address[key as keyof Address];
    return v === undefined || v === '' ? null : v;
  });
  if (params.length !== ADDRESS_INSERT_COLUMNS.length) {
    logWrite('addresses', `INSERT param count mismatch: ${params.length} vs ${ADDRESS_INSERT_COLUMNS.length}`, 0);
  }
  await db.runAsync(sql, params);
  logWrite('addresses', `INSERT id=${address.id} plus_code=${address.plus_code} ${address.house_number} ${address.street_name}`, 1);
  logSuccess(`Address saved successfully to offline DB: id=${address.id} ${address.house_number} ${address.street_name}, ${address.neighborhood ?? ''}, ${address.city}`);
}

/**
 * Get address by ID
 */
export async function getAddressById(id: string): Promise<Address | null> {
  return queryFirst<Address>('SELECT * FROM addresses WHERE id = ?', [id]);
}

/**
 * Get address by local ID
 */
export async function getAddressByLocalId(localId: string): Promise<Address | null> {
  return queryFirst<Address>('SELECT * FROM addresses WHERE local_id = ?', [localId]);
}

/**
 * Get address by Plus Code (10 char)
 */
export async function getAddressByPlusCode(plusCode: string): Promise<Address | null> {
  return queryFirst<Address>(
    'SELECT * FROM addresses WHERE plus_code = ? LIMIT 1',
    [plusCode]
  );
}

/**
 * Get all addresses by Plus Code (in case of multiple addresses in same cell)
 */
export async function getAllAddressesByPlusCode(plusCode: string): Promise<Address[]> {
  return queryAll<Address>(
    'SELECT * FROM addresses WHERE plus_code = ?',
    [plusCode]
  );
}

/**
 * Get addresses by sync status
 */
export async function getAddressesBySyncStatus(
  syncStatus: 'pending' | 'synced' | 'conflict'
): Promise<Address[]> {
  return queryAll<Address>(
    'SELECT * FROM addresses WHERE sync_status = ?',
    [syncStatus]
  );
}

/**
 * Get all addresses
 */
export async function getAllAddresses(): Promise<Address[]> {
  return queryAll<Address>('SELECT * FROM addresses ORDER BY created_at DESC');
}

/**
 * Update an address
 */
export async function updateAddress(id: string, updates: Partial<Address>): Promise<void> {
  const db = await getDB();
  
  const fields: string[] = [];
  const values: unknown[] = [];
  
  // Build update fields dynamically
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (fields.length === 0) {
    return; // No updates
  }
  
  // Always update updated_at
  if (!fields.includes('updated_at = ?')) {
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
  }
  
  values.push(id); // WHERE clause

  const sql = `UPDATE addresses SET ${fields.join(', ')} WHERE id = ?`;
  const result = await db.runAsync(sql, values);
  const changes = result.changes ?? 0;
  logWrite('addresses', `UPDATE id=${id}`, changes);
}

/**
 * Delete an address
 */
export async function deleteAddress(id: string): Promise<void> {
  await execute('DELETE FROM addresses WHERE id = ?', [id]);
}

/**
 * Check if address exists
 */
export async function addressExists(id: string): Promise<boolean> {
  return exists('addresses', { id });
}

/**
 * Count addresses
 */
export async function countAddresses(where?: { sync_status?: string }): Promise<number> {
  if (where) {
    return count('addresses', where);
  }
  return count('addresses');
}

/**
 * Batch insert addresses
 */
export async function batchCreateAddresses(addresses: Address[]): Promise<void> {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    for (const address of addresses) {
      await createAddress(address);
    }
  });
}

/**
 * Get house numbers already taken for a street (reservations + addresses).
 * Used by allocateHouseNumberAsync for duplicate prevention.
 * Phase 8: Address services — offline first.
 */
export async function getTakenHouseNumbers(streetKey: string): Promise<Set<number>> {
  const set = new Set<number>();
  const fromRes = await queryAll<{ houseNumber: number }>(
    'SELECT houseNumber FROM street_number_reservations WHERE streetKey = ?',
    [streetKey]
  );
  fromRes.forEach((r) => set.add(r.houseNumber));
  if (streetKey.startsWith('name:')) {
    const namePart = streetKey.slice(5).trim().toLowerCase();
    if (namePart) {
      const fromAddr = await queryAll<{ house_number: number }>(
        'SELECT house_number FROM addresses WHERE LOWER(TRIM(street_name)) = ?',
        [namePart]
      );
      fromAddr.forEach((a) => set.add(a.house_number));
    }
  }
  return set;
}

/**
 * Reserve a house number for a street (prevents duplicate allocation).
 * Phase 8: Address services — offline first.
 */
export async function reserveHouseNumber(input: {
  streetKey: string;
  houseNumber: number;
  lat: number;
  lon: number;
  source: 'JANGO_ASSIGNED' | 'OSM_OFFICIAL' | 'USER_CONFIRMED';
}): Promise<void> {
  const db = await getDB();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO street_number_reservations (id, streetKey, houseNumber, lat, lon, source, createdAt, addressId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.streetKey, input.houseNumber, input.lat, input.lon, input.source, now, null]
  );
  logWrite('street_number_reservations', `INSERT id=${id} streetKey=${input.streetKey} houseNumber=${input.houseNumber}`, 1);
}

/**
 * Normalize street key for consistent lookups (matches web implementation)
 */
export function normalizeStreetKey(streetName: string, city?: string): string {
  const normalized = streetName.trim().toLowerCase().replace(/\s+/g, '_');
  if (city) {
    return `name:${normalized}:${city.trim().toLowerCase().replace(/\s+/g, '_')}`;
  }
  return `name:${normalized}`;
}

/**
 * Normalize neighborhood key for consistent lookups (matches web implementation)
 */
export function normalizeNeighborhoodKey(neighborhoodName: string, city?: string): string {
  const normalized = neighborhoodName.trim().toLowerCase().replace(/\s+/g, '_');
  if (city) {
    return `neighborhood:${normalized}:${city.trim().toLowerCase().replace(/\s+/g, '_')}`;
  }
  return `neighborhood:${normalized}`;
}
