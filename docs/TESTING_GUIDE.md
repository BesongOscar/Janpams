# Testing Guide

## Overview

This document outlines the testing strategy and procedures for the JanGO mobile app's offline-first implementation.

## Test Structure

### Unit Tests
- **Location**: `lib/**/__tests__/`
- **Purpose**: Test individual functions and modules in isolation
- **Coverage**: Business logic, utilities, database operations

### Integration Tests
- **Location**: `__tests__/integration/`
- **Purpose**: Test interactions between multiple modules
- **Coverage**: Database + Sync, Geocoding + Address Creation, etc.

### Manual Testing Scenarios
- **Location**: This document
- **Purpose**: End-to-end user flows
- **Coverage**: Complete user journeys

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- database.test.ts
```

## Test Categories

### 1. Database Tests

**File**: `lib/db/__tests__/database.test.ts`

**Test Cases**:
- Database initialization
- Table creation
- CRUD operations
- Transaction handling
- Migration testing

**Example**:
```typescript
it('should create an address', async () => {
  await initDB();
  const address = createTestAddress();
  await createAddress(address);
  const addresses = await getAllAddresses();
  expect(addresses.length).toBe(1);
});
```

### 2. Sync Manager Tests

**File**: `lib/sync/__tests__/syncManager.test.ts`

**Test Cases**:
- Address creation with sync queue
- Address update with sync queue
- Address deletion with sync queue
- Sync status tracking
- Retry logic
- Conflict resolution

**Example**:
```typescript
it('should create address and add to sync queue', async () => {
  const address = createTestAddress();
  const created = await SyncManager.createAddress(address);
  expect(created.sync_status).toBe('pending');
});
```

### 3. Geocoding Tests

**File**: `lib/geocoding/__tests__/reverseGeocode.test.ts`

**Test Cases**:
- Offline reverse geocoding
- Address component extraction
- Confidence scoring
- Fallback handling

### 4. Plus Code Tests

**File**: `lib/pluscode/__tests__/pluscode.test.ts`

**Test Cases**:
- Encoding coordinates
- Decoding Plus Codes
- Grid bounds calculation
- Neighbor grid detection

### 5. House Number Calculation Tests

**File**: `lib/createLocationAddress/__tests__/houseNumber.test.ts`

**Test Cases**:
- Distance calculations
- House number calculation
- Side-of-street detection
- Invalid projection handling

## Manual Testing Scenarios

### Scenario 1: Online Address Creation

**Steps**:
1. Ensure device is online
2. Open create-address form
3. Fill in address details
4. Submit form
5. Verify address appears in my-addresses
6. Verify sync status shows "synced"

**Expected**:
- Address created immediately
- Sync status updates to "synced" quickly
- Address visible in list

### Scenario 2: Offline Address Creation

**Steps**:
1. Turn off device network (airplane mode)
2. Open create-address form
3. Fill in address details
4. Submit form
5. Verify address appears in my-addresses
6. Verify sync status shows "pending"
7. Turn network back on
8. Wait for sync to complete
9. Verify sync status updates to "synced"

**Expected**:
- Address created successfully offline
- Sync status shows "pending"
- Address syncs automatically when online
- Sync status updates to "synced"

### Scenario 3: Multiple Offline Addresses

**Steps**:
1. Turn off network
2. Create 5 addresses offline
3. Verify all show "pending" status
4. Turn network back on
5. Wait for all to sync
6. Verify all show "synced" status

**Expected**:
- All addresses created offline
- All sync when online
- Sync queue processes in order

### Scenario 4: Network Interruption During Sync

**Steps**:
1. Create address offline
2. Turn network on
3. Start sync
4. Turn network off mid-sync
5. Turn network back on
6. Verify sync retries and completes

**Expected**:
- Sync retries automatically
- Address eventually syncs
- No data loss

### Scenario 5: Address Editing Offline

**Steps**:
1. Create address (online or offline)
2. Edit address offline
3. Verify sync status shows "pending"
4. Turn network on
5. Verify update syncs

**Expected**:
- Edit saved locally
- Update queued for sync
- Update syncs when online

### Scenario 6: Data Pack Usage

**Steps**:
1. Download data pack for region
2. Turn off network
3. Create address in that region
4. Verify geocoding works offline
5. Verify house number calculated

**Expected**:
- Geocoding works without network
- House number calculated from street data
- Address components populated correctly

### Scenario 7: App Restart During Sync

**Steps**:
1. Create address offline
2. Turn network on
3. Start sync
4. Force close app
5. Reopen app
6. Verify sync resumes

**Expected**:
- Sync queue persists
- Sync resumes on app restart
- Address eventually syncs

### Scenario 8: Large Address List

**Steps**:
1. Create 100+ addresses
2. Open my-addresses screen
3. Verify list loads quickly
4. Test filtering by sync status
5. Test scrolling performance

**Expected**:
- List loads in <2 seconds
- Smooth scrolling
- Filters work correctly

### Scenario 9: Conflict Resolution

**Steps**:
1. Create address on device A
2. Sync to server
3. Edit same address on device B
4. Sync device B
5. Edit same address on device A
6. Sync device A
7. Verify conflict handling

**Expected**:
- Conflict detected
- User notified
- Resolution strategy applied

### Scenario 10: 7+ Days Offline

**Steps**:
1. Create 20 addresses offline
2. Keep device offline for 7+ days
3. Turn network on
4. Verify all addresses sync
5. Verify no data corruption

**Expected**:
- All addresses preserved
- All sync successfully
- No errors or corruption

## Performance Benchmarks

### Database Operations
- **Address Creation**: <100ms
- **Address Query**: <50ms (single)
- **Address List (100 items)**: <200ms
- **Sync Queue Processing**: <500ms per item

### Geocoding
- **Offline Reverse Geocode**: <500ms
- **Address Component Extraction**: <100ms
- **House Number Calculation**: <200ms

### Sync
- **Queue Processing**: <1s per item
- **Background Sync**: Non-blocking
- **Conflict Detection**: <100ms

## Edge Cases to Test

1. **Empty Database**: App behavior with no data
2. **Corrupted Database**: Recovery mechanisms
3. **Full Storage**: Handling when device storage is full
4. **Low Memory**: App behavior under memory pressure
5. **Battery Saver Mode**: Background sync behavior
6. **Timezone Changes**: Timestamp handling
7. **Invalid Coordinates**: Handling of invalid lat/lng
8. **Very Large Addresses**: Long street names, etc.
9. **Special Characters**: Unicode handling
10. **Concurrent Operations**: Multiple simultaneous creates/updates

## Test Data

### Test Coordinates
- **Buea, Cameroon**: `4.1594, 9.2356`
- **Douala, Cameroon**: `4.0511, 9.7679`
- **Yaoundé, Cameroon**: `3.8480, 11.5021`

### Test Addresses
See `lib/utils/__tests__/testHelpers.ts` for `createTestAddress()` helper.

## Continuous Integration

Tests run automatically on:
- Pull requests
- Merge to main/dev branches
- Nightly builds

See `.gitlab-ci.yml` for CI configuration.

## Reporting Issues

When reporting test failures:
1. Include test name and file
2. Include error message and stack trace
3. Include device/OS information
4. Include steps to reproduce
5. Include expected vs actual behavior
