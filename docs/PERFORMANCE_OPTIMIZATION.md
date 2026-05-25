# Performance Optimization Guide

## Overview

This document outlines performance optimization strategies and benchmarks for the JanGO mobile app.

## Performance Benchmarks

### Target Metrics

| Operation | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| Address Creation | <100ms | <200ms | >500ms |
| Address Query (single) | <50ms | <100ms | >200ms |
| Address List (100 items) | <200ms | <500ms | >1000ms |
| Offline Reverse Geocode | <500ms | <1000ms | >2000ms |
| House Number Calculation | <200ms | <500ms | >1000ms |
| Sync Queue Processing | <1s/item | <2s/item | >5s/item |
| Database Initialization | <500ms | <1000ms | >2000ms |

## Optimization Strategies

### 1. Database Optimization

#### Indexes
- All foreign keys indexed
- Frequently queried columns indexed
- Composite indexes for common query patterns

#### Query Optimization
- Use prepared statements
- Batch operations when possible
- Limit result sets with LIMIT
- Use transactions for multiple operations

#### Example:
```typescript
// Good: Use index
const addresses = await queryAll<Address>(
  'SELECT * FROM addresses WHERE plus_code = ?',
  [plusCode]
);

// Bad: Full table scan
const addresses = await queryAll<Address>(
  'SELECT * FROM addresses'
);
```

### 2. Geocoding Optimization

#### Caching
- Cache geocoding results for recent coordinates
- Cache admin boundary lookups
- Cache settlement place queries

#### Spatial Indexing
- Use bounding box queries before polygon checks
- Limit search radius
- Use grid-based spatial partitioning

#### Example:
```typescript
// Good: Limit search radius
const streets = await findClosestStreets(lat, lon, 60); // 60m max

// Bad: Search all streets
const allStreets = await getAllStreets();
```

### 3. Sync Optimization

#### Batch Processing
- Process multiple items in single transaction
- Group related operations
- Limit concurrent API calls

#### Retry Strategy
- Exponential backoff
- Maximum retry limit
- Skip non-retryable errors

#### Example:
```typescript
// Good: Batch sync
await syncBatch(queueItems.slice(0, 10));

// Bad: Sync one by one
for (const item of queueItems) {
  await syncItem(item);
}
```

### 4. Memory Management

#### Large Lists
- Use FlatList with pagination
- Virtualize long lists
- Clear unused data

#### Image Handling
- Compress images before storage
- Use thumbnails for lists
- Clear image cache periodically

### 5. Network Optimization

#### Request Batching
- Batch multiple API calls
- Use GraphQL if available
- Minimize request size

#### Offline-First
- Queue operations when offline
- Sync in background
- Don't block UI on network calls

## Performance Monitoring

### Using Performance Monitor

```typescript
import { performanceMonitor } from '@/lib/utils/performanceMonitor';

// Measure async operation
const result = await performanceMonitor.measure(
  'create-address',
  async () => {
    await SyncManager.createAddress(address);
  }
);

// Measure sync operation
const value = performanceMonitor.measureSync(
  'calculate-house-number',
  () => {
    return calculateHouseNumberSync(lat, lon, street);
  }
);

// Get statistics
const stats = performanceMonitor.getStats('create-address');
console.log(`Average: ${stats.average}ms`);

// Generate report
console.log(performanceMonitor.generateReport());
```

### Performance Logging

Performance metrics are automatically logged in development mode:
- Operations taking >1 second are logged as warnings
- All operations are logged with duration
- Metadata can be attached for debugging

## Common Performance Issues

### 1. N+1 Query Problem

**Problem**: Querying database in a loop
```typescript
// Bad
for (const id of ids) {
  const address = await getAddressById(id);
}
```

**Solution**: Batch query
```typescript
// Good
const addresses = await getAddressesByIds(ids);
```

### 2. Unnecessary Re-renders

**Problem**: Component re-renders on every state change
```typescript
// Bad
useEffect(() => {
  setData(processData(rawData));
}, [rawData]); // Re-processes on every change
```

**Solution**: Memoization
```typescript
// Good
const processedData = useMemo(() => {
  return processData(rawData);
}, [rawData]);
```

### 3. Large State Updates

**Problem**: Updating entire state object
```typescript
// Bad
setState({ ...state, field: value }); // Creates new object
```

**Solution**: Update only changed fields
```typescript
// Good
setStateField(value); // Direct field update
```

### 4. Synchronous Heavy Operations

**Problem**: Blocking UI thread
```typescript
// Bad
const result = heavyCalculation(); // Blocks UI
```

**Solution**: Use async/background processing
```typescript
// Good
const result = await heavyCalculationAsync(); // Non-blocking
```

## Profiling Tools

### React Native Performance Monitor
- Built-in performance monitor
- Shows render times
- Identifies slow components

### Flipper
- Network inspector
- Database inspector
- Layout inspector

### Chrome DevTools
- Memory profiling
- CPU profiling
- Network analysis

## Optimization Checklist

- [ ] All database queries use indexes
- [ ] Large lists use pagination/virtualization
- [ ] Images are compressed
- [ ] Geocoding results are cached
- [ ] Sync operations are batched
- [ ] Heavy operations are async
- [ ] Unnecessary re-renders prevented
- [ ] Memory leaks checked
- [ ] Performance benchmarks met
- [ ] Slow operations identified and optimized

## Monitoring in Production

### Key Metrics to Track
1. **Address Creation Time**: Average time to create address
2. **Sync Queue Size**: Number of pending sync items
3. **Geocoding Latency**: Time to resolve address
4. **Database Query Time**: Average query duration
5. **App Startup Time**: Time to first render
6. **Memory Usage**: Peak memory consumption
7. **Battery Impact**: Background sync efficiency

### Alert Thresholds
- Address creation >500ms
- Sync queue >100 items
- Geocoding >2000ms
- Database query >200ms
- Memory usage >200MB

## Best Practices

1. **Measure First**: Profile before optimizing
2. **Optimize Hot Paths**: Focus on frequently used code
3. **Cache Aggressively**: Cache expensive operations
4. **Batch Operations**: Group related operations
5. **Lazy Load**: Load data only when needed
6. **Debounce/Throttle**: Limit frequent operations
7. **Use Native Modules**: For performance-critical code
8. **Monitor Continuously**: Track performance over time
