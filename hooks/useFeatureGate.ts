/**
 * Feature gating hook — tier-based capability restrictions.
 *
 * Usage:
 *   const { allowed, tier } = useFeatureGate('multi_stop_routing');
 *   if (!allowed) { show upgrade prompt }
 */

import { useMemo } from 'react';
import type { SubscriptionTier } from '@/lib/tierRoleMapping';

export type GatedFeature =
  | 'advanced_search'
  | 'poi_layer'
  | 'multi_stop_routing'
  | 'transport_modes'
  | 'address_edit'
  | 'offline_routing'
  | 'trusted_geolocation'
  | 'bulk_export';

const FEATURE_MIN_TIER: Record<GatedFeature, SubscriptionTier> = {
  advanced_search: 'freemium',
  poi_layer: 'freemium',
  multi_stop_routing: 'pro',
  transport_modes: 'freemium',
  address_edit: 'freemium',
  offline_routing: 'freemium',
  trusted_geolocation: 'freemium',
  bulk_export: 'business',
};

const TIER_ORDER: Record<SubscriptionTier, number> = {
  freemium: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

function tierMeetsMinimum(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier,
): boolean {
  return TIER_ORDER[userTier] >= TIER_ORDER[requiredTier];
}

/**
 * Returns whether the current user's subscription tier allows the given feature.
 * Reads tier from auth context; defaults to 'freemium' when unknown.
 */
export function useFeatureGate(feature: GatedFeature): {
  allowed: boolean;
  tier: SubscriptionTier;
  requiredTier: SubscriptionTier;
} {
  // TODO: read from auth context once user store exposes tier
  const tier: SubscriptionTier = 'freemium';

  const requiredTier = FEATURE_MIN_TIER[feature];
  const allowed = useMemo(
    () => tierMeetsMinimum(tier, requiredTier),
    [tier, requiredTier],
  );

  return { allowed, tier, requiredTier };
}
