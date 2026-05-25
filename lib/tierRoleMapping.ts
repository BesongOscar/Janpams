/**
 * Tier / Role Mapping — subscription-based feature gating.
 * Ported from web's lib/tierRoleMapping.ts.
 *
 * Defines which roles are allowed per subscription tier and
 * provides helpers for role validation and feature gating.
 */

export type AppRole = 'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin';
export type SubscriptionTier = 'freemium' | 'pro' | 'business' | 'enterprise';

export interface TierRoleConstraints {
  allowedRoles: AppRole[];
  maxNonBasicRoles: number;
  description: string;
}

export const TIER_ROLE_CONSTRAINTS: Record<SubscriptionTier, TierRoleConstraints> = {
  freemium: {
    allowedRoles: ['basic_user'],
    maxNonBasicRoles: 0,
    description: 'Freemium users can only have the Basic User role',
  },
  pro: {
    allowedRoles: ['basic_user'],
    maxNonBasicRoles: 0,
    description: 'Pro users can only have the Basic User role',
  },
  business: {
    allowedRoles: ['basic_user', 'advanced_agent', 'org_admin'],
    maxNonBasicRoles: 1,
    description: 'Business users can have one of: Basic User, Advanced Agent, or Org Admin',
  },
  enterprise: {
    allowedRoles: ['basic_user', 'advanced_agent', 'org_admin'],
    maxNonBasicRoles: 4,
    description: 'Enterprise users can have any organization role combination',
  },
};

export function isPlatformRole(role: AppRole): boolean {
  return role === 'system_admin';
}

export function getRolesForTier(tier: SubscriptionTier): AppRole[] {
  return TIER_ROLE_CONSTRAINTS[tier].allowedRoles;
}

export function canAssignRole(tier: SubscriptionTier, role: AppRole): boolean {
  if (isPlatformRole(role)) return false;
  return TIER_ROLE_CONSTRAINTS[tier].allowedRoles.includes(role);
}

export function validateRoleAssignment(
  tier: SubscriptionTier,
  currentRoles: AppRole[],
  newRole: AppRole,
): { valid: boolean; reason?: string } {
  if (isPlatformRole(newRole)) {
    return { valid: false, reason: 'Platform roles cannot be assigned via subscription' };
  }

  const constraints = TIER_ROLE_CONSTRAINTS[tier];
  if (!constraints.allowedRoles.includes(newRole)) {
    return { valid: false, reason: `Role "${newRole}" is not available on the ${tier} tier` };
  }

  const nonBasicCount = currentRoles.filter(r => r !== 'basic_user' && !isPlatformRole(r)).length;
  if (newRole !== 'basic_user' && nonBasicCount >= constraints.maxNonBasicRoles) {
    return {
      valid: false,
      reason: `${tier} tier allows max ${constraints.maxNonBasicRoles} elevated role(s)`,
    };
  }

  return { valid: true };
}
