/**
 * Canonical address display for the app.
 * Use getAddressDisplayLines() everywhere an address is shown so format is consistent.
 *
 * Display format:
 * 1. Alias name (My Address Book) or business name — skip if both missing
 * 2. Number + street name (e.g. 162 Borstal Street)
 * 3. Neighborhood, city (e.g. Small-Soppo, Buea)
 * 4. Region code, country code (e.g. SW, CMR)
 */

import { formatStreetLine } from './formatStreetName';

export interface AddressDisplayInput {
  aliasName?: string | null;
  businessName?: string | null;
  houseNumber?: string | number | null;
  streetName?: string | null;
  streetType?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  regionCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

function trim(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s).trim();
}

/** Map common region names to display codes (line 4). */
const REGION_NAME_TO_CODE: Record<string, string> = {
  southwest: 'SW',
  'south west': 'SW',
  'north west': 'NW',
  northwest: 'NW',
  littoral: 'LT',
  west: 'W',
  centre: 'CE',
  center: 'CE',
  east: 'E',
  north: 'N',
  south: 'S',
  adamawa: 'AD',
  'far north': 'EN',
};

/** Map country name or 2-letter to ISO 3166-1 alpha-3 (e.g. CMR). */
const COUNTRY_TO_CODE: Record<string, string> = {
  cameroon: 'CMR',
  cm: 'CMR',
  nigeria: 'NGA',
  ng: 'NGA',
  ghana: 'GHA',
  gh: 'GHA',
};

function toRegionCode(region: string): string {
  if (!region) return '';
  const key = region.trim().toLowerCase();
  return REGION_NAME_TO_CODE[key] ?? region.trim();
}

function toCountryCode(country: string): string {
  if (!country) return '';
  const key = country.trim().toLowerCase();
  return COUNTRY_TO_CODE[key] ?? country.trim();
}

/**
 * Returns 1–4 lines for display. Line 1 is omitted when both alias and business name are missing.
 */
export function getAddressDisplayLines(input: AddressDisplayInput): string[] {
  const alias = trim(input.aliasName);
  const business = trim(input.businessName);
  const houseNumber = trim(input.houseNumber);
  const streetName = trim(input.streetName);
  const streetType = input.streetType ? trim(input.streetType) : '';
  const neighborhood = trim(input.neighborhood);
  const city = trim(input.city);
  const region = trim(input.region);
  const regionCode = trim(input.regionCode);
  const country = trim(input.country);
  const countryCode = trim(input.countryCode);

  const lines: string[] = [];

  // 1. Alias name if present, else business name; skip if both missing
  const line1 = alias || business;
  if (line1) lines.push(line1);

  // 2. Number + street name (e.g. 162 Borstal Street)
  const streetLine = formatStreetLine(streetName || '', streetType || undefined);
  const numberStreet = [houseNumber, streetLine].filter(Boolean).join(' ').trim();
  if (numberStreet) lines.push(numberStreet);

  // 3. Neighborhood, city (e.g. Small-Soppo, Buea)
  const neighborhoodCity = [neighborhood, city].filter(Boolean).join(', ').trim();
  if (neighborhoodCity) lines.push(neighborhoodCity);

  // 4. Region code, country code (e.g. SW, CMR); prefer codes, else derive from region/country names
  const regionPart = regionCode || (region ? toRegionCode(region) : '');
  const countryPart = countryCode || (country ? toCountryCode(country) : '');
  const regionCountry = [regionPart, countryPart].filter(Boolean).join(', ').trim();
  if (regionCountry) lines.push(regionCountry);

  return lines;
}

/** address_components shape used by Jango/API and local address book */
interface AddressComponentsLike {
  house_number?: string | null;
  road?: string | null;
  neighbourhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  country_code?: string | null;
  business_name?: string | null;
  amenity?: string | null;
}

/** Normalize from addressesMyJangoAddress / addressesJangoAddress / address book / addressesCheckAddressResponse */
export function normalizeAddressForDisplay(addr: {
  alias_name?: string | null;
  business_name?: string | null;
  address_components?: AddressComponentsLike | null;
  address?: AddressComponentsLike | null;
  formatted_address?: string | null;
  [key: string]: unknown;
}): AddressDisplayInput {
  const ac = addr?.address_components ?? addr?.address;
  return {
    aliasName: addr?.alias_name ?? undefined,
    businessName: addr?.business_name ?? ac?.business_name ?? ac?.amenity ?? undefined,
    houseNumber: ac?.house_number ?? undefined,
    streetName: ac?.road ?? undefined,
    streetType: undefined,
    neighborhood: ac?.neighbourhood ?? undefined,
    city: ac?.city ?? undefined,
    region: ac?.state ?? undefined,
    regionCode: undefined,
    country: ac?.country ?? undefined,
    countryCode: ac?.country_code ?? undefined,
  };
}

/** Normalize from Result (search result) when it includes address_components / alias_name */
export function normalizeResultForDisplay(item: {
  aliasName?: string | null;
  businessName?: string | null;
  formattedAddress?: string | null;
  address_components?: AddressComponentsLike | null;
  houseNumber?: string | null;
  streetName?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  regionCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  [key: string]: unknown;
}): AddressDisplayInput {
  const ac = item?.address_components;
  return {
    aliasName: item?.aliasName ?? undefined,
    businessName: item?.businessName ?? ac?.business_name ?? ac?.amenity ?? undefined,
    houseNumber: (item?.houseNumber ?? ac?.house_number) ?? undefined,
    streetName: (item?.streetName ?? ac?.road) ?? undefined,
    streetType: undefined,
    neighborhood: (item?.neighborhood ?? ac?.neighbourhood) ?? undefined,
    city: (item?.city ?? ac?.city) ?? undefined,
    region: (item?.region ?? ac?.state) ?? undefined,
    regionCode: item?.regionCode ?? undefined,
    country: (item?.country ?? ac?.country) ?? undefined,
    countryCode: (item?.countryCode ?? ac?.country_code) ?? undefined,
  };
}
