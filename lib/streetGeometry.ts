/**
 * Street Geometry Resolution
 *
 * Ported from web's docs/src/lib/streetGeometry.ts
 * Single source of truth for street direction (resolveStreetGeometry, createStreetKey).
 *
 * Spec reference (Phase 9):
 * - Implementation guide: docs/Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide.md
 * - Web reference: docs/src/lib/streetGeometry.ts
 */

import type { Street } from './createLocationAddress';
import type { StreetDirectionLock as DBStreetDirectionLock } from './db/schemas';

// Re-export for consumers that don't need db
export type DirectionState = 'unlocked' | 'locked';
export type LockedDirection = 'as_is' | 'reversed';
export type LockSource = 'auto_on_first_address' | 'authority_override';
export type { StreetDirectionLock } from './db/schemas';

export interface ResolvedStreetGeometry {
  /** The effective geometry after applying any direction lock */
  geometry: [number, number][];
  /** Start point of the resolved geometry */
  start: [number, number];
  /** End point of the resolved geometry */
  end: [number, number];
  /** Whether the geometry was reversed from OSM order */
  reversed: boolean;
  /** The direction lock state used for resolution */
  directionState: DirectionState;
}

/**
 * Resolve street geometry based on direction lock state.
 * 
 * Rules:
 * - Unlocked: Use raw OSM geometry order
 * - Locked/as_is: Use raw OSM geometry order  
 * - Locked/reversed: Reverse the geometry
 * 
 * This is the ONLY place geometry direction should be determined.
 * All consumers (UI markers, chainage, numbering) must use this.
 * 
 * Phase 2: Always uses raw OSM order (no locks yet)
 * Phase 3: Will integrate with database direction locks
 */
export function resolveStreetGeometry(
  street: Street,
  directionLock?: DBStreetDirectionLock | null
): ResolvedStreetGeometry {
  const rawGeometry = street.geometry;
  const shouldReverse =
    directionLock?.directionState === 'locked' &&
    directionLock?.lockedDirection === 'reversed';
  
  const geometry = shouldReverse
    ? [...rawGeometry].reverse()
    : rawGeometry;
  
  const start = geometry[0];
  const end = geometry[geometry.length - 1];
  
  const directionState = directionLock?.directionState ?? 'unlocked';
  
  console.log('[Geometry Resolution] street:', street.name,
    'directionState:', directionState,
    'lockedDirection:', directionLock?.lockedDirection ?? 'n/a',
    'reversed:', shouldReverse,
    'start:', start,
    'end:', end);
  
  return {
    geometry,
    start,
    end,
    reversed: shouldReverse,
    directionState,
  };
}

/**
 * Create a stable street key for direction lock storage.
 * Prefers OSM way ID if available, otherwise uses normalized name.
 */
export function createStreetKey(street: Street): string {
  if (street.osm_id) {
    return `osm:${street.osm_id}`;
  }
  // Fallback to normalized name (lowercase, trimmed)
  return `name:${street.name.toLowerCase().trim()}`;
}

/**
 * Normalize street name for consistent lookups
 * (matches web's normalizeStreetKey function)
 */
export function normalizeStreetKey(streetName: string, city?: string): string {
  const normalized = streetName.trim().toLowerCase().replace(/\s+/g, '_');
  if (city) {
    return `name:${normalized}:${city.trim().toLowerCase().replace(/\s+/g, '_')}`;
  }
  return `name:${normalized}`;
}
