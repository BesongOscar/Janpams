/**
 * Check Location Address — mobile wiring layer
 *
 * Re-exports the shared decision engine from @janpams/core and wires in
 * the platform-specific local JanGo lookup (SQLite via getAddressByPlusCode).
 *
 * Consumers should call `checkLocationAddressWired` for the fully-wired version
 * or import types/pure functions directly from @janpams/core/address.
 */

import {
  checkLocationAddress as checkLocationAddressCore,
  type AddressCheckResult,
  type AddressSource,
  type AddressQuality,
  type ExternalCandidate,
  type NumberingContext,
} from '@janpams/core/address';
import { getAddressByPlusCode } from './db/addresses';

export type { AddressSource, AddressQuality, ExternalCandidate, NumberingContext, AddressCheckResult };

/**
 * Fully-wired checkLocationAddress with local JanGo DB lookup injected.
 * Drop-in replacement for the previous app-local implementation.
 */
export async function checkLocationAddress(args: {
  lat: number;
  lng: number;
  isOnline: boolean;
  offlineReverseGeocode: (lat: number, lng: number) => Promise<any | null>;
  onlineReverseGeocode?: (lat: number, lng: number) => Promise<any | null>;
}): Promise<AddressCheckResult> {
  return checkLocationAddressCore({
    ...args,
    findLocalByPlusCode: async (plusCode10: string) => {
      const record = await getAddressByPlusCode(plusCode10);
      return record ?? null;
    },
  });
}
