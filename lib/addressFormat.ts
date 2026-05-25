/**
 * Centralized Address Formatting Utilities
 * Uses @janpams/core/address for all 4-line formatters; app applies normalization then calls core.
 */

import {
  type AddressLines,
  type AddressDataInput,
  type AddressRecordInput,
  formatAddressLines as coreFormatAddressLines,
  formatAddressLinesFromRecord as coreFormatAddressLinesFromRecord,
  formatAddressSingleLine as coreFormatAddressSingleLine,
  formatSubdivisionPairDefault,
  addressLinesToArray,
  addressLinesToString,
} from '@janpams/core/address';
import { normalizeAddressText } from './geocoding/normalization';

export type { AddressLines, AddressDataInput, AddressRecordInput };

/** Subdivision for line4: use core default; when no region use 'SW, CMR' for display. */
function subdivisionContext(region: string, countryCode: string): string {
  if (!region.trim()) return 'SW, CMR';
  return formatSubdivisionPairDefault(region, countryCode);
}

/**
 * Format address lines for multi-line display (4-line format).
 * App normalizes geocoding text; core does not read DB.
 */
export function formatAddressLines(
  data: AddressDataInput,
  defaultCountryCode: string = 'CM'
): AddressLines {
  const normalized: AddressDataInput = {
    ...data,
    displayAddress: data.displayAddress ?? '',
    osmData: data.osmData
      ? {
          ...data.osmData,
          neighborhood: (normalizeAddressText(data.osmData.neighborhood ?? undefined) || data.osmData.neighborhood) ?? null,
          city: (normalizeAddressText(data.osmData.city ?? undefined) || data.osmData.city) ?? null,
        }
      : undefined,
  };
  return coreFormatAddressLines(normalized, defaultCountryCode, subdivisionContext);
}

/**
 * Format address lines from a database Address record (with app normalization).
 */
export function formatAddressLinesFromRecord(
  address: AddressRecordInput,
  defaultCountryCode: string = 'CM'
): AddressLines {
  const normalized: AddressRecordInput = {
    ...address,
    street_name: normalizeAddressText(address.street_name ?? undefined) || address.street_name || 'Unnamed Street',
    neighborhood: address.neighborhood ? normalizeAddressText(address.neighborhood) || address.neighborhood : null,
    city: address.city ? normalizeAddressText(address.city) || address.city : null,
    region: address.region ? normalizeAddressText(address.region) || address.region : null,
    country: address.country ? normalizeAddressText(address.country) || address.country : null,
  };
  return coreFormatAddressLinesFromRecord(normalized, defaultCountryCode, subdivisionContext);
}

/**
 * Format address as a single line (with app normalization).
 */
export function formatAddressSingleLine(address: AddressRecordInput): string {
  const normalized: AddressRecordInput = {
    ...address,
    street_name: normalizeAddressText(address.street_name ?? undefined) || address.street_name || 'Unnamed Street',
    neighborhood: address.neighborhood ? normalizeAddressText(address.neighborhood) || address.neighborhood : undefined,
    city: address.city ? normalizeAddressText(address.city) || address.city : undefined,
    region: address.region ? normalizeAddressText(address.region) || address.region : undefined,
    country: address.country ? normalizeAddressText(address.country) || address.country : undefined,
  };
  return coreFormatAddressSingleLine(normalized);
}

export { addressLinesToArray, addressLinesToString };

/**
 * Format AddressData (map/geocoding) as display string (single line)
 */
export function formatDisplayAddress(data: { displayAddress?: string | null }): string {
  return data.displayAddress ?? '';
}
