/**
 * useAddresses Hook
 *
 * Address list and CRUD from local DB (SyncManager).
 * Phase 8: Address services & hooks — offline first.
 */

import { useState, useEffect, useCallback } from 'react';
import { SyncManager } from '@/lib/syncManager';
import type { Address } from '@/lib/db/schemas';

export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await SyncManager.init();
      const data = await SyncManager.getAllAddresses();
      setAddresses(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch addresses'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const createAddress = useCallback(
    async (
      data: Omit<
        Address,
        'id' | 'local_id' | 'sync_status' | 'created_at' | 'updated_at'
      >
    ) => {
      const newAddress = await SyncManager.createAddress(data);
      setAddresses((prev) => [...prev, newAddress]);
      return newAddress;
    },
    []
  );

  const updateAddress = useCallback(async (id: string, updates: Partial<Address>) => {
    const updated = await SyncManager.updateAddress(id, updates);
    if (updated) {
      setAddresses((prev) => prev.map((addr) => (addr.id === id ? updated : addr)));
    }
    return updated;
  }, []);

  const deleteAddress = useCallback(async (id: string) => {
    const success = await SyncManager.deleteAddress(id);
    if (success) {
      setAddresses((prev) => prev.filter((addr) => addr.id !== id));
    }
    return success;
  }, []);

  return {
    addresses,
    isLoading,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    refetch: fetchAddresses,
  };
}
