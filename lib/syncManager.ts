/**
 * Sync Manager
 * 
 * Ported from web's docs/src/lib/syncManager.ts
 * Offline-first sync system for queuing and syncing address operations
 * 
 * Matches web implementation exactly for sync behavior parity.
 */

import NetInfo from '@react-native-community/netinfo';
import { getDB, initDB, checkAndRepairDB, ensureDBReady, queryAll, queryFirst, execute, parseJSON, stringifyJSON } from './db';
import type { Address, SyncQueueItem } from './db/schemas';
import { createAddress as dbCreateAddress, updateAddress as dbUpdateAddress, deleteAddress as dbDeleteAddress, getAddressById } from './db/addresses';
import { addToSyncQueue, getPendingSyncQueueItems, markSyncQueueItemProcessing, markSyncQueueItemFailed, removeSyncQueueItem, getSyncQueueItemCount } from './db/syncQueue';
import { logSuccess } from './db/dbLogger';
import { syncCreateAddress as syncCreateAddressAPI, syncUpdateAddress as syncUpdateAddressAPI, syncDeleteAddress as syncDeleteAddressAPI } from './sync/apiClient';
import { registerBackgroundSync } from './sync/backgroundSync';
import { validateAndRepair } from './search/searchIndex';
import { getInstalledPacks } from './dataPacks/manager';
import { cleanupStagingOnRestart, getPackState } from './japaState';
import { initValhallaRouting, loadTilesForNewPacksIfReady } from './valhalla/initValhalla';
import { getGlueUrls } from './valhalla/glueUrls';
import { valhallaProvider } from './valhalla/ValhallaProvider';
import { randomUUID } from './randomUUID';

// ===== TYPES =====

export type SyncStatus = 'idle' | 'syncing' | 'error';

/** Search index state after validateAndRepair (Phase 6.1). */
export type SearchIndexStatus = 'idle' | 'validating' | 'ready' | 'error';

export interface SyncManagerState {
  isOnline: boolean;
  status: SyncStatus;
  lastSync: string | null;
  pendingCount: number;
  searchIndexStatus: SearchIndexStatus;
}

// ===== SYNC MANAGER CLASS =====

