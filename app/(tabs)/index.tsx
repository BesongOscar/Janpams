import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Text,
  Alert,
  BackHandler,
  Dimensions,
  InteractionManager,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LatLng, Region } from 'react-native-maps';
import MapViewMapLibre from '@/components/MapViewMapLibre';
import { MapLibreMarker } from '@/components/MapLibreMarker';
import { ActiveStreetLayer } from '@/components/ActiveStreetLayer';
import NearbyStreetsLayer from '@/components/NearbyStreetsLayer';
import { GPSLocationLayer } from '@/components/GPSLocationLayer';
import { SearchHighlightLayer } from '@/components/SearchHighlightLayer';
import { POILayer } from '@/components/POILayer';
import { GpsVerificationModal } from '@/components/GpsVerificationModal';
import { SourceBadge, QualityIndicator, VerificationBadge, type AddressSource, type AddressQuality } from '@/components/AddressBadges';
import * as Location from 'expo-location';

import {
  createAddressStyles,
  defaultStyles,
  tabIndexStyles as styles,
} from '@/styles';
import {
  Loader,
  MapControls,
  AddressFoundCard,
  AddressNotFoundCard,
  SwipeableBottomSheet,
  SyncStatusIndicator,
  OfflineDataManager,
  OfflineDataInfoCard,
  StreetDirectionInfo,
} from '@/components';
import { Drawer } from '@/components/Drawer';
import { Button, Dialog, Icon, Checkbox } from 'react-native-paper';
import { Colors, STREET_TYPES, grayMapStyle, MAP_TILE_CONFIG } from '@/constants';
import { Context, ContextType } from '../_layout';
import {
  useCheckAddress,
  useAddAliasAddress,
  useGetWhat3Words,
} from '@/hooks/addresses.hooks';
import { getDisplayCode } from '@janpams/core/pluscode';
import { useOffline } from '@/hooks/useOffline';
import { useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { addressesCheckAddressResponse } from '@/interfaces';
import { openShareSheet, storeData, readData } from '@/utils';
import { decodePlusCodeToBounds } from '@/utils/coordinateUtils';
import { AddUnitInfo } from '@/components/AddUnitInfo';
import { AddAlias } from '@/components/AddAliasComponent';
import i18n from '../../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseFormattedAddress } from '@/utils/helpers';
import { snackbarToast } from '@/utils/toastHelpter';
import { useQueryClient } from '@tanstack/react-query';
import { useBottomSheet } from '@/contexts/BottomSheetContext';
import { sizes } from '@/constants/sizes';
import { getInstalledPacks } from '@/lib/dataPacks/manager';
import { initDB } from '@/lib/db';
import { resolveStreetAddress } from '@/lib/offlineDataPacks';
import { offlineReverseGeocode } from '@/lib/geocoding/reverseGeocode';
import { getAddressComponentsSync } from '@/lib/geocoding/getAddressComponents';
import { useActiveStreet, syncMapStoreFromResolveResult } from '@/hooks/useActiveStreet';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { useUserLocationStore } from '@/lib/store/userLocationStore';
import { useStreetSelectionStore } from '@/lib/store/streetSelectionStore';
import { useAddressStore } from '@/lib/store/addressStore';
import { checkLocation, offlineResultToCheckResponse } from '@/lib/addressServices';
import { isClickInNeighborCellOnly, isSameGridCell } from '@/utils/plusCodeGrid';

// Plus Codes G-square (grid cell) - the smallest visible grid cell
// Based on Plus Code specification: G-square is approximately 14.3m x 14.3m
// The actual grid alignment depends on the Plus Code encoding algorithm
// At latitude ~4°: 1° latitude ≈ 111,000m, 1° longitude ≈ 110,700m (cos(4°) ≈ 0.9976)
// G-square: 14.3m = 0.0001288° latitude, 0.0001292° longitude
// Fine-tuned values to match the visible grid overlay
const G_SQUARE_LAT_SIZE = 0.0001288; // 14.3m in degrees (latitude)
const G_SQUARE_LNG_SIZE = 0.0001292; // 14.3m in degrees (longitude at ~4° latitude)
const G_SQUARE_LAT_HALF = 0.0000644; // Half of G-square latitude (7.15m)
const G_SQUARE_LNG_HALF = 0.0000646; // Half of G-square longitude (7.15m)

// Plus Code grid may have a slight offset from standard lat/lng grid
// This offset helps align with the actual visible grid overlay
// Adjust these if the alignment is still off
// Negative values shift down (south) and left (west)
const GRID_ALIGNMENT_OFFSET_LAT = -0.000022; // Fine-tuned: slightly up from -0.00004
const GRID_ALIGNMENT_OFFSET_LNG = -0.000023; // Fine-tuned: slightly right from -0.00004
// Additional fine-tune nudges to better align the rendered square with the visible grid
// Positive latitude moves north (up); negative longitude moves west (left)
const GRID_NUDGE_LAT = 0.00004; // ≈1.1m up
const GRID_NUDGE_LNG = -0.000055; // ≈1.1m left

// Plus Codes uses a specific grid system with known cell size
// The G-square is exactly 14.3m x 14.3m
// We need to align to the actual Plus Code grid boundaries
// The grid cells are aligned based on the Plus Code encoding algorithm
// Using a more precise calculation that accounts for the grid's actual alignment

// Function to snap coordinates to Plus Code grid cell center
// This calculates the exact center of the G-square grid cell that contains the coordinate
// The Plus Code grid has a specific origin and alignment
const snapToPlusCodeGrid = (
  lat: number,
  lng: number,
): { lat: number; lng: number } => {
  // Apply any alignment offset first
  const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
  const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;

  // Calculate which grid cell contains this coordinate
  // Use floor to find the cell's lower boundary (this finds the cell index)
  const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
  const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);

  // Calculate the center of that grid cell
  // Center = lower boundary + half of cell size
  const snappedLat =
    latCellIndex * G_SQUARE_LAT_SIZE +
    G_SQUARE_LAT_HALF +
    GRID_ALIGNMENT_OFFSET_LAT;
  const snappedLng =
    lngCellIndex * G_SQUARE_LNG_SIZE +
    G_SQUARE_LNG_HALF +
    GRID_ALIGNMENT_OFFSET_LNG;

  return { lat: snappedLat, lng: snappedLng };
};

// Function to get grid cell boundaries directly (for perfect rectangle alignment)
const getGridCellBounds = (
  lat: number,
  lng: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
} => {
  // Apply any alignment offset first
  const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
  const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;

  // Calculate which grid cell contains this coordinate
  const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
  const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);

  // Calculate the exact boundaries of the grid cell
  const minLat = latCellIndex * G_SQUARE_LAT_SIZE + GRID_ALIGNMENT_OFFSET_LAT;
  const maxLat = minLat + G_SQUARE_LAT_SIZE;
  const minLng = lngCellIndex * G_SQUARE_LNG_SIZE + GRID_ALIGNMENT_OFFSET_LNG;
  const maxLng = minLng + G_SQUARE_LNG_SIZE;

  // Calculate center
  const centerLat = minLat + G_SQUARE_LAT_HALF;
  const centerLng = minLng + G_SQUARE_LNG_HALF;

  // Apply rendering nudge to better visually align with the tile grid
  return {
    minLat: minLat + GRID_NUDGE_LAT,
    maxLat: maxLat + GRID_NUDGE_LAT,
    minLng: minLng + GRID_NUDGE_LNG,
    maxLng: maxLng + GRID_NUDGE_LNG,
    centerLat: centerLat + GRID_NUDGE_LAT,
    centerLng: centerLng + GRID_NUDGE_LNG,
  };
};

/** Default zoom: ~350m radius from active Plus Code centroid (700m span ≈ 0.0063° at mid-latitudes). */
const DEFAULT_MAP_ZOOM_DELTA = 0.0063;

const INITIAL_REGION = {
  latitude: 4.1594, // Latitude of Buea
  longitude: 9.2481, // Longitude of Buea
  latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
  longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
};

