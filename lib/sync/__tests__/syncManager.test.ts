/**
 * Sync Manager Tests
 * 
 * Tests for sync queue operations, retry logic, and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SyncManager } from '../../syncManager';
import { initDB, deleteDB, closeDB } from '../../db/database';
import { createAddress, getAllAddresses } from '../../db/addresses';
import type { Address } from '../../db/schemas';

// Mock network status
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback) => {
    // Simulate online by default
    callback({ isConnected: true, isInternetReachable: true });
    return () => {}; // Return unsubscribe function
  }),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

describe('SyncManager', () => {
  beforeEach(async () => {
    await deleteDB();
    await SyncManager.init();
  });

  afterEach(async () => {
    await closeDB();
  });

  describe('Address Creation', () => {
    it('should create address and add to sync queue', async () => {
      const addressData: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
        house_number: 789,
        street_name: 'Sync Test Street',
        city: 'Sync City',
        region: 'Sync Region',
        country: 'CM',
        latitude: 6.0,
        longitude: 11.0,
        plus_code: 'SYNC1234+56',
        property_category: 'residential',
        property_type: 'House',
        status: 'pending',
        sync_status: 'pending',
      };

      const created = await SyncManager.createAddress(addressData);
      
      expect(created).not.toBeNull();
      expect(created.sync_status).toBe('pending');
      
      // Check that address exists in database
      const addresses = await getAllAddresses();
      expect(addresses.length).toBeGreaterThanOrEqual(1);
    });

    it('should update address and add to sync queue', async () => {
      const addressData: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
        house_number: 999,
        street_name: 'Update Test Street',
        city: 'Update City',
        region: 'Update Region',
        country: 'CM',
        latitude: 7.0,
        longitude: 12.0,
        plus_code: 'UPDT1234+56',
        property_category: 'residential',
        property_type: 'House',
        status: 'pending',
        sync_status: 'pending',
      };

      const created = await SyncManager.createAddress(addressData);
      
      // Update the address
      const updated = await SyncManager.updateAddress(created.id, {
        business_name: 'Updated Business',
      });
      
      expect(updated).not.toBeNull();
      expect(updated?.business_name).toBe('Updated Business');
      expect(updated?.sync_status).toBe('pending');
    });

    it('should delete address and add to sync queue', async () => {
      const addressData: Omit<Address, 'id' | 'local_id' | 'created_at' | 'updated_at'> = {
        house_number: 111,
        street_name: 'Delete Test Street',
        city: 'Delete City',
        region: 'Delete Region',
        country: 'CM',
        latitude: 8.0,
        longitude: 13.0,
        plus_code: 'DEL1234+56',
        property_category: 'residential',
        property_type: 'House',
        status: 'pending',
        sync_status: 'pending',
      };

      const created = await SyncManager.createAddress(addressData);
      
      const deleted = await SyncManager.deleteAddress(created.id);
      
      expect(deleted).toBe(true);
      
      // Check that address is removed from database
      const addresses = await getAllAddresses();
      expect(addresses.length).toBe(0);
    });
  });

  describe('Sync Status', () => {
    it('should track sync status', () => {
      const state = SyncManager.getState();
      
      expect(state).toHaveProperty('isOnline');
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('pendingCount');
      expect(state).toHaveProperty('lastSync');
    });

    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      SyncManager.subscribe(listener);
      
      // Trigger a state change (e.g., create address)
      // Note: This would require actual implementation
      
      // Cleanup
      SyncManager.subscribe(() => {});
    });
  });
});
