/**
 * Sync user roles from Supabase user_roles to local_user_roles (SQLite).
 * Same source as web; call after login and optionally on session restore.
 */

import { getSupabase } from '@/lib/supabase/client';
import { upsertLocalUserRoles, type AppRole } from '@/lib/db/userRoles';

function toAppRole(s: string): AppRole | null {
  const valid: AppRole[] = ['basic_user', 'advanced_agent', 'org_admin', 'system_admin'];
  return valid.includes(s as AppRole) ? (s as AppRole) : null;
}

/**
 * Fetch current user's roles from Supabase user_roles (uses session on client).
 * Returns null if not configured or errors.
 */
export async function fetchRolesFromBackend(userId: string): Promise<AppRole[] | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error || !Array.isArray(data) || data.length === 0) return null;
    const roles = data
      .map((r) => toAppRole(String(r.role)))
      .filter((r): r is AppRole => r != null);
    return roles.length ? roles : null;
  } catch {
    return null;
  }
}

/**
 * Fetch roles from Supabase and upsert into local_user_roles for the given user.
 * No-op if Supabase returns no roles or is not configured.
 */
export async function syncRolesFromBackend(userId: string): Promise<void> {
  const roles = await fetchRolesFromBackend(userId);
  if (!roles?.length) return;
  const { initDB } = await import('@/lib/db');
  await initDB();
  await upsertLocalUserRoles(userId, roles);
}
