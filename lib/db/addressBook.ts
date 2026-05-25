/**
 * Address Book (alias/saved addresses) – local SQLite only.
 * Used for "My Address Book" tab: link a Jango address (address_id) with an alias name.
 */

import { getDB } from './database';
import { queryAll, queryFirst, execute } from './helpers';
import { getAddressById } from './addresses';
import { formatStreetLine } from '@/utils/formatStreetName';
import type { Address } from './schemas';
import type { addressesJangoAddress } from '@/interfaces';

export interface AddressBookEntry {
  id: string;
  address_id: string;
  alias_name: string;
  created_at: string;
  updated_at: string;
}

function addressToJangoWithAlias(addr: Address, entry: AddressBookEntry): addressesJangoAddress & { alias_name?: string } {
  const streetLine = formatStreetLine(addr.street_name, addr.street_type);
  const formatted_address = `${addr.house_number}${addr.extension || ''} ${streetLine}, ${addr.neighborhood || ''}, ${addr.city}, ${addr.region}`;
  return {
    id: entry.id,
    alias_name: entry.alias_name,
    created_by: addr.created_by,
    business_name: entry.alias_name,
    formatted_address,
    global_code: addr.plus_code,
    latitude: addr.latitude != null ? String(addr.latitude) : undefined,
    longitude: addr.longitude != null ? String(addr.longitude) : undefined,
    image: addr.image_url ?? undefined,
    address_components: {
      house_number: addr.house_number != null ? String(addr.house_number) : undefined,
      road: addr.street_name,
      neighbourhood: addr.neighborhood ?? undefined,
      city: addr.city,
      state: addr.region,
      country: addr.country,
      business_name: entry.alias_name ?? undefined,
    },
  };
}

export async function insertAddressBookEntry(
  id: string,
  address_id: string,
  alias_name: string,
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO address_book (id, address_id, alias_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, address_id, alias_name, now, now]
  );
}

export async function getAllAddressBookEntries(): Promise<AddressBookEntry[]> {
  return queryAll<AddressBookEntry>('SELECT * FROM address_book ORDER BY created_at DESC', []);
}

export async function getAddressBookEntriesPaginated(
  page: number,
  itemsPerPage: number,
): Promise<{ entries: (addressesJangoAddress & { alias_name?: string })[]; total: number }> {
  const all = await getAllAddressBookEntries();
  const total = all.length;
  const start = (page - 1) * itemsPerPage;
  const pageEntries = all.slice(start, start + itemsPerPage);
  const entries: (addressesJangoAddress & { alias_name?: string })[] = [];
  for (const entry of pageEntries) {
    const addr = await getAddressById(entry.address_id);
    if (addr) {
      entries.push(addressToJangoWithAlias(addr, entry));
    }
  }
  return { entries, total };
}

export async function getAddressBookEntryById(id: string): Promise<AddressBookEntry | null> {
  return queryFirst<AddressBookEntry>('SELECT * FROM address_book WHERE id = ?', [id]);
}

export async function updateAddressBookEntry(id: string, alias_name: string): Promise<boolean> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'UPDATE address_book SET alias_name = ?, updated_at = ? WHERE id = ?',
    [alias_name, now, id]
  );
  return (result.changes ?? 0) > 0;
}

export async function deleteAddressBookEntry(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM address_book WHERE id = ?', [id]);
  return (result.changes ?? 0) > 0;
}

export async function getAddressBookEntryByAddressId(address_id: string): Promise<AddressBookEntry | null> {
  return queryFirst<AddressBookEntry>('SELECT * FROM address_book WHERE address_id = ? LIMIT 1', [address_id]);
}
