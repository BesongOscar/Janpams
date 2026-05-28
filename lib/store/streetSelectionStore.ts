import { create } from 'zustand';
import type { Street } from '../createLocationAddress';
import type { ResolvedStreetGeometry, StreetDirectionLock } from '../streetGeometry';
import type { ActiveStreetData, RejectedStreet, AccessType } from '../streetSelection';

export interface StreetSelectionDebugData {
  rejectedStreets: RejectedStreet[];
  accessType: AccessType;
  activeStreetId?: string;
}

export interface StreetSelectionState {
  activeStreet: Street | null;
  activeStreetData: ActiveStreetData | null;
  resolvedStreetGeometry: ResolvedStreetGeometry | null;
  activeStreetDirectionLock: StreetDirectionLock | null;
  nearbyStreets: ActiveStreetData[];
  streetSelectionDebug: StreetSelectionDebugData | null;

  setActiveStreet: (street: Street | null) => void;
  setActiveStreetData: (data: ActiveStreetData | null) => void;
  setResolvedStreetGeometry: (geometry: ResolvedStreetGeometry | null) => void;
  setActiveStreetDirectionLock: (lock: StreetDirectionLock | null) => void;
  setNearbyStreets: (streets: ActiveStreetData[]) => void;
  setStreetSelectionDebug: (debug: StreetSelectionDebugData | null) => void;
  reset: () => void;
}

const initialState = {
  activeStreet: null as Street | null,
  activeStreetData: null as ActiveStreetData | null,
  resolvedStreetGeometry: null as ResolvedStreetGeometry | null,
  activeStreetDirectionLock: null as StreetDirectionLock | null,
  nearbyStreets: [] as ActiveStreetData[],
  streetSelectionDebug: null as StreetSelectionDebugData | null,
};

export const useStreetSelectionStore = create<StreetSelectionState>((set) => ({
  ...initialState,
  setActiveStreet: (street) => set({ activeStreet: street }),
  setActiveStreetData: (data) => set({ activeStreetData: data }),
  setResolvedStreetGeometry: (geometry) => set({ resolvedStreetGeometry: geometry }),
  setActiveStreetDirectionLock: (lock) => set({ activeStreetDirectionLock: lock }),
  setNearbyStreets: (streets) => set({ nearbyStreets: streets }),
  setStreetSelectionDebug: (debug) => set({ streetSelectionDebug: debug }),
  reset: () => set(initialState),
}));
