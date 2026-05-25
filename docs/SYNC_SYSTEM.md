# Sync System Documentation

## Overview

The JanGO mobile app uses an offline-first sync system that queues operations when offline and syncs them when online. This ensures users can create and edit addresses even without network connectivity.

## Architecture

### Components

1. **SyncManager**: Core sync orchestration
2. **Sync Queue**: Database table storing pending operations
3. **API Client**: Handles communication with backend
4. **Background Sync**: Periodic sync in background
5. **Network Monitor**: Tracks online/offline status

## Sync Flow

### 1. Address Creation (Offline)

```
User creates address
    ↓
SyncManager.createAddress()
    ↓
Save to local database (sync_status='pending')
    ↓
Add to sync_queue (operation='CREATE')
    ↓
If online: Trigger sync immediately
If offline: Queue for later sync
```

### 2. Address Update (Offline)

```
User updates address
    ↓
SyncManager.updateAddress()
    ↓
Update local database (sync_status='pending')
    ↓
Add to sync_queue (operation='UPDATE')
    ↓
If online: Trigger sync immediately
If offline: Queue for later sync
```

### 3. Address Deletion (Offline)

```
User deletes address
    ↓
SyncManager.deleteAddress()
    ↓
Delete from local database
    ↓
Add to sync_queue (operation='DELETE')
    ↓
If online: Trigger sync immediately
If offline: Queue for later sync
```

### 4. Sync Process (Online)

```
Network comes online
    ↓
SyncManager detects online status
    ↓
Get pending items from sync_queue
    ↓
For each item:
    - Mark as 'processing'
    - Call API endpoint
    - On success: Mark as 'synced', remove from queue
    - On failure: Increment attempts, mark as 'pending'
    - On retryable error: Retry with exponential backoff
    - On non-retryable error: Mark as 'failed'
```

## Sync Queue Structure

### Queue Item Fields

- `id`: Unique identifier
- `operation`: 'CREATE', 'UPDATE', or 'DELETE'
- `table`: Table name (always 'addresses' for now)
- `record_id`: Server ID (if exists) or local ID
- `local_id`: Local ID for offline-created records
- `data`: JSON string of operation data
- `status`: 'pending', 'processing', 'synced', 'failed'
- `attempts`: Number of sync attempts
- `last_error`: Last error message (if any)
- `created_at`: When item was added to queue
- `updated_at`: Last update timestamp

## Retry Logic

### Exponential Backoff

Retry delays increase exponentially:
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds
- Maximum: 60 seconds

### Maximum Attempts

- Default: 5 attempts
- Configurable per operation type
- After max attempts: Mark as 'failed'

### Retryable Errors

- Network errors (timeout, connection refused)
- 5xx server errors
- Rate limiting (429)

### Non-Retryable Errors

- 4xx client errors (except 429)
- Authentication errors (401)
- Validation errors (400)
- Not found errors (404)

## Conflict Resolution

### Conflict Detection

Conflicts occur when:
1. Address updated on server after local update
2. Address deleted on server but updated locally
3. Concurrent edits on multiple devices

### Resolution Strategies

1. **Last Write Wins**: Use most recent timestamp
2. **Server Wins**: Prefer server version
3. **Client Wins**: Prefer local version
4. **Merge**: Combine changes when possible
5. **User Choice**: Prompt user to resolve

### Current Implementation

- Basic conflict detection on sync
- Mark address as 'conflict' status
- User must manually resolve
- Future: Automatic merge when possible

## Background Sync

### Configuration

- **Task Name**: `background-sync`
- **Minimum Interval**: 15 minutes
- **Required Network**: Any (WiFi or cellular)

### Implementation

```typescript
import { registerBackgroundSync } from '@/lib/sync/backgroundSync';

// Register background sync task
await registerBackgroundSync();

// Task runs automatically in background
// Calls SyncManager.syncPendingChanges()
```

### Limitations

- iOS: Limited by system background execution time
- Android: More reliable, can run longer
- Battery impact: Minimal, only syncs when needed

## Network Monitoring

### Implementation

Uses `@react-native-community/netinfo`:
- Monitors network state changes
- Triggers sync when coming online
- Pauses sync when going offline

### States

- **Online**: Connected to internet
- **Offline**: No internet connection
- **Unknown**: Network state unknown

## API Integration

### Endpoints

#### Create Address
```
POST /api/addresses
Body: Address data
Response: { address: { id, ... } }
```

#### Update Address
```
PUT /api/addresses/:id
Body: Updated address data
Response: { address: { id, ... } }
```

#### Delete Address
```
DELETE /api/addresses/:id
Response: { success: true }
```

### Request Mapping

```typescript
// CREATE operation
POST /api/addresses
Body: parseJSON(syncQueueItem.data)

// UPDATE operation
PUT /api/addresses/:record_id
Body: parseJSON(syncQueueItem.data)

// DELETE operation
DELETE /api/addresses/:record_id
```

### Response Handling

```typescript
// Success
- Extract server ID from response
- Update local record with server ID
- Mark queue item as 'synced'
- Remove from queue

// Error
- Check if retryable
- If retryable: Increment attempts, retry later
- If not retryable: Mark as 'failed', notify user
```

## Sync Status

### Address Sync Status

- **pending**: Waiting to sync
- **syncing**: Currently syncing (temporary)
- **synced**: Successfully synced
- **conflict**: Conflict detected, needs resolution
- **failed**: Sync failed (non-retryable error)

### UI Indicators

- **Badge on address card**: Shows sync status
- **Filter options**: Filter by sync status
- **Sync status indicator**: Global sync status

## Error Handling

### Sync Errors

1. **Network Error**: Retry with backoff
2. **Server Error (5xx)**: Retry with backoff
3. **Client Error (4xx)**: Mark as failed, notify user
4. **Timeout**: Retry with backoff
5. **Authentication Error**: Refresh token, retry

### User Notification

- **Pending items**: Shown in sync status indicator
- **Failed items**: Shown in address list (conflict badge)
- **Sync errors**: Logged for debugging

## Testing Sync

### Manual Testing

1. Create address offline
2. Verify sync_status='pending'
3. Turn network on
4. Verify sync happens automatically
5. Verify sync_status='synced'

### Automated Testing

See `lib/sync/__tests__/syncManager.test.ts` for test cases.

## Performance

### Optimization

- Batch sync operations when possible
- Process queue in background
- Limit concurrent API calls
- Cache sync state
- Debounce network state changes

### Benchmarks

- **Queue Processing**: <1s per item
- **Background Sync**: Non-blocking
- **Conflict Detection**: <100ms

## Future Enhancements

1. **Automatic Conflict Resolution**: Merge changes when possible
2. **Sync Prioritization**: Priority queue for important operations
3. **Partial Sync**: Sync only changed fields
4. **Compression**: Compress sync data for large operations
5. **Delta Sync**: Only sync changes, not full records
