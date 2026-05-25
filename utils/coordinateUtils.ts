import { addressesMyJangoAddress } from '@/interfaces';

/**
 * Utility functions for handling coordinates in address objects
 */

/**
 * Checks if an address has valid coordinates
 */
export const hasValidCoordinates = (
  address: addressesMyJangoAddress,
): boolean => {
  return !!(address.latitude && address.longitude);
};

/**
 * Extracts coordinates from an address object, with fallback handling
 */
export const extractCoordinates = (
  address: addressesMyJangoAddress,
): {
  latitude: string | undefined;
  longitude: string | undefined;
  hasCoordinates: boolean;
} => {
  const latitude = address.latitude;
  const longitude = address.longitude;
  const hasCoordinates = hasValidCoordinates(address);

  return {
    latitude,
    longitude,
    hasCoordinates,
  };
};

/**
 * Logs coordinate information for debugging
 */
export const logCoordinateInfo = (
  address: addressesMyJangoAddress,
  context: string = 'AddressComponent',
): void => {
  const { latitude, longitude, hasCoordinates } = extractCoordinates(address);

  if (!hasCoordinates) {
    console.warn(`${context} - Missing coordinates for address:`, {
      id: address.id,
      formatted_address: address.formatted_address,
      global_code: address.global_code,
      latitude,
      longitude,
    });
  }
};

/**
 * TODO: Add Plus Code decoding functionality
 * This would decode a Plus Code (like "8F6CCQCW+2W") to latitude/longitude coordinates
 */
const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const ENCODING_BASE = 20;
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

const decodeDigit = (ch: string): number => {
  const idx = CODE_ALPHABET.indexOf(ch);
  if (idx === -1) throw new Error(`Invalid plus code character: ${ch}`);
  return idx;
};

export const decodePlusCodeToBounds = (
  plusCode: string,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
} | null => {
  if (!plusCode || plusCode.length < 8) return null;

  const cleanCode = plusCode.replace('+', '').toUpperCase();
  const pairLength = Math.min(cleanCode.length, 10);

  let lat = -90.0;
  let lng = -180.0;

  // Decode the paired section (first up to 10 digits)
  for (let i = 0; i < pairLength; i += 2) {
    const latDigit = decodeDigit(cleanCode[i]);
    const lngDigit = decodeDigit(cleanCode[i + 1]);
    const resolution = PAIR_RESOLUTIONS[i / 2];
    lat += latDigit * resolution;
    lng += lngDigit * resolution;
  }

  // Current resolution after pairs
  let latRes = PAIR_RESOLUTIONS[Math.floor((pairLength - 2) / 2)];
  let lngRes = latRes;

  // Decode grid section (remaining digits, max 5)
  let rowRes = latRes / GRID_ROWS;
  let colRes = lngRes / GRID_COLUMNS;
  for (let i = pairLength; i < cleanCode.length && i < pairLength + 5; i++) {
    const digit = decodeDigit(cleanCode[i]);
    const row = Math.floor(digit / GRID_COLUMNS);
    const col = digit % GRID_COLUMNS;
    lat += rowRes * row;
    lng += colRes * col;
    rowRes /= GRID_ROWS;
    colRes /= GRID_COLUMNS;
    latRes = rowRes * GRID_ROWS;
    lngRes = colRes * GRID_COLUMNS;
  }

  const minLat = lat;
  const minLng = lng;
  const maxLat = lat + rowRes * GRID_ROWS;
  const maxLng = lng + colRes * GRID_COLUMNS;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return { minLat, maxLat, minLng, maxLng, centerLat, centerLng };
};

/**
 * TODO: Add geocoding functionality
 * This would geocode a formatted address to get coordinates
 */
export const geocodeAddress = async (
  formattedAddress: string,
): Promise<{ latitude: number; longitude: number } | null> => {
  // TODO: Implement geocoding
  // You can use Google Geocoding API, OpenStreetMap Nominatim, or other services
  console.warn('Geocoding not implemented yet for:', formattedAddress);
  return null;
};
