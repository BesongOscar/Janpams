/**
 * Navigation state store (Zustand)
 *
 * Single source of truth for the active navigation session, snapped position,
 * ETA, maneuver progression, and GPS quality during turn-by-turn navigation.
 *
 * Follows the same pattern as mapStore.ts. Written to by NavigationCore;
 * read reactively by UI components (NavigationOverlay, RouteModal, etc.).
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  NavSession,
  NavigationState,
  NavigationFailureCode,
  Coordinate,
  GPSQuality,
} from '@janpams/core/navigation';

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export interface NavigationETAInfo {
  etaSeconds: number;
  formattedETA: string;
  formattedDistance: string;
}

export interface NavigationStoreState {
  session: NavSession | null;
  snappedPosition: Coordinate | null;
  currentManeuverIndex: number;
  eta: NavigationETAInfo | null;
  gpsQuality: GPSQuality | null;
  currentSpeed: number;
  isFollowingMap: boolean;
  isVoiceMuted: boolean;
}

// ---------------------------------------------------------------------------
// Store actions
// ---------------------------------------------------------------------------

export interface NavigationStoreActions {
  setSession: (session: NavSession | null) => void;
  updateSession: (patch: Partial<NavSession>) => void;
  setSnappedPosition: (pos: Coordinate | null) => void;
  setCurrentManeuverIndex: (index: number) => void;
  setETA: (eta: NavigationETAInfo | null) => void;
  setGpsQuality: (quality: GPSQuality | null) => void;
  setCurrentSpeed: (speed: number) => void;
  setFollowingMap: (following: boolean) => void;
  setVoiceMuted: (muted: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: NavigationStoreState = {
  session: null,
  snappedPosition: null,
  currentManeuverIndex: 0,
  eta: null,
  gpsQuality: null,
  currentSpeed: 0,
  isFollowingMap: true,
  isVoiceMuted: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNavigationStore = create<
  NavigationStoreState & NavigationStoreActions
>((set, get) => ({
  ...initialState,

  setSession: (session) => set({ session }),

  updateSession: (patch) => {
    const current = get().session;
    if (!current) return;
    set({ session: { ...current, ...patch } });
  },

  setSnappedPosition: (pos) => set({ snappedPosition: pos }),
  setCurrentManeuverIndex: (index) => set({ currentManeuverIndex: index }),
  setETA: (eta) => set({ eta }),
  setGpsQuality: (quality) => set({ gpsQuality: quality }),
  setCurrentSpeed: (speed) => set({ currentSpeed: speed }),
  setFollowingMap: (following) => set({ isFollowingMap: following }),
  setVoiceMuted: (muted) => set({ isVoiceMuted: muted }),
  reset: () => set(initialState),
}));

// ---------------------------------------------------------------------------
// Derived selector hooks
// ---------------------------------------------------------------------------

export function useNavigationSession(): NavSession | null {
  return useNavigationStore((s) => s.session);
}

export function useNavState(): NavigationState {
  return useNavigationStore((s) => s.session?.state ?? 'IDLE');
}

export function useIsNavigating(): boolean {
  return useNavigationStore(
    (s) =>
      s.session?.state === 'NAVIGATING' ||
      s.session?.state === 'OFF_ROUTE_RECALCULATING' ||
      s.session?.state === 'ARRIVED',
  );
}

/** Stable selector: returns same reference when failureCode/failureMessage unchanged (avoids getSnapshot infinite loop). */
export function useNavigationError(): {
  failureCode: NavigationFailureCode;
  failureMessage: string;
} | null {
  return useNavigationStore(
    useShallow((s) => {
      const sess = s.session;
      if (!sess || sess.state !== 'FAILED' || !sess.failureCode) return null;
      return {
        failureCode: sess.failureCode,
        failureMessage: sess.failureMessage ?? '',
      };
    }),
  );
}
