/**
 * Location management thresholds for form state management
 * These values ensure location accuracy and prevent coordinate/image mismatches
 */
export const LOCATION_THRESHOLDS = {
  /** Maximum background time (1 min) → force refresh on return */
  MAX_BG_MS: 60_000,
  
  /** Soft stale threshold (30s) → treat location stale and refetch */
  MAX_AGE_MS: 30_000,
  
  /** Hard stale threshold (120s) → force hard reset */
  HARD_STALE_AGE_MS: 120_000,
  
  /** Soft move threshold (20m) → prompt refresh */
  MAX_MOVE_SOFT_M: 20,
  
  /** Hard move threshold (50m) → force refresh/reset */
  MAX_MOVE_HARD_M: 50,
  
  /** Accuracy threshold (50m) → require retry/confirmation before submit */
  ACCURACY_THRESHOLD_M: 50,
  
  /** Location monitoring interval (15s) */
  LOCATION_CHECK_INTERVAL_MS: 15_000,
  
  /** Location monitoring distance interval (10m) */
  LOCATION_CHECK_DISTANCE_M: 10,
  
  /** Banner auto-dismiss time (5s) */
  BANNER_AUTO_DISMISS_MS: 5_000,
} as const;

export type LocationThresholds = typeof LOCATION_THRESHOLDS;

