/**
 * Sync Queue Database Operations
 * 
 * Operations for managing the sync queue (pending sync operations).
 * Matches web's sync queue operations exactly.
 * 
 * Reference: docs/src/lib/db.ts (web's sync queue operations)
 */

import { getDB, initDB } from './database';
import { queryAll, queryFirst, execute, exists, count, parseJSON, stringifyJSON } from './helpers';
import { logWrite } from './dbLogger';
import type { SyncQueueItem } from './schemas';
import { randomUUID } from '../randomUUID';

/**
 * Add an item to the sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'created_at' | 'attempts'>): Promise<SyncQueueItem> {
  try {
    const db = await getDB();
    
    const id = randomUUID();
    const syncItem: SyncQueueItem = {
      id,
      ...item,
      attempts: 0,
      created_at: new Date().toISOString(),
    };
    
    const sql = `
      INSERT INTO sync_queue (
        id, operation, "table", record_id, local_id, data,
        status, attempts, last_error, device_id, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.runAsync(sql, [
      syncItem.id,
      syncItem.operation,
      syncItem.table,
      syncItem.record_id || null,
      syncItem.local_id || null,
      stringifyJSON(syncItem.data),
      syncItem.status,
      syncItem.attempts,
      syncItem.last_error || null,
      syncItem.device_id || null,
      syncItem.created_at,
      syncItem.processed_at || null,
    ]);
    logWrite('sync_queue', `${syncItem.operation} ${syncItem.table} record_id=${syncItem.record_id ?? syncItem.local_id} id=${syncItem.id}`, 1);
    return syncItem;
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the operation
      const db = await getDB();
      const id = randomUUID();
      const syncItem: SyncQueueItem = {
        id,
        ...item,
        attempts: 0,
        created_at: new Date().toISOString(),
      };
      const sql = `
        INSERT INTO sync_queue (
          id, operation, table, record_id, local_id, data,
          status, attempts, last_error, device_id, created_at, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await db.runAsync(sql, [
        syncItem.id,
        syncItem.operation,
        syncItem.table,
        syncItem.record_id || null,
        syncItem.local_id || null,
        stringifyJSON(syncItem.data),
        syncItem.status,
        syncItem.attempts,
        syncItem.last_error || null,
        syncItem.device_id || null,
        syncItem.created_at,
        syncItem.processed_at || null,
      ]);
      logWrite('sync_queue', `${syncItem.operation} ${syncItem.table} record_id=${syncItem.record_id ?? syncItem.local_id} id=${syncItem.id} (retry)`, 1);
      return syncItem;
    }
    throw error;
  }
}

/**
 * Get sync queue item by ID
 */
export async function getSyncQueueItem(id: string): Promise<SyncQueueItem | null> {
  try {
    const result = await queryFirst<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE id = ?',
      [id]
    );
    
    if (!result) return null;
    
    const data = parseJSON<Record<string, unknown>>(result.data) || {};
    
    return {
      ...result,
      data: stringifyJSON(data), // Keep as string for type compatibility
    } as unknown as SyncQueueItem;
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const result = await queryFirst<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE id = ?',
        [id]
      );
      if (!result) return null;
      const data = parseJSON<Record<string, unknown>>(result.data) || {};
      return {
        ...result,
        data: stringifyJSON(data),
      } as unknown as SyncQueueItem;
    }
    throw error;
  }
}

/**
 * Get all pending sync queue items
 */
export async function getPendingSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const results = await queryAll<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
      ['pending']
    );
    
    return results.map(item => {
      const data = parseJSON<Record<string, unknown>>(item.data) || {};
      return {
        ...item,
        data: stringifyJSON(data), // Keep as string for type compatibility
      } as unknown as SyncQueueItem;
    });
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const results = await queryAll<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
        ['pending']
      );
      return results.map(item => {
        const data = parseJSON<Record<string, unknown>>(item.data) || {};
        return {
          ...item,
          data: stringifyJSON(data),
        } as unknown as SyncQueueItem;
      });
    }
    throw error;
  }
}

/**
 * Get all failed sync queue items
 */
export async function getFailedSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const results = await queryAll<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
      ['failed']
    );
    
    return results.map(item => {
      const data = parseJSON<Record<string, unknown>>(item.data) || {};
      return {
        ...item,
        data: stringifyJSON(data), // Keep as string for type compatibility
      } as unknown as SyncQueueItem;
    });
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const results = await queryAll<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
        ['failed']
      );
      return results.map(item => {
        const data = parseJSON<Record<string, unknown>>(item.data) || {};
        return {
          ...item,
          data: stringifyJSON(data),
        } as unknown as SyncQueueItem;
      });
    }
    throw error;
  }
}

/**
 * Get all processing sync queue items
 */
