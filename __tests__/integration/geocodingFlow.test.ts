/**
 * Integration Tests: Geocoding Flow
 * 
 * Tests the complete geocoding flow from coordinates to address components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initDB, deleteDB, closeDB } from '../../lib/db/database';
import { offlineReverseGeocode } from '../../lib/geocoding/reverseGeocode';
import { getAddressComponents } from '../../lib/geocoding/getAddressComponents';
import { resolveStreetAddress } from '../../lib/offlineDataPacks';

describe('Geocoding Flow Integration', () => {
  beforeEach(async () => {
    await deleteDB();
    await initDB();
  });

  afterEach(async () => {
    await closeDB();
  });

  describe('Offline Reverse Geocoding', () => {
    it('should geocode coordinates to address', async () => {
      // Test with coordinates in Cameroon (Buea area)
      const lat = 4.1594;
      const lng = 9.2356;

      const result = await offlineReverseGeocode(lat, lng, {
        cameroonTuning: true,
      });

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rawAdmin');
      expect(result).toHaveProperty('rawSettlements');
    });

    it('should extract address components', async () => {
      const lat = 4.1594;
      const lng = 9.2356;

      const geocodeResult = await offlineReverseGeocode(lat, lng);
      const components = await getAddressComponents({
        latitude: lat,
        longitude: lng,
        lang: 'en',
      });

      expect(components).toHaveProperty('street_name');
      expect(components).toHaveProperty('city');
      expect(components).toHaveProperty('region');
      expect(components).toHaveProperty('country');
    });
  });

  describe('Street Address Resolution', () => {
    it('should resolve street address with house number', async () => {
      const lat = 4.1594;
      const lng = 9.2356;

      const result = await resolveStreetAddress(lat, lng, 60);

      expect(result).toHaveProperty('street');
      expect(result).toHaveProperty('admin');
      expect(result).toHaveProperty('houseNumber');
      expect(result).toHaveProperty('chainage');
    });

    it('should handle coordinates without street data', async () => {
      // Coordinates far from any street
      const lat = 0.0;
      const lng = 0.0;

      const result = await resolveStreetAddress(lat, lng, 60);

      // Should still return result structure
      expect(result).toHaveProperty('street');
      expect(result).toHaveProperty('admin');
      // House number may be null if no street found
    });
  });

  describe('End-to-End Geocoding', () => {
    it('should geocode coordinates to complete address', async () => {
      const lat = 4.1594;
      const lng = 9.2356;

      // Step 1: Reverse geocode
      const geocodeResult = await offlineReverseGeocode(lat, lng);

      // Step 2: Extract components
      const components = await getAddressComponents({
        latitude: lat,
        longitude: lng,
        lang: 'en',
      });

      // Step 3: Resolve street address
      const streetAddress = await resolveStreetAddress(lat, lng, 60);

      // Verify all steps completed
      expect(geocodeResult).not.toBeNull();
      expect(components).not.toBeNull();
      expect(streetAddress).not.toBeNull();

      // Verify components are populated
      expect(components.street_name || components.road).toBeTruthy();
      expect(components.city || components.town).toBeTruthy();
      expect(components.region || components.state).toBeTruthy();
      expect(components.country || components.country_code).toBeTruthy();
    });
  });
});
