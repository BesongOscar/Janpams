import { create } from 'zustand';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type ActiveLocationSource = 'gps' | 'map_click' | null;

export interface UserLocationState {
  userLocation: GeoPosition | null;
  activeLocation: GeoPosition | null;
  activeLocationSource: ActiveLocationSource;

  setUserLocation: (location: GeoPosition | null) => void;
  setActiveLocation: (location: GeoPosition | null) => void;
  setActiveLocationSource: (source: ActiveLocationSource) => void;
  reset: () => void;
}

const initialState = {
  userLocation: null as GeoPosition | null,
  activeLocation: null as GeoPosition | null,
  activeLocationSource: null as ActiveLocationSource,
};

export const useUserLocationStore = create<UserLocationState>((set) => ({
  ...initialState,
  setUserLocation: (location) => set({ userLocation: location }),
  setActiveLocation: (location) => set({ activeLocation: location }),
  setActiveLocationSource: (source) => set({ activeLocationSource: source }),
  reset: () => set(initialState),
}));
