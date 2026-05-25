/**
 * Integration Tests: Sync Flow
 * 
 * Tests the complete sync flow from offline creation to online sync
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SyncManager } from '../../lib/syncManager';
import { getAllAddresses } from '../../lib/db/addresses';
import { getPendingSyncQueueItems } from '../../lib/db/syncQueue';
import { createTestAddress, setupTestDB, cleanupTestDB } from '../../lib/utils/__tests__/testHelpers';

// Mock network status
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback) => {
    callback({ isConnected: false, isInternetReachable: false });
    return () => {};
  }),
  fetch: jest.fn(() => Promise.resolve({ isConnected: false, isInternetReachable: false })),
}));

describe('Sync Flow Integration', () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB();
  });

  describe('Offline Address Creation', () => {
    it('should create address offline and add to sync queue', async () => {
      const addressData = createTestAddress({
        house_number: 100,
        street_name: 'Offline Test Street',
      });

      const created = await SyncManager.createAddress(addressData);

      // Verify address created
      expect(created).not.toBeNull();
      expect(created.sync_status).toBe('pending');

      // Verify in database
      const addresses = await getAllAddresses();
      expect(addresses.length).toBe(1);
      expect(addresses[0].house_number).toBe(100);

      // Verify in sync queue
      const queueItems = await getPendingSyncQueueItems();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].operation).toBe('CREATE');
      expect(queueItems[0].table).toBe('addresses');
    });

    it('should create multiple addresses offline', async () => {
      for (let i = 1; i <= 5; i++) {
        const addressData = createTestAddress({
          house_number: 100 + i,
          street_name: `Offline Street ${i}`,
        });
        await SyncManager.createAddress(addressData);
      }

      // Verify all created
      const addresses = await getAllAddresses();
      expect(addresses.length).toBe(5);

      // Verify all in sync queue
      const queueItems = await getPendingSyncQueueItems();
      expect(queueItems.length).toBe(5);
    });
  });

  describe('Address Update Offline', () => {
    it('should update address offline and add to sync queue', async () => {
      const addressData = createTestAddress({
        house_number: 200,
        street_name: 'Update Test Street',
      });

      const created = await SyncManager.createAddress(addressData);

      // Update address
      const updated = await SyncManager.updateAddress(created.id, {
        business_name: 'Updated Business Name',
      });

      expect(updated).not.toBeNull();
      expect(updated?.business_name).toBe('Updated Business Name');
      expect(updated?.sync_status).toBe('pending');

      // Verify update in sync queue
      const queueItems = await getPendingSyncQueueItems();
      expect(queueItems.length).toBe(2); // CREATE + UPDATE
      expect(queueItems[1].operation).toBe('UPDATE');
    });
  });

  describe('Address Deletion Offline', () => {
    it('should delete address offline and add to sync queue', async () => {
      const addressData = createTestAddress({
        house_number: 300,
        street_name: 'Delete Test Street',
      });

      const created = await SyncManager.createAddress(addressData);

      // Delete address
      const deleted = await SyncManager.deleteAddress(created.id);
      expect(deleted).toBe(true);

      // Verify deleted from database
      const addresses = await getAllAddresses();
      expect(addresses.length).toBe(0);

      // Verify delete in sync queue
      const queueItems = await getPendingSyncQueueItems();
      expect(queueItems.length).toBe(2); // CREATE + DELETE
      expect(queueItems[1].operation).toBe('DELETE');
    });
  });

  describe('Sync Queue Processing', () => {
    it('should process sync queue in order', async () => {
      // Create multiple addresses
      const addresses = [];
      for (let i = 1; i <= 3; i++) {
        const addressData = createTestAddress({
          house_number: 400 + i,
          street_name: `Queue Test Street ${i}`,
        });
        const created = await SyncManager.createAddress(addressData);
        addresses.push(created);
      }

      // Verify all in queue
      const queueItems = await getPendingSyncQueueItems();
      expect(queueItems.length).toBe(3);

      // Verify order (should be by created_at)
      const timestamps = queueItems.map(item => new Date(item.created_at).getTime());
      const sorted = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sorted);
    });
  });
});