export default function GetAdressScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);

  const { user, lang } = useContext(Context) as ContextType;

  const [location, setLocation] = useState<{
    description: string;
    coordinates: LatLng;
    addressComponents?: {
      street?: string;
      city?: string;
      neighborhood?: string;
      region?: string;
      country?: string;
      countryCode?: string;
    };
  }>();
  const [selectedLocation, setSelectedLocation] =
    useState<Region>(INITIAL_REGION);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAddress, setIsCheckingAddress] = useState(false);
  const [addressNotFound, setAddressNotFound] = useState(false);
  const [addressFound, setAddressFound] =
    useState<addressesCheckAddressResponse>();
  const [showAddressFound, setShowAddressFound] = useState(false);

  const [showAdminInfo, setShowAdminInfo] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedGridRectangle, setSelectedGridRectangle] = useState<{
    coordinates: Array<{ latitude: number; longitude: number }>;
  } | null>(null);
  const [isProcessingGridClick, setIsProcessingGridClick] = useState(false);
  const [currentPlusCode, setCurrentPlusCode] = useState<string>();
  const [currentWhat3Words, setCurrentWhat3Words] = useState<string>();
  const [showCardMarker, setShowCardMarker] = useState(true);
  const [markerCoordinates, setMarkerCoordinates] = useState<LatLng | null>(
    null,
  );
  const [pendingPlusCode, setPendingPlusCode] = useState<string>();
  const [pendingWhat3Words, setPendingWhat3Words] = useState<string>();
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [hasOfflinePacks, setHasOfflinePacks] = useState<boolean | null>(null);
  const [installedPackIds, setInstalledPackIds] = useState<string[]>([]);
  const [showOfflineTip, setShowOfflineTip] = useState(true);
  const [showGpsVerification, setShowGpsVerification] = useState(false);
  const [pendingCreateAction, setPendingCreateAction] = useState<(() => void) | null>(null);
  /** Cached check result at user GPS for reuse when tapping back to GPS cell (web parity) */
  const [lastGpsCheckResult, setLastGpsCheckResult] = useState<{
    latitude: number;
    longitude: number;
    found: boolean;
    response?: addressesCheckAddressResponse;
  } | null>(null);
  const pressStartTime = useRef<number>(0);
  const gpsCacheRef = useRef<{
    snappedLat: number;
    snappedLng: number;
    timestamp: number;
    plusCode: string;
    what3words?: string;
  } | null>(null);
  const dbReadyRef = useRef(false);
  const packsRef = useRef<{ checked: boolean; hasPacks: boolean }>({ checked: false, hasPacks: false });

  // MapLibre native init on the same frame as navigation often triggers Android ANRs ("isn't responding").
  // Defer mounting until after transitions + one frame; iOS unchanged.
  const [mapNativeMountAllowed, setMapNativeMountAllowed] = useState(Platform.OS !== 'android');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handle = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setTimeout(() => setMapNativeMountAllowed(true), 350);
      });
    });
    return () => handle.cancel();
  }, []);

  const queryClient = useQueryClient();
  const { setBottomSheetHeight, bottomSheetHeight, setHideTabBar } =
    useBottomSheet();

  // Hide bottom tab bar whenever any SwipeableBottomSheet is visible.
  const anySheetVisible = Boolean(
    (hasOfflinePacks === false && markerCoordinates && showCardMarker) ||
    (addressNotFound && markerCoordinates && showCardMarker) ||
    (addressFound && markerCoordinates && showAddressFound && showCardMarker) ||
    showOfflineManager,
  );
  useEffect(() => {
    setHideTabBar(anySheetVisible);
  }, [anySheetVisible, setHideTabBar]);

  // Check if any offline data packs are installed (used to decide whether to show offline info card)
  useEffect(() => {
    const checkOfflinePacks = async () => {
      try {
        const packs = await getInstalledPacks();
        setHasOfflinePacks(packs.length > 0);
        setInstalledPackIds(packs.map((p) => p.id));
      } catch (error) {
        console.warn('[GetAddress] Failed to read offline packs:', error);
        setHasOfflinePacks(false);
      }
    };

    checkOfflinePacks();
  }, []);

  // Update addressFound with plus code and what3words when it's set
  useEffect(() => {
    if (addressFound && (pendingPlusCode || pendingWhat3Words)) {
      const updatedResponse = {
        ...addressFound,
        global_code: addressFound.global_code || pendingPlusCode,
        w3wAddress: addressFound.w3wAddress || pendingWhat3Words,
      };
      setAddressFound(updatedResponse);
      setPendingPlusCode(undefined);
      setPendingWhat3Words(undefined);
    }
  }, [addressFound, pendingPlusCode, pendingWhat3Words]);

  // Dismiss bottom sheet when unit address card (AddUnitInfo) becomes active
  useEffect(() => {
    if (showAdminInfo) {
      // Dismiss bottom sheet when unit address card opens
      setShowCardMarker(false);
      setShowAddressFound(false);
    }
  }, [showAdminInfo]);

  //   latitude=4.144562
  // longitude=9.235563

  const navigation = useNavigation();
  const { updateFromLocation } = useActiveStreet();
  const { isLocationRestricted } = useEffectiveRole(user?.id);
  const { isOnline } = useOffline();
  const setUserLocation = useUserLocationStore((s) => s.setUserLocation);
  const setActiveLocation = useUserLocationStore((s) => s.setActiveLocation);
  const setActiveLocationSource = useUserLocationStore((s) => s.setActiveLocationSource);
  const setUserLocationAddress = useAddressStore((s) => s.setUserLocationAddress);
  const setActiveLocationAddress = useAddressStore((s) => s.setActiveLocationAddress);
  const setBothAddresses = useAddressStore((s) => s.setBothAddresses);
  const activeLocation = useUserLocationStore((s) => s.activeLocation);
  const userLocation = useUserLocationStore((s) => s.userLocation);
  const userLocationAddress = useAddressStore((s) => s.userLocationAddress);
  const calculatedAddress = useAddressStore((s) => s.calculatedAddress);

  // Task 6: Restore location and sync store from @currentCoordinates when map tab loads (only when we don't have location yet)
  const locationRef = useRef(location);
  locationRef.current = location;
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const stored = (await readData('@currentCoordinates')) as
            | { latitude: number; longitude: number }
            | null;
          if (cancelled || !stored?.latitude || !stored?.longitude) return;
          if (locationRef.current?.coordinates) return;
          setLocation(prev => ({
            description: prev?.description ?? '',
            coordinates: { latitude: stored.latitude, longitude: stored.longitude },
            addressComponents: prev?.addressComponents,
          }));
          setUserLocation({ latitude: stored.latitude, longitude: stored.longitude });
          setActiveLocation({ latitude: stored.latitude, longitude: stored.longitude });
          setActiveLocationSource('gps');
          setMarkerCoordinates({ latitude: stored.latitude, longitude: stored.longitude });
          setSelectedLocation({
            latitude: stored.latitude,
            longitude: stored.longitude,
            latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          });
        } catch (e) {
          if (!cancelled) console.warn('[GetAddress] Restore @currentCoordinates failed:', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [setUserLocation, setActiveLocation, setActiveLocationSource]),
  );

  // Enter-address-mode parity: when we have GPS and no active location yet, set active = GPS and source = gps
  useEffect(() => {
    if (
      !location?.coordinates ||
      activeLocation != null
    ) return;
    const { latitude, longitude } = location.coordinates;
    setUserLocation({ latitude, longitude });
    setActiveLocation({ latitude, longitude });
    setActiveLocationSource('gps');
  }, [location?.coordinates?.latitude, location?.coordinates?.longitude, activeLocation, setUserLocation, setActiveLocation, setActiveLocationSource]);

  const { mutateAsync: checkAddress } = useCheckAddress(
    lang,
    data => {
      if (data === undefined || Object.keys(data).length === 0) {
        Alert.alert('No data found');
        return;
      }
      // Check if formatted_address exists and is not empty/null
      // Also check if it's not a "no address" message in any language
      const formattedAddress = data?.formatted_address?.trim();
      const normalizedFormatted = formattedAddress?.toLowerCase();
      const hasFormattedAddress =
        formattedAddress &&
        ![
          'no official address',
          'no ofiicial address', // typo variant sometimes returned
          'aucune adresse officielle',
          'nenhum endereço oficial',
          'sem endereço oficial',
        ].includes(normalizedFormatted ?? '');

      if (hasFormattedAddress) {
        // Address found - show it
        setAddressFound(data);
        setShowAddressFound(true);

        // Show rectangle/square box for the found address location
        const lat =
          typeof data?.latitude === 'string'
            ? parseFloat(data.latitude)
            : data?.latitude;
        const lng =
          typeof data?.longitude === 'string'
            ? parseFloat(data.longitude)
            : data?.longitude;

        // Cache at user location for reuse when tapping back to GPS cell (web parity)
        if (
          lat != null &&
          lng != null &&
          !isNaN(lat) &&
          !isNaN(lng) &&
          location?.coordinates &&
          isSameGridCell(lat, lng, location.coordinates.latitude, location.coordinates.longitude)
        ) {
          setLastGpsCheckResult({
            latitude: lat,
            longitude: lng,
            found: true,
            response: data,
          });
          setUserLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
        }

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          setMarkerCoordinates({ latitude: lat, longitude: lng });
          setShowCardMarker(true);
          const plusCode = data?.global_code || getDisplayCode(lat, lng);
          let centerLat = lat;
          let centerLng = lng;
          if (plusCode) {
            const decodedBounds = decodePlusCodeToBounds(plusCode);
            const bounds = decodedBounds ?? getGridCellBounds(lat, lng);
            centerLat = bounds.centerLat;
            centerLng = bounds.centerLng;
            setMarkerCoordinates({
              latitude: centerLat,
              longitude: centerLng,
            });
            setSelectedLocation({
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
              longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            });
            setSelectedGridRectangle({
              coordinates: [
                { latitude: bounds.minLat, longitude: bounds.minLng },
                { latitude: bounds.maxLat, longitude: bounds.minLng },
                { latitude: bounds.maxLat, longitude: bounds.maxLng },
                { latitude: bounds.minLat, longitude: bounds.maxLng },
              ],
            });
            if (mapRef.current) {
              mapRef.current.animateToRegion(
                {
                  latitude: centerLat,
                  longitude: centerLng,
                  latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
                  longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
                },
                500,
              );
            }
          }
          // Populate map store (marching ants, active street, neighboring streets) when we have offline packs
          (async () => {
            try {
              const packs = await getInstalledPacks();
              if (packs.length > 0) {
                await initDB();
                const streetResult = await resolveStreetAddress(centerLat, centerLng, 60);
                syncMapStoreFromResolveResult(streetResult, { latitude: centerLat, longitude: centerLng });
                setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
              }
            } catch (e) {
              if (__DEV__) console.warn('[Index] Sync map store from API address:', e);
            }
          })();
        } else {
          // If no coordinates in data, ensure marker is still visible (coordinates already set in handleMapPress)
          setShowCardMarker(true);
        }
      } else if (data?.nearby_addresses && data.nearby_addresses.length > 0) {
        // Use the first nearby address as a found address fallback
        const firstNearby = data.nearby_addresses[0];
        const lat =
          typeof firstNearby?.latitude === 'string'
            ? parseFloat(firstNearby.latitude)
            : firstNearby?.latitude;
        const lng =
          typeof firstNearby?.longitude === 'string'
            ? parseFloat(firstNearby.longitude)
            : firstNearby?.longitude;

        const mergedFound = {
          ...data,
          ...firstNearby,
          formatted_address:
            firstNearby?.formatted_address || data?.formatted_address,
          latitude: firstNearby?.latitude || data?.latitude,
          longitude: firstNearby?.longitude || data?.longitude,
          address_components:
            firstNearby?.address_components || data?.address_components,
          global_code: firstNearby?.global_code || data?.global_code,
          w3wAddress: firstNearby?.w3wAddress || data?.w3wAddress,
        };

        setAddressFound(mergedFound as addressesCheckAddressResponse);
        setShowAddressFound(true);
        setAddressNotFound(false);

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          setMarkerCoordinates({ latitude: lat, longitude: lng });
          setShowCardMarker(true);
          const nearbyPlusCode = mergedFound.global_code || getDisplayCode(lat, lng);
          let centerLat = lat;
          let centerLng = lng;
          if (nearbyPlusCode) {
            const decodedBounds = decodePlusCodeToBounds(nearbyPlusCode);
            const bounds = decodedBounds ?? getGridCellBounds(lat, lng);
            centerLat = bounds.centerLat;
            centerLng = bounds.centerLng;
            setMarkerCoordinates({
              latitude: centerLat,
              longitude: centerLng,
            });
            setSelectedLocation({
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
              longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            });
            setSelectedGridRectangle({
              coordinates: [
                { latitude: bounds.minLat, longitude: bounds.minLng },
                { latitude: bounds.maxLat, longitude: bounds.minLng },
                { latitude: bounds.maxLat, longitude: bounds.maxLng },
                { latitude: bounds.minLat, longitude: bounds.maxLng },
              ],
            });
            if (mapRef.current) {
              mapRef.current.animateToRegion(
                {
                  latitude: centerLat,
                  longitude: centerLng,
                  latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
                  longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
                },
                500,
              );
            }
          }
          (async () => {
            try {
              const packs = await getInstalledPacks();
              if (packs.length > 0) {
                await initDB();
                const streetResult = await resolveStreetAddress(centerLat, centerLng, 60);
                syncMapStoreFromResolveResult(streetResult, { latitude: centerLat, longitude: centerLng });
                setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
              }
            } catch (e) {
              if (__DEV__) console.warn('[Index] Sync map store from API nearby address:', e);
            }
          })();
        } else {
          setShowCardMarker(true);
        }
      } else {
        // No official address - show address not found
        setAddressNotFound(true);
        // Set marker coordinates for the not found card marker
        // Use coordinates from data if available, otherwise markerCoordinates should already be set from handleMapPress
        const lat =
          typeof data?.latitude === 'string'
            ? parseFloat(data.latitude)
            : data?.latitude;
        const lng =
          typeof data?.longitude === 'string'
            ? parseFloat(data.longitude)
            : data?.longitude;
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          setMarkerCoordinates({ latitude: lat, longitude: lng });
        }
        // If no coordinates in data, markerCoordinates should already be set from handleMapPress
        setShowCardMarker(true);
      }
    },
    async (error: any) => {
      // Handle errors from checkAddress (timeouts, slow connections, API errors, etc.)
      setIsLoading(false);
      setIsCheckingAddress(false);

      let errorMessage = i18n.t('(tabs).index.errorCheckingAddress');

      // Check for timeout or slow connection errors
      if (
        error?.message?.includes('timeout') ||
        error?.code === 'ECONNABORTED'
      ) {
        errorMessage =
          'Request timeout: The server took too long to respond. Please check your internet connection.';
        router.replace('/(tabs)');
        return;
      }

      // Check for network errors
      if (
        error?.message?.includes('Network Error') ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ECONNREFUSED'
      ) {
        errorMessage =
          'Network error: Unable to connect to the server. Please check your internet connection.';
        router.replace('/(tabs)');
        return;
      }

      // For other errors (e.g. 404, 500, address API failure), show the actual message when useful
      const rawMessage = error?.message?.trim?.();
      if (rawMessage && rawMessage.length > 0 && rawMessage.length < 200) {
        errorMessage = rawMessage;
      }

      // Alert.alert(i18n.t('(tabs).index.error'), errorMessage, [
      //   { text: 'Go Back', onPress: () => router.replace('/(tabs)') },
      // ]);
    },
  );

  // Extract address checking logic to reusable function
  const handleUseCurrentLocation = useCallback(async () => {
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      setIsLoading(true);
      // Reset states when triggering address check
      setAddressNotFound(false);
      setAddressFound(undefined);
      setShowAddressFound(false);
      setMarkerCoordinates(null);
      setShowCardMarker(true);

      // Set a timeout to detect slow connections (20 seconds)
      // This ensures we don't get stuck on slow connections
      timeoutId = setTimeout(() => {
        setIsLoading(false);
        setIsCheckingAddress(false);
        // Auto-navigate back to tabs screen on timeout
        router.replace('/(tabs)');
      }, 20000); // 20 seconds timeout

      // --- Cache check: reuse recent GPS fix for same cell ---
      const cached = gpsCacheRef.current;
      let snappedLat: number;
      let snappedLng: number;
      let plusCode: string;
      let what3words: string | undefined;

      if (cached && (Date.now() - cached.timestamp) < 30_000) {
        snappedLat = cached.snappedLat;
        snappedLng = cached.snappedLng;
        plusCode = cached.plusCode;
        what3words = cached.what3words;
        setIsCheckingAddress(true);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
        if (timeoutId) clearTimeout(timeoutId);
        alert(i18n.t('(tabs).index.pleaseAcceptPermissions'));
        setIsLoading(false);
        return;
      }

      // Ensure device location services are on
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (timeoutId) clearTimeout(timeoutId);
        Alert.alert(
          i18n.t('(tabs).index.error'),
          'Location services are disabled. Please enable GPS/Location and try again.',
          [{ text: 'OK' }],
        );
        setIsLoading(false);
        return;
      }

      // Try high-accuracy first, fallback to last known if it fails
      let currentLocation;
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
          mayShowUserSettingsDialog: true,
        });
      } catch (posErr) {
        console.warn(
          'Error getting current position, trying last known:',
          posErr,
        );
        currentLocation = await Location.getLastKnownPositionAsync();
      }

      if (!currentLocation) {
        if (timeoutId) clearTimeout(timeoutId);
        Alert.alert(
          i18n.t('(tabs).index.error'),
          'Unable to get current location. Please move to an open area or try again.',
        );
        setIsLoading(false);
        return;
      }
      const address = await Location.reverseGeocodeAsync(
        currentLocation.coords,
      );

      // Snap current location to the exact center of the Plus Code grid cell (G-square)
      const snapped = snapToPlusCodeGrid(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
      );
      snappedLat = snapped.lat;
      snappedLng = snapped.lng;

      const snappedCoords = {
        ...currentLocation.coords,
        latitude: snappedLat,
        longitude: snappedLng,
      };

      if (address?.length) {
        await storeData('@currentCoordinates', snappedCoords);
      }

      setSelectedLocation({
        latitude: snappedLat,
        longitude: snappedLng,
        latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
      });

      setLocation({
        description: `${address[0].name}, ${address[0].city}, ${address[0].country}`,
        coordinates: snappedCoords,
        addressComponents: {
          street: address[0].name || address[0].street || undefined,
          city: address[0].city || undefined,
          neighborhood: address[0].district || address[0].subregion || undefined,
          region: address[0].region || undefined,
          country: address[0].country || undefined,
          countryCode: address[0].isoCountryCode || undefined,
        },
      });

      // Set marker coordinates so grid visualization can render
      setMarkerCoordinates({
        latitude: snappedLat,
        longitude: snappedLng,
      });
      // userLocation = always from GPS (only updated here, on restore, or when location first arrives)
      setUserLocation({ latitude: snappedLat, longitude: snappedLng });
      setActiveLocation({ latitude: snappedLat, longitude: snappedLng });

      // Compute Plus Code locally (no API needed); W3W only when online
      plusCode = getDisplayCode(snappedLat, snappedLng);
      what3words = undefined;
      if (isOnline) {
        try {
          const w3wResponse = await getWhat3Words({
            latitude: snappedLat,
            longitude: snappedLng,
          });
          what3words = w3wResponse?.words || undefined;
        } catch (error) {
          console.warn('Error getting what3words:', error);
        }
      }

      setCurrentPlusCode(plusCode);
      setCurrentWhat3Words(what3words);

      if (plusCode) {
        const decodedBounds = decodePlusCodeToBounds(plusCode);
        const bounds =
          decodedBounds ?? getGridCellBounds(snappedLat, snappedLng);

        setSelectedLocation({
          latitude: bounds.centerLat,
          longitude: bounds.centerLng,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        });

        setSelectedGridRectangle({
          coordinates: [
            { latitude: bounds.minLat, longitude: bounds.minLng },
            { latitude: bounds.maxLat, longitude: bounds.minLng },
            { latitude: bounds.maxLat, longitude: bounds.maxLng },
            { latitude: bounds.minLat, longitude: bounds.maxLng },
          ],
        });

        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: bounds.centerLat,
              longitude: bounds.centerLng,
              latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
              longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            },
            500,
          );
        }
      }

        // Update GPS cache
        gpsCacheRef.current = {
          snappedLat,
          snappedLng,
          timestamp: Date.now(),
          plusCode,
          what3words,
        };
      }

      // Show address checking loading state
      setIsCheckingAddress(true);

      if (!packsRef.current.checked) {
        const packs = await getInstalledPacks();
        packsRef.current = { checked: true, hasPacks: packs.length > 0 };
      }
      const hasPacks = packsRef.current.hasPacks;
      if (hasPacks) {
        if (!dbReadyRef.current) {
          await initDB();
          dbReadyRef.current = true;
        }
        const offlineResult = await checkLocation(
          snappedLat, snappedLng, isOnline,
          async (lat, lng) => {
            try {
              const addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
              if (addr?.[0]) {
                return {
                  road: addr[0].street || addr[0].name || null,
                  city: addr[0].city || null,
                  region: addr[0].region || null,
                  country: addr[0].country || null,
                  country_code: addr[0].isoCountryCode || null,
                };
              }
            } catch (e) {
              console.warn('[checkLocation] Online reverse geocode fallback failed:', e);
            }
            return null;
          }
        );
        if (offlineResult.status === 'FOUND') {
          const converted = offlineResultToCheckResponse(
            offlineResult,
            snappedLat,
            snappedLng,
            plusCode ?? undefined,
            what3words ?? undefined
          );
          const responseData = converted as addressesCheckAddressResponse;
          setAddressFound(responseData);
          setShowAddressFound(true);
          setShowCardMarker(true);
          setAddressNotFound(false);
          setLastGpsCheckResult({
            latitude: snappedLat,
            longitude: snappedLng,
            found: true,
            response: responseData,
          });
          const streetResult = await resolveStreetAddress(snappedLat, snappedLng, 60);
          syncMapStoreFromResolveResult(streetResult, { latitude: snappedLat, longitude: snappedLng });
          setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
        } else {
          setAddressNotFound(true);
          setShowCardMarker(true);
          setAddressFound(undefined);
          setLastGpsCheckResult({
            latitude: snappedLat,
            longitude: snappedLng,
            found: false,
            response: undefined,
          });
          const streetResult = await resolveStreetAddress(snappedLat, snappedLng, 60);
          syncMapStoreFromResolveResult(streetResult, { latitude: snappedLat, longitude: snappedLng });
          setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
          if (isOnline) {
            try {
              await checkAddress({ latitude: snappedLat, longitude: snappedLng });
            } catch (err) {
              // onError in useCheckAddress handles it
            }
          }
        }
      } else {
        try {
          await checkAddress({
            latitude: snappedLat,
            longitude: snappedLng,
          });
        } catch (error) {
          // Error is handled by onError callback in useCheckAddress; cache NOT_FOUND so tap-back reuses
          setLastGpsCheckResult({
            latitude: snappedLat,
            longitude: snappedLng,
            found: false,
            response: undefined,
          });
        }
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setIsCheckingAddress(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      let errorMessage = i18n.t('(tabs).index.errorGettingCurrentLocation');

      if (error?.message?.includes('Network Error')) {
        errorMessage =
          'Network error: Unable to connect to the server. Please check your internet connection.';
        // Auto-navigate on network error
        router.replace('/(tabs)');
        return;
      } else if (error?.code === 'ECONNABORTED') {
        errorMessage =
          'Request timeout: The server took too long to respond. Please try again.';
        // Auto-navigate on timeout
        router.replace('/(tabs)');
        return;
      }

      Alert.alert(i18n.t('(tabs).index.error'), errorMessage, [
        {
          text: 'Retry',
          onPress: () => {
            // Retry by calling handleUseCurrentLocation again
            handleUseCurrentLocation();
          },
        },
        { text: 'Go Back', onPress: () => router.replace('/(tabs)') },
      ]);
    } finally {
      setIsLoading(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }, [lang, checkAddress, router, isOnline]);

  // Handle tab press event - trigger address check even when tab is already active
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // Only handle if this is the index tab and it's already focused
      if (navigation.isFocused()) {
        // Trigger address check
        handleUseCurrentLocation();
      }
    });

    return unsubscribe;
  }, [navigation, handleUseCurrentLocation]);

  useFocusEffect(
    useCallback(() => {
      // Call the extracted function when screen comes into focus
      handleUseCurrentLocation();
      return () => {
        setAddressNotFound(false);
        setAddressFound(undefined);
        setShowAddressFound(false);
        setMarkerCoordinates(null);
        setShowCardMarker(true);
        setIsDrawerOpen(false);
      };
    }, [handleUseCurrentLocation]),
  );

  // When address not found, enrich location with offline street + neighborhood so the card shows both
  useEffect(() => {
    if (!addressNotFound || !markerCoordinates) return;
    const lat = markerCoordinates.latitude;
    const lng = markerCoordinates.longitude;
    let cancelled = false;
    (async () => {
      try {
        await initDB();
        const installedPacks = await getInstalledPacks();
        const packIds = installedPacks.length > 0 ? installedPacks.map((p) => p.id) : undefined;
        const [geocodeResult, streetResult] = await Promise.all([
          offlineReverseGeocode(lat, lng, { cameroonTuning: true, packIds }),
          resolveStreetAddress(lat, lng, 60),
        ]);
        if (cancelled) return;
        const components = getAddressComponentsSync(geocodeResult?.address ?? {});
        const street =
          streetResult?.street?.name ??
          streetResult?.activeStreet?.name ??
          undefined;
        const neighborhood = components?.neighborhood ?? undefined;
        const city = components?.city ?? undefined;
        const region = components?.state ?? undefined;
        const country = components?.country ?? undefined;
        const countryCode = components?.country_code ?? undefined;
        setLocation(prev => ({
          description: prev?.description ?? `${street ?? ''}, ${city ?? ''}, ${country ?? ''}`,
          coordinates: prev?.coordinates ?? { latitude: lat, longitude: lng },
          addressComponents: {
            street: street ?? prev?.addressComponents?.street,
            city: city ?? prev?.addressComponents?.city,
            neighborhood: neighborhood ?? prev?.addressComponents?.neighborhood,
            region: region ?? prev?.addressComponents?.region,
            country: country ?? prev?.addressComponents?.country,
            countryCode: countryCode ?? prev?.addressComponents?.countryCode,
          },
        }));
        if (streetResult) {
          syncMapStoreFromResolveResult(streetResult, { latitude: lat, longitude: lng });
        }
      } catch (e) {
        if (!cancelled) console.warn('[Index] Enrich location context failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressNotFound, markerCoordinates?.latitude, markerCoordinates?.longitude]);

  // When address is found, populate map store with active street from location (offline selection)
  useEffect(() => {
    if (addressFound && markerCoordinates) {
      updateFromLocation(markerCoordinates.latitude, markerCoordinates.longitude);
    }
  }, [addressFound, markerCoordinates?.latitude, markerCoordinates?.longitude, updateFromLocation]);

  // This use effect listens to every back action and routes to the tabs screen
  useEffect(() => {
    const backAction = () => {
      router.replace('/(tabs)');
      return true; // prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  const closeModal = () => {
    setAddressNotFound(false);
    setAddressFound(undefined);
    setShowAddressFound(false);
    setMarkerCoordinates(null);
    setShowCardMarker(true);
    router.replace('/(tabs)');
  };

  const insets = useSafeAreaInsets();

  // Fly to location when it changes; when restricted keep camera on GPS so don't recenter on neighbor click
  useEffect(() => {
    if (!mapRef.current || !location?.coordinates || isLocationRestricted) return;
    mapRef.current.animateToRegion(
      {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
        latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
      },
      1000,
    );
  }, [location?.coordinates?.latitude, location?.coordinates?.longitude, isLocationRestricted]);

  // Dismiss bottom sheet when drawer opens
  useEffect(() => {
    if (isDrawerOpen) {
      setShowCardMarker(false);
      setShowAddressFound(false);
    }
  }, [isDrawerOpen]);

  // Adjust map region when bottom sheet expands to keep marker visible
  useEffect(() => {
    if (mapRef.current && markerCoordinates && bottomSheetHeight > 0) {
      // When bottom sheet is visible, adjust map to keep marker visible
      // Calculate how much we need to shift the map up
      // The marker should stay visible above the bottom sheet
      const paddingNeeded = bottomSheetHeight + 100; // Bottom sheet height + extra space for marker

      // Get current camera/region
      mapRef.current.getCamera().then(camera => {
        if (camera && camera.center) {
          // Animate to keep marker visible with padding
          mapRef.current?.animateCamera({
            center: {
              latitude: markerCoordinates.latitude,
              longitude: markerCoordinates.longitude,
            },
            zoom: camera.zoom || 15,
            pitch: camera.pitch || 0,
            heading: camera.heading || 0,
          });
        }
      }).catch(() => {
        // Fallback to animateToRegion if getCamera fails
        mapRef.current?.animateToRegion(
          {
            latitude: markerCoordinates.latitude,
            longitude: markerCoordinates.longitude,
            latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          },
          300,
        );
      });
    }
  }, [bottomSheetHeight, markerCoordinates]);

  const displayAddressText = parseFormattedAddress(
    addressFound?.formatted_address ?? '',
  );
  const formatedLength = Object.keys(displayAddressText).length;

  // Map controls handlers
  const handleToggleGrid = () => {
    const newValue = !showGrid;
    console.log('Toggling grid from', showGrid, 'to', newValue);
    setShowGrid(newValue);
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then(camera => {
        mapRef.current?.animateCamera({
          center: camera.center,
          zoom: (camera.zoom || 15) + 1,
        });
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then(camera => {
        mapRef.current?.animateCamera({
          center: camera.center,
          zoom: Math.max((camera.zoom || 15) - 1, 3),
        });
      });
    }
  };

  const handleToggle3D = () => {
    setShow3D(!show3D);
  };

  const handleCenterLocation = () => {
    if (!mapRef.current) return;
    const center = isLocationRestricted && userLocation
      ? userLocation
      : location?.coordinates
        ? { latitude: location.coordinates.latitude, longitude: location.coordinates.longitude }
        : null;
    if (center) {
      mapRef.current.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        },
        1000,
      );
    }
  };

  // Save Address handler
  const handleSaveAddress = async () => {
    if (!addressFound) return;

    setSavingAddress(true);
    try {
      const businessName =
        addressFound?.address_components?.business_name ||
        addressFound?.address?.business_name ||
        'Saved Address';

      await addAliasMutateAsync({
        alias_name: businessName,
        longitude: parseFloat(addressFound.longitude || '0'),
        latitude: parseFloat(addressFound.latitude || '0'),
      });
    } catch (error) {
      // Error handled by hook
    } finally {
      setSavingAddress(false);
    }
  };

  // Add to My Address handler
  const handleAddToMyAddress = () => {
    setShowAddAlias(true);
  };

  const navigateToCreateAddress = useCallback(() => {
    if (!markerCoordinates) return;
    const ac = location?.addressComponents;
    // Hand off location-context street geometry so create screen shows marching ants on same street (e.g. Borstal Street)
    const geometry = useStreetSelectionStore.getState().resolvedStreetGeometry;
    if (geometry?.geometry?.length) {
      useAddressStore.getState().setPendingCreateStreetGeometry(geometry);
    }
    router.push({
      pathname: '/new-create-address',
      params: {
        latitude: markerCoordinates.latitude.toString(),
        longitude: markerCoordinates.longitude.toString(),
        plusCode: currentPlusCode ?? '',
        what3Words: currentWhat3Words ?? '',
        street: ac?.street ?? '',
        city: ac?.city ?? '',
        neighborhood: ac?.neighborhood ?? '',
        region: ac?.region ?? '',
        country: ac?.country ?? '',
        countryCode: ac?.countryCode ?? '',
      },
    });
    setAddressNotFound(false);
    setAddressFound(undefined);
    setShowAddressFound(false);
    setMarkerCoordinates(null);
  }, [markerCoordinates, location, currentPlusCode, currentWhat3Words, router]);

  const handleCreateAddress = () => {
    if (!markerCoordinates) return;
    setPendingCreateAction(() => navigateToCreateAddress);
    setShowGpsVerification(true);
  };

  const isWithinAllowedGridArea = useCallback(
    (lat: number, lng: number) => {
      // If we haven't drawn a square yet, allow the click
      if (!selectedGridRectangle) return true;

      const latitudes = selectedGridRectangle.coordinates.map(c => c.latitude);
      const longitudes = selectedGridRectangle.coordinates.map(
        c => c.longitude,
      );

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      // Expand the bounds by one grid cell to allow adjacent squares
      const expandedMinLat = minLat - G_SQUARE_LAT_SIZE;
      const expandedMaxLat = maxLat + G_SQUARE_LAT_SIZE;
      const expandedMinLng = minLng - G_SQUARE_LNG_SIZE;
      const expandedMaxLng = maxLng + G_SQUARE_LNG_SIZE;

      return (
        lat >= expandedMinLat &&
        lat <= expandedMaxLat &&
        lng >= expandedMinLng &&
        lng <= expandedMaxLng
      );
    },
    [selectedGridRectangle],
  );

  // Share Address handler
  const handleShareAddress = () => {
    if (addressFound) {
      openShareSheet(
        {
          latitude: addressFound?.latitude,
          longitude: addressFound?.longitude,
          global_code: addressFound?.global_code,
          formatted_address: addressFound?.formatted_address,
          house_number:
            addressFound?.address_components?.house_number ??
            addressFound?.address?.house_number,
          street_name:
            addressFound?.address_components?.road ??
            addressFound?.address?.road,
        },
        user?.full_names,
      );
    }
  };

  const { mutateAsync: addAliasMutateAsync } = useAddAliasAddress(
    lang,
    () => {
      snackbarToast('Address saved successfully', 'success', Colors.success);
      queryClient.invalidateQueries({
        queryKey: ['/addresses/my-alias-addresses-infinite'],
      });
      setShowAddAlias(false);
    },
    async error => {
      setSavingAddress(false);
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(error.response.data.message, 'error', Colors.error);
      } else {
        snackbarToast('Error saving address', 'error', Colors.error);
      }
    },
  );

  const { mutateAsync: getWhat3Words } = useGetWhat3Words(
    data => {
      // What3Words will be included in the address response
    },
    error => {
      console.warn('Error getting what3words:', error);
    },
  );

  // Handle map press to open bottom sheet when grid is off
  const handleMapPressToOpenSheet = (e: any) => {
    // Only handle when grid is off and bottom sheet is closed
    if (showGrid || isProcessingGridClick) {
      return;
    }

    // If there's address data available, open the bottom sheet
    if ((addressFound || addressNotFound) && markerCoordinates) {
      setShowCardMarker(true);
      if (addressFound) {
        setShowAddressFound(true);
      }
      if (addressNotFound) {
        // Ensure addressNotFound is still true
        setAddressNotFound(true);
      }
    }
  };

  // Handle map press when grid is active
  const handleMapPress = async (e: any) => {
    // Only handle clicks when grid is shown and not already processing
    if (!showGrid || isProcessingGridClick) {
      return;
    }

    const { latitude, longitude } = e.nativeEvent.coordinate;

    // Re-center grid when clicking outside the current area
    if (!isWithinAllowedGridArea(latitude, longitude)) {
      console.log('Click outside allowed grid area, re-centering grid');
      setSelectedGridRectangle(null);
    }

    // basic_user: only 8 neighbor cells (not center). Center = user location.
    if (isLocationRestricted && location?.coordinates) {
      const userLat = location.coordinates.latitude;
      const userLon = location.coordinates.longitude;
      if (!isClickInNeighborCellOnly(latitude, longitude, userLat, userLon)) {
        snackbarToast(
          'Your role allows creating addresses only in your location or neighboring cells',
          'info'
        );
        return;
      }
    }

    // If there's a card marker visible, check if the click is near the marker
    // If it's very close (within ~20m), don't process - let the Marker handle it
    if (markerCoordinates && showCardMarker) {
      const distance = Math.sqrt(
        Math.pow(latitude - markerCoordinates.latitude, 2) +
        Math.pow(longitude - markerCoordinates.longitude, 2),
      );
      // ~20m threshold (approximately 0.00018 degrees)
      if (distance < 0.00018) {
        console.log(
          'Map click too close to marker, ignoring - let Marker handle it',
        );
        return;
      }
    }

    // Web parity: same cell = toggle sheet; GPS cell = reuse cached address when possible
    const isClickingActiveBox =
      activeLocation &&
      isSameGridCell(latitude, longitude, activeLocation.latitude, activeLocation.longitude);
    const isClickingUserBox =
      location?.coordinates &&
      isSameGridCell(
        latitude,
        longitude,
        location.coordinates.latitude,
        location.coordinates.longitude,
      );

    if (isClickingActiveBox) {
      // Toggle sheet: if visible, dismiss; if hidden, leave as-is (no re-open without data)
      const sheetVisible = Boolean(
        (addressNotFound && markerCoordinates && showCardMarker) ||
          (addressFound && markerCoordinates && showCardMarker),
      );
      if (sheetVisible) {
        setShowCardMarker(false);
        setShowAddressFound(false);
        setAddressNotFound(false);
      }
      return;
    }

    if (isClickingUserBox && lastGpsCheckResult) {
      // Reuse cached GPS check result (web: setActiveLocationAddress(userLocationAddress))
      const gpsLat = location!.coordinates!.latitude;
      const gpsLon = location!.coordinates!.longitude;
      if (
        isSameGridCell(latitude, longitude, lastGpsCheckResult.latitude, lastGpsCheckResult.longitude)
      ) {
        setIsProcessingGridClick(true);
        const bounds = getGridCellBounds(gpsLat, gpsLon);
        setMarkerCoordinates({ latitude: bounds.centerLat, longitude: bounds.centerLng });
        setActiveLocation({ latitude: bounds.centerLat, longitude: bounds.centerLng });
        setActiveLocationSource('gps');
        setActiveLocationAddress(userLocationAddress ?? null);
        setShowCardMarker(true);
        if (lastGpsCheckResult.found && lastGpsCheckResult.response) {
          setAddressFound(lastGpsCheckResult.response);
          setShowAddressFound(true);
          setAddressNotFound(false);
        } else {
          setAddressNotFound(true);
          setShowAddressFound(false);
          setAddressFound(undefined);
        }
        setCurrentPlusCode(lastGpsCheckResult.response?.global_code ?? undefined);
        setCurrentWhat3Words(lastGpsCheckResult.response?.w3wAddress ?? undefined);
        setIsProcessingGridClick(false);
        return;
      }
    }

    console.log('Map clicked at:', latitude, longitude);
    setIsProcessingGridClick(true);
    setAddressNotFound(false);
    setAddressFound(undefined);
    setShowAddressFound(false);
    setCurrentPlusCode(undefined);
    setCurrentWhat3Words(undefined);

    // Snap to grid cell center immediately so the clicked box becomes active (marching ants + blue) like web
    const tappedCellBounds = getGridCellBounds(latitude, longitude);
    const cellLat = tappedCellBounds.centerLat;
    const cellLng = tappedCellBounds.centerLng;

    // activeLocation = selected box only (never change userLocation here — it stays = GPS)
    setMarkerCoordinates({ latitude: cellLat, longitude: cellLng });
    setActiveLocation({ latitude: cellLat, longitude: cellLng });
    setActiveLocationSource(isClickingUserBox ? 'gps' : 'map_click');
    setShowCardMarker(true);

    setSelectedLocation({
      latitude: cellLat,
      longitude: cellLng,
      latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
      longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
    });

    // Update location description (use cell center for consistency with active box)
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude: cellLat,
        longitude: cellLng,
      });
      if (address?.length) {
        setLocation({
          description: `${address[0].name}, ${address[0].city}, ${address[0].country}`,
          coordinates: { latitude: cellLat, longitude: cellLng },
          addressComponents: {
            street: address[0].name || address[0].street || undefined,
            city: address[0].city || undefined,
            neighborhood: address[0].district || address[0].subregion || undefined,
            region: address[0].region || undefined,
            country: address[0].country || undefined,
            countryCode: address[0].isoCountryCode || undefined,
          },
        });
      }
    } catch (error) {
      console.warn('Error reverse geocoding clicked location:', error);
    }

    try {
      // Compute Plus Code locally; W3W only when online
      const plusCode = getDisplayCode(cellLat, cellLng);
      let what3words: string | undefined;
      if (isOnline) {
        try {
          const w3wResponse = await getWhat3Words({ latitude: cellLat, longitude: cellLng });
          what3words = w3wResponse?.words || undefined;
        } catch (e) {
          console.warn('Error getting what3words:', e);
        }
      }

      setCurrentPlusCode(plusCode);
      setCurrentWhat3Words(what3words);
      setPendingPlusCode(plusCode);
      setPendingWhat3Words(what3words);

      if (plusCode) {
        const decodedBounds = decodePlusCodeToBounds(plusCode);
        const bounds = decodedBounds ?? tappedCellBounds;
        setSelectedGridRectangle({
          coordinates: [
            { latitude: bounds.minLat, longitude: bounds.minLng },
            { latitude: bounds.maxLat, longitude: bounds.minLng },
            { latitude: bounds.maxLat, longitude: bounds.maxLng },
            { latitude: bounds.minLat, longitude: bounds.maxLng },
          ],
        });
      }

      // Check address at clicked cell center (offline-first when packs installed, else API)
      if (hasOfflinePacks) {
        await initDB();
        const offlineResult = await checkLocation(
          cellLat, cellLng, isOnline,
          async (lat, lng) => {
            try {
              const addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
              if (addr?.[0]) {
                return {
                  road: addr[0].street || addr[0].name || null,
                  city: addr[0].city || null,
                  region: addr[0].region || null,
                  country: addr[0].country || null,
                  country_code: addr[0].isoCountryCode || null,
                };
              }
            } catch (e) {
              console.warn('[checkLocation] Online reverse geocode fallback failed:', e);
            }
            return null;
          }
        );
        if (offlineResult.status === 'FOUND') {
          const converted = offlineResultToCheckResponse(
            offlineResult,
            cellLat,
            cellLng,
            plusCode ?? undefined,
            what3words ?? undefined
          );
          setAddressFound(converted as addressesCheckAddressResponse);
          setShowAddressFound(true);
          setShowCardMarker(true);
          setAddressNotFound(false);
          const streetResult = await resolveStreetAddress(cellLat, cellLng, 60);
          syncMapStoreFromResolveResult(streetResult, { latitude: cellLat, longitude: cellLng });
          setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
        } else {
          setAddressNotFound(true);
          setShowCardMarker(true);
          setAddressFound(undefined);
          const streetResult = await resolveStreetAddress(cellLat, cellLng, 60);
          syncMapStoreFromResolveResult(streetResult, { latitude: cellLat, longitude: cellLng });
          setActiveLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
        }
        // Cache result at user location for reuse when tapping back to GPS cell (web parity)
        if (location?.coordinates) {
          const b = plusCode
            ? decodePlusCodeToBounds(plusCode) ?? tappedCellBounds
            : { centerLat: cellLat, centerLng: cellLng };
          if (
            isSameGridCell(b.centerLat, b.centerLng, location.coordinates.latitude, location.coordinates.longitude)
          ) {
            setLastGpsCheckResult({
              latitude: b.centerLat,
              longitude: b.centerLng,
              found: offlineResult.status === 'FOUND',
              response:
                offlineResult.status === 'FOUND'
                  ? (offlineResultToCheckResponse(
                      offlineResult,
                      cellLat,
                      cellLng,
                      plusCode ?? undefined,
                      what3words ?? undefined,
                    ) as addressesCheckAddressResponse)
                  : undefined,
            });
            setUserLocationAddress(useAddressStore.getState().calculatedAddress ?? null);
          }
        }
      } else {
        await checkAddress({
          latitude: cellLat,
          longitude: cellLng,
        });
      }

      // Center map on clicked cell when not restricted (restricted: camera stays on GPS)
      if (mapRef.current && plusCode && !isLocationRestricted) {
        const bounds = decodePlusCodeToBounds(plusCode) ?? tappedCellBounds;
        mapRef.current.animateToRegion(
          {
            latitude: bounds.centerLat,
            longitude: bounds.centerLng,
            latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          },
          500,
        );
      }
    } catch (error) {
      console.warn('Error processing grid click:', error);
      snackbarToast('Error processing grid selection', 'error', Colors.error);
    } finally {
      setIsProcessingGridClick(false);
    }
  };

  // Don't remove rectangle when grid is toggled - it should stay visible

  // Address-card sheet visible (OfflineDataInfoCard, AddressNotFoundCard, or AddressFoundCard)
  const addressCardSheetVisible = Boolean(
    (hasOfflinePacks === false && markerCoordinates && showCardMarker) ||
    (addressNotFound && markerCoordinates && showCardMarker) ||
    (addressFound && markerCoordinates && showAddressFound && showCardMarker),
  );
  const screenHeight = Dimensions.get('window').height;
  const addressSheetCollapsedHeight = 340;
  const offlineManagerCollapsedHeight = 600;
  const effectiveBottomSheetHeight =
    showOfflineManager
      ? (bottomSheetHeight > 0 ? bottomSheetHeight : offlineManagerCollapsedHeight)
      : (addressCardSheetVisible
          ? (bottomSheetHeight > 0 ? bottomSheetHeight : addressSheetCollapsedHeight)
          : 0);
  const cameraPaddingBottomValue =
    (addressCardSheetVisible || showOfflineManager) && effectiveBottomSheetHeight > 0
      ? 320 //screenHeight - 0.5 * (screenHeight - effectiveBottomSheetHeight)
      : undefined;

  // Phase 2: When restricted, camera/neighbors/restriction stay on GPS. Use store userLocation with fallback to location hook.
  const gpsAnchor =
    isLocationRestricted && showGrid
      ? userLocation ??
        (location?.coordinates
          ? { latitude: location.coordinates.latitude, longitude: location.coordinates.longitude }
          : undefined)
      : undefined;

  const mapCenterLocation = (() => {
    if (isLocationRestricted && showGrid && location?.coordinates) {
      return (
        activeLocation ?? markerCoordinates ?? {
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude,
        }
      );
    }
    return (
      markerCoordinates ||
      (location?.coordinates
        ? {
            latitude: location.coordinates.latitude,
            longitude: location.coordinates.longitude,
          }
        : null) ||
      (selectedLocation
        ? {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          }
        : null) ||
      {
        latitude: INITIAL_REGION.latitude,
        longitude: INITIAL_REGION.longitude,
      }
    );
  })();

  return (
    <View style={styles.container}>
      {!mapNativeMountAllowed ? (
        <View
          style={[
            styles.map,
            {
              marginBottom: insets.bottom - 12,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: Colors.light?.['0'] ?? '#E8EEF5',
            },
          ]}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      ) : (
      <MapViewMapLibre
        style={[
          styles.map,
          {
            marginBottom: insets.bottom - 12,
          },
        ]}
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        showGrid={showGrid}
        selectedGridRectangle={selectedGridRectangle}
        centerLocation={mapCenterLocation}
        cameraCenter={gpsAnchor}
        neighborCenter={gpsAnchor}
        // Debug logging
        onMapLoad={() => {
          console.log('[GetAdressScreen] Map loaded, centerLocation:', {
            markerCoordinates,
            location: location?.coordinates,
            selectedLocation,
            showGrid,
          });
        }}
        showNeighborSquares={true}
        animateGridPulse={showGrid}
        restrictionCenter={gpsAnchor ?? null}
        scrollEnabled={true}
        zoomEnabled={true}
        cameraPaddingBottom={cameraPaddingBottomValue}
        onMapPress={showGrid ? handleMapPress : handleMapPressToOpenSheet}
      >
        {/* Phase 5: Map layers — order: below active (nearby) → active street → GPS → search highlight */}
        <NearbyStreetsLayer />
        <ActiveStreetLayer />
        <GPSLocationLayer
          showOnlyWhenOffset={true}
          showOnlyWhenRestrictedAndOffset={true}
          isLocationRestricted={isLocationRestricted}
        />
        <SearchHighlightLayer />
        {hasOfflinePacks && installedPackIds.length > 0 && <POILayer packIds={installedPackIds} />}
      </MapViewMapLibre>
      )}

      {/* Hamburger Menu - Hide when drawer is open */}
      {!isDrawerOpen && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 40,
            left: 20,
            zIndex: 1001,
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            setIsDrawerOpen(true);
            // Dismiss bottom sheet when opening drawer
            setShowCardMarker(false);
            setShowAddressFound(false);
          }}>
          <Icon source={'menu'} size={32} color={Colors.primary[500]} />
        </TouchableOpacity>
      )}

      {/* Sync Status Indicator */}
      <View
        style={{
          position: 'absolute',
          top: 40,
          right: 20,
          zIndex: 1001,
        }}>
        <SyncStatusIndicator />
      </View>

      {/* Map Controls */}
      <MapControls
        mapRef={mapRef}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggle3D={handleToggle3D}
        onCenterLocation={handleCenterLocation}
        onOpenOfflineManager={() => setShowOfflineManager(true)}
        show3D={show3D}
        bottomOffset={bottomSheetHeight}
      />

      {/* Neighbor box hint when role is location-restricted (basic_user) */}
      {/* {isLocationRestricted && showGrid && (
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: bottomSheetHeight + 60,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            alignSelf: 'center',
          }}>
          <Text
            style={{
              color: Colors.light[10],
              fontSize: 12,
              textAlign: 'center',
            }}>
            Tap a green area if your address is there
          </Text>
        </View>
      )} */}

      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        pointerEvents="box-none">
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
          }}>
          <View style={styles.container} pointerEvents="box-none">
            <View style={styles.topBar} pointerEvents="box-none">
              <View
                style={styles.relativeContainer}
                pointerEvents="box-none"></View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Loader
        visible={isLoading || isCheckingAddress || isProcessingGridClick}
        text={
          isProcessingGridClick
            ? i18n.t('(tabs).index.searchingForAddress')
            : isCheckingAddress
              ? i18n.t('(tabs).index.searchingForAddress')
              : i18n.t('(tabs).index.loadingLocation')
        }
      />

      {/* Swipeable Bottom Sheet for Address Cards */}
      <SwipeableBottomSheet
        visible={Boolean(
          // Show offline info card if no offline packs are installed and we have a location
          (hasOfflinePacks === false && markerCoordinates && showCardMarker) ||
          (addressNotFound && markerCoordinates && showCardMarker) ||
          (addressFound && markerCoordinates && showAddressFound && showCardMarker),
        )}
        onDismiss={() => {
          // Only hide the sheet, don't clear address data
          // This allows users to reopen it by clicking the marker or map
          setShowCardMarker(false);
          setShowAddressFound(false);
        }}
        onHeightChange={setBottomSheetHeight}
        collapsedHeight={390}
        expandedHeight={390}
        fullHeight={400}>
        {/* If no offline packs are installed, prioritize showing the offline data info card */}
        {hasOfflinePacks === false && markerCoordinates ? (
          <OfflineDataInfoCard
            regionName={location?.addressComponents?.region || null}
            showTip={showOfflineTip}
            onDismissTip={() => setShowOfflineTip(false)}
            onDownloadRegion={() => {
              setShowOfflineManager(true);
            }}
            onDismiss={() => {
              setShowCardMarker(false);
              setShowAddressFound(false);
            }}
          />
        ) : addressNotFound && markerCoordinates ? (
          <>
            <AddressNotFoundCard
              onCreateAddress={handleCreateAddress}
              plusCode={currentPlusCode}
              what3Words={currentWhat3Words}
              locationContext={location?.addressComponents}
              onDismiss={() => {
                setShowCardMarker(false);
                setShowAddressFound(false);
              }}
            />
          </>
        ) : addressFound && markerCoordinates ? (
          /* When user clicked a cell and address was found (offline or API), show AddressFoundCard */
          <>
            <AddressFoundCard
              address={addressFound}
              onSaveAddress={handleSaveAddress}
              onShareAddress={handleShareAddress}
              onAddToMyAddress={handleAddToMyAddress}
              onAddUnitInfo={() => {
                setShowAdminInfo(true);
              }}
              onDismiss={() => {
                setShowCardMarker(false);
                setShowAddressFound(false);
              }}
            />
          </>
        ) : null}
      </SwipeableBottomSheet>

      {/* Offline Data Manager Bottom Sheet */}
      <SwipeableBottomSheet
        visible={showOfflineManager}
        onDismiss={() => setShowOfflineManager(false)}
        onHeightChange={setBottomSheetHeight}
        collapsedHeight={600}
        expandedHeight={600}
        fullHeight={750}>
        <OfflineDataManager onClose={() => setShowOfflineManager(false)} />
      </SwipeableBottomSheet>

      {/* Address selected modal  */}

      {/* Add unit info Modal  */}
      <AddUnitInfo
        visible={showAdminInfo}
        onClose={() => {
          setShowAdminInfo(false);
          // Reopen the SwipeableBottomSheet with existing address data
          if (addressFound && markerCoordinates) {
            setShowAddressFound(true);
            setShowCardMarker(true);
          } else if (addressNotFound && markerCoordinates) {
            setShowCardMarker(true);
          }
        }}
        onSuccess={async () => {
          setShowAdminInfo(false);
          // Refetch the address to get updated data with unit info
          if (markerCoordinates) {
            try {
              await checkAddress({
                latitude: markerCoordinates.latitude,
                longitude: markerCoordinates.longitude,
              });
              // The checkAddress callback will update addressFound and show the bottom sheet
            } catch (error) {
              console.warn('Error refetching address after unit info:', error);
              // Even if refetch fails, reopen the bottom sheet with existing data
              if (addressFound) {
                setShowAddressFound(true);
                setShowCardMarker(true);
              }
            }
          } else if (addressFound) {
            // If no marker coordinates, just reopen with existing data
            setShowAddressFound(true);
            setShowCardMarker(true);
          }
        }}
        address={addressFound}
      />

      {/* Add Alias Modal for Add to My Address */}
      <AddAlias
        visible={showAddAlias}
        onClose={() => {
          setShowAddAlias(false);
        }}
        onSuccess={() => {
          setShowAddAlias(false);
        }}
        address={addressFound}
      />

      <Loader visible={savingAddress} text="Saving address..." />

      <GpsVerificationModal
        visible={showGpsVerification}
        onCancel={() => {
          setShowGpsVerification(false);
          setPendingCreateAction(null);
        }}
        onVerified={() => {
          setShowGpsVerification(false);
          pendingCreateAction?.();
          setPendingCreateAction(null);
        }}
        onProceedAnyway={() => {
          setShowGpsVerification(false);
          pendingCreateAction?.();
          setPendingCreateAction(null);
        }}
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setTimeout(() => {
            if (navigation.isFocused()) {
              handleUseCurrentLocation();
            }
          }, 100);
        }}
      />
    </View>
  );
}
