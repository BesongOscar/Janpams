/**
 * Background Sync
 * 
 * Implements background sync using expo-background-fetch and expo-task-manager
 * Allows sync to run even when app is in background
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

// ===== TASK DEFINITION =====

const BACKGROUND_SYNC_TASK = 'background-sync';

type SyncHandler = {
  syncFn: () => Promise<void>;
  getStateFn: () => Promise<{ isOnline: boolean }>;
};

let syncHandler: SyncHandler | null = null;

/**
 * Background sync task handler
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    if (!syncHandler) {
      console.log('[BackgroundSync] No sync handler configured');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log('[BackgroundSync] Running background sync task');
    
    // Check if online before attempting sync
    const state = await syncHandler.getStateFn();
    if (!state.isOnline) {
      console.log('[BackgroundSync] Skipping sync - offline');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Run sync
    await syncHandler.syncFn();
    
    console.log('[BackgroundSync] Background sync completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.log('[BackgroundSync] Background sync failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ===== BACKGROUND SYNC SETUP =====

/**
 * Register background sync task
 */
export async function registerBackgroundSync(handler: SyncHandler): Promise<boolean> {
  syncHandler = handler;
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      console.log('[BackgroundSync] Task already registered');
      return true;
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes minimum interval
      stopOnTerminate: false, // Continue running when app is terminated
      startOnBoot: true, // Start when device boots
    });

    console.log('[BackgroundSync] Background sync task registered');
    return true;
  } catch (error) {
    console.log('[BackgroundSync] Failed to register background sync:', error);
    return false;
  }
}

/**
 * Unregister background sync task
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('[BackgroundSync] Background sync task unregistered');
    }
  } catch (error) {
    console.log('[BackgroundSync] Failed to unregister background sync:', error);
  }
}

/**
 * Check if background sync is registered
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  } catch (error) {
    console.log('[BackgroundSync] Failed to check registration:', error);
    return false;
  }
}

/**
 * Get background fetch status
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  try {
    return await BackgroundFetch.getStatusAsync();
  } catch (error) {
    console.log('[BackgroundSync] Failed to get background fetch status:', error);
    return BackgroundFetch.BackgroundFetchStatus.Restricted;
  }
}
