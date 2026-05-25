/**
 * useLocalAddresses — search/filter locally stored addresses.
 *
 * Queries the local SQLite addresses table for offline access,
 * with client-side filtering by street name, house number, plus code.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDB } from '@/lib/db';
import type { Address } from '@/lib/db/schemas';

export interface LocalAddressFilters {
  query: string;
  status?: 'pending' | 'verified' | 'rejected';
  sortBy?: 'created_at' | 'street_name' | 'house_number';
  sortOrder?: 'asc' | 'desc';
}

export function useLocalAddresses(filters: LocalAddressFilters) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const loadAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDB();
      let sql = 'SELECT * FROM addresses';
      const params: (string | number)[] = [];

      if (filters.status) {
        sql += ' WHERE status = ?';
        params.push(filters.status);
      }

      const sortCol = filters.sortBy || 'created_at';
      const sortDir = filters.sortOrder || 'desc';
      sql += ` ORDER BY ${sortCol} ${sortDir}`;

      const rows = await db.getAllAsync<Address>(sql, params);
      setAddresses(rows);
      setTotalCount(rows.length);
    } catch (e) {
      console.log('[useLocalAddresses] Failed to load:', e);
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    if (!q) return addresses;

    return addresses.filter(a => {
      const streetMatch = a.street_name?.toLowerCase().includes(q);
      const houseMatch = a.house_number?.toString().includes(q);
      const plusCodeMatch = a.plus_code?.toLowerCase().includes(q);
      const neighborhoodMatch = a.neighborhood?.toLowerCase().includes(q);
      const businessMatch = a.business_name?.toLowerCase().includes(q);
      return streetMatch || houseMatch || plusCodeMatch || neighborhoodMatch || businessMatch;
    });
  }, [addresses, filters.query]);

  return {
    addresses: filtered,
    allAddresses: addresses,
    isLoading,
    totalCount,
    filteredCount: filtered.length,
    reload: loadAddresses,
  };
}
