/**
 * Supabase client for mobile (auth + user_roles).
 * Uses same project as web; session persisted with AsyncStorage for React Native.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

/**
 * React Native–compatible storage adapter for Supabase Auth.
 * Supabase expects { getItem, setItem, removeItem } (async).
 */
const asyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const _supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: asyncStorageAdapter,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const supabase = _supabase;

/** Returns Supabase client when configured; null otherwise. Use for auth and roles. */
export function getSupabase(): NonNullable<typeof _supabase> | null {
  return _supabase;
}
