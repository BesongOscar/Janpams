/**
 * useAddressModeEntry Hook
 *
 * Entry point for address-at-location flow: performLocationCheck using
 * addressServices.checkLocation (local DB + resolveStreetAddress).
 * Entry point (e.g. create address from map) uses active street and
 * calculated address from store/hook (useAddressStore, useActiveStreet).
 *
 * Phase 8: Address services & hooks — offline first.
 */

import { useCallback } from 'react';
import { checkLocation, type AddressCheckResult } from '@/lib/addressServices';

export interface UseAddressModeEntryOptions {
  onCheckComplete?: (result: AddressCheckResult) => void;
  onError?: (error: Error) => void;
}

export function useAddressModeEntry(options: UseAddressModeEntryOptions = {}) {
  /**
   * Perform location check and return result.
   * Uses addressServices.checkLocation (offline resolveStreetAddress + checkLocationAddress).
   */
  const performLocationCheck = useCallback(
    async (lat: number, lng: number): Promise<AddressCheckResult | null> => {
      try {
        const result = await checkLocation(lat, lng, false);
        options.onCheckComplete?.(result);
        return result;
      } catch (error) {
        console.log('[useAddressModeEntry] Location check failed:', error);
        options.onError?.(error instanceof Error ? error : new Error('Location check failed'));
        return null;
      }
    },
    [options.onCheckComplete, options.onError]
  );

  return {
    performLocationCheck,
  };
}
