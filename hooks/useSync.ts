/**
 * useSync Hook
 * 
 * Provides sync status, manual sync trigger, and sync history
 */

import { useState, useEffect, useCallback } from 'react';
import { SyncManager } from '@/lib/syncManager';
import type { SyncManagerState } from '@/lib/syncManager';

export interface SyncState extends SyncManagerState {
  isInitialized: boolean;
  error: Error | null;
}

export function useSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: true,
    status: 'idle',
    lastSync: null,
    pendingCount: 0,
    searchIndexStatus: 'idle',
    isInitialized: false,
    error: null,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        await SyncManager.init();
        const initialState = await SyncManager.getStateAsync();
        setState(prev => ({
          ...initialState,
          isInitialized: true,
          error: null,
        }));

        unsubscribe = SyncManager.subscribe((newState) => {
          setState(prev => ({
            ...newState,
            isInitialized: true,
            error: null,
          }));
        });
      } catch (error) {
        console.log('[useSync] Failed to initialize SyncManager:', error);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: error instanceof Error ? error : new Error('Failed to initialize sync'),
        }));
      }
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const syncNow = useCallback(async () => {
    try {
      await SyncManager.syncNow();
      setState(prev => ({ ...prev, error: null }));
    } catch (error) {
      console.log('[useSync] Sync failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Sync failed'),
      }));
    }
  }, []);

  const getPendingCount = useCallback(async () => {
    try {
      const count = await SyncManager.getPendingCount();
      setState(prev => ({ ...prev, pendingCount: count }));
      return count;
    } catch (error) {
      console.log('[useSync] Failed to get pending count:', error);
      return 0;
    }
  }, []);

  return {
    ...state,
    syncNow,
    getPendingCount,
  };
}