class SyncManagerClass {
  private isOnline: boolean = false;
  private status: SyncStatus = 'idle';
  private lastSync: string | null = null;
  private searchIndexStatus: SearchIndexStatus = 'idle';
  private searchIndexReadyResolvers: Array<() => void> = [];
  private pendingCount: number = 0;
  private listeners: Set<(state: SyncManagerState) => void> = new Set();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize sync manager
   * 
   * Reference: Web's SyncManager.init() - ensures DB is ready before starting sync
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[SyncManager] Already initialized');
      return;
    }

    try {
      // Initialize database and ensure it's healthy (like web's getDB() guarantees)
      await initDB();
      
      // Check and repair DB if needed (ensures sync_queue exists)
      await checkAndRepairDB();

      // JAPA: cleanup any orphaned staging from interrupted installs (Phase 2)
      try {
        await cleanupStagingOnRestart();
      } catch (e) {
        console.warn('[SyncManager] cleanupStagingOnRestart failed:', e);
      }

      // Validate/repair search index for installed packs (Phase 1)
      this.searchIndexStatus = 'validating';
      this.notifyListeners();
      try {
        const packs = await getInstalledPacks();
        const installedPacks = packs.map(p => ({ id: p.id, version: p.version, countryCode: p.country }));
        const { repaired, packsRebuilt } = await validateAndRepair(installedPacks, msg => console.log('[SyncManager]', msg));
        if (repaired && packsRebuilt.length > 0) {
          console.log('[SyncManager] Search index repair: packs needing rebuild:', packsRebuilt.join(', '));
        }
        this.searchIndexStatus = 'ready';
        this.searchIndexReadyResolvers.forEach(r => r());
        this.searchIndexReadyResolvers = [];
      } catch (e) {
        console.warn('[SyncManager] Search index validateAndRepair failed:', e);
        this.searchIndexStatus = 'error';
        this.searchIndexReadyResolvers.forEach(r => r());
        this.searchIndexReadyResolvers = [];
      }
      this.notifyListeners();

      // Phase 4: init Valhalla routing (tiles loaded when glue URLs provided)
      try {
        initValhallaRouting({
          getInstalledPacks,
          getPackState,
          getGlueUrls,
          getRouteProvider: () => valhallaProvider,
        });
        await loadTilesForNewPacksIfReady();
      } catch (e) {
        console.warn('[SyncManager] Valhalla init failed (routing will use fallback):', e);
      }

      // Load initial pending count from DB
      this.pendingCount = await this.getPendingCount();

      // Check initial network state
      const netInfoState = await NetInfo.fetch();
      this.isOnline = netInfoState.isConnected ?? false;

      // Subscribe to network state changes
      this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;

        if (!wasOnline && this.isOnline) {
          console.log('[SyncManager] Network came online, triggering sync');
          this.handleOnline();
        } else if (wasOnline && !this.isOnline) {
          console.log('[SyncManager] Network went offline');
          this.handleOffline();
        }

        this.notifyListeners();
      });

      // Start periodic sync check (every 30 seconds)
      this.syncInterval = setInterval(() => {
        if (this.isOnline && this.status !== 'syncing') {
          this.syncPendingChanges();
        }
      }, 30000);

      // Initial sync if online (only after DB is confirmed ready)
      if (this.isOnline) {
        await this.syncPendingChanges();
      }

      // Register background sync
      try {
        await registerBackgroundSync({
          syncFn: () => this.syncPendingChanges(),
          getStateFn: () => this.getStateAsync(),
        });
      } catch (error) {
        console.warn('[SyncManager] Failed to register background sync:', error);
        // Don't fail initialization if background sync fails
      }

      this.isInitialized = true;
      this.notifyListeners();
      console.log('[SyncManager] Initialized, isOnline:', this.isOnline);
    } catch (error) {
      console.log('[SyncManager] Failed to initialize:', error);
      // Mark as initialized anyway to prevent retry loops, but status will be 'error'
      this.isInitialized = true;
      this.status = 'error';
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): SyncManagerState {
    return {
      isOnline: this.isOnline,
      status: this.status,
      lastSync: this.lastSync,
      pendingCount: this.pendingCount,
      searchIndexStatus: this.searchIndexStatus,
    };
  }

  /**
   * Get state with pending count (async)
   */
  async getStateAsync(): Promise<SyncManagerState> {
    return this.getState();
  }

  /**
   * Get search index status (Phase 6.1): validating | ready | error
   */
  getSearchIndexStatus(): SearchIndexStatus {
    return this.searchIndexStatus;
  }

  /**
   * Promise that resolves when search index is ready or error (Phase 6.1)
   */
  waitForSearchIndex(): Promise<SearchIndexStatus> {
    if (this.searchIndexStatus === 'ready' || this.searchIndexStatus === 'error') {
      return Promise.resolve(this.searchIndexStatus);
    }
    return new Promise<SearchIndexStatus>(resolve => {
      this.searchIndexReadyResolvers.push(() => resolve(this.searchIndexStatus));
    });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SyncManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.log('[SyncManager] Error in listener:', error);
      }
    });
  }

  /**
   * Handle network coming online
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.notifyListeners();
    this.syncPendingChanges();
  }

  /**
   * Handle network going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Get pending sync queue item count
   */
  async getPendingCount(): Promise<number> {
    try {
      return await getSyncQueueItemCount('pending');
    } catch (error) {
      console.log('[SyncManager] Error getting pending count:', error);
      return 0;
    }
  }

  /**
   * Create address with sync queue
   */
  async createAddress(data: Omit<Address, 'id' | 'local_id' | 'sync_status' | 'created_at' | 'updated_at'>): Promise<Address> {
    const localId = randomUUID();
    const now = new Date().toISOString();

    const record: Address = {
      ...data,
      id: localId,
      local_id: localId,
      sync_status: 'pending',
      status: 'pending',
      created_at: now,
      updated_at: now,
    };

    // Save to database
    await dbCreateAddress(record);

    // Add to sync queue
    await addToSyncQueue({
      operation: 'CREATE',
      table: 'addresses',
      record_id: localId,
      local_id: localId,
      data: stringifyJSON(record),
      status: 'pending',
    });

    logSuccess(`Address saved successfully to offline DB (sync queued): id=${record.id} ${record.house_number} ${record.street_name}, ${record.neighborhood ?? ''}, ${record.city}`);

    this.pendingCount++;
    this.notifyListeners();

    // Try to sync if online
    if (this.isOnline) {
      this.syncPendingChanges();
    }

    return record;
  }

  /**
   * Update address with sync queue
   */
  async updateAddress(id: string, updates: Partial<Address>): Promise<Address | null> {
    const existing = await getAddressById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Address = {
      ...existing,
      ...updates,
      updated_at: now,
      sync_status: 'pending',
    };

    await dbUpdateAddress(id, updated);

    // Add to sync queue
    await addToSyncQueue({
      operation: 'UPDATE',
      table: 'addresses',
      record_id: id,
      local_id: existing.local_id,
      data: stringifyJSON(updated),
      status: 'pending',
    });

    this.pendingCount++;
    this.notifyListeners();

    if (this.isOnline) {
      this.syncPendingChanges();
    }

    return updated;
  }

  /**
   * Delete address with sync queue
   */
  async deleteAddress(id: string): Promise<boolean> {
    const existing = await getAddressById(id);
    if (!existing) return false;

    await dbDeleteAddress(id);

    // Add to sync queue
    await addToSyncQueue({
      operation: 'DELETE',
      table: 'addresses',
      record_id: id,
      local_id: existing.local_id,
      data: stringifyJSON({ id }),
      status: 'pending',
    });

    this.pendingCount++;
    this.notifyListeners();

    if (this.isOnline) {
      this.syncPendingChanges();
    }

    return true;
  }

  /**
   * Get address by ID
   */
  async getAddress(id: string): Promise<Address | null> {
    return getAddressById(id);
  }

  /**
   * Get all addresses
   */
  async getAllAddresses(): Promise<Address[]> {
    const db = await getDB();
    return queryAll<Address>('SELECT * FROM addresses ORDER BY created_at DESC');
  }

  /**
   * Get addresses by Plus Code
   */
  async getAddressesByPlusCode(plusCode: string): Promise<Address[]> {
    const db = await getDB();
    return queryAll<Address>('SELECT * FROM addresses WHERE plus_code = ?', [plusCode]);
  }

  /**
   * Sync pending changes
   * 
   * Reference: Web's syncPendingChanges() - reads from sync_queue store
   */
  async syncPendingChanges(): Promise<void> {
    if (this.status === 'syncing' || !this.isOnline) {
      return;
    }

    // Ensure DB is ready before syncing (defensive check)
    try {
      await ensureDBReady();
    } catch (error) {
      console.log('[SyncManager] Failed to ensure DB ready:', error);
      this.status = 'error';
      this.notifyListeners();
      return;
    }

    this.status = 'syncing';
    this.notifyListeners();

    try {
      const queue = await getPendingSyncQueueItems();

      for (const item of queue) {
        if (item.attempts >= 5) {
          console.warn('[SyncManager] Skipping item after 5 failed attempts:', item.id);
          continue; // Skip after 5 failed attempts
        }

        try {
          // Mark as processing
          await markSyncQueueItemProcessing(item.id);

          // Process the sync item
          await this.processSyncItem(item);

          // Update the address sync status if not DELETE
          if (item.operation !== 'DELETE' && item.table === 'addresses') {
            const address = await getAddressById(item.record_id || '');
            if (address) {
              await dbUpdateAddress(address.id, { sync_status: 'synced', last_synced_at: new Date().toISOString() });
            }
          }

          // Remove from sync queue
          await removeSyncQueueItem(item.id);
        } catch (error) {
          console.log('[SyncManager] Sync failed for item:', item.id, error);
          
          // Check if it's a conflict error
          const isConflict = this.isConflictError(error);
          if (isConflict) {
            // Mark as conflict
            await markSyncQueueItemFailed(
              item.id,
              error instanceof Error ? error.message : 'Conflict detected',
              false // Don't increment attempts for conflicts
            );
            
            // Update address sync status to conflict
            if (item.operation !== 'DELETE' && item.table === 'addresses') {
              const address = await getAddressById(item.record_id || '');
              if (address) {
                await dbUpdateAddress(address.id, { sync_status: 'conflict' });
              }
            }
          } else {
            // Update attempt count for retryable errors
            await markSyncQueueItemFailed(
              item.id,
              error instanceof Error ? error.message : 'Unknown error',
              true // increment attempts
            );
          }
        }
      }

      this.lastSync = new Date().toISOString();
      this.status = 'idle';
    } catch (error) {
      console.log('[SyncManager] Sync error:', error);
      this.status = 'error';
    }

    this.pendingCount = await this.getPendingCount();
    this.notifyListeners();
  }

  /**
   * Process a single sync queue item
   */
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    if (item.table !== 'addresses') {
      throw new Error(`Unsupported table: ${item.table}`);
    }

    const data = parseJSON<Address>(item.data);
    if (!data) {
      throw new Error(`Invalid data in sync queue item: ${item.id}`);
    }

    switch (item.operation) {
      case 'CREATE':
        await this.syncCreateAddress(data);
        break;
      case 'UPDATE':
        await this.syncUpdateAddress(data);
        break;
      case 'DELETE':
        await this.syncDeleteAddress(item.record_id || '');
        break;
      default:
        throw new Error(`Unsupported operation: ${item.operation}`);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempts: number): number {
    // Exponential backoff: 2^attempts seconds, max 60 seconds
    const delay = Math.min(Math.pow(2, attempts) * 1000, 60000);
    return delay;
  }

  /**
   * Check if error is a conflict error
   */
  private isConflictError(error: any): boolean {
    // Check for HTTP 409 (Conflict) status
    if (error?.status === 409) {
      return true;
    }
    
    // Check for conflict in error message
    if (error?.message?.toLowerCase().includes('conflict')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sync CREATE operation
   */
  private async syncCreateAddress(address: Address): Promise<void> {
    const lang = 'en'; // TODO: Get language from context/i18n
    const response = await syncCreateAddressAPI(address, lang);

    // Update local address with server ID if provided
    if (response?.address?.id) {
      await dbUpdateAddress(address.id, {
        id: response.address.id, // Update with server ID
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Sync UPDATE operation
   */
  private async syncUpdateAddress(address: Address): Promise<void> {
    const lang = 'en'; // TODO: Get language from context/i18n
    await syncUpdateAddressAPI(address, lang);
  }

  /**
   * Sync DELETE operation
   */
  private async syncDeleteAddress(addressId: string): Promise<void> {
    const lang = 'en'; // TODO: Get language from context/i18n
    await syncDeleteAddressAPI(addressId, lang);
  }

  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    await this.syncPendingChanges();
  }

  /**
   * Destroy sync manager (cleanup)
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }
}

// ===== SINGLETON EXPORT =====

export const SyncManager = new SyncManagerClass();
