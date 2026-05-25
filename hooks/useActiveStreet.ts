/**
 * useActiveStreet — active street with geometry and direction lock
 *
 * Runs street selection (selectStreets), direction lock, geometry resolution,
 * and house number calculation. Updates map store; works entirely offline.
 *
 * Phase 4: State management — offline first.
 */

import { useCallback } from 'react';
import { useMapStore } from '@/lib/store/mapStore';
import { selectStreets, detectContext } from '@/lib/streetSelection';
import type { ActiveStreetData } from '@/lib/streetSelection';
import { normalizeStreetKey } from '@/lib/streetDirectionService';
import { resolveStreetGeometry } from '@/lib/streetGeometry';
import { calculateHouseNumberSync } from '@/lib/createLocationAddress';
import type { Street, AddressData } from '@/lib/createLocationAddress';
import type { OfflineReverseGeocodeResult } from '@/lib/offlineDataPacks';
import { getDirectionLock } from '@/lib/streetDirectionService';

/** Convert ActiveStreetData (geometry [lon,lat]) to Street (geometry [lat,lon]) for resolution */
function activeStreetDataToStreet(data: ActiveStreetData): Street {
  return {
    id: data.segment_id,
    name: data.name,
    geometry: data.geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
    direction_locked: false,
  };
}

export interface UseActiveStreetConfig {
  context?: 'urban' | 'rural';
  urbanRadius?: number;
  ruralRadius?: number;
}

/**
 * Update store from location: run selectStreets, direction lock, resolution, house number.
 * Call when user location or map-selected location changes.
 */
export async function updateActiveStreetFromLocation(
  lat: number,
  lon: number,
  config?: UseActiveStreetConfig
): Promise<void> {
  const context = config?.context ?? (await detectContext(lat, lon));
  const selectionResult = await selectStreets(lat, lon, {
    context,
    urbanRadius: config?.urbanRadius ?? 60,
    ruralRadius: config?.ruralRadius ?? 100,
    maxFrontageCandidateDistanceUrban: 60,
    maxFrontageCandidateDistanceRural: 100,
    cornerAlternateMaxDistance: 25,
    cornerAlternateMaxAngle: 90,
  });

  useMapStore.getState().setStreetSelectionDebug({
    rejectedStreets: selectionResult.rejectedStreets,
    accessType: selectionResult.accessType,
    activeStreetId: selectionResult.activeStreet?.segment_id,
  });
  useMapStore.getState().setNearbyStreets(selectionResult.candidateStreets);

  if (!selectionResult.activeStreet) {
    useMapStore.getState().setActiveStreetData(null);
    useMapStore.getState().setResolvedStreetGeometry(null);
    useMapStore.getState().setActiveStreetDirectionLock(null);
    useMapStore.getState().setCalculatedAddress(null);
    useMapStore.getState().setActiveStreet(null);
    return;
  }

  const activeStreetData = selectionResult.activeStreet;
  useMapStore.getState().setActiveStreetData(activeStreetData);

  const streetKey = normalizeStreetKey(activeStreetData.name);
  const directionLock = await getDirectionLock(streetKey);
  useMapStore.getState().setActiveStreetDirectionLock(directionLock);

  const street = activeStreetDataToStreet(activeStreetData);
  const resolved = resolveStreetGeometry(street, directionLock);
  useMapStore.getState().setResolvedStreetGeometry(resolved);
  useMapStore.getState().setActiveStreet(street);

  const nearbyAsStreet: Street[] = selectionResult.candidateStreets
    .filter((s) => s.segment_id !== activeStreetData.segment_id)
    .map((s) => activeStreetDataToStreet(s));

  const calculatedAddress = calculateHouseNumberSync(lat, lon, street, {
    directionLock,
    nearbyStreets: nearbyAsStreet,
  });
  useMapStore.getState().setCalculatedAddress(calculatedAddress ?? null);
}

/**
 * Sync map store from resolveStreetAddress result (e.g. after address check or when enriching location).
 * Use when the app already has a resolve result and should not run selectStreets again.
 */
