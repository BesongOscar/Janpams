import { clearAuthTokens } from './secureAuthStorage';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Single implementation of "clear auth state".
 * Signs out from Supabase (when configured), clears tokens and auth header.
 * Does not navigate; use triggerLogoutNavigation for full logout.
 */
export const performLogout = async (): Promise<void> => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    await clearAuthTokens();
    const { updateAuthHeader } = await import('./interceptor');
    updateAuthHeader('');
    console.log('🔒 User logged out - tokens cleared');
  } catch (error) {
    console.log('❌ Error during logout:', error);
    const { updateAuthHeader } = await import('./interceptor');
    updateAuthHeader('');
  }
};

/** @deprecated Use performLogout */
export const logout = performLogout;

/**
 * Check if we're currently in a refresh token attempt to avoid infinite loops
 */
let isRefreshing = false;
let refreshStartTime: number | null = null;
const REFRESH_TIMEOUT = 20000; // 20 seconds max for token refresh
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshFailureCallbacks: Array<(error: Error) => void> = [];

/**
 * Safety mechanism to reset refresh state if it gets stuck
 * This prevents the app from getting permanently stuck in a refresh state
 */
const resetRefreshStateIfStuck = () => {
  if (isRefreshing && refreshStartTime) {
    const elapsed = Date.now() - refreshStartTime;
    if (elapsed > REFRESH_TIMEOUT) {
      console.warn('⚠️ Token refresh appears stuck, resetting state...');
      isRefreshing = false;
      refreshStartTime = null;
      const stuckError = new Error('Token refresh timeout - state reset');
      notifyTokenRefreshFailure(stuckError);
    }
  }
};

// Set up periodic check to prevent stuck state (every 5 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(resetRefreshStateIfStuck, 5000);
}

/**
 * Subscribe to token refresh - will be called when token is refreshed
 */
export const subscribeToTokenRefresh = (
  onSuccess: (token: string) => void,
  onFailure?: (error: Error) => void,
) => {
  refreshSubscribers.push(onSuccess);
  
  if (onFailure) {
    refreshFailureCallbacks.push(onFailure);
  }
  
  return () => {
    refreshSubscribers = refreshSubscribers.filter(cb => cb !== onSuccess);
    if (onFailure) {
      refreshFailureCallbacks = refreshFailureCallbacks.filter(cb => cb !== onFailure);
    }
  };
};

/**
 * Notify all subscribers that token has been refreshed
 */
export const notifyTokenRefresh = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
  refreshFailureCallbacks = [];
};

/**
 * Notify all subscribers that token refresh failed
 */
export const notifyTokenRefreshFailure = (error: Error) => {
  refreshFailureCallbacks.forEach(callback => callback(error));
  refreshSubscribers = [];
  refreshFailureCallbacks = [];
};

/**
 * Get refresh token state
 */
export const getIsRefreshing = () => isRefreshing;

/**
 * Set refresh token state
 */
export const setIsRefreshing = (value: boolean) => {
  isRefreshing = value;
  if (value) {
    refreshStartTime = Date.now();
  } else {
    refreshStartTime = null;
  }
};

/**
 * Force reset refresh state (safety mechanism)
 */
export const resetRefreshState = () => {
  console.warn('🔄 Force resetting refresh state');
  isRefreshing = false;
  refreshStartTime = null;
  refreshSubscribers = [];
  refreshFailureCallbacks = [];
};

