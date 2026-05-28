import { create } from 'zustand';
import type { AddressData } from '../createLocationAddress';
import type { ResolvedStreetGeometry } from '../streetGeometry';

export interface SearchHighlightData {
  geometry: [number, number][];
  name?: string;
}

export interface AddressState {
  calculatedAddress: AddressData | null;
  userLocationAddress: AddressData | null;
  activeLocationAddress: AddressData | null;
  searchHighlight: SearchHighlightData | null;
  pendingCreateStreetGeometry: ResolvedStreetGeometry | null;

  setCalculatedAddress: (address: AddressData | null) => void;
  setUserLocationAddress: (address: AddressData | null) => void;
  setActiveLocationAddress: (address: AddressData | null) => void;
  setBothAddresses: (address: AddressData | null) => void;
  setSearchHighlight: (highlight: SearchHighlightData | null) => void;
  setPendingCreateStreetGeometry: (geometry: ResolvedStreetGeometry | null) => void;
  reset: () => void;
}

const initialState = {
  calculatedAddress: null as AddressData | null,
  userLocationAddress: null as AddressData | null,
  activeLocationAddress: null as AddressData | null,
  searchHighlight: null as SearchHighlightData | null,
  pendingCreateStreetGeometry: null as ResolvedStreetGeometry | null,
};

export const useAddressStore = create<AddressState>((set) => ({
  ...initialState,
  setCalculatedAddress: (address) => set({ calculatedAddress: address }),
  setUserLocationAddress: (address) => set({ userLocationAddress: address }),
  setActiveLocationAddress: (address) => set({ activeLocationAddress: address }),
  setBothAddresses: (address) =>
    set({ userLocationAddress: address, activeLocationAddress: address }),
  setSearchHighlight: (highlight) => set({ searchHighlight: highlight }),
  setPendingCreateStreetGeometry: (geometry) => set({ pendingCreateStreetGeometry: geometry }),
  reset: () => set(initialState),
}));
