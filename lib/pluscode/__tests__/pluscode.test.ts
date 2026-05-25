/**
 * Plus Code Tests
 * 
 * Tests for Plus Code encoding, decoding, and grid operations
 */

import { describe, it, expect } from '@jest/globals';
import { encode, decode, getGridBounds, getNeighborGrids, isInNeighborhood, getDisplayCode } from '@janpams/core/pluscode';

describe('Plus Code', () => {
  describe('Encoding', () => {
    it('should encode coordinates to Plus Code', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      
      const code = encode(lat, lng, 10);
      
      expect(code).toBeTruthy();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('should encode with different precision levels', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      
      const code10 = encode(lat, lng, 10);
      const code8 = encode(lat, lng, 8);
      
      expect(code10).not.toBe(code8);
      expect(code10.length).toBeGreaterThanOrEqual(code8.length);
    });
  });

  describe('Decoding', () => {
    it('should decode Plus Code to coordinates', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      const code = encode(lat, lng, 10);
      
      const decoded = decode(code);
      
      expect(decoded).toHaveProperty('latitude');
      expect(decoded).toHaveProperty('longitude');
      expect(decoded.latitude).toBeCloseTo(lat, 4);
      expect(decoded.longitude).toBeCloseTo(lng, 4);
    });
  });

  describe('Grid Bounds', () => {
    it('should calculate grid bounds for coordinates', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      
      const bounds = getGridBounds(lat, lng);
      
      expect(bounds).toHaveProperty('sw');
      expect(bounds).toHaveProperty('ne');
      expect(Array.isArray(bounds.sw)).toBe(true);
      expect(Array.isArray(bounds.ne)).toBe(true);
      expect(bounds.sw).toHaveLength(2);
      expect(bounds.ne).toHaveLength(2);
      expect(bounds.sw[0]).toBeLessThanOrEqual(bounds.ne[0]);
      expect(bounds.sw[1]).toBeLessThanOrEqual(bounds.ne[1]);
    });

    it('should get neighbor grids', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      const bounds = getGridBounds(lat, lng);
      
      const neighbors = getNeighborGrids(bounds);
      
      expect(neighbors).toHaveLength(8);
      neighbors.forEach(b => {
        expect(b).toHaveProperty('sw');
        expect(b).toHaveProperty('ne');
        expect(Array.isArray(b.sw)).toBe(true);
        expect(Array.isArray(b.ne)).toBe(true);
      });
    });
  });

  describe('Neighborhood Check', () => {
    it('should check if coordinates are in neighborhood', () => {
      const centerLat = 4.1594;
      const centerLng = 9.2356;
      const gridBounds = getGridBounds(centerLat, centerLng);
      
      // Point very close to center (should be in neighborhood)
      const nearbyLat = 4.1595;
      const nearbyLng = 9.2357;
      
      const isNearby = isInNeighborhood([nearbyLat, nearbyLng], gridBounds);
      expect(isNearby).toBe(true);
    });
  });

  describe('Display Code', () => {
    it('should format Plus Code for display', () => {
      const lat = 4.1594;
      const lng = 9.2356;
      const display = getDisplayCode(lat, lng);
      
      expect(display).toBeTruthy();
      expect(typeof display).toBe('string');
    });
  });
});