export async function syncMapStoreFromResolveResult(
  result: OfflineReverseGeocodeResult,
  activeLocation: { latitude: number; longitude: number }
): Promise<void> {
  useMapStore.getState().setActiveLocation(activeLocation);
  useMapStore.getState().setNearbyStreets(result.nearbyStreets);
  useMapStore.getState().setStreetSelectionDebug({
    rejectedStreets: result.rejectedStreets ?? [],
    accessType: result.accessType ?? 'FRONTAGE',
  });

  if (!result.activeStreet) {
    useMapStore.getState().setActiveStreetData(null);
    useMapStore.getState().setResolvedStreetGeometry(null);
    useMapStore.getState().setActiveStreetDirectionLock(null);
    useMapStore.getState().setActiveStreet(null);
    // Still set a minimal calculatedAddress from reverse-geocode admin so create-address can prefill city/neighborhood/region/country
    const admin = result.admin;
    if (admin && (admin.city || admin.neighborhood || admin.region || admin.country)) {
      const minimalAddress: AddressData = {
        houseNumber: 0,
        street: '',
        chainage: '0',
        spacing: 14,
        displayAddress: admin.city ?? admin.neighborhood ?? admin.region ?? admin.country ?? '',
        noStreetFound: true,
        osmData: {
          neighborhood: admin.neighborhood ?? null,
          city: admin.city ?? '',
          region: admin.region ?? '',
          region_code: admin.region_code ?? null,
          country: admin.country ?? '',
        },
      };
      useMapStore.getState().setCalculatedAddress(minimalAddress);
    } else {
      useMapStore.getState().setCalculatedAddress(null);
    }
    return;
  }

  useMapStore.getState().setActiveStreetData(result.activeStreet);
  const streetKey = result.streetKey ?? normalizeStreetKey(result.activeStreet.name);
  const directionLock = await getDirectionLock(streetKey);
  useMapStore.getState().setActiveStreetDirectionLock(directionLock);

  const street = activeStreetDataToStreet(result.activeStreet);
  const resolved = resolveStreetGeometry(street, directionLock);
  useMapStore.getState().setResolvedStreetGeometry(resolved);
  useMapStore.getState().setActiveStreet(street);

  const calculatedAddress: AddressData | null =
    result.houseNumber != null && result.street
      ? {
          houseNumber: result.houseNumber,
          street: result.street.name,
          chainage: String(result.chainage ?? 0),
          side: result.street.side,
          spacing: 14,
          displayAddress: `${result.houseNumber} ${result.street.name}`,
        }
      : null;
  useMapStore.getState().setCalculatedAddress(calculatedAddress);
}

export function useActiveStreet() {
  const activeStreetData = useMapStore((s) => s.activeStreetData);
  const resolvedStreetGeometry = useMapStore((s) => s.resolvedStreetGeometry);
  const activeStreetDirectionLock = useMapStore((s) => s.activeStreetDirectionLock);
  const nearbyStreets = useMapStore((s) => s.nearbyStreets);
  const calculatedAddress = useMapStore((s) => s.calculatedAddress);
  const streetSelectionDebug = useMapStore((s) => s.streetSelectionDebug);
  const setActiveStreetData = useMapStore((s) => s.setActiveStreetData);
  const setResolvedStreetGeometry = useMapStore((s) => s.setResolvedStreetGeometry);
  const setActiveStreetDirectionLock = useMapStore((s) => s.setActiveStreetDirectionLock);
  const setNearbyStreets = useMapStore((s) => s.setNearbyStreets);
  const setCalculatedAddress = useMapStore((s) => s.setCalculatedAddress);
  const setStreetSelectionDebug = useMapStore((s) => s.setStreetSelectionDebug);

  const updateFromLocation = useCallback(
    async (lat: number, lon: number, config?: UseActiveStreetConfig) => {
      await updateActiveStreetFromLocation(lat, lon, config);
    },
    []
  );

  /** Set active street and resolve geometry (e.g. when geometry already from resolveStreetAddress) */
  const setActiveStreetWithGeometry = useCallback(
    (streetData: ActiveStreetData | null) => {
      setActiveStreetData(streetData);
      if (streetData) {
        const street = activeStreetDataToStreet(streetData);
        const resolved = resolveStreetGeometry(street, activeStreetDirectionLock);
        setResolvedStreetGeometry(resolved);
      } else {
        setResolvedStreetGeometry(null);
      }
    },
    [activeStreetDirectionLock, setActiveStreetData, setResolvedStreetGeometry]
  );

  const clearActiveStreet = useCallback(() => {
    setActiveStreetData(null);
    setResolvedStreetGeometry(null);
    setActiveStreetDirectionLock(null);
    setNearbyStreets([]);
    setCalculatedAddress(null);
    setStreetSelectionDebug(null);
  }, [
    setActiveStreetData,
    setResolvedStreetGeometry,
    setActiveStreetDirectionLock,
    setNearbyStreets,
    setCalculatedAddress,
    setStreetSelectionDebug,
  ]);

  return {
    activeStreetData,
    resolvedStreetGeometry,
    activeStreetDirectionLock,
    nearbyStreets,
    calculatedAddress,
    rejectedStreets: streetSelectionDebug?.rejectedStreets ?? [],
    accessType: streetSelectionDebug?.accessType,
    updateFromLocation,
    setActiveStreetWithGeometry,
    clearActiveStreet,
  };
}
