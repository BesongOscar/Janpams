/**
 * useOffline Hook
 * 
 * Ported from web's docs/src/hooks/useOffline.ts
 * Provides offline status, sync status, and pending count
 */

import { useState, useEffect, useCallback } from 'react';
import { SyncManager } from '@/lib/syncManager';
import type { SyncManagerState, SearchIndexStatus } from '@/lib/syncManager';

export interface OfflineState {
  isOnline: boolean;
  status: 'idle' | 'syncing' | 'error';
  lastSync: string | null;
  pendingCount: number;
  searchIndexStatus: SearchIndexStatus;
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    status: 'idle',
    lastSync: null,
    pendingCount: 0,
    searchIndexStatus: 'idle',
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        await SyncManager.init();
        setIsInitialized(true);

        const pendingCount = await SyncManager.getPendingCount();
        const initialState = await SyncManager.getStateAsync();
        setState({ ...initialState, pendingCount });

        unsubscribe = SyncManager.subscribe(async (newState) => {
          const pendingCount = await SyncManager.getPendingCount();
          setState({ ...newState, pendingCount });
        });
      } catch (error) {
        console.log('[useOffline] Failed to initialize SyncManager:', error);
        setIsInitialized(true); // Still mark as initialized to show UI
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
    if (state.isOnline) {
      await SyncManager.syncNow();
    }
  }, [state.isOnline]);

  return {
    ...state,
    isInitialized,
    syncNow,
  };
}
