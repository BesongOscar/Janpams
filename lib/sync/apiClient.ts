/**
 * API Client for Sync Operations
 * 
 * Handles API calls for syncing address operations to the backend
 * Maps sync queue items to API requests and handles responses
 */

import { axiosFormDataInstance, axiosInstance } from '@/utils';
import type { addressesCreateAddressRequest, addressesCreateAddressResponse } from '@/interfaces';
import type { Address, SyncQueueItem } from '../db/schemas';

// ===== TYPES =====

export interface SyncApiError {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
}

// ===== API CLIENT =====

/**
 * Sync CREATE operation
 */
export async function syncCreateAddress(
  address: Address,
  lang: string = 'en'
): Promise<addressesCreateAddressResponse> {
  const formData = new FormData();

  // Add image if available
  if (address.image_url) {
    // Note: Image upload in sync requires special handling
    // For now, we'll skip image in sync (can be handled via separate upload)
    console.warn('[SyncAPI] Image upload not yet supported in sync');
  }

  // Map address fields to API format (guard against undefined from parsed sync queue data)
  const lat = address.latitude != null ? String(address.latitude) : '';
  const lon = address.longitude != null ? String(address.longitude) : '';
  formData.append('unit_number', address.extension ?? '');
  formData.append('unit_type', address.property_type ?? '');
  formData.append('house_plot_nbr', address.house_number != null ? String(address.house_number) : '');
  formData.append('house_plot_extension', address.extension ?? '');
  formData.append('latitude', lat);
  formData.append('longitude', lon);
  formData.append('userSSName', address.street_name ?? '');
  formData.append('userSSType', address.street_type ?? '');
  formData.append('userSNName', address.neighborhood ?? '');
  formData.append('business_name', address.business_name ?? '');
  formData.append('address_category', address.property_category ?? '');
  formData.append('connection', address.connection_type ?? '');

  try {
    const response = await axiosFormDataInstance.post<addressesCreateAddressResponse>(
      `/address/create?lang=${lang}`,
      formData,
    );
    return response.data;
  } catch (error: any) {
    const apiError: SyncApiError = {
      code: error.code || 'UNKNOWN',
      message: error.message || 'Failed to create address',
      status: error.response?.status,
      retryable: isRetryableError(error),
    };
    throw apiError;
  }
}

/**
 * Sync UPDATE operation
 */
export async function syncUpdateAddress(
  address: Address,
  lang: string = 'en'
): Promise<any> {
  // TODO: Implement UPDATE API call when backend endpoint is available
  // For now, we'll use CREATE endpoint (backend should handle idempotency)
  console.warn('[SyncAPI] UPDATE sync using CREATE endpoint (idempotency assumed)');
  return syncCreateAddress(address, lang);
}

/**
 * Sync DELETE operation
 */
export async function syncDeleteAddress(
  addressId: string,
  lang: string = 'en'
): Promise<void> {
  // TODO: Implement DELETE API call when backend endpoint is available
  try {
    await axiosInstance.delete(`/address/${addressId}?lang=${lang}`);
  } catch (error: any) {
    const apiError: SyncApiError = {
      code: error.code || 'UNKNOWN',
      message: error.message || 'Failed to delete address',
      status: error.response?.status,
      retryable: isRetryableError(error),
    };
    throw apiError;
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (!error.response) {
    return true;
  }

  const status = error.response?.status;

  // 5xx errors are retryable
  if (status >= 500 && status < 600) {
    return true;
  }

  // 429 (Too Many Requests) is retryable
  if (status === 429) {
    return true;
  }

  // 408 (Request Timeout) is retryable
  if (status === 408) {
    return true;
  }

  // 4xx errors (except 429, 408) are not retryable
  if (status >= 400 && status < 500) {
    return false;
  }

  // Default: not retryable
  return false;
}

/**
 * Process sync queue item with API call
 */
export async function processSyncItemWithAPI(
  item: SyncQueueItem,
  lang: string = 'en'
): Promise<any> {
  if (item.table !== 'addresses') {
    throw new Error(`Unsupported table: ${item.table}`);
  }

  const data = item.data as unknown as Address;

  switch (item.operation) {
    case 'CREATE':
      return syncCreateAddress(data, lang);
    case 'UPDATE':
      return syncUpdateAddress(data, lang);
    case 'DELETE':
      return syncDeleteAddress(item.record_id || '', lang);
    default:
      throw new Error(`Unsupported operation: ${item.operation}`);
  }
}
