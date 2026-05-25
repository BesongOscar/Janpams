/**
 * Performance Monitor
 * 
 * Utility for monitoring and logging performance metrics
 * Useful for identifying bottlenecks during testing
 */

export interface PerformanceMetric {
  operation: string;
  duration: number; // milliseconds
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private enabled: boolean = __DEV__; // Only enabled in development

  /**
   * Measure execution time of an async function
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.record(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.record(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure execution time of a sync function
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.record(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.record(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  record(operation: string, duration: number, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Log slow operations (>1 second)
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation: ${operation} took ${duration.toFixed(2)}ms`, metadata);
    } else {
      console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`);
    }

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operation: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.operation === operation);
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operation: string): number {
    const operationMetrics = this.getMetricsForOperation(operation);
    if (operationMetrics.length === 0) return 0;

    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  /**
   * Get statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    total: number;
  } {
    const operationMetrics = this.getMetricsForOperation(operation);
    if (operationMetrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, total: 0 };
    }

    const durations = operationMetrics.map(m => m.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return { count: operationMetrics.length, average, min, max, total };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const operations = new Set(this.metrics.map(m => m.operation));
    const report: string[] = ['Performance Report', '==================', ''];

    operations.forEach(operation => {
      const stats = this.getStats(operation);
      report.push(`${operation}:`);
      report.push(`  Count: ${stats.count}`);
      report.push(`  Average: ${stats.average.toFixed(2)}ms`);
      report.push(`  Min: ${stats.min.toFixed(2)}ms`);
      report.push(`  Max: ${stats.max.toFixed(2)}ms`);
      report.push(`  Total: ${stats.total.toFixed(2)}ms`);
      report.push('');
    });

    return report.join('\n');
  }
}

export const performanceMonitor = new PerformanceMonitor();
