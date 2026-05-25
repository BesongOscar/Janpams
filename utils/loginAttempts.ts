/**
 * Login attempt lockout (parity with web).
 * After MAX_LOGIN_ATTEMPTS failed attempts, lock for LOCKOUT_DURATION_MS.
 * Reset on successful login.
 */

import { readData, storeData } from './storage';

const LOGIN_ATTEMPTS_KEY = '@login_attempts';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginAttempt {
  count: number;
  lockedUntil: number | null;
}

export async function getLoginAttempts(): Promise<LoginAttempt> {
  try {
    const stored = await readData(LOGIN_ATTEMPTS_KEY);
    if (stored && typeof stored === 'object' && 'count' in stored) {
      const { count, lockedUntil } = stored as LoginAttempt;
      return { count: Number(count) || 0, lockedUntil: lockedUntil ? Number(lockedUntil) : null };
    }
    return { count: 0, lockedUntil: null };
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

export async function saveLoginAttempts(attempts: LoginAttempt): Promise<void> {
  await storeData(LOGIN_ATTEMPTS_KEY, attempts);
}

export async function clearLoginAttempts(): Promise<void> {
  await saveLoginAttempts({ count: 0, lockedUntil: null });
}

/**
 * Returns lockout error message if currently locked, or null if not locked.
 * Call after getLoginAttempts(); if lockedUntil is set and in the future, return message.
 */
export function getLockoutError(attempts: LoginAttempt): string | null {
  if (!attempts.lockedUntil || Date.now() >= attempts.lockedUntil) return null;
  const remainingMins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
  return `Too many failed attempts. Try again in ${remainingMins} minute(s).`;
}

/**
 * Apply a failed login: increment count, optionally set lockedUntil.
 * Returns the error message to show (remaining attempts or lockout).
 */
export function applyFailedAttempt(attempts: LoginAttempt): { next: LoginAttempt; errorMessage: string } {
  const newCount = attempts.count + 1;
  const lockedUntil =
    newCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
  const next: LoginAttempt = { count: newCount, lockedUntil };
  const remaining = MAX_LOGIN_ATTEMPTS - newCount;
  const errorMessage =
    remaining > 0
      ? `Invalid credentials. ${remaining} attempt(s) remaining.`
      : 'Too many failed attempts. Account locked for 15 minutes.';
  return { next, errorMessage };
}