export async function getProcessingSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const results = await queryAll<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
      ['processing']
    );
    
    return results.map(item => {
      const data = parseJSON<Record<string, unknown>>(item.data) || {};
      return {
        ...item,
        data: stringifyJSON(data), // Keep as string for type compatibility
      } as unknown as SyncQueueItem;
    });
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const results = await queryAll<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC',
        ['processing']
      );
      return results.map(item => {
        const data = parseJSON<Record<string, unknown>>(item.data) || {};
        return {
          ...item,
          data: stringifyJSON(data),
        } as unknown as SyncQueueItem;
      });
    }
    throw error;
  }
}

/**
 * Mark sync queue item as processing
 */
export async function markSyncQueueItemProcessing(id: string): Promise<void> {
  try {
    await execute(
      'UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?',
      ['processing', new Date().toISOString(), id]
    );
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the operation
      await execute(
        'UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?',
        ['processing', new Date().toISOString(), id]
      );
      return;
    }
    throw error;
  }
}

/**
 * Mark sync queue item as failed
 */
export async function markSyncQueueItemFailed(
  id: string,
  error: string,
  incrementAttempts: boolean = true
): Promise<void> {
  try {
    const db = await getDB();
    
    if (incrementAttempts) {
      await db.runAsync(
        'UPDATE sync_queue SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?',
        ['failed', error, id]
      );
    } else {
      await db.runAsync(
        'UPDATE sync_queue SET status = ?, last_error = ? WHERE id = ?',
        ['failed', error, id]
      );
    }
  } catch (dbError: any) {
    // If table doesn't exist, ensure DB is initialized
    if (dbError?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the operation
      const db = await getDB();
      if (incrementAttempts) {
        await db.runAsync(
          'UPDATE sync_queue SET status = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?',
          ['failed', error, id]
        );
      } else {
        await db.runAsync(
          'UPDATE sync_queue SET status = ?, last_error = ? WHERE id = ?',
          ['failed', error, id]
        );
      }
      return;
    }
    throw dbError;
  }
}

/**
 * Remove sync queue item (after successful sync)
 */
export async function removeSyncQueueItem(id: string): Promise<void> {
  try {
    await execute('DELETE FROM sync_queue WHERE id = ?', [id]);
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the operation (though item may not exist if table was just created)
      try {
        await execute('DELETE FROM sync_queue WHERE id = ?', [id]);
      } catch {
        // Ignore if item doesn't exist after repair
      }
      return;
    }
    throw error;
  }
}

/**
 * Get sync queue item count by status
 */
export async function getSyncQueueItemCount(status?: 'pending' | 'processing' | 'failed'): Promise<number> {
  try {
    if (status) {
      return await count('sync_queue', { status });
    }
    return await count('sync_queue');
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      if (status) {
        return await count('sync_queue', { status });
      }
      return await count('sync_queue');
    }
    throw error;
  }
}

/**
 * Clear all sync queue items (use with caution)
 */
export async function clearSyncQueue(): Promise<void> {
  try {
    await execute('DELETE FROM sync_queue', []);
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Table is now empty after creation, so no need to delete
      return;
    }
    throw error;
  }
}

/**
 * Get sync queue items by table name
 */
export async function getSyncQueueItemsByTable(table: string): Promise<SyncQueueItem[]> {
  try {
    const results = await queryAll<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE "table" = ? ORDER BY created_at ASC',
      [table]
    );
    
    return results.map(item => {
      const data = parseJSON<Record<string, unknown>>(item.data) || {};
      return {
        ...item,
        data: stringifyJSON(data), // Keep as string for type compatibility
      } as unknown as SyncQueueItem;
    });
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const results = await queryAll<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE "table" = ? ORDER BY created_at ASC',
        [table]
      );
      return results.map(item => {
        const data = parseJSON<Record<string, unknown>>(item.data) || {};
        return {
          ...item,
          data: stringifyJSON(data),
        } as unknown as SyncQueueItem;
      });
    }
    throw error;
  }
}

/**
 * Get sync queue items by record ID
 */
export async function getSyncQueueItemsByRecordId(recordId: string): Promise<SyncQueueItem[]> {
  try {
    const results = await queryAll<SyncQueueItem & { data: string }>(
      'SELECT * FROM sync_queue WHERE record_id = ? ORDER BY created_at ASC',
      [recordId]
    );
    
    return results.map(item => {
      const data = parseJSON<Record<string, unknown>>(item.data) || {};
      return {
        ...item,
        data: stringifyJSON(data), // Keep as string for type compatibility
      } as unknown as SyncQueueItem;
    });
  } catch (error: any) {
    // If table doesn't exist, ensure DB is initialized
    if (error?.message?.includes('no such table: sync_queue')) {
      console.warn('[SyncQueue] sync_queue table missing, re-initializing DB...');
      await initDB();
      // Retry the query
      const results = await queryAll<SyncQueueItem & { data: string }>(
        'SELECT * FROM sync_queue WHERE record_id = ? ORDER BY created_at ASC',
        [recordId]
      );
      return results.map(item => {
        const data = parseJSON<Record<string, unknown>>(item.data) || {};
        return {
          ...item,
          data: stringifyJSON(data),
        } as unknown as SyncQueueItem;
      });
    }
    throw error;
  }
}
