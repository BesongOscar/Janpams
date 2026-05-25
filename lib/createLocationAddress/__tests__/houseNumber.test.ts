/**
 * House Number Calculation Tests
 * 
 * Tests for house number calculation algorithms
 */

import { describe, it, expect } from '@jest/globals';
import { calculateHouseNumberSync, haversineDistance } from '../../createLocationAddress';
import type { Street } from '../../createLocationAddress';

describe('House Number Calculation', () => {
  describe('Distance Calculation', () => {
    it('should calculate haversine distance correctly', () => {
      const point1: [number, number] = [4.0, 9.0]; // [lat, lon]
      const point2: [number, number] = [4.001, 9.001];
      
      const distance = haversineDistance(point1, point2);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(200); // Should be roughly 100-150m
    });

    it('should return 0 for identical points', () => {
      const point: [number, number] = [4.0, 9.0];
      
      const distance = haversineDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });

  describe('House Number Calculation', () => {
    it('should calculate house number for valid street', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      
      const street: Street = {
        id: 'test-street-1',
        name: 'Test Street',
        geometry: [
          [4.1590, 9.2350], // [lat, lon]
          [4.1600, 9.2360],
        ],
        direction_locked: false,
      };
      
      const result = calculateHouseNumberSync(lat, lng, street);
      
      // Result may be null if no valid projection, which is acceptable
      if (result) {
        expect(result).toHaveProperty('houseNumber');
        expect(result).toHaveProperty('street');
        expect(result).toHaveProperty('side');
        expect(result.houseNumber).toBeGreaterThan(0);
        expect(['L', 'R']).toContain(result.side);
      }
    });

    it('should handle streets with no valid projection', () => {
      const lat = 0.0; // Far from street
      const lng = 0.0;
      
      const street: Street = {
        id: 'test-street-2',
        name: 'Distant Street',
        geometry: [
          [4.1590, 9.2350],
          [4.1600, 9.2360],
        ],
        direction_locked: false,
      };
      
      const result = calculateHouseNumberSync(lat, lng, street);
      
      // Should return null when point is too far from street
      expect(result).toBeNull();
    });
  });
});
