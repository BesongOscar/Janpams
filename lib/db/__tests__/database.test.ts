/**
 * Database Tests
 * 
 * Tests for database initialization, schema, and basic operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initDB, getDB, closeDB, deleteDB } from '../database';
import { createAddress, getAddressById, getAllAddresses } from '../addresses';
import type { Address } from '../schemas';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('Database', () => {
  beforeEach(async () => {
    // Clean up before each test
    await deleteDB();
  });

  afterEach(async () => {
    // Clean up after each test
    await closeDB();
  });

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      await expect(initDB()).resolves.not.toThrow();
    });

    it('should create all tables', async () => {
      await initDB();
      const db = await getDB();
      
      // Check that addresses table exists
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='addresses'"
      );
      
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Address Operations', () => {
    it('should create an address', async () => {
      await initDB();
      
      const address: Address = {
        id: `test-${Date.now()}`,
        local_id: `local-${Date.now()}`,
        house_number: 123,
        street_name: 'Test Street',
        city: 'Test City',
        region: 'Test Region',
        country: 'CM',
        latitude: 4.0,
        longitude: 9.0,
        plus_code: 'TEST1234+56',
        property_category: 'residential',
        property_type: 'House',
        status: 'pending',
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createAddress(address);
      
      const addresses = await getAllAddresses();
      expect(addresses.length).toBe(1);
      expect(addresses[0].house_number).toBe(123);
      expect(addresses[0].street_name).toBe('Test Street');
    });

    it('should retrieve address by ID', async () => {
      await initDB();
      
      const addressId = `test-${Date.now()}`;
      const address: Address = {
        id: addressId,
        local_id: `local-${Date.now()}`,
        house_number: 456,
        street_name: 'Another Street',
        city: 'Another City',
        region: 'Another Region',
        country: 'CM',
        latitude: 5.0,
        longitude: 10.0,
        plus_code: 'TEST5678+90',
        property_category: 'commercial',
        property_type: 'Shop',
        status: 'pending',
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createAddress(address);
      const retrieved = await getAddressById(addressId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.house_number).toBe(456);
    });
  });
});
