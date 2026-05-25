/**
 * Reverse Geocoding Tests
 * 
 * Tests for offline reverse geocoding functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initDB, deleteDB, closeDB } from '../../db/database';
import { offlineReverseGeocode } from '../reverseGeocode';

describe('Reverse Geocoding', () => {
  beforeEach(async () => {
    await deleteDB();
    await initDB();
  });

  afterEach(async () => {
    await closeDB();
  });

  describe('Offline Reverse Geocode', () => {
    it('should return address components for valid coordinates', async () => {
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

    it('should handle coordinates without data packs gracefully', async () => {
      // Test with coordinates that may not have data packs
      const lat = 0.0;
      const lng = 0.0;
      
      const result = await offlineReverseGeocode(lat, lng);
      
      // Should still return a result structure, even if empty
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('confidence');
    });

    it('should return confidence scores', async () => {
      const lat = 4.1594;
      const lng = 9.2356;
      
      const result = await offlineReverseGeocode(lat, lng);
      
      expect(result.confidence).toHaveProperty('score');
      expect(result.confidence).toHaveProperty('method');
      expect(result.confidence.score).toBeGreaterThanOrEqual(0);
      expect(result.confidence.score).toBeLessThanOrEqual(1);
    });
  });
});
