/**
 * Street Direction Service
 *
 * Manages street direction locks for consistent numbering.
 * Per spec: direction is auto-locked on first address creation (no override in v1).
 * Ported from web's docs/src/lib/streetDirectionService.ts. Uses SQLite (lib/db).
 *
 * Spec reference (Phase 9):
 * - Implementation guide: docs/Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide.md
 * - Web reference: docs/src/lib/streetDirectionService.ts
 */

import { queryFirst, execute } from './db';
import type { StreetDirectionLock, LockedDirection, LockSource } from './db/schemas';
import { normalizeStreetKey } from '@janpams/core/streets';

export { normalizeStreetKey };

/**
 * Get the direction lock for a street
 * Returns null if the street has no lock (unlocked state)
 */
export async function getDirectionLock(
  streetKey: string
): Promise<StreetDirectionLock | null> {
  const row = await queryFirst<{
    streetKey: string;
    directionState: string;
    lockedDirection: string | null;
    lockedAt: string | null;
    lockedBy: string | null;
    lockSource: string | null;
    syncStatus: string;
    lastSyncedAt: string | null;
  }>(
    'SELECT streetKey, directionState, lockedDirection, lockedAt, lockedBy, lockSource, syncStatus, lastSyncedAt FROM street_direction_locks WHERE streetKey = ?',
    [streetKey]
  );
  if (!row) return null;
  return {
    streetKey: row.streetKey,
    directionState: row.directionState as StreetDirectionLock['directionState'],
    lockedDirection: row.lockedDirection as LockedDirection | null,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    lockSource: row.lockSource as LockSource | null,
    syncStatus: row.syncStatus as StreetDirectionLock['syncStatus'],
    lastSyncedAt: row.lastSyncedAt ?? undefined,
  };
}

/**
 * Check if a street's direction is locked
 */
export async function isStreetLocked(streetKey: string): Promise<boolean> {
  const lock = await getDirectionLock(streetKey);
  return lock?.directionState === 'locked';
}

/**
 * Lock the direction for a street
 * Once locked, direction can only be changed via authority override (Phase 3)
 */
export async function setDirectionLock(
  streetKey: string,
  direction: LockedDirection,
  source: LockSource,
  lockedBy?: string
): Promise<StreetDirectionLock> {
  const existing = await getDirectionLock(streetKey);
  if (existing?.directionState === 'locked') {
    console.warn(
      `[StreetDirection] Street ${streetKey} is already locked. Use authority override to change.`
    );
    return existing;
  }

  const now = new Date().toISOString();
  await execute(
    `INSERT OR REPLACE INTO street_direction_locks 
     (streetKey, directionState, lockedDirection, lockedAt, lockedBy, lockSource, syncStatus)
     VALUES (?, 'locked', ?, ?, ?, ?, 'pending')`,
    [streetKey, direction, now, lockedBy ?? 'system', source]
  );

  const lock = await getDirectionLock(streetKey);
  if (!lock) throw new Error('[StreetDirection] Failed to read lock after insert');
  console.log(
    `[StreetDirection] Locked street ${streetKey} with direction: ${direction}, source: ${source}`
  );
  return lock;
}

/**
 * Auto-lock street direction on first address creation
 * Called during the address save flow
 */
export async function autoLockOnFirstAddress(
  streetKey: string,
  lockedBy?: string
): Promise<StreetDirectionLock | null> {
  const isLocked = await isStreetLocked(streetKey);
  if (isLocked) {
    console.log(`[StreetDirection] Street ${streetKey} already locked, skipping auto-lock`);
    return getDirectionLock(streetKey);
  }
  return setDirectionLock(streetKey, 'as_is', 'auto_on_first_address', lockedBy);
}

/**
 * Find geographic anchor: westernmost point, then southernmost on tie.
 * Used for deterministic geometry merging in Phase 3.
 * Expects segment geometry as [lon, lat][] (matches segment storage in offlineDataPacks).
 * Returns anchor as [lon, lat] for use with mergeSegmentGeometries.
 */
function findGeographicAnchor(
  allSegments: { geometry: [number, number][] }[]
): [number, number] {
  let anchor: [number, number] | null = null;
  for (const seg of allSegments) {
    const start = seg.geometry[0];
    const end = seg.geometry[seg.geometry.length - 1];
    for (const point of [start, end]) {
      // point is [lon, lat]; westernmost = smaller lon (index 0), then southernmost = smaller lat (index 1)
      if (!anchor) {
        anchor = point;
      } else if (point[0] < anchor[0]) {
        anchor = point;
      } else if (point[0] === anchor[0] && point[1] < anchor[1]) {
        anchor = point;
      }
    }
  }
  return anchor ?? [0, 0];
}

/**
 * Determine the anchor point for geometry merging based on direction lock.
 * For Phase 3: findConnectedStreetSegments + mergeSegmentGeometries use this.
 * Expects segment geometry as [lon, lat][]. Returns anchorPoint as [lon, lat].
 * All operations use SQLite only (no network).
 */
export async function getMergeAnchorFromLock(
  allSegments: { geometry: [number, number][] }[],
  streetKey: string
): Promise<{
  anchorPoint: [number, number]; // [lon, lat]
  shouldReverseAfterMerge: boolean;
}> {
  const lock = await getDirectionLock(streetKey);
  const geoAnchor = findGeographicAnchor(allSegments);

  if (lock?.directionState === 'locked' && lock.lockedDirection === 'reversed') {
    console.log('[MergeAnchor] Locked/reversed, geographic anchor:', geoAnchor, '+ reverse');
    return {
      anchorPoint: geoAnchor,
      shouldReverseAfterMerge: true,
    };
  }

  console.log('[MergeAnchor] Using geographic anchor:', geoAnchor);
  return {
    anchorPoint: geoAnchor,
    shouldReverseAfterMerge: false,
  };
}
