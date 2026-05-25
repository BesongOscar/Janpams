/**
 * Test Helpers
 * 
 * Utility functions for testing offline-first functionality
 */

import { initDB, deleteDB, closeDB } from '../../db/database';
import { SyncManager } from '../../syncManager';
import type { Address } from '../../db/schemas';

/**
 * Setup test database
 */
export async function setupTestDB(): Promise<void> {
  await deleteDB();
  await initDB();
  await SyncManager.init();
}

/**
 * Cleanup test database
 */
export async function cleanupTestDB(): Promise<void> {
  await closeDB();
  await deleteDB();
}

/**
 * Create a test address
 */
export function createTestAddress(overrides?: Partial<Address>): Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> {
  // Generate a unique local ID similar to crypto.randomUUID()
  const localId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return {
    house_number: 123,
    street_name: 'Test Street',
    city: 'Test City',
    region: 'Test Region',
    country: 'CM',
    latitude: 4.1594,
    longitude: 9.2356,
    plus_code: 'TEST1234+56',
    property_category: 'residential',
    property_type: 'House',
    status: 'pending',
    sync_status: 'pending',
    local_id: localId,
    ...overrides,
  };
}

/**
 * Wait for sync to complete
 */
export async function waitForSync(timeout: number = 5000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const state = SyncManager.getState();
    if (state.status === 'idle' && state.pendingCount === 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Sync timeout');
}

/**
 * Simulate network offline
 */
export function simulateOffline(): void {
  // This would require mocking NetInfo
  // For now, just a placeholder
}

/**
 * Simulate network online
 */
export function simulateOnline(): void {
  // This would require mocking NetInfo
  // For now, just a placeholder
}
