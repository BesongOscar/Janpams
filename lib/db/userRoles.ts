/**
 * User roles from local_user_roles (mobile).
 * Schema matches web: role is AppRole only (basic_user, advanced_agent, org_admin, system_admin).
 * Used for role-based map click restriction (e.g. basic_user = center + 8 neighbors only).
 */

import { queryAll, execute } from './helpers';

export type AppRole = 'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin';

const VALID_APP_ROLES: AppRole[] = ['basic_user', 'advanced_agent', 'org_admin', 'system_admin'];

function isAppRole(s: string): s is AppRole {
  return VALID_APP_ROLES.includes(s as AppRole);
}

/**
 * Get all roles for a user from local_user_roles.
 * Returns empty array if no roles or DB not ready.
 * Values are AppRole (after migration 13; legacy values are migrated).
 */
export async function getLocalUserRoles(userId: string): Promise<AppRole[]> {
  try {
    const rows = await queryAll<{ role: string }>(
      'SELECT role FROM local_user_roles WHERE userId = ? ORDER BY role',
      [userId]
    );
    return rows.map((r) => r.role).filter(isAppRole);
  } catch {
    return [];
  }
}

/**
 * Replace local roles for a user with the given list (e.g. after fetching from backend).
 * Deletes existing rows for userId and inserts one row per role.
 */
export async function upsertLocalUserRoles(
  userId: string,
  roles: AppRole[],
): Promise<void> {
  const grantedAt = new Date().toISOString();
  await execute('DELETE FROM local_user_roles WHERE userId = ?', [userId]);
  for (const role of roles) {
    if (!isAppRole(role)) continue;
    const id = `local-${userId}-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await execute(
      `INSERT INTO local_user_roles (id, userId, role, grantedAt, syncStatus) VALUES (?, ?, ?, ?, 'synced')`,
      [id, userId, role, grantedAt],
    );
  }
}
