/**
 * useEffectiveRole - Returns the effective role for the current user (mobile).
 *
 * Reads from local_user_roles (AppRole only). When effective role is basic_user,
 * isLocationRestricted is true and map tap is restricted to center + 8 neighbors.
 */

import { useEffect, useState } from 'react';
import { getLocalUserRoles, type AppRole } from '@/lib/db/userRoles';
import { initDB } from '@/lib/db';

export type { AppRole } from '@/lib/db/userRoles';

const ROLE_ORDER: AppRole[] = ['basic_user', 'advanced_agent', 'org_admin', 'system_admin'];

export interface UseEffectiveRoleResult {
  effectiveRole: AppRole;
  isLocationRestricted: boolean;
  isLoading: boolean;
}

/**
 * Returns effective role from local_user_roles. When userId is undefined or no roles,
 * defaults to advanced_agent (no restriction). When highest role is basic_user,
 * isLocationRestricted is true.
 */
export function useEffectiveRole(userId: string | undefined): UseEffectiveRoleResult {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      await initDB();
      if (cancelled) return;
      const list = await getLocalUserRoles(userId);
      if (cancelled) return;
      setRoles(list);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const effectiveRole: AppRole =
    roles.length > 0
      ? ROLE_ORDER.reduce((highest, r) =>
          roles.includes(r) && ROLE_ORDER.indexOf(r) > ROLE_ORDER.indexOf(highest) ? r : highest
        , 'basic_user')
      : 'advanced_agent';
  const isLocationRestricted = effectiveRole === 'basic_user';

  return {
    effectiveRole,
    isLocationRestricted,
    isLoading,
  };
}
