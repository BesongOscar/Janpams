/**
 * Unified Street Color System
 *
 * Shared colors for street visualization (ActiveStreetLayer, NearbyStreetsLayer).
 * Ported from docs/src/lib/streetColors.ts.
 */

export const ACTIVE_STREET_COLOR = '#0000EE';
export const ALTERNATE_STREET_COLORS = [
  '#FFBF00', // Amber (1st alternate)
  '#9932CC', // Purple (2nd)
  '#008080', // Teal (3rd)
  '#DC143C', // Crimson (4th)
];
export const START_MARKER_COLOR = '#22C55E';
export const END_MARKER_COLOR = '#EF4444';
export const LOCK_INDICATOR_COLOR = '#F59E0B';

export function getStreetColor(isActive: boolean, alternateIndex: number): string {
  if (isActive) return ACTIVE_STREET_COLOR;
  return ALTERNATE_STREET_COLORS[alternateIndex % ALTERNATE_STREET_COLORS.length];
}
