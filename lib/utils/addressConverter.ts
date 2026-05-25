/**
 * Address Converter Utilities
 * 
 * Converts between API request format and Address schema format
 */

import type { addressesCreateAddressRequest } from '@/interfaces';
import type { Address } from '../db/schemas';
import { getDisplayCode } from '@janpams/core/pluscode';

/**
 * Convert API request format to Address schema
 */
export function convertRequestToAddress(
  request: addressesCreateAddressRequest,
  userId?: string
): Omit<Address, 'id' | 'local_id' | 'sync_status' | 'created_at' | 'updated_at'> {
  const lat = parseFloat(request.latitude || '0');
  const lon = parseFloat(request.longitude || '0');
  const plusCode = getDisplayCode(lat, lon);

  return {
    house_number: parseInt(request.house_plot_nbr || '0', 10),
    extension: request.house_plot_extension || undefined,
    street_name: request.userSSName || '',
    street_type: request.userSSType || undefined,
    neighborhood: request.userSNName || undefined,
    city: request.userSCity || '', // May need to be populated from geocoding
    region: request.userSRegion || '', // May need to be populated from geocoding
    country: 'CM', // Default, may need to be populated from geocoding
    latitude: lat,
    longitude: lon,
    plus_code: plusCode,
    business_name: request.business_name || undefined,
    property_category: request.address_category || 'residential',
    property_type: request.unit_type || 'House',
    created_by: userId,
    connection_type: request.connection || undefined,
    image_url: request.image || undefined,
    status: 'pending',
    sync_status: 'pending', // Will be set by SyncManager
  };
}

/**
 * Convert Address schema to API request format (for compatibility)
 */
export function convertAddressToRequest(address: Address): addressesCreateAddressRequest {
  return {
    latitude: address.latitude.toString(),
    longitude: address.longitude.toString(),
    house_plot_nbr: address.house_number.toString(),
    house_plot_extension: address.extension,
    userSSName: address.street_name,
    userSSType: address.street_type,
    userSNName: address.neighborhood,
    userSCity: address.city,
    userSRegion: address.region,
    unit_number: undefined, // Not in Address schema
    unit_type: address.property_type,
    address_category: address.property_category,
    business_name: address.business_name,
    connection: address.connection_type,
    image: address.image_url,
  };
}
