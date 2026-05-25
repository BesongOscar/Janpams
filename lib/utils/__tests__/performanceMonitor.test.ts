/**
 * Performance Monitor Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { performanceMonitor } from '../performanceMonitor';

describe('Performance Monitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
    performanceMonitor.setEnabled(true);
  });

  describe('Measurement', () => {
    it('should measure async operation duration', async () => {
      await performanceMonitor.measure('test-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const metrics = performanceMonitor.getMetricsForOperation('test-operation');
      expect(metrics.length).toBe(1);
      expect(metrics[0].duration).toBeGreaterThan(90); // Allow some variance
      expect(metrics[0].duration).toBeLessThan(150);
    });

    it('should measure sync operation duration', () => {
      performanceMonitor.measureSync('test-sync', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      const metrics = performanceMonitor.getMetricsForOperation('test-sync');
      expect(metrics.length).toBe(1);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should record metadata', async () => {
      await performanceMonitor.measure(
        'test-with-metadata',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        },
        { testKey: 'testValue' }
      );

      const metrics = performanceMonitor.getMetricsForOperation('test-with-metadata');
      expect(metrics[0].metadata).toEqual({ testKey: 'testValue' });
    });
  });

  describe('Statistics', () => {
    it('should calculate average duration', async () => {
      for (let i = 0; i < 5; i++) {
        await performanceMonitor.measure('stats-test', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      const average = performanceMonitor.getAverageDuration('stats-test');
      expect(average).toBeGreaterThan(40);
      expect(average).toBeLessThan(100);
    });

    it('should calculate stats', async () => {
      for (let i = 0; i < 3; i++) {
        await performanceMonitor.measure('stats-test-2', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      const stats = performanceMonitor.getStats('stats-test-2');
      expect(stats.count).toBe(3);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate performance report', async () => {
      await performanceMonitor.measure('report-test-1', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      await performanceMonitor.measure('report-test-2', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const report = performanceMonitor.generateReport();
      expect(report).toContain('Performance Report');
      expect(report).toContain('report-test-1');
      expect(report).toContain('report-test-2');
    });
  });
});
