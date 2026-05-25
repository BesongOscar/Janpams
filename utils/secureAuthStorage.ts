/**
 * Secure auth token storage (keychain/Keystore).
 * Used for refresh_token and userId so credentials are not in AsyncStorage.
 * Falls back to AsyncStorage if SecureStore is unavailable (e.g. web).
 */

import * as SecureStore from 'expo-secure-store';
import { storeData, readData, deleteData } from './storage';

const AUTH_USER_ID_KEY = 'auth_user_id';
const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';

/**
 * Whether SecureStore is available (native; not in web or some simulators).
 */
async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, '__probe__');
    await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

let useSecureStore: boolean | null = null;

async function getStorageMode(): Promise<boolean> {
  if (useSecureStore === null) {
    useSecureStore = await isSecureStoreAvailable();
  }
  return useSecureStore;
}

export interface AuthTokens {
  userId: string;
  refreshToken: string;
}

/**
 * Store auth tokens (userId, refreshToken).
 * Uses SecureStore on native when available; otherwise AsyncStorage.
 */
export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  const secure = await getStorageMode();
  if (secure) {
    await SecureStore.setItemAsync(AUTH_USER_ID_KEY, tokens.userId);
    await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, tokens.refreshToken);
  } else {
    await storeData('@userId', tokens.userId);
    await storeData('@refreshToken', tokens.refreshToken);
  }
}

/**
 * Read auth tokens from storage.
 * Returns null if not found or on error.
 */
export async function getAuthTokens(): Promise<AuthTokens | null> {
  const secure = await getStorageMode();
  if (secure) {
    try {
      const userId = await SecureStore.getItemAsync(AUTH_USER_ID_KEY);
      const refreshToken = await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY);
      if (userId && refreshToken) return { userId, refreshToken };
      return null;
    } catch {
      return null;
    }
  }
  try {
    const userId = await readData('@userId');
    const refreshToken = await readData('@refreshToken');
    if (userId && refreshToken) return { userId: String(userId), refreshToken: String(refreshToken) };
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear auth tokens from storage (SecureStore and AsyncStorage both cleared
 * so migration from AsyncStorage to SecureStore doesn't leave stale data).
 */
export async function clearAuthTokens(): Promise<void> {
  try {
    const secure = await getStorageMode();
    if (secure) {
      await SecureStore.deleteItemAsync(AUTH_USER_ID_KEY);
      await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
    }
    await deleteData('@userId');
    await deleteData('@refreshToken');
  } catch (e) {
    console.warn('[secureAuthStorage] clearAuthTokens error:', e);
  }
}
