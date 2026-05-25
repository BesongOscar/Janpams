/**
 * Map/Address state store (Zustand)
 *
 * Single source of truth for active location, active street, resolved geometry,
 * direction lock, nearby streets, and calculated address. No network; all data
 * from local modules (selectStreets, resolveStreetGeometry, calculateHouseNumberSync).
 *
 * Phase 4: State management — offline first.
 */

import { create } from 'zustand';
import type { AddressData, Street } from '../createLocationAddress';
import type { ResolvedStreetGeometry, StreetDirectionLock } from '../streetGeometry';
import type { ActiveStreetData } from '../streetSelection';
import type { RejectedStreet, AccessType } from '../streetSelection';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/** Debug data for street selection (optional; no debug UI in app scope) */
export interface StreetSelectionDebugData {
  rejectedStreets: RejectedStreet[];
  accessType: AccessType;
  activeStreetId?: string;
}

/** Geometry for search highlight: GeoJSON [lon, lat][] */
export interface SearchHighlightData {
  geometry: [number, number][];
  name?: string;
}

/** Source of active location (parity with web: trust/analytics) */
export type ActiveLocationSource = 'gps' | 'map_click' | null;

export interface MapState {
  /** User's actual GPS position. Must only be set from GPS (e.g. handleUseCurrentLocation or restore). Never set from a clicked cell. */
  userLocation: GeoPosition | null;
  /** The grid cell the user has selected (center = GPS cell, or any neighbor). Set when user taps a cell or when GPS is used and that cell is the "active" one. */
  activeLocation: GeoPosition | null;
  /** Whether activeLocation came from GPS or a map tap (web parity) */
  activeLocationSource: ActiveLocationSource;

  activeStreet: Street | null;
  activeStreetData: ActiveStreetData | null;
  resolvedStreetGeometry: ResolvedStreetGeometry | null;
  activeStreetDirectionLock: StreetDirectionLock | null;
  nearbyStreets: ActiveStreetData[];

  calculatedAddress: AddressData | null;
  /** Address at user's GPS position (for reuse when tapping back to GPS cell) */
  userLocationAddress: AddressData | null;
  /** Address at active/clicked position (web parity) */
  activeLocationAddress: AddressData | null;
  searchHighlight: SearchHighlightData | null;

  streetSelectionDebug: StreetSelectionDebugData | null;
  /** Geometry handed off when navigating to create-address so marching ants use location-context street. Cleared after create screen reads it. */
  pendingCreateStreetGeometry: ResolvedStreetGeometry | null;

  setUserLocation: (location: GeoPosition | null) => void;
  setActiveLocation: (location: GeoPosition | null) => void;
  setActiveLocationSource: (source: ActiveLocationSource) => void;
  setActiveStreet: (street: Street | null) => void;
  setActiveStreetData: (data: ActiveStreetData | null) => void;
  setResolvedStreetGeometry: (geometry: ResolvedStreetGeometry | null) => void;
  setActiveStreetDirectionLock: (lock: StreetDirectionLock | null) => void;
  setNearbyStreets: (streets: ActiveStreetData[]) => void;
  setCalculatedAddress: (address: AddressData | null) => void;
  setUserLocationAddress: (address: AddressData | null) => void;
  setActiveLocationAddress: (address: AddressData | null) => void;
  /** Set both user and active address (e.g. initial load when active = GPS) */
  setBothAddresses: (address: AddressData | null) => void;
  setSearchHighlight: (highlight: SearchHighlightData | null) => void;
  setStreetSelectionDebug: (debug: StreetSelectionDebugData | null) => void;
  setPendingCreateStreetGeometry: (geometry: ResolvedStreetGeometry | null) => void;
  reset: () => void;
}

const initialState = {
  userLocation: null as GeoPosition | null,
  activeLocation: null as GeoPosition | null,
  activeLocationSource: null as ActiveLocationSource,
  activeStreet: null as Street | null,
  activeStreetData: null as ActiveStreetData | null,
  resolvedStreetGeometry: null as ResolvedStreetGeometry | null,
  activeStreetDirectionLock: null as StreetDirectionLock | null,
  nearbyStreets: [] as ActiveStreetData[],
  calculatedAddress: null as AddressData | null,
  userLocationAddress: null as AddressData | null,
  activeLocationAddress: null as AddressData | null,
  searchHighlight: null as SearchHighlightData | null,
  streetSelectionDebug: null as StreetSelectionDebugData | null,
  pendingCreateStreetGeometry: null as ResolvedStreetGeometry | null,
};

export const useMapStore = create<MapState>((set) => ({
  ...initialState,
  setUserLocation: (location) => set({ userLocation: location }),
  setActiveLocation: (location) => set({ activeLocation: location }),
  setActiveLocationSource: (source) => set({ activeLocationSource: source }),
  setActiveStreet: (street) => set({ activeStreet: street }),
  setActiveStreetData: (data) => set({ activeStreetData: data }),
  setResolvedStreetGeometry: (geometry) => set({ resolvedStreetGeometry: geometry }),
  setActiveStreetDirectionLock: (lock) => set({ activeStreetDirectionLock: lock }),
  setNearbyStreets: (streets) => set({ nearbyStreets: streets }),
  setCalculatedAddress: (address) => set({ calculatedAddress: address }),
  setUserLocationAddress: (address) => set({ userLocationAddress: address }),
  setActiveLocationAddress: (address) => set({ activeLocationAddress: address }),
  setBothAddresses: (address) =>
    set({ userLocationAddress: address, activeLocationAddress: address }),
  setSearchHighlight: (highlight) => set({ searchHighlight: highlight }),
  setStreetSelectionDebug: (debug) => set({ streetSelectionDebug: debug }),
  setPendingCreateStreetGeometry: (geometry) => set({ pendingCreateStreetGeometry: geometry }),
  reset: () => set(initialState),
}));
