import {
  Colors,
  countries,
  STREET_TYPES,
  UNIT_TYPES,
  CONNECTIONS,
  grayMapStyle,
  MAP_TILE_CONFIG,
} from '@/constants';
import { defaultStyles } from '@/styles';
import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  BackHandler,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
  InteractionManager,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  Appbar,
  Button,
  Checkbox,
  Dialog,
  Icon,
  Snackbar,
} from 'react-native-paper';
import { Region } from 'react-native-maps';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
import MapViewMapLibre from '@/components/MapViewMapLibre';
import * as ImagePicker from 'expo-image-picker';
import {
  delay,
  formatNeighborhood,
  formatStreetLine,
  openShareSheet,
  readData,
  useCompressedImage,
  deleteData,
  storeData,
  decodePlusCodeToBounds,
} from '@/utils';
import * as Location from 'expo-location';
import {
  useGetWhat3Words,
} from '@/hooks/addresses.hooks';
import { getAddressComponents, getAddressComponentsSync } from '@/lib/geocoding/getAddressComponents';
import { SyncManager } from '@/lib/syncManager';
import { convertRequestToAddress } from '@/lib/utils/addressConverter';
import { initDB } from '@/lib/db';
import { createStreetNameSuggestion, createNeighborhoodNameSuggestion } from '@/lib/db/suggestions';
import { checkLocationAddress } from '@/lib/checkLocationAddress';
import { offlineReverseGeocode } from '@/lib/geocoding/reverseGeocode';
import { useOffline } from '@/hooks/useOffline';
import { resolveStreetAddress } from '@/lib/offlineDataPacks';
import { autoLockOnFirstAddress, getDirectionLock, normalizeStreetKey } from '@/lib/streetDirectionService';
import { syncMapStoreFromResolveResult } from '@/hooks/useActiveStreet';
import { createStreetKey, resolveStreetGeometry, type ResolvedStreetGeometry } from '@/lib/streetGeometry';
import {
  calculateCompoundSuffix,
  isNonStreetFacing,
  getCompoundBandDescription,
} from '@janpams/core/address';
import { getDisplayCode } from '@janpams/core/pluscode';
import { calculateHouseNumberSync } from '@/lib/createLocationAddress';
import type { Street } from '@/lib/createLocationAddress';
import type { ActiveStreetData } from '@/lib/streetSelection';
import {
  AddressCategoryDropdown,
  EditStreet,
  InputComponent,
  Loader,
  MapControls,
  StreetDirectionInfo,
} from '@/components';
import { StreetNameEditor } from '@/components/StreetNameEditor';
import { StreetNameBadge } from '@/components/StreetNameBadge';
import { Context, ContextType } from './_layout';
import {
  addressesCreateAddressRequest,
  addressesCreateAddressResponse,
} from '@/interfaces';
import i18n from '../i18n';
import { getLocationLabel, getRegionZip } from '@/utils/regionZipFormatter';
import { snackbarToast } from '@/utils/toastHelpter';
import { useFormResetOnNavigation } from '@/hooks/useFormResetOnNavigation';
import { useFormResetOnNavigationAndroid } from '@/hooks/useFormResetOnNavigationAndroid';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sizes } from '@/constants/sizes';
import { useStreetSelectionStore } from '@/lib/store/streetSelectionStore';
import { useAddressStore } from '@/lib/store/addressStore';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { parseFormattedAddress } from '@/utils/helpers';

/** Convert ActiveStreetData (geometry [lon,lat]) to Street (geometry [lat,lon]) for calculateHouseNumberSync (web parity: include osm_id) */
function activeStreetDataToStreet(data: ActiveStreetData): Street {
  return {
    id: data.segment_id,
    name: data.name,
    osm_id: parseInt(data.segment_id.split('-')[0], 10) || 0,
    geometry: data.geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
    direction_locked: false,
  };
}

// Helper to format region/country pair like "SW, CMR"
const formatRegionCountryPair = (region: string | undefined, country: string | undefined) => {
  if (!region && !country) return '';

  const normalizedRegion = (region || '').toLowerCase().replace(/[-\s]+/g, '');
  const regionCodes: Record<string, string> = {
    // Match the original mapping used by AddressNotFoundCard so both screens behave identically
    southwest: 'SW',
    southwestregion: 'SW',
    northwest: 'NW',
    northwestregion: 'NW',
    littoral: 'LT',
    littoralregion: 'LT',
    centre: 'CE',
    center: 'CE',
    centreregion: 'CE',
    centerregion: 'CE',
    west: 'OU',
    westregion: 'OU',
    east: 'ES',
    eastregion: 'ES',
    south: 'SU',
    southregion: 'SU',
    north: 'NO',
    northregion: 'NO',
    adamawa: 'AD',
    adamaoua: 'AD',
    adamawaregion: 'AD',
    farnorth: 'EN',
    extremenord: 'EN',
    extremenorth: 'EN',
    extremenorthregion: 'EN',
  };

  const countryCodes: Record<string, string> = {
    Cameroon: 'CMR',
    Nigeria: 'NGA',
    'United States': 'USA',
    'United Kingdom': 'GBR',
    France: 'FRA',
    Germany: 'DEU',
  };

  const regionCode =
    regionCodes[normalizedRegion] ||
    (region ? region.substring(0, 2).toUpperCase() : '');
  const countryAlpha3 =
    (country && countryCodes[country]) || (country ? country.substring(0, 3).toUpperCase() : '');

  if (regionCode && countryAlpha3) return `${regionCode}, ${countryAlpha3}`;
  if (regionCode) return regionCode;
  return countryAlpha3;
};

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
const GRID_NUDGE_LAT = 0.00004;
const GRID_NUDGE_LNG = -0.000055;

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

const INITIAL_REGION: Region = {
  latitude: 4.1594,
  longitude: 9.2356,
  latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
  longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
};

/** Map native-module (e.g. expo-sqlite) errors to a message that tells the user to use a dev build, not Expo Go. */
function formatAddressCreateError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('native module') || lower.includes('exposqlite') || lower.includes('expo sqlite')) {
    return 'Offline database is not available. Use a development build (not Expo Go): run "npx expo run:ios" or "npx expo run:android", then open the app from the built binary.';
  }
  return rawMessage;
}

export default function NewCreateAddress() {
  const { user, lang } = useContext(Context) as ContextType;
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    plusCode?: string;
    what3Words?: string;
    street?: string;
    city?: string;
    neighborhood?: string;
    region?: string;
    country?: string;
    countryCode?: string;
  }>();
  const calculatedAddress = useAddressStore((s) => s.calculatedAddress);
  const activeStreet = useStreetSelectionStore((s) => s.activeStreet);
  const activeStreetDirectionLock = useStreetSelectionStore((s) => s.activeStreetDirectionLock);
  const resolvedStreetGeometry = useStreetSelectionStore((s) => s.resolvedStreetGeometry);
  const nearbyStreets = useStreetSelectionStore((s) => s.nearbyStreets);
  const setActiveStreetData = useStreetSelectionStore((s) => s.setActiveStreetData);
  const setResolvedStreetGeometry = useStreetSelectionStore((s) => s.setResolvedStreetGeometry);
  const setActiveStreetDirectionLock = useStreetSelectionStore((s) => s.setActiveStreetDirectionLock);
  const setActiveStreet = useStreetSelectionStore((s) => s.setActiveStreet);
  const setCalculatedAddress = useAddressStore((s) => s.setCalculatedAddress);
  const setPendingCreateStreetGeometry = useAddressStore((s) => s.setPendingCreateStreetGeometry);
  const prefilledFromMapStoreRef = useRef(false);
  /** When opened from map tab: capture store's resolvedStreetGeometry once so marching ants stay on location-context street even if store is updated later */
  const fromMapStreetGeometryRef = useRef<typeof resolvedStreetGeometry>(null);
  /** When fromMap: geometry used for marching ants overlay (set once from store, never overwritten by resolve) */
  const [fromMapAntsGeometry, setFromMapAntsGeometry] = useState<ResolvedStreetGeometry | null>(null);
  const fromMapAntsGeometrySetRef = useRef(false);
  const mapRef = useRef<any>(null);
  const hasInitiallyCenteredRef = useRef(false); // Track if initial centering has happened
  const { height: screenHeight } = Dimensions.get('window');

  // Bottom padding so the map viewport center is at 40% from top (location grid at 40%)
  // Viewport center = (screenHeight - paddingBottom) / 2 = 0.4 * screenHeight => paddingBottom = 0.2 * screenHeight
  const cameraPaddingBottom = Math.round(0.2 * screenHeight);

  const [coordinates, setCoordinates] =
    useState<Location.LocationObjectCoords>();
  const initialLocationRef = useRef<Location.LocationObjectCoords | undefined>(
    coordinates,
  );
  const [selectedLocation, setSelectedLocation] =
    useState<Region>(INITIAL_REGION);
  const [showGrid, setShowGrid] = useState(true); // Default to grid view
  const [show3D, setShow3D] = useState(false);
  const [selectedGridRectangle, setSelectedGridRectangle] = useState<{
    coordinates: Array<{ latitude: number; longitude: number }>;
  } | null>(null);
  const [currentPlusCode, setCurrentPlusCode] = useState<string>();
  const [currentWhat3Words, setCurrentWhat3Words] = useState<string>();
  const [activeStreetGeometry, setActiveStreetGeometry] = useState<[number, number][]>([]);
  const [distanceToStreet, setDistanceToStreet] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapCameraOffset, setMapCameraOffset] = useState({ x: 0, y: 0 });
  /** Phase 0→1 for marching ants dash animation (ShapeSource+LineLayer, match commented implementation) */
  const [routeAnimPhase, setRouteAnimPhase] = useState(0);

  const [checked, setChecked] = useState(false);
  const [businessName, setBusinessName] = useState<string>();
  const [addressCategory, setAddressCategory] = useState<string>();
  const [houseNumber, setHouseNumber] = useState<string>();
  const [connection, setConnection] = useState<string>();
  const [city, setCity] = useState<string>();
  const [region, setRegion] = useState<string>();
  const [extension, setExtension] = useState<string>();
  const [unitNumber, setUnitNumber] = useState<string>();
  const [unitType, setUnitType] = useState<string>();
  const [street, setStreet] = useState<string>();
  const [streetKeyFromGeocode, setStreetKeyFromGeocode] = useState<string | null>(null);
  const [originalApiStreetName, setOriginalApiStreetName] = useState<string | null>(null);
  const [originalApiNeighborhood, setOriginalApiNeighborhood] = useState<string | null>(null);
  const [neighbourhood, setNeighbourhood] = useState<string>();
  const [country, setCountry] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset>();
  const [error, setError] = useState<string>();
  const [showValidationError, setShowValidationError] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [visibleToolTip, setVisibleToolTip] = useState<string>();
  const [isEditingStreet, setIsEditingStreet] = useState(false);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [streetType, setStreetType] = useState<string>('Street');
  const [regionLabel, setRegionLabel] = useState('Region');
  const [cityLabel, setCityLabel] = useState('City');
  const [zipLabel, setZipLabel] = useState('Zip');
  const [extensionError, setExtensionError] = useState<string>();
  const [houseNumberError, setHouseNumberError] = useState<string>();
  const [createAddressResponse, setCreateAddressResponse] = useState<
    addressesCreateAddressResponse | undefined
  >(undefined);
  const [isImagePickerActive, setIsImagePickerActive] = useState(false);
  const isImagePickerActiveRef = useRef(false);
  const imagePickerLaunchTime = useRef(0);
  const isSettingImageRef = useRef(false);

  const { compressImage } = useCompressedImage(image?.uri ?? '');

  // Web parity: view mode when existing JanGo address found at location
  const [viewMode, setViewMode] = useState<'create' | 'view'>('create');
  const [existingAddressRecord, setExistingAddressRecord] = useState<any>(null);

  // Two-step form inside bottom sheet:
  // Step 1: image + street + neighborhood
  // Step 2: business name + address category + connection (+ house/unit)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Compound (non–street-facing) suffix from distance — single source of truth from core (web parity)
  const compoundSuffix = useMemo(() => {
    if (distanceToStreet == null) return null;
    if (!isNonStreetFacing(distanceToStreet)) return null;
    return calculateCompoundSuffix(distanceToStreet);
  }, [distanceToStreet]);

  // Upload options
  const [createUploadLink, setCreateUploadLink] = useState(false);

  const { mutateAsync: getWhat3Words } = useGetWhat3Words();

  // Function to reset all form fields to initial state
  const resetForm = () => {
    setChecked(false);
    setBusinessName(undefined);
    setAddressCategory(undefined);
    setHouseNumber(undefined);
    setConnection(undefined);
    setCity(undefined);
    setRegion(undefined);
    setExtension(undefined);
    setUnitNumber(undefined);
    setUnitType(undefined);
    setStreet(undefined);
    setStreetKeyFromGeocode(null);
    setOriginalApiStreetName(null);
    setOriginalApiNeighborhood(null);
    setNeighbourhood(undefined);
    setCountry(undefined);
    setImage(undefined);
    setError(undefined);
    setShowValidationError(false);
    setShowSuccessModal(false);
    setVisibleToolTip(undefined);
    setIsEditingStreet(false);
    setIsEditingCity(false);
    setStreetType('Street');
    setRegionLabel('Region');
    setCityLabel('City');
    setZipLabel('Zip');
    setExtensionError(undefined);
    setHouseNumberError(undefined);
    setCreateAddressResponse(undefined);
    setCoordinates(undefined);
  };

  // Function to refresh location and reset form
  const refreshLocationAndResetForm = useCallback(
    async (showFeedback: boolean = false) => {
      await deleteData('@currentCoordinates');
      setPreLoading(true);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
          setPreLoading(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        // Snap to G-square grid
        const snapped = snapToPlusCodeGrid(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
        );
        setCoordinates({
          ...currentLocation.coords,
          latitude: snapped.lat,
          longitude: snapped.lng,
        });
        await storeData('@currentCoordinates', {
          ...currentLocation.coords,
          latitude: snapped.lat,
          longitude: snapped.lng,
        });

        setSelectedLocation({
          latitude: snapped.lat,
          longitude: snapped.lng,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        });

        // Compute Plus Code locally; W3W only when online
        const plusCode = getDisplayCode(snapped.lat, snapped.lng);
        let what3words: string | undefined;
        if (isOnline) {
          try {
            const w3wResponse = await getWhat3Words({
              latitude: snapped.lat,
              longitude: snapped.lng,
            });
            what3words = w3wResponse?.words || undefined;
          } catch (e) {
            console.warn('Error getting what3words:', e);
          }
        }

        setCurrentPlusCode(plusCode);
        setCurrentWhat3Words(what3words);

        if (plusCode) {
          const decodedBounds = decodePlusCodeToBounds(plusCode);
          const bounds =
            decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
          const snappedCoords = {
            ...currentLocation.coords,
            latitude: snapped.lat,
            longitude: snapped.lng,
          };
          setCoordinates({
            ...snappedCoords,
            latitude: bounds.centerLat,
            longitude: bounds.centerLng,
          });
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
        }
      } catch {
        // TODO: Handle errors if necessary
      } finally {
        setPreLoading(false);
      }
    },
    [isOnline, getWhat3Words],
  );

  const onLocationChangeReset = useCallback((distance: number) => {
    snackbarToast(
      `Form reset: You moved ${Math.round(distance)}m from the original location. Please create address for your current location.`,
      'info',
    );
  }, []);

  // Use platform-specific hooks to handle form reset
  // Only reset when app goes to background/inactive, not on screen touches or image selection
  if (Platform.OS === 'android') {
    const androidFormReset = useCallback(async () => {
      await refreshLocationAndResetForm(true);
      router.replace('/(tabs)');
    }, [refreshLocationAndResetForm, router]);

    useFormResetOnNavigationAndroid({
      onFormReset: androidFormReset,
      shouldResetOnAppStateChange: true, // Only reset when app goes to background
      shouldResetOnLocationChange: false, // Disable location change resets during form use
      resetRoute: '/(tabs)',
      locationChangeThreshold: 50,
      initialLocation: initialLocationRef.current,
      onLocationChangeReset,
      isImagePickerActive,
      isImagePickerActiveRef,
      imagePickerLaunchTime,
    });
  } else {
    const iosFormReset = useCallback(async () => {
      await refreshLocationAndResetForm(true);
    }, [refreshLocationAndResetForm]);

    useFormResetOnNavigation({
      onFormReset: iosFormReset,
      shouldResetOnFocus: false, // Disable focus reset - don't reload on screen touches
      shouldResetOnAppStateChange: true, // Only reset when app goes to background/inactive
      shouldResetOnLocationChange: false, // Disable location change resets during form use
      resetRoute: '/(tabs)',
      locationChangeThreshold: 50,
      initialLocation: initialLocationRef.current,
      onLocationChangeReset,
      isImagePickerActive,
      isImagePickerActiveRef,
      imagePickerLaunchTime,
    });
  }

  useEffect(() => {
    // Defer heavy init so the screen can paint first (fixes Android freeze)
    const task = InteractionManager.runAfterInteractions(() => {
      const retrieveLocationFromStorage = async () => {
        isInitializingRef.current = true; // Mark as initializing
        setPreLoading(true);

        // When opened from map tab (Create address), use route params as source of truth
      const paramLat = params.latitude != null ? parseFloat(params.latitude) : NaN;
      const paramLng = params.longitude != null ? parseFloat(params.longitude) : NaN;
      if (!Number.isNaN(paramLat) && !Number.isNaN(paramLng)) {
        const snapped = snapToPlusCodeGrid(paramLat, paramLng);
        const snappedCoords: Location.LocationObjectCoords = {
          latitude: snapped.lat,
          longitude: snapped.lng,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };
        await storeData('@currentCoordinates', snappedCoords);
        setCurrentPlusCode(params.plusCode ?? undefined);
        setCurrentWhat3Words(params.what3Words ?? undefined);
        const bounds = getGridCellBounds(snapped.lat, snapped.lng);
        // Use the same snapped tap point as the map (do NOT use grid center). The map resolved
        // street/address at this point; using grid center would shift ~7–14m and can miss the street.
        setCoordinates(snappedCoords);
        if (!initialLocationRef.current) initialLocationRef.current = snappedCoords;
        setSelectedLocation({
          latitude: snapped.lat,
          longitude: snapped.lng,
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
        setPreLoading(false);
        setTimeout(() => {
          isInitializingRef.current = false;
          setInitializationComplete(true);
        }, 1000);
        return;
      }

      const locationCoords = (await readData('@currentCoordinates')) as
        | Location.LocationObjectCoords
        | undefined;

      if (locationCoords) {
        // Snap to G-square grid
        const snapped = snapToPlusCodeGrid(
          locationCoords.latitude,
          locationCoords.longitude,
        );
        const snappedCoords = {
          ...locationCoords,
          latitude: snapped.lat,
          longitude: snapped.lng,
        };

        // Compute Plus Code locally; W3W only when online
        let finalCoords = snappedCoords;
        const plusCode = getDisplayCode(snapped.lat, snapped.lng);
        let what3words: string | undefined;
        if (isOnline) {
          try {
            const w3wResponse = await getWhat3Words({
              latitude: snapped.lat,
              longitude: snapped.lng,
            });
            what3words = w3wResponse?.words || undefined;
          } catch (e) {
            console.warn('Error getting what3words:', e);
          }
        }

        setCurrentPlusCode(plusCode);
        setCurrentWhat3Words(what3words);

        if (plusCode) {
          const decodedBounds = decodePlusCodeToBounds(plusCode);
          const bounds =
            decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);

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
        }

        setCoordinates(finalCoords);
        if (!initialLocationRef.current) {
          initialLocationRef.current = finalCoords;
        }
        setSelectedLocation({
          latitude: finalCoords.latitude,
          longitude: finalCoords.longitude,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        // Snap to G-square grid
        const snapped = snapToPlusCodeGrid(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
        );
        const snappedCoords = {
          ...currentLocation.coords,
          latitude: snapped.lat,
          longitude: snapped.lng,
        };

        // Compute Plus Code locally; W3W only when online
        let finalCoords = snappedCoords;
        const plusCode2 = getDisplayCode(snapped.lat, snapped.lng);
        let what3words2: string | undefined;
        if (isOnline) {
          try {
            const w3wResponse = await getWhat3Words({
              latitude: snapped.lat,
              longitude: snapped.lng,
            });
            what3words2 = w3wResponse?.words || undefined;
          } catch (e) {
            console.warn('Error getting what3words:', e);
          }
        }

        setCurrentPlusCode(plusCode2);
        setCurrentWhat3Words(what3words2);

        if (plusCode2) {
          const decodedBounds = decodePlusCodeToBounds(plusCode2);
          const bounds =
            decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
          finalCoords = {
            ...snappedCoords,
            latitude: bounds.centerLat,
            longitude: bounds.centerLng,
          };
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
        }

        setCoordinates(finalCoords);
        if (!initialLocationRef.current) {
          initialLocationRef.current = finalCoords;
        }
        setSelectedLocation({
          latitude: finalCoords.latitude,
          longitude: finalCoords.longitude,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        });
      }
      setPreLoading(false);

      // Mark initialization as complete after a short delay to let coordinates stabilize
      setTimeout(() => {
        isInitializingRef.current = false;
        setInitializationComplete(true);
        console.log('[NewCreateAddress] Initialization complete, address fetching enabled');
      }, 1000); // 1 second delay to ensure all coordinate updates are done
    };
    retrieveLocationFromStorage();
    });
    return () => task.cancel();
  }, [isOnline, getWhat3Words, params.latitude, params.longitude, params.plusCode, params.what3Words]);

  // Center map on coordinates ONLY when first set (initial load). cameraPaddingBottom positions grid at 40% from top.
  // Does NOT re-center when user drags the map
  useEffect(() => {
    if (coordinates && mapRef.current && !hasInitiallyCenteredRef.current) {
      hasInitiallyCenteredRef.current = true; // Mark as centered to prevent re-centering on drag
      mapRef.current.animateToRegion(
        {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        },
        500,
      );
    }
  }, [coordinates?.latitude, coordinates?.longitude]);

  // Prefill form when opened from map tab: use route params first (exactly what the card showed), then fill gaps from store
  useEffect(() => {
    if (prefilledFromMapStoreRef.current) return;
    const fromMap = params.latitude != null && params.longitude != null;
    if (!fromMap || !coordinates) return;

    prefilledFromMapStoreRef.current = true;

    // 1) Prefill from route params (same data as AddressNotFoundCard / AddressFoundCard)
    if (params.street?.trim()) setStreet(params.street.trim());
    if (params.neighborhood?.trim()) setNeighbourhood(params.neighborhood.trim());
    if (params.city?.trim()) {
      setCity(params.city.trim());
      setCityLabel(params.city.trim());
    }
    if (params.region?.trim()) setRegion(params.region.trim());
    if (params.country?.trim()) setCountry(params.country.trim());
    else if (params.countryCode?.trim()) setCountry(params.countryCode.trim());

    // 2) Fill gaps from map store (house number, street key, geometry)
    if (calculatedAddress) {
      if (calculatedAddress.houseNumber != null) setHouseNumber(calculatedAddress.houseNumber.toString());
      if (!params.street?.trim() && calculatedAddress.street) setStreet(calculatedAddress.street);
      if (calculatedAddress.osmData) {
        if (!params.neighborhood?.trim() && calculatedAddress.osmData.neighborhood) setNeighbourhood(calculatedAddress.osmData.neighborhood);
        if (!params.city?.trim() && calculatedAddress.osmData.city) {
          setCity(calculatedAddress.osmData.city);
          setCityLabel(calculatedAddress.osmData.city);
        }
        if (!params.region?.trim() && calculatedAddress.osmData.region) setRegion(calculatedAddress.osmData.region);
        if (!params.country?.trim() && calculatedAddress.osmData.country) setCountry(calculatedAddress.osmData.country);
      }
      if (calculatedAddress.distanceToStreet != null) setDistanceToStreet(calculatedAddress.distanceToStreet);
    }
    if (activeStreet?.name && !params.street?.trim() && !calculatedAddress?.street) setStreet(activeStreet.name);
    if (activeStreetDirectionLock?.streetKey) setStreetKeyFromGeocode(activeStreetDirectionLock.streetKey);
    const geom = resolvedStreetGeometry?.geometry;
    if (geom && geom.length >= 2) setActiveStreetGeometry(geom);
  }, [
    params.latitude,
    params.longitude,
    params.street,
    params.city,
    params.neighborhood,
    params.region,
    params.country,
    params.countryCode,
    coordinates?.latitude,
    coordinates?.longitude,
    calculatedAddress,
    activeStreet,
    activeStreetDirectionLock,
    resolvedStreetGeometry,
  ]);

  // When opened from map: use geometry handed off from map tab (Borstal Street etc.) so marching ants match location context
  const fromMap = params.latitude != null && params.longitude != null;
  useEffect(() => {
    if (!fromMap) return;
    if (fromMapAntsGeometrySetRef.current) return;
    const pending = useAddressStore.getState().pendingCreateStreetGeometry;
    if (pending?.geometry?.length) {
      fromMapAntsGeometrySetRef.current = true;
      setFromMapAntsGeometry({ ...pending });
      setPendingCreateStreetGeometry(null);
      return;
    }
    if (!resolvedStreetGeometry?.geometry?.length) return;
    const captured = { ...resolvedStreetGeometry };
    fromMapStreetGeometryRef.current = captured;
    fromMapAntsGeometrySetRef.current = true;
    setFromMapAntsGeometry(captured);
  }, [fromMap, resolvedStreetGeometry, setPendingCreateStreetGeometry]);

  // Offline geocoding for address components
  const [isLoadingAddressComponents, setIsLoadingAddressComponents] = useState(false);
  const [addressComponents, setAddressComponents] = useState<any>(null);
  const fetchingAddressRef = useRef(false);
  const lastFetchedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const isInitializingRef = useRef(true); // Track if we're still initializing
  const [initializationComplete, setInitializationComplete] = useState(false);
  // Lazy-mount map after first paint to avoid blocking UI on Android
  const [mapReadyToMount, setMapReadyToMount] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => setMapReadyToMount(true), 300);
    });
    return () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      task.cancel();
    };
  }, []);

  useEffect(() => {
    const fetchAddressComponents = async () => {
      // Guard: prevent concurrent fetches
      if (fetchingAddressRef.current) {
        console.log('[NewCreateAddress] Skipping fetch - already fetching');
        return;
      }

      // Guard: don't fetch during initialization (wait for coordinates to stabilize)
      if (isInitializingRef.current || !initializationComplete) {
        console.log('[NewCreateAddress] Skipping fetch - still initializing');
        return;
      }

      // Guard: check required conditions
      if (
        !coordinates?.longitude ||
        !coordinates?.latitude ||
        !user?.id ||
        isImagePickerActive ||
        isImagePickerActiveRef.current ||
        isSettingImageRef.current
      ) {
        return;
      }

      // Guard: prevent fetching same coordinates twice
      const currentCoords = {
        lat: coordinates.latitude,
        lng: coordinates.longitude,
      };
      const lastCoords = lastFetchedCoordsRef.current;
      if (
        lastCoords &&
        Math.abs(lastCoords.lat - currentCoords.lat) < 0.000001 &&
        Math.abs(lastCoords.lng - currentCoords.lng) < 0.000001
      ) {
        console.log('[NewCreateAddress] Skipping fetch - same coordinates');
        return; // Same coordinates, skip fetch
      }

      // Mark as fetching and store current coordinates
      fetchingAddressRef.current = true;
      lastFetchedCoordsRef.current = currentCoords;
      console.log('[NewCreateAddress] Fetching address components for:', currentCoords);

      try {
        setIsLoadingAddressComponents(true);

        // Ensure DB is ready before offline geocoding (resolveStreetAddress uses it).
        await initDB();

        // Web parity: single canonical geocode — resolve first, then components from that result.
        try {
          console.log('[NewCreateAddress] resolveStreetAddress at page coords (canonical)', coordinates.latitude, coordinates.longitude, 'maxDist 60m');
          const streetAddress = await resolveStreetAddress(
            coordinates.latitude,
            coordinates.longitude,
            60
          );

          // Components from same geocode result (single source of truth)
          if (streetAddress.osmStyleAddress) {
            const components = getAddressComponentsSync(streetAddress.osmStyleAddress);
            setAddressComponents(components);
          }

          const streetNameFromResult = streetAddress.street?.name ?? streetAddress.activeStreet?.name ?? '';
          const hasActive = !!(streetAddress.activeStreet?.geometry?.length);
          const fromMap = params.latitude != null && params.longitude != null;
          console.log('[NewCreateAddress] resolveStreetAddress result:', {
            hasActiveStreet: !!streetAddress.activeStreet,
            geometryLength: streetAddress.activeStreet?.geometry?.length ?? 0,
            streetName: streetNameFromResult,
            distance: streetAddress.activeStreet?.distance ?? streetAddress.street?.distance,
            fromMap,
          });

          // When opened from map tab: keep store and street/neighbourhood as home screen (marching ants = same street as form)
          if (!fromMap) {
            if (streetNameFromResult) setStreet(streetNameFromResult);
            const admin = streetAddress.admin;
            if (admin?.neighborhood) setNeighbourhood(admin.neighborhood);
          }
          if (streetAddress.houseNumber != null) setHouseNumber(streetAddress.houseNumber.toString());
          else if (streetNameFromResult && !fromMap) setHouseNumber('1');
          else if (streetNameFromResult && fromMap) setHouseNumber(useAddressStore.getState().calculatedAddress?.houseNumber?.toString() ?? '1');
          else setHouseNumber('');
          if (streetAddress.streetKey) setStreetKeyFromGeocode(streetAddress.streetKey);

          const admin = streetAddress.admin;
          if (admin?.city) {
            setCity(admin.city);
            setCityLabel(admin.city);
          }
          if (admin?.region) setRegion(admin.region);
          if (admin?.country) setCountry(admin.country);

          if (hasActive && streetAddress.activeStreet && !fromMap) {
            setActiveStreetGeometry(streetAddress.activeStreet.geometry);
            setDistanceToStreet(streetAddress.activeStreet.distance ?? null);
          } else if (fromMap && resolvedStreetGeometry?.geometry?.length) {
            setActiveStreetGeometry(resolvedStreetGeometry.geometry);
            setDistanceToStreet(useAddressStore.getState().calculatedAddress?.distanceToStreet ?? null);
          } else if (!fromMap) {
            setActiveStreetGeometry([]);
            setDistanceToStreet(streetAddress.street?.distance ?? null);
          }

          // When opened from map: do not overwrite store so marching ants stay on same street as home screen
          if (!fromMap) {
            syncMapStoreFromResolveResult(streetAddress, {
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
            }).catch((syncErr) => {
              console.warn('[NewCreateAddress] syncMapStoreFromResolveResult failed:', syncErr);
            });
          }

          // Original API values for edit detection (dual-address creation when user edits)
          if (fromMap) {
            const storeStreet = useStreetSelectionStore.getState().activeStreet?.name;
            const storeNeighborhood = useAddressStore.getState().calculatedAddress?.osmData?.neighborhood;
            if ((params.street?.trim() ?? storeStreet) && !streetAddress.street?.isUnnamed && !streetAddress.activeStreet?.isUnnamed) {
              setOriginalApiStreetName(params.street?.trim() ?? storeStreet ?? streetNameFromResult ?? null);
            } else {
              setOriginalApiStreetName(null);
            }
            setOriginalApiNeighborhood(params.neighborhood?.trim() ?? storeNeighborhood ?? admin?.neighborhood ?? null);
          } else {
            if (streetNameFromResult && !streetAddress.street?.isUnnamed && !streetAddress.activeStreet?.isUnnamed) {
              setOriginalApiStreetName(streetNameFromResult);
            } else {
              setOriginalApiStreetName(null);
            }
            if (admin?.neighborhood) setOriginalApiNeighborhood(admin.neighborhood);
            else setOriginalApiNeighborhood(null);
          }
        } catch (resolveErr) {
          console.warn('[NewCreateAddress] resolveStreetAddress failed, fallback to getAddressComponents', resolveErr);
          const components = await getAddressComponents({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            lang,
          });
          setAddressComponents(components);
          const newCountry = components?.country ?? components?.country_code ?? '';
          const newCity = components?.city ?? '';
          const newNeighbourhood = formatNeighborhood(components?.neighborhood ?? '', STREET_TYPES, lang);
          const newStreet = components?.street_name ?? '';
          const newRegion = components?.state ?? '';
          if (newCountry) setCountry(newCountry);
          if (newCity) { setCity(newCity); setCityLabel(newCity); }
          if (newNeighbourhood) setNeighbourhood(newNeighbourhood);
          if (newStreet) setStreet(newStreet);
          if (newRegion) setRegion(newRegion);
          // Fallback has no offline street → no chainage-based number; show default so we don't show "—"
          const storeAddress = useAddressStore.getState().calculatedAddress;
          setHouseNumber(newStreet ? (storeAddress?.houseNumber?.toString() ?? '1') : '');
          // Original API values for dual-address edit detection (fallback path)
          if (newStreet) setOriginalApiStreetName(newStreet);
          else setOriginalApiStreetName(null);
          if (newNeighbourhood) setOriginalApiNeighborhood(newNeighbourhood);
          else setOriginalApiNeighborhood(null);
        }
      } catch (error) {
        console.log('[NewCreateAddress] Failed to geocode address:', error);
        // Fallback: try to use expo-location reverse geocoding
        try {
          const location = await Location.reverseGeocodeAsync({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          });
          if (location && location.length > 0) {
            const loc = location[0];
            const fallbackCountry = loc.countryCode ?? '';
            const fallbackCity = loc.city ?? loc.town ?? loc.village ?? '';
            const fallbackNeighbourhood = loc.district ?? loc.subregion ?? '';
            const fallbackStreet = loc.street ?? '';
            const fallbackRegion = loc.region ?? '';

            // Only update if values changed (handle undefined safely)
            if (fallbackCountry !== (country ?? '')) setCountry(fallbackCountry);
            if (fallbackCity !== (city ?? '')) {
              setCity(fallbackCity);
              setCityLabel(fallbackCity);
            }
            if (fallbackNeighbourhood !== (neighbourhood ?? '')) setNeighbourhood(fallbackNeighbourhood);
            if (fallbackStreet !== (street ?? '')) setStreet(fallbackStreet);
            if (fallbackRegion !== (region ?? '')) setRegion(fallbackRegion);
          }
        } catch (fallbackError) {
          console.log('[NewCreateAddress] Fallback geocoding also failed:', fallbackError);
        }
        // Web parity: early check for existing JanGo address to enable view mode
        try {
          const earlyCheck = await checkLocationAddress({
            lat: coordinates.latitude,
            lng: coordinates.longitude,
            isOnline,
            offlineReverseGeocode: async (lat, lng) => {
              const result = await resolveStreetAddress(lat, lng);
              return {
                houseNumber: result.houseNumber ?? null,
                road: result.street?.name ?? null,
                streetName: result.street?.name ?? null,
                city: result.admin.city ?? null,
                neighborhood: result.admin.neighborhood ?? null,
                region: result.admin.region ?? null,
                country: result.admin.country ?? null,
                country_code: result.admin.country_code ?? 'CM',
              };
            },
          });
          if (earlyCheck.status === 'FOUND' && earlyCheck.jangoMatch) {
            setViewMode('view');
            setExistingAddressRecord(earlyCheck.jangoMatch.record);
          } else {
            setViewMode('create');
            setExistingAddressRecord(null);
          }
        } catch (earlyCheckErr) {
          console.warn('[NewCreateAddress] Early address check failed:', earlyCheckErr);
        }
      } finally {
        setIsLoadingAddressComponents(false);
        fetchingAddressRef.current = false;
      }
    };

    // Defer so first paint isn't blocked by initDB/resolveStreetAddress (Android perf)
    const task = InteractionManager.runAfterInteractions(() => {
      fetchAddressComponents();
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.latitude, coordinates?.longitude, user?.id, lang, isImagePickerActive, initializationComplete]);

  // Web parity: populate form fields from existing address record in view mode
  useEffect(() => {
    if (viewMode !== 'view' || !existingAddressRecord) return;
    const r = existingAddressRecord;
    if (r.street_name) setStreet(r.street_name);
    if (r.neighborhood) setNeighbourhood(r.neighborhood);
    if (r.city) setCity(r.city);
    if (r.region) setRegion(r.region);
    if (r.country) setCountry(r.country);
    if (r.business_name) setBusinessName(r.business_name);
    if (r.house_number != null) setHouseNumber(String(r.house_number));
    if (r.property_category) setAddressCategory(r.property_category);
    if (r.connection_type) setConnection(r.connection_type);
  }, [viewMode, existingAddressRecord]);

  const handlePickStreet = useCallback(
    async (selected: ActiveStreetData) => {
      if (!coordinates?.latitude || !coordinates?.longitude) return;
      const streetForCalc = activeStreetDataToStreet(selected);
      const streetKey = createStreetKey(streetForCalc);
      const directionLock = await getDirectionLock(streetKey);
      const nearbyAsStreet: Street[] = nearbyStreets
        .filter((s) => s.segment_id !== selected.segment_id)
        .map((s) => activeStreetDataToStreet(s));
      // Web parity: do NOT pass directionLock into house number calc (web CreateAddressPage uses no options on street change)
      const calculated = calculateHouseNumberSync(
        coordinates.latitude,
        coordinates.longitude,
        streetForCalc,
        { nearbyStreets: nearbyAsStreet }
      );
      setStreet(selected.name);
      setOriginalApiStreetName(selected.name);
      setStreetKeyFromGeocode(streetKey);
      setActiveStreetGeometry(selected.geometry);
      setDistanceToStreet(selected.distance ?? null);
      setHouseNumber(calculated?.houseNumber?.toString() ?? '');
      const resolved = resolveStreetGeometry(streetForCalc, directionLock);
      setActiveStreetData(selected);
      setResolvedStreetGeometry(resolved);
      setActiveStreetDirectionLock(directionLock);
      setActiveStreet(streetForCalc);
      setCalculatedAddress(calculated ?? null);
    },
    [
      coordinates?.latitude,
      coordinates?.longitude,
      nearbyStreets,
    ]
  );

  const handleTakePhoto = () => {
    imagePickerLaunchTime.current = Date.now();
    isImagePickerActiveRef.current = true;
    setIsImagePickerActive(true);
    takePhoto();
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        isImagePickerActiveRef.current = false;
        setIsImagePickerActive(false);
        Alert.alert(
          i18n.t('add-home-address.permissionDenied'),
          i18n.t('add-home-address.allowAccessToCamera'),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        // Mark that we're setting an image to prevent loader from showing
        isSettingImageRef.current = true;
        setImage(result.assets[0]);
        // Reset after image is set
        setTimeout(() => {
          isSettingImageRef.current = false;
        }, 300);
      }
    } catch (error) {
      console.warn('Error taking photo:', error);
    } finally {
      // Only reset if image wasn't selected (user canceled)
      // If image was selected, it's already handled in the if block above
      if (!image) {
        setTimeout(() => {
          isImagePickerActiveRef.current = false;
          setIsImagePickerActive(false);
        }, 500);
      }
    }
  };

  const handleExtensionChange = (value: string | undefined) => {
    if (!value) {
      setExtension(undefined);
      setExtensionError(undefined);
      return;
    }

    const letterValue = value.replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (letterValue.length > 1) {
      setExtensionError('Extension must be a single letter');
      return;
    }

    setExtensionError(undefined);
    setExtension(letterValue);
  };

  const handleHouseNumberChange = (value: string | undefined) => {
    if (!value) {
      setHouseNumber(undefined);
      setHouseNumberError(undefined);
      return;
    }

    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue.length > 6) {
      setHouseNumberError('House number cannot exceed 6 digits');
      return;
    }

    setHouseNumberError(undefined);
    setHouseNumber(numericValue);
  };

  const handleCreateAddress = async () => {
    console.log('[CreateAddress] handleCreateAddress fired');
    try {
      setShowValidationError(true);
      if (!checked) {
        console.log('[CreateAddress] Blocked: checked is false');
        setError(i18n.t('add-home-address.pleaseCheck'));
        await delay(3000);
        setError(undefined);
        return;
      }

      if (extensionError || houseNumberError) {
        console.log('[CreateAddress] Blocked: extensionError/houseNumberError', { extensionError, houseNumberError });
        return;
      }

      const missing: string[] = [];
      if (!addressCategory) missing.push('addressCategory');
      if (!houseNumber) missing.push('houseNumber');
      if (!street) missing.push('street');
      if (!neighbourhood) missing.push('neighbourhood');
      if (!region) missing.push('region');
      if (!connection) missing.push('connection');
      if (missing.length > 0) {
        console.log('[CreateAddress] Blocked: missing required fields', missing);
        setError(`Please fill all required fields: ${missing.join(', ')}`);
        await delay(4000);
        setError(undefined);
        return;
      }

      let imageUri = '';

      if (image?.uri) {
        imageUri = await compressImage();
      }

      console.log('[CreateAddress] Validation passed, showing loading spinner');
      setLoading(true);

      await initDB();

      console.log('[CreateAddress] Checking if address already exists');
      try {
        const addressCheck = await checkLocationAddress({
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          isOnline,
          offlineReverseGeocode: async (lat, lng) => {
            const result = await offlineReverseGeocode(lat, lng, { cameroonTuning: true });
            return result.address;
          },
          onlineReverseGeocode: isOnline ? async (lat, lng) => {
            try {
              const location = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
              if (location && location.length > 0) {
                const loc = location[0];
                return {
                  road: loc.street || null,
                  houseNumber: null,
                  city: loc.city || loc.town || loc.village || null,
                  neighborhood: loc.district || loc.subregion || null,
                  region: loc.region || null,
                  country: loc.country || null,
                  country_code: loc.countryCode || null,
                };
              }
            } catch (error) {
              console.warn('[NewCreateAddress] Online geocoding failed:', error);
            }
            return null;
          } : undefined,
        });

        console.log('[CreateAddress] checkLocationAddress result:', addressCheck.status);

        // If address already exists, warn user
        if (addressCheck.status === 'FOUND') {
          if (addressCheck.jangoMatch) {
            console.log('[CreateAddress] jangoMatch found, showing alert');
            Alert.alert(
              'Address Already Exists',
              'An address already exists at this location in JanGo. Do you want to continue creating a new address?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => proceedWithCreation(imageUri) },
              ]
            );
            setLoading(false);
            return;
          } else if (addressCheck.externalCandidate && addressCheck.externalCandidate.houseNumber) {
            console.log('[CreateAddress] externalCandidate found, showing alert');
            Alert.alert(
              'Address May Already Exist',
              `An address (${addressCheck.externalCandidate.houseNumber} ${addressCheck.externalCandidate.road}) may already exist at this location according to ${addressCheck.externalCandidate.source === 'online_osm' ? 'OpenStreetMap' : 'offline data'}. Do you want to continue?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => proceedWithCreation(imageUri) },
              ]
            );
            setLoading(false);
            return;
          }
        }
      } catch (checkError) {
        console.warn('[CreateAddress] Address check failed, proceeding anyway:', checkError);
      }

      console.log('[CreateAddress] Proceeding with address creation');
      await proceedWithCreation(imageUri);
    } catch (error: any) {
      const rawMessage = error?.message || i18n.t('add-home-address.unknownError');
      console.log('[CreateAddress] Error (handleSubmit):', rawMessage, error);
      const errorMessage = formatAddressCreateError(rawMessage);
      setError(`${i18n.t('add-home-address.errorCreatingAddress')}: ${errorMessage}`);
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  const proceedWithCreation = async (imageUri: string) => {
    setLoading(true);
    let lastRequestPayload: { createAddressData?: unknown; addressData?: unknown } = {};
    try {
      // Ensure database is initialized
      await initDB();

      // Convert form data to Address schema (extension = compound suffix when non–street-facing, web parity)
      const finalExtension = compoundSuffix ?? extension;
      const createAddressData: addressesCreateAddressRequest = {
        image: imageUri,
        latitude: (coordinates?.latitude ?? 0)?.toString(),
        longitude: (coordinates?.longitude ?? 0)?.toString(),
        unit_number: unitNumber,
        unit_type: unitType as string,
        house_plot_nbr: houseNumber,
        house_plot_extension: finalExtension,
        userSSName: street,
        userSSType: streetType,
        userSNName: neighbourhood,
        userSCity: city,
        userSRegion: region,
        address_category: addressCategory,
        connection: connection ?? '',
      };

      if (businessName) {
        createAddressData.business_name = businessName;
      }

      // Convert to Address schema (base; street_name/neighborhood may be overridden for dual-address)
      const addressData = convertRequestToAddress(createAddressData, user?.id);

      console.log('[CreateAddress] Request body (form):', JSON.stringify(createAddressData, null, 2));
      console.log('[CreateAddress] Converted address (offline DB payload):', JSON.stringify(addressData, null, 2));
      lastRequestPayload = { createAddressData, addressData };

      // Detect user edits for dual-address creation (web parity: CreateAddressPage handleSubmit)
      const userEditedStreet =
        originalApiStreetName !== null &&
        (street ?? '').trim().toLowerCase() !== originalApiStreetName.trim().toLowerCase();
      const userEditedNeighborhood =
        originalApiNeighborhood !== null &&
        (neighbourhood ?? '').trim().toLowerCase() !== originalApiNeighborhood.trim().toLowerCase();
      const hasUserEdits = userEditedStreet || userEditedNeighborhood;

      let createdAddress: Awaited<ReturnType<typeof SyncManager.createAddress>>;

      if (hasUserEdits) {
        // Dual-address: official (API names) + user_suggested (edited names) with suggestion records
        const plusCode = addressData.plus_code;
        const streetKey =
          streetKeyFromGeocode ?? normalizeStreetKey((originalApiStreetName || street) ?? '', city ?? '');
        let streetSuggestionId: string | undefined;
        let neighborhoodSuggestionId: string | undefined;

        if (userEditedStreet && originalApiStreetName) {
          const suggestion = await createStreetNameSuggestion({
            plusCode,
            streetKey,
            suggestedName: (street ?? '').trim(),
            suggestedType: streetType || undefined,
            languageCode: lang ?? 'en',
            originalName: originalApiStreetName,
            originalSource: 'offline',
            suggestedBy: user?.id,
          });
          streetSuggestionId = suggestion.id;
        }
        if (userEditedNeighborhood && originalApiNeighborhood) {
          const neighborhoodKey = `${originalApiNeighborhood.toLowerCase()}_${(city ?? '').toLowerCase()}`;
          const suggestion = await createNeighborhoodNameSuggestion({
            plusCode,
            neighborhoodKey,
            suggestedName: (neighbourhood ?? '').trim(),
            languageCode: lang ?? 'en',
            originalName: originalApiNeighborhood,
            originalSource: 'offline',
            suggestedBy: user?.id,
          });
          neighborhoodSuggestionId = suggestion.id;
        }

        const officialAddress = await SyncManager.createAddress({
          ...addressData,
          street_name: originalApiStreetName || addressData.street_name,
          neighborhood: originalApiNeighborhood ?? addressData.neighborhood,
          name_source: 'api_official',
        });
        const userSuggestedAddress = await SyncManager.createAddress({
          ...addressData,
          street_name: addressData.street_name,
          neighborhood: addressData.neighborhood,
          name_source: 'user_suggested',
          linked_address_id: officialAddress.id,
          street_suggestion_id: streetSuggestionId,
          neighborhood_suggestion_id: neighborhoodSuggestionId,
        });
        await SyncManager.updateAddress(officialAddress.id, {
          linked_address_id: userSuggestedAddress.id,
        });
        createdAddress = userSuggestedAddress;
      } else {
        createdAddress = await SyncManager.createAddress({
          ...addressData,
          name_source: 'api_official',
        });
      }

      // Auto-lock street direction on first address (SRD: consistent numbering)
      const streetKey = streetKeyFromGeocode ?? normalizeStreetKey(street ?? '', city ?? '');
      if (streetKey) {
        try {
          await autoLockOnFirstAddress(streetKey, user?.id);
        } catch (lockErr) {
          console.warn('[NewCreateAddress] autoLockOnFirstAddress failed:', lockErr);
        }
      }

      // Success - show success modal (user_suggested address when dual, else single)
      setCreateAddressResponse({
        message: i18n.t('add-home-address.yourAddressHasBeenCreated'),
        address: {
          id: createdAddress.id,
          latitude: createdAddress.latitude.toString(),
          longitude: createdAddress.longitude.toString(),
          global_code: createdAddress.plus_code,
          formatted_address: `${createdAddress.house_number}${createdAddress.extension || ''} ${formatStreetLine(createdAddress.street_name, createdAddress.street_type)}, ${createdAddress.neighborhood || ''}, ${createdAddress.city}, ${createdAddress.region}`,
          address_components: {
            house_number: createdAddress.house_number.toString(),
            road: createdAddress.street_name,
            neighbourhood: createdAddress.neighborhood,
            city: createdAddress.city,
            county: createdAddress.region,
            country: createdAddress.country,
          },
        },
      });

      setShowSuccessModal(true);

      // Clear form
      setChecked(false);
      setBusinessName(undefined);
      setAddressCategory(undefined);
      setHouseNumber(undefined);
      setExtension(undefined);
      setUnitNumber(undefined);
      setUnitType(undefined);
      setImage(undefined);
      setError(undefined);
      setShowValidationError(false);
      setNeighbourhood(undefined);
      setExtensionError(undefined);
      setHouseNumberError(undefined);

      // Invalidate the addresses cache
      queryClient.invalidateQueries({
        queryKey: ['/addresses/my-jango-addresses-infinite'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/addresses/my-alias-addresses-infinite'],
      });
    } catch (error: any) {
      setLoading(false);
      const rawMessage = error?.message || i18n.t('add-home-address.unknownError');
      console.log('[CreateAddress] Error (proceedWithCreation):', rawMessage, error);
      console.log('[CreateAddress] Failed request payload:', JSON.stringify(lastRequestPayload, null, 2));
      const errorMessage = formatAddressCreateError(rawMessage);
      setError(`${i18n.t('add-home-address.errorCreatingAddress')}: ${errorMessage}`);
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  // Initialize SyncManager on mount
  useEffect(() => {
    const initSync = async () => {
      try {
        await SyncManager.init();
      } catch (error) {
        console.log('[NewCreateAddress] Failed to initialize SyncManager:', error);
      }
    };
    initSync();
  }, []);

  useEffect(() => {
    const backAction = () => {
      router.replace('/(tabs)');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    const regionZip = getRegionZip(country, lang);
    setRegionLabel(regionZip.region);
    setZipLabel(regionZip.zip);
  }, [lang, country]);

  useEffect(() => {
    return () => {
      isImagePickerActiveRef.current = false;
      setIsImagePickerActive(false);
    };
  }, []);

  // Map controls
  const handleToggleGrid = () => {
    setShowGrid(prev => !prev);
    // Don't clear the rectangle when toggling grid - it should stay visible
  };

  const handleToggle3D = () => {
    setShow3D(prev => !prev);
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
          zoom: Math.max((camera.zoom || 15) - 1, 0),
        });
      });
    }
  };

  const handleCenterLocation = async () => {
    if (coordinates) {
      if (mapRef.current) {
        // Camera padding already positions grid at 40% from top; center on grid
        mapRef.current.animateToRegion(
          {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          },
          500,
        );
      }
    } else {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        // Snap to G-square grid
        const snapped = snapToPlusCodeGrid(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
        );
        setCoordinates({
          ...currentLocation.coords,
          latitude: snapped.lat,
          longitude: snapped.lng,
        });
        setSelectedLocation({
          latitude: snapped.lat,
          longitude: snapped.lng,
          latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
          longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
        });

        if (mapRef.current) {
          // Camera padding already positions grid at 40% from top; center on grid
          mapRef.current.animateToRegion(
            {
              latitude: snapped.lat,
              longitude: snapped.lng,
              latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
              longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
            },
            500,
          );
        }
      } catch (error) {
        console.warn('Error getting location:', error);
      }
    }
  };

  const displayAddressText = parseFormattedAddress(
    createAddressResponse?.address?.formatted_address ?? '',
  );
  const formatedLength = Object.keys(displayAddressText).length;

  // Get business name from address components

  // Memoize centerLocation to prevent unnecessary re-renders of MapViewMapLibre
  const memoizedCenterLocation = useMemo(
    () =>
      coordinates
        ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
        : null,
    [coordinates?.latitude, coordinates?.longitude]
  );

  // Same geometry as overlay: fromMap → fromMapAntsGeometry (location-context street), else resolvedStreetGeometry. GeoJSON = [lon, lat][].
  const activeStreetShape = useMemo(() => {
    const fromMapGeom = fromMap && fromMapAntsGeometry?.geometry ? fromMapAntsGeometry.geometry : null;
    const antsGeometry = fromMap && fromMapGeom && fromMapGeom.length >= 2 ? fromMapAntsGeometry : resolvedStreetGeometry;
    const geom = antsGeometry?.geometry;
    if (!geom || geom.length < 2) return null;
    const coordinates = geom.map(([lat, lon]) => [lon, lat] as [number, number]);
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates },
      properties: {},
    };
  }, [fromMap, fromMapAntsGeometry, resolvedStreetGeometry]);

  // Animate marching ants (dash phase 0→1, 800ms cycle)
  useEffect(() => {
    if (!activeStreetShape) return;
    let phase = 0;
    const msPerTick = 50;
    const cycleMs = 800;
    const step = msPerTick / cycleMs;
    const interval = setInterval(() => {
      phase = (phase + step) % 1;
      setRouteAnimPhase(phase);
    }, msPerTick);
    return () => clearInterval(interval);
  }, [activeStreetShape]);

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Map View with street marching ants (ShapeSource + LineLayer, same street as location context) */}
        <View style={styles.mapWrapper}>
          {mapReadyToMount ? (
            <MapViewMapLibre
              style={styles.map}
              ref={mapRef}
              initialRegion={INITIAL_REGION}
              showGrid={showGrid}
              centerLocation={memoizedCenterLocation}
              animateGridPulse
              scrollEnabled={false}
              zoomEnabled={false}
              cameraPaddingBottom={cameraPaddingBottom}
              onMapLoad={() => setMapReady(true)}
            >
              {activeStreetShape && (
                <>
                  <ShapeSource id="active-street-outline" shape={activeStreetShape}>
                    <LineLayer
                      id="active-street-outline-layer"
                      style={{
                        lineColor: '#FFFFFF',
                        lineWidth: 8,
                        lineOpacity: 0.9,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </ShapeSource>
                  <ShapeSource id="active-street" shape={activeStreetShape}>
                    <LineLayer
                      id="active-street-line"
                      style={{
                        lineColor: '#0000EE',
                        lineWidth: 4,
                        lineDasharray: [
                          Math.max(0.5, 12 * (1 - routeAnimPhase)),
                          6 + 12 * routeAnimPhase,
                        ],
                        lineOpacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </ShapeSource>
                </>
              )}
            </MapViewMapLibre>
          ) : (
            <View style={[styles.map, { backgroundColor: '#e0e4e8' }]} />
          )}
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
          show3D={show3D}
          top="15%"
        />

        {/* Form Section - Bottom Sheet */}
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}>
            <KeyboardAwareScrollView
              style={styles.formScrollView}
              contentContainerStyle={styles.formContent}
              enableOnAndroid={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* Sheet header */}
              <View style={styles.formHeader}>
                <Text style={styles.formHeaderText}>
                  {i18n.t('add-home-address.createAJanGoAddress')}
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/(tabs)')}
                  style={styles.closeButton}>
                  <Icon source={'close'} size={24} color={Colors.light[10]} />
                </TouchableOpacity>
              </View>

              <View style={styles.headerCardTopRow}>
                <Text style={styles.headerTabActive}>
                  {i18n.t('add-home-address.addressInformation') || 'Address Information'}
                </Text>
                <View style={styles.autoGeneratedPill}>
                  <Text style={styles.autoGeneratedText}>
                    {i18n.t('add-home-address.autoGenerated') || '✨ Auto-Generated'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerCardSeparator} />

              {/* Header card with live text preview */}
              <View style={styles.headerCard}>
                {/* Show business name when entering it (Step 2) */}
                {businessName != null && businessName.trim() !== '' && (

                  <Text style={styles.headerBusinessNameValue} numberOfLines={1} ellipsizeMode="tail">
                    {businessName.trim()}
                  </Text>
                )}
                <View style={styles.headerAddressText}>
                  <Text style={styles.headerAddressLine1}>
                    {`${houseNumber?.trim() ? `${houseNumber}${compoundSuffix ?? extension ?? ''}` : '—'} ${street || i18n.t('add-home-address.unnamedStreet')
                      }`}
                  </Text>
                  {(neighbourhood || city) && (
                    <Text style={styles.headerAddressLine2}>
                      {[neighbourhood, city].filter(Boolean).join(', ')}
                    </Text>
                  )}
                  {(region || country) && (
                    <Text style={styles.headerAddressLine3}>
                      {formatRegionCountryPair(region, country)}
                    </Text>
                  )}
                </View>
              </View>

              {/* View mode banner when existing address found */}
              {viewMode === 'view' && (
                <View style={styles.viewModeBanner}>
                  <Icon source="information" size={18} color={Colors.primary[500]} />
                  <Text style={styles.viewModeBannerText}>
                    This location already has an address
                  </Text>
                </View>
              )}

              {/* Street direction lock status (spec: show on create page when address context exists) */}
              {/* <StreetDirectionInfo /> */}

              {/* Non–street-facing: compound suffix auto-applied (web parity) */}
              {/* {distanceToStreet != null && compoundSuffix && (
                <View style={[styles.headerCard, { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12 }]}>
                  <Text style={{ fontSize: 12, color: Colors.grey }}>
                    {getCompoundBandDescription(distanceToStreet)} — {i18n.t('add-home-address.suffixAutoApplied') || "Suffix auto-applied"}
                  </Text>
                </View>
              )} */}

              {/* Pick a Street: list of nearby streets (web parity); tap to recalc house number */}
              {/* {nearbyStreets.length > 0 && (
                <View style={[styles.headerCard, { marginTop: 8 }]}>
                  <Text style={[styles.headerTabActive, { marginBottom: 8 }]}>
                    {i18n.t('add-home-address.pickAStreet') || 'Pick a Street'}
                  </Text>
                  {nearbyStreets.map((item) => {
                    const isActive =
                      (streetKeyFromGeocode && streetKeyFromGeocode === normalizeStreetKey(item.name)) ||
                      street === item.name;
                    return (
                      <TouchableOpacity
                        key={item.segment_id}
                        onPress={() => handlePickStreet(item)}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: isActive ? Colors.primary['50'] : 'transparent',
                          borderWidth: 1,
                          borderColor: isActive ? Colors.primary[500] : Colors.grey,
                          marginBottom: 6,
                        }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isActive ? '600' : '400',
                            color: isActive ? Colors.primary[500] : Colors['grey-dark'],
                          }}
                          numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.grey, marginTop: 2 }}>
                          {item.distance != null ? `${Math.round(item.distance)} m` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )} */}

              {/* Step indicator */}
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>
                  {i18n.t('common.step')} {currentStep} / 2
                </Text>
              </View>

              {/* Step 1: image + street + neighborhood */}
              {currentStep === 1 && (
                <View pointerEvents={viewMode === 'view' ? 'none' : 'auto'} style={viewMode === 'view' ? { opacity: 0.6 } : undefined}>
                  {/* Upload image row - web-style card */}
                  <View style={styles.uploadRow}>
                    <TouchableOpacity
                      style={styles.uploadCard}
                      onPress={handleTakePhoto}>
                      {image ? (
                        <>
                          <Image
                            source={{ uri: image.uri }}
                            style={styles.uploadCardImage}
                          />
                          <Text style={styles.uploadChangeText}>
                            {i18n.t('add-home-address.change') || 'Change'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Icon
                            source="upload"
                            size={20}
                            color={Colors.primary[500]}
                          />
                          <Text style={styles.uploadTitleText}>
                            {i18n.t('add-home-address.uploadImage') || 'Take a Photo'}
                          </Text>
                          <Text style={styles.uploadSubtitleText}>
                            {i18n.t('add-home-address.uploadImageFormats') || 'PNG, JPG'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <View style={styles.uploadMeta}>
                      <Text style={styles.uploadLabelText}>
                        {i18n.t('add-home-address.uploadImage') || 'Take a Photo'}
                        <Text style={styles.requiredAsterisk}> *</Text>
                      </Text>

                    </View>
                  </View>

                  {/* Location fields */}
                  <View style={styles.formFieldsContainer}>
                    <View>
                      <InputComponent
                        icon={require('@/assets/images/ic_street.png')}
                        title1={i18n.t('add-home-address.street')}
                        required
                        placeHolder1={i18n.t('add-home-address.street')}
                        value1={street}
                        setValue1={setStreet}
                        defaultDisabled={true}
                        onPress={() => setIsEditingStreet(true)}
                        isEditing={isEditingStreet}
                        editable
                        error={i18n.t('add-home-address.pleaseEnterAStreet')}
                        showError={showValidationError && !street}
                      />
                      {street ? <View style={{ marginTop: 4, marginLeft: 36 }}><StreetNameBadge streetName={street} /></View> : null}
                    </View>
                    <InputComponent
                      icon={require('@/assets/images/ic_neighbour.png')}
                      title1={zipLabel}
                      required
                      placeHolder1={`${i18n.t('add-home-address.enter')}${zipLabel}`}
                      value1={neighbourhood}
                      setValue1={setNeighbourhood}
                      onDone={() => {
                        setNeighbourhood(prev =>
                          formatNeighborhood(prev ?? '', STREET_TYPES, lang),
                        );
                      }}
                      editable
                      error={`${i18n.t('add-home-address.pleaseEnterA')}${zipLabel}`}
                      showError={showValidationError && !neighbourhood}
                    />
                    {/* <Text style={styles.cityRegionCountryText}>
                      {city} {region}, {country}
                    </Text> */}
                  </View>
                </View>
              )}

              {/* Step 2: business name, property type, connection, house/unit */}
              {currentStep === 2 && (
                <View style={styles.formFieldsContainer} pointerEvents={viewMode === 'view' ? 'none' : 'auto'}>
                  <InputComponent
                    icon={require('@/assets/images/ic_building.png')}
                    optional
                    title1={i18n.t('add-home-address.businessName')}
                    placeHolder1={i18n.t('add-home-address.enterBusinessName')}
                    value1={businessName}
                    setValue1={setBusinessName}
                    tooltip={i18n.t('add-home-address.ifThisAddressIs')}
                    toolTipVisible={visibleToolTip === 'business_name'}
                    onToggleTooltip={() => {
                      visibleToolTip === 'business_name'
                        ? setVisibleToolTip(undefined)
                        : setVisibleToolTip('business_name');
                    }}
                  />
                  <AddressCategoryDropdown
                    label={i18n.t('add-home-address.addressCategory')}
                    value={addressCategory}
                    onChange={value => setAddressCategory(value)}
                    placeholder={i18n.t('add-home-address.selectAddressCategory')}
                    error={i18n.t('add-home-address.pleaseSelectAddressCategory')}
                    showError={showValidationError && !addressCategory}
                    onClose={() => { }}
                  />
                  <InputComponent
                    icon={require('@/assets/images/connections.png')}
                    title1={i18n.t('add-home-address.connection') || 'Connection'}
                    required
                    placeHolder1={
                      i18n.t('add-home-address.selectConnection') ||
                      'Select Connection'
                    }
                    value1={connection}
                    setValue1={setConnection}
                    options1={CONNECTIONS.map(conn => ({
                      label:
                        lang === 'pt'
                          ? conn.Portuguese
                          : lang === 'fr'
                            ? conn.French
                            : conn.English,
                      value:
                        lang === 'pt'
                          ? conn.Portuguese
                          : lang === 'fr'
                            ? conn.French
                            : conn.English,
                    }))}
                  />
                  <InputComponent
                    icon={require('@/assets/images/house_number.png')}
                    title1={i18n.t('add-home-address.housePlotNumber')}
                    title2={i18n.t('add-home-address.extension')}
                    required
                    maxLength1={6}
                    placeHolder1={i18n.t('add-home-address.enterNumber')}
                    value1={houseNumber}
                    setValue1={handleHouseNumberChange}
                    inputMode1="numeric"
                    placeHolder2={i18n.t('add-home-address.enterExtension')}
                    value2={extension}
                    setValue2={handleExtensionChange}
                    maxLength2={1}
                    tooltip={i18n.t('add-home-address.aLetterCanBe')}
                    toolTipVisible={visibleToolTip === 'extension'}
                    onToggleTooltip={() => {
                      visibleToolTip === 'extension'
                        ? setVisibleToolTip(undefined)
                        : setVisibleToolTip('extension');
                    }}
                    error={
                      houseNumberError
                        ? houseNumberError
                        : extensionError
                          ? extensionError
                          : i18n.t('add-home-address.pleaseEnterAHouseNumber')
                    }
                    showError={
                      !!houseNumberError ||
                      !!extensionError ||
                      (showValidationError && !houseNumber)
                    }
                  />
                </View>
              )}

              {/* Footer with step navigation */}
              <View style={styles.footer}>
                {viewMode === 'view' ? (
                  <Button
                    mode="contained"
                    buttonColor={Colors.primary['500']}
                    style={styles.footerButtonContainer}
                    onPress={() => router.back()}>
                    <Text style={styles.buttonText}>
                      {i18n.t('common.back') || 'Back to Map'}
                    </Text>
                  </Button>
                ) : currentStep === 1 ? (
                    <Button
                      mode="contained"
                      buttonColor={Colors.primary['500']}
                      style={styles.footerButtonContainer}
                      disabled={!street || !neighbourhood}
                      onPress={() => setCurrentStep(2)}>
                      <Text style={styles.buttonText}>
                        {i18n.t('common.next') || 'Next'}
                      </Text>
                    </Button>
                ) : (
                  <>
                    <View style={defaultStyles.checkboxContainer}>
                      <Checkbox.Android
                        status={checked ? 'checked' : 'unchecked'}
                        onPress={() => setChecked(prev => !prev)}
                        color={Colors.primary[500]}
                        uncheckedColor={Colors.error}
                      />
                      <Text
                        style={[
                          defaultStyles.checkboxText,
                          !checked && { color: Colors.error },
                        ]}>
                        {i18n.t('add-home-address.checkTheBox')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Button
                        mode="outlined"
                        textColor={Colors.primary[500]}
                        buttonColor={Colors.light[10]}
                        style={[defaultStyles.button, { flex: 1 }]}
                        onPress={() => setCurrentStep(1)}>
                        <Text>
                          {i18n.t('common.back') || 'Back'}
                        </Text>
                      </Button>
                      <Button
                        mode="contained"
                        buttonColor={Colors.primary['500']}
                        style={[defaultStyles.button, { flex: 1 }]}
                        disabled={loading}
                        loading={loading}
                        onPress={()=>{console.log("submit pressed"); handleCreateAddress()}}>
                        <Text style={defaultStyles.buttonText}>
                          {i18n.t('add-home-address.submitAddress')}
                        </Text>
                      </Button>
                    </View>
                  </>
                )}
              </View>
            </KeyboardAwareScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Snackbar
        visible={!!error}
        onDismiss={() => { }}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
      <Loader
        visible={loading}
        text={i18n.t('add-home-address.creatingAddress')}
      />
      <Dialog
        visible={!!createAddressResponse && showSuccessModal}
        onDismiss={() => { }}
        style={styles.dialogContainer}>
        <Dialog.Content
          style={[styles.dialogSubtitleContainer, styles.paddingHorizontal]}>
          <Icon source={'check-circle'} size={24} color={Colors.success} />
          <Text style={styles.addressSuccessfullyCreatedText}>
            {i18n.t('add-home-address.yourAddressHasBeenCreated')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowSuccessModal(false);
              router.replace('/(tabs)');
            }}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content style={styles.dialogContentContainer}>
          <Text style={styles.jangoAddress}>
            {i18n.t('add-home-address.jangoGPS')}
          </Text>
        </Dialog.Content>
        <Dialog.Content>
          <View style={styles.addressContainer}>
            {displayAddressText.line1 && (
              <Text
                style={[
                  styles.addressLine,
                  formatedLength > 3 && styles.addressLineBold,
                ]}>
                {displayAddressText.line1}
              </Text>
            )}
            {displayAddressText.line2 && (
              <Text style={styles.addressLine}>{displayAddressText.line2}</Text>
            )}
            {displayAddressText.line3 && (
              <Text style={styles.addressLine}>{displayAddressText.line3}</Text>
            )}
            {displayAddressText.line4 && (
              <Text style={styles.addressLine}>{displayAddressText.line4}</Text>
            )}
            {displayAddressText.line5 && (
              <Text style={styles.addressLine}>{displayAddressText.line5}</Text>
            )}
          </View>
          {/* <Text style={styles.dialogTitle}>
            {createAddressResponse?.address?.formatted_address}
          </Text> */}
        </Dialog.Content>
        <Dialog.Actions style={styles.dialogActionContainer}>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={[defaultStyles.flexButton, styles.shareAddressButton]}
            onPress={() => {
              setShowSuccessModal(false);
              openShareSheet(
                {
                  latitude: createAddressResponse?.address?.latitude,
                  longitude: createAddressResponse?.address?.longitude,
                  global_code: createAddressResponse?.address?.global_code,
                  formatted_address:
                    createAddressResponse?.address?.formatted_address,
                  house_number:
                    createAddressResponse?.address?.address_components
                      ?.house_number,
                  street_name:
                    createAddressResponse?.address?.address_components?.road,
                },
                user?.full_names,
              )
            }}
            labelStyle={[
              defaultStyles.buttonText,
              styles.shareAddressText,
              styles.font14,
            ]}>
            {i18n.t('add-home-address.shareAddress')}
          </Button>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={defaultStyles.button}
            onPress={() => {
              setShowSuccessModal(false);
              router.push('/my-addresses');
            }}
            labelStyle={[
              defaultStyles.buttonText,
              styles.gentiumText,
              styles.font14,
            ]}>
            {i18n.t('add-home-address.viewAddress')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Loader
        visible={
          (preLoading || loading) &&
          !isImagePickerActive &&
          !isImagePickerActiveRef.current &&
          !isSettingImageRef.current // Don't show loader when setting image
        }
        text={i18n.t('add-home-address.loadingAddressComponents')}
      />
      {isEditingStreet && (
        <Modal
          visible={isEditingStreet}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsEditingStreet(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: Colors.light[10], borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' }}>
              <StreetNameEditor
                streetName={street ?? ''}
                streetType={streetType}
                isFromApi={!!originalApiStreetName}
                onSave={(name, type) => {
                  setStreet(name);
                  setStreetType(type);
                  setIsEditingStreet(false);
                }}
                onCancel={() => setIsEditingStreet(false)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
    flex: 1,
    right: 0,
    left: 0,
    // top: 0,
    bottom: 150,
    position: 'absolute',
  },
  formContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light[10],
    maxHeight: '68%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    paddingBottom: 40,
  },
  formScrollView: {
    flex: 1,
  },
  formContent: {
    paddingBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark['0.1'],
    backgroundColor: Colors.primary[500],
  },
  closeButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    fontFamily: 'gentium-bold',
    textAlign: 'center',
  },
  imageParentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    marginBottom: 6,
    borderBottomColor: Colors.dark['0.1'],
    width: '100%',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark['0.1'],
    gap: 16,
  },
  uploadCard: {
    width: 100,
    height: 70,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light[10],
    padding: 6,
  },
  uploadCardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  uploadTitleText: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  uploadSubtitleText: {
    fontSize: 9,
    fontFamily: 'gentium',
    color: Colors.grey,
  },
  uploadChangeText: {
    position: 'absolute',
    bottom: 4,
    fontSize: 9,
    fontFamily: 'gentium',
    color: Colors.light[10],
    backgroundColor: Colors.dark[0.5],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  uploadMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  uploadLabelText: {
    fontSize: 12,
    fontFamily: 'gentium-bold',
    color: Colors.primary[500],
    marginBottom: 4,
  },
  uploadCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadCheckboxLabel: {
    fontSize: 12,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  requiredAsterisk: {
    color: Colors.error,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    backgroundColor: Colors.light[10],
    borderRadius: 4,
    width: '10%',
    marginLeft: 12,
  },
  image: {
    width: 60,
    height: 60,
  },
  closeImageContainer: {
    backgroundColor: Colors.dark[0.5],
    width: 12,
    height: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  changeImageContainer: {
    backgroundColor: Colors.dark[0.5],
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 2,
    columnGap: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  changeText: {
    fontSize: 10,
    color: Colors.light[10],
  },
  addAPictureContainer: {
    flexDirection: 'row',
    columnGap: 2,
    alignItems: 'center',
  },
  addAPictureText: {
    fontSize: 8,
    color: Colors.primary[500],
  },
  formFieldsContainer: {
    marginHorizontal: 20,
    gap: 6,
    paddingBottom: 6,
  },
  footer: {
    gap: 12,
    marginHorizontal: 20,
    marginTop:8,
  },
  dialogContainer: {
    backgroundColor: Colors.light['10'],
    borderRadius: 8,
    position: 'relative',
    rowGap: 0,
    paddingVertical: 4,
    width: sizes.windowWidth * 0.94,
    alignSelf: 'center',
    marginHorizontal: 0,
  },
  paddingHorizontal: {
    marginTop: 16,
    paddingLeft: 12,
    paddingRight: 12,
    columnGap: 16,
  },
  dialogSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 4,
    paddingHorizontal: 12,
    paddingBottom: 16,
    overflowX: 'hidden',
    flexShrink: 1,
  },
  dialogContentContainer: {
    paddingTop: 0,
    paddingBottom: 2,
  },
  dialogTitle: {
    fontSize: 16,
    color: Colors.primary[500],
    textAlign: 'center',
    fontFamily: 'gentium',
    marginHorizontal: 24,
  },
  dialogActionContainer: {
    flexDirection: 'row',
    columnGap: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingBottom: 0,
    overflowX: 'hidden',
  },
  jangoAddress: {
    fontFamily: 'gentium-bold',
    textAlign: 'center',
  },
  addressSuccessfullyCreatedText: {
    color: Colors.success,
    fontFamily: 'gentium-bold',
    textAlign: 'center',
    flexShrink: 1,
  },
  shareAddressButton: {
    borderWidth: 1,
    borderColor: Colors.dark[0.1],
    backgroundColor: Colors.secondary[10],
  },
  shareAddressText: {
    color: Colors.dark[0],
    fontFamily: 'gentium',
  },
  font14: {
    fontSize: 14,
  },
  gentiumText: {
    fontFamily: 'gentium',
  },
  addressContainer: {
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderColor: Colors.dark['0.1'],
  },
  addressLine: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginBottom: 2,
    textAlign: 'center',
  },
  addressLineBold: {
    fontWeight: '700',
    fontFamily: 'gentium-bold',
  },
  cityRegionCountryText: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginBottom: 2,
    textAlign: 'center',
  },
  headerCard: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark['0.1'],
    backgroundColor: Colors.light[10],
  },

  headerBusinessNameLabel: {
    fontSize: 12,
    fontFamily: 'gentium',
    color: Colors.dark[10],
    opacity: 0.8,
  },
  headerBusinessNameValue: {
    fontSize: 14,
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  headerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 20

  },
  headerTabActive: {
    fontSize: 14,
    fontFamily: 'gentium-bold',
    color: Colors.primary[500],
  },
  autoGeneratedPill: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  autoGeneratedText: {
    fontSize: 12,
    fontFamily: 'gentium-bold',
    color: Colors.light[10],
  },
  headerAddressText: {
  },
  headerAddressLine1: {
    fontSize: 14,
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  headerAddressLine2: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  headerAddressLine3: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  previewCardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewModeBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary['50'] ?? '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  viewModeBannerText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontFamily: 'gentium',
    flex: 1,
  },
  stepIndicator: {
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  stepIndicatorText: {
    fontSize: 12,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
  headerCardSeparator: {
    height: 1,
    backgroundColor: Colors.dark[0.1]
  },
  footerButtonContainer: {
    width: '35%',
    alignSelf: 'center',
 
    justifyContent: 'center',
    borderRadius: 4,
  },
  buttonText: {
    // flexShrink: 1,
    flexWrap: 'wrap',
    fontWeight: '500',
    color: Colors.light['10'],
    fontSize: 10,
    textAlign: 'center',
  },
});


// import {
//   Colors,
//   countries,
//   STREET_TYPES,
//   UNIT_TYPES,
//   CONNECTIONS,
//   grayMapStyle,
//   MAP_TILE_CONFIG,
// } from '@/constants';
// import { defaultStyles } from '@/styles';
// import React, {
//   useContext,
//   useEffect,
//   useRef,
//   useState,
//   useCallback,
//   useMemo,
// } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Keyboard,
//   TouchableWithoutFeedback,
//   Platform,
//   Alert,
//   BackHandler,
//   TouchableOpacity,
//   Image,
//   KeyboardAvoidingView,
//   Dimensions,
// } from 'react-native';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import {
//   Appbar,
//   Button,
//   Checkbox,
//   Dialog,
//   Icon,
//   Snackbar,
// } from 'react-native-paper';
// import { Region } from 'react-native-maps';
// import MapViewMapLibre from '@/components/MapViewMapLibre';
// import { MapLibreMarker } from '@/components/MapLibreMarker';
// import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
// import * as ImagePicker from 'expo-image-picker';
// import {
//   delay,
//   formatNeighborhood,
//   openShareSheet,
//   readData,
//   useCompressedImage,
//   deleteData,
//   storeData,
//   decodePlusCodeToBounds,
// } from '@/utils';
// import * as Location from 'expo-location';
// import {
//   useGetPlusCode,
//   useGetWhat3Words,
// } from '@/hooks/addresses.hooks';
// import { getAddressComponents } from '@/lib/geocoding/getAddressComponents';
// import { SyncManager } from '@/lib/syncManager';
// import { convertRequestToAddress } from '@/lib/utils/addressConverter';
// import { initDB } from '@/lib/db';
// import { checkLocationAddress } from '@/lib/checkLocationAddress';
// import { offlineReverseGeocode } from '@/lib/geocoding/reverseGeocode';
// import { useOffline } from '@/hooks/useOffline';
// import { resolveStreetAddress } from '@/lib/offlineDataPacks';
// import { autoLockOnFirstAddress, getDirectionLock, normalizeStreetKey } from '@/lib/streetDirectionService';
// import { syncMapStoreFromResolveResult } from '@/hooks/useActiveStreet';
// import { createStreetKey, resolveStreetGeometry } from '@/lib/streetGeometry';
// import { calculateHouseNumberSync } from '@/lib/createLocationAddress';
// import type { Street } from '@/lib/createLocationAddress';
// import type { ActiveStreetData } from '@/lib/streetSelection';
// import {
//   AddressCategoryDropdown,
//   EditStreet,
//   InputComponent,
//   Loader,
//   AddressLivePreviewCard,
//   MapControls,
//   StreetDirectionInfo,
// } from '@/components';
// import { Context, ContextType } from './_layout';
// import {
//   addressesCreateAddressRequest,
//   addressesCreateAddressResponse,
// } from '@/interfaces';
// import i18n from '../i18n';
// import { getLocationLabel, getRegionZip } from '@/utils/regionZipFormatter';
// import { snackbarToast } from '@/utils/toastHelpter';
// import { useFormResetOnNavigation } from '@/hooks/useFormResetOnNavigation';
// import { useFormResetOnNavigationAndroid } from '@/hooks/useFormResetOnNavigationAndroid';
// import { useQueryClient } from '@tanstack/react-query';
// import { useRouter, useLocalSearchParams } from 'expo-router';
// import { sizes } from '@/constants/sizes';
// import { useStreetSelectionStore, useAddressStore } from '@/lib/store';
// import {
//   SafeAreaView,
//   useSafeAreaInsets,
// } from 'react-native-safe-area-context';
// import { parseFormattedAddress } from '@/utils/helpers';

// /** Convert ActiveStreetData (geometry [lon,lat]) to Street (geometry [lat,lon]) for calculateHouseNumberSync (web parity: include osm_id) */
// function activeStreetDataToStreet(data: ActiveStreetData): Street {
//   return {
//     id: data.segment_id,
//     name: data.name,
//     osm_id: parseInt(data.segment_id.split('-')[0], 10) || 0,
//     geometry: data.geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
//     direction_locked: false,
//   };
// }

// // Helper to format region/country pair like "SW, CMR"
// const formatRegionCountryPair = (region: string | undefined, country: string | undefined) => {
//   if (!region && !country) return '';

//   const normalizedRegion = (region || '').toLowerCase().replace(/[-\s]+/g, '');
//   const regionCodes: Record<string, string> = {
//     southwest: 'SW',
//     northwest: 'NW',
//     littoral: 'LT',
//     centre: 'CE',
//     center: 'CE',
//     west: 'OU',
//     east: 'ES',
//     south: 'SU',
//     north: 'NO',
//     adamawa: 'AD',
//     adamaoua: 'AD',
//     farnorth: 'EN',
//     extremenord: 'EN',
//   };

//   const countryCodes: Record<string, string> = {
//     Cameroon: 'CMR',
//     Nigeria: 'NGA',
//     'United States': 'USA',
//     'United Kingdom': 'GBR',
//     France: 'FRA',
//     Germany: 'DEU',
//   };

//   const regionCode =
//     regionCodes[normalizedRegion] ||
//     (region ? region.substring(0, 2).toUpperCase() : '');
//   const countryAlpha3 =
//     (country && countryCodes[country]) || (country ? country.substring(0, 3).toUpperCase() : '');

//   if (regionCode && countryAlpha3) return `${regionCode}, ${countryAlpha3}`;
//   if (regionCode) return regionCode;
//   return countryAlpha3;
// };

// // Plus Codes G-square (grid cell) - the smallest visible grid cell
// // Based on Plus Code specification: G-square is approximately 14.3m x 14.3m
// // The actual grid alignment depends on the Plus Code encoding algorithm
// // At latitude ~4°: 1° latitude ≈ 111,000m, 1° longitude ≈ 110,700m (cos(4°) ≈ 0.9976)
// // G-square: 14.3m = 0.0001288° latitude, 0.0001292° longitude
// // Fine-tuned values to match the visible grid overlay
// const G_SQUARE_LAT_SIZE = 0.0001288; // 14.3m in degrees (latitude)
// const G_SQUARE_LNG_SIZE = 0.0001292; // 14.3m in degrees (longitude at ~4° latitude)
// const G_SQUARE_LAT_HALF = 0.0000644; // Half of G-square latitude (7.15m)
// const G_SQUARE_LNG_HALF = 0.0000646; // Half of G-square longitude (7.15m)

// // Plus Code grid may have a slight offset from standard lat/lng grid
// // This offset helps align with the actual visible grid overlay
// // Adjust these if the alignment is still off
// // Negative values shift down (south) and left (west)
// const GRID_ALIGNMENT_OFFSET_LAT = -0.000022; // Fine-tuned: slightly up from -0.00004
// const GRID_ALIGNMENT_OFFSET_LNG = -0.000023; // Fine-tuned: slightly right from -0.00004
// // Additional fine-tune nudges to better align the rendered square with the visible grid
// // Positive latitude moves north (up); negative longitude moves west (left)
// const GRID_NUDGE_LAT = 0.00004;
// const GRID_NUDGE_LNG = -0.000055;

// // Function to snap coordinates to Plus Code grid cell center
// // This calculates the exact center of the G-square grid cell that contains the coordinate
// // The Plus Code grid has a specific origin and alignment
// const snapToPlusCodeGrid = (
//   lat: number,
//   lng: number,
// ): { lat: number; lng: number } => {
//   // Apply any alignment offset first
//   const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
//   const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;

//   // Calculate which grid cell contains this coordinate
//   // Use floor to find the cell's lower boundary (this finds the cell index)
//   const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
//   const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);

//   // Calculate the center of that grid cell
//   // Center = lower boundary + half of cell size
//   const snappedLat =
//     latCellIndex * G_SQUARE_LAT_SIZE +
//     G_SQUARE_LAT_HALF +
//     GRID_ALIGNMENT_OFFSET_LAT;
//   const snappedLng =
//     lngCellIndex * G_SQUARE_LNG_SIZE +
//     G_SQUARE_LNG_HALF +
//     GRID_ALIGNMENT_OFFSET_LNG;

//   return { lat: snappedLat, lng: snappedLng };
// };

// // Function to get grid cell boundaries directly (for perfect rectangle alignment)
// const getGridCellBounds = (
//   lat: number,
//   lng: number,
// ): {
//   minLat: number;
//   maxLat: number;
//   minLng: number;
//   maxLng: number;
//   centerLat: number;
//   centerLng: number;
// } => {
//   // Apply any alignment offset first
//   const adjustedLat = lat - GRID_ALIGNMENT_OFFSET_LAT;
//   const adjustedLng = lng - GRID_ALIGNMENT_OFFSET_LNG;

//   // Calculate which grid cell contains this coordinate
//   const latCellIndex = Math.floor(adjustedLat / G_SQUARE_LAT_SIZE);
//   const lngCellIndex = Math.floor(adjustedLng / G_SQUARE_LNG_SIZE);

//   // Calculate the exact boundaries of the grid cell
//   const minLat = latCellIndex * G_SQUARE_LAT_SIZE + GRID_ALIGNMENT_OFFSET_LAT;
//   const maxLat = minLat + G_SQUARE_LAT_SIZE;
//   const minLng = lngCellIndex * G_SQUARE_LNG_SIZE + GRID_ALIGNMENT_OFFSET_LNG;
//   const maxLng = minLng + G_SQUARE_LNG_SIZE;

//   // Calculate center
//   const centerLat = minLat + G_SQUARE_LAT_HALF;
//   const centerLng = minLng + G_SQUARE_LNG_HALF;

//   return {
//     minLat: minLat + GRID_NUDGE_LAT,
//     maxLat: maxLat + GRID_NUDGE_LAT,
//     minLng: minLng + GRID_NUDGE_LNG,
//     maxLng: maxLng + GRID_NUDGE_LNG,
//     centerLat: centerLat + GRID_NUDGE_LAT,
//     centerLng: centerLng + GRID_NUDGE_LNG,
//   };
// };

// /** Default zoom: ~350m radius from active Plus Code centroid (700m span ≈ 0.0063° at mid-latitudes). */
// const DEFAULT_MAP_ZOOM_DELTA = 0.0063;

// const INITIAL_REGION: Region = {
//   latitude: 4.1594,
//   longitude: 9.2356,
//   latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//   longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
// };

// export default function NewCreateAddress() {
//   const { user, lang } = useContext(Context) as ContextType;
//   const { isOnline } = useOffline();
//   const queryClient = useQueryClient();
//   const router = useRouter();
//   const insets = useSafeAreaInsets();
//   const params = useLocalSearchParams<{
//     latitude?: string;
//     longitude?: string;
//     plusCode?: string;
//     what3Words?: string;
//     street?: string;
//     city?: string;
//     neighborhood?: string;
//     region?: string;
//     country?: string;
//     countryCode?: string;
//   }>();
//   const calculatedAddress = useAddressStore((s) => s.calculatedAddress);
//   const activeStreet = useStreetSelectionStore((s) => s.activeStreet);
//   const activeStreetDirectionLock = useStreetSelectionStore((s) => s.activeStreetDirectionLock);
//   const resolvedStreetGeometry = useStreetSelectionStore((s) => s.resolvedStreetGeometry);
//   const nearbyStreets = useStreetSelectionStore((s) => s.nearbyStreets);
//   const setActiveStreetData = useStreetSelectionStore((s) => s.setActiveStreetData);
//   const setResolvedStreetGeometry = useStreetSelectionStore((s) => s.setResolvedStreetGeometry);
//   const setActiveStreetDirectionLock = useStreetSelectionStore((s) => s.setActiveStreetDirectionLock);
//   const setActiveStreet = useStreetSelectionStore((s) => s.setActiveStreet);
//   const setCalculatedAddress = useAddressStore((s) => s.setCalculatedAddress);
//   const prefilledFromMapStoreRef = useRef(false);
//   const mapRef = useRef<any>(null);
//   const hasInitiallyCenteredRef = useRef(false); // Track if initial centering has happened
//   const { height: screenHeight } = Dimensions.get('window');

//   // Calculate padding to position location at 25% from top
//   const mapPadding = {
//     top: -250, // 25% from top
//     right: 0,
//     bottom: 0,
//     left: 0,
//   };

//   const [coordinates, setCoordinates] =
//     useState<Location.LocationObjectCoords>();
//   const initialLocationRef = useRef<Location.LocationObjectCoords | undefined>(
//     coordinates,
//   );
//   const [selectedLocation, setSelectedLocation] =
//     useState<Region>(INITIAL_REGION);
//   const [showGrid, setShowGrid] = useState(true); // Default to grid view
//   const [show3D, setShow3D] = useState(false);
//   const [selectedGridRectangle, setSelectedGridRectangle] = useState<{
//     coordinates: Array<{ latitude: number; longitude: number }>;
//   } | null>(null);
//   const [currentPlusCode, setCurrentPlusCode] = useState<string>();
//   const [currentWhat3Words, setCurrentWhat3Words] = useState<string>();
//   const [showCardMarker, setShowCardMarker] = useState(true);
//   const [activeStreetGeometry, setActiveStreetGeometry] = useState<[number, number][]>([]);
//   const [distanceToStreet, setDistanceToStreet] = useState<number | null>(null);
//   const [routeAnimPhase, setRouteAnimPhase] = useState(0);
//   const [mapCameraOffset, setMapCameraOffset] = useState({ x: 0, y: 0 });

//   const [checked, setChecked] = useState(false);
//   const [businessName, setBusinessName] = useState<string>();
//   const [addressCategory, setAddressCategory] = useState<string>();
//   const [houseNumber, setHouseNumber] = useState<string>();
//   const [connection, setConnection] = useState<string>();
//   const [city, setCity] = useState<string>();
//   const [region, setRegion] = useState<string>();
//   const [extension, setExtension] = useState<string>();
//   const [unitNumber, setUnitNumber] = useState<string>();
//   const [unitType, setUnitType] = useState<string>();
//   const [street, setStreet] = useState<string>();
//   const [streetKeyFromGeocode, setStreetKeyFromGeocode] = useState<string | null>(null);
//   const [originalApiStreetName, setOriginalApiStreetName] = useState<string | null>(null);
//   const [originalApiNeighborhood, setOriginalApiNeighborhood] = useState<string | null>(null);
//   const [neighbourhood, setNeighbourhood] = useState<string>();
//   const [country, setCountry] = useState<string>();
//   const [loading, setLoading] = useState(false);
//   const [image, setImage] = useState<ImagePicker.ImagePickerAsset>();
//   const [error, setError] = useState<string>();
//   const [showValidationError, setShowValidationError] = useState(false);
//   const [showSuccessModal, setShowSuccessModal] = useState(false);
//   const [preLoading, setPreLoading] = useState(false);
//   const [visibleToolTip, setVisibleToolTip] = useState<string>();
//   const [isEditingStreet, setIsEditingStreet] = useState(false);
//   const [isEditingCity, setIsEditingCity] = useState(false);
//   const [streetType, setStreetType] = useState<string>('Street');
//   const [regionLabel, setRegionLabel] = useState('Region');
//   const [cityLabel, setCityLabel] = useState('City');
//   const [zipLabel, setZipLabel] = useState('Zip');
//   const [extensionError, setExtensionError] = useState<string>();
//   const [houseNumberError, setHouseNumberError] = useState<string>();
//   const [createAddressResponse, setCreateAddressResponse] = useState<
//     addressesCreateAddressResponse | undefined
//   >(undefined);
//   const [isImagePickerActive, setIsImagePickerActive] = useState(false);
//   const isImagePickerActiveRef = useRef(false);
//   const imagePickerLaunchTime = useRef(0);
//   const isSettingImageRef = useRef(false);

//   const { compressImage } = useCompressedImage(image?.uri ?? '');

//   // Two-step form inside bottom sheet:
//   // Step 1: image + street + neighborhood
//   // Step 2: business name + address category + connection (+ house/unit)
//   const [currentStep, setCurrentStep] = useState<1 | 2>(1);

//   // Upload options
//   const [createUploadLink, setCreateUploadLink] = useState(false);

//   const { mutateAsync: getPlusCode } = useGetPlusCode();
//   const { mutateAsync: getWhat3Words } = useGetWhat3Words();

//   // Function to reset all form fields to initial state
//   const resetForm = () => {
//     setChecked(false);
//     setBusinessName(undefined);
//     setAddressCategory(undefined);
//     setHouseNumber(undefined);
//     setConnection(undefined);
//     setCity(undefined);
//     setRegion(undefined);
//     setExtension(undefined);
//     setUnitNumber(undefined);
//     setUnitType(undefined);
//     setStreet(undefined);
//     setStreetKeyFromGeocode(null);
//     setOriginalApiStreetName(null);
//     setOriginalApiNeighborhood(null);
//     setNeighbourhood(undefined);
//     setCountry(undefined);
//     setImage(undefined);
//     setError(undefined);
//     setShowValidationError(false);
//     setShowSuccessModal(false);
//     setVisibleToolTip(undefined);
//     setIsEditingStreet(false);
//     setIsEditingCity(false);
//     setStreetType('Street');
//     setRegionLabel('Region');
//     setCityLabel('City');
//     setZipLabel('Zip');
//     setExtensionError(undefined);
//     setHouseNumberError(undefined);
//     setCreateAddressResponse(undefined);
//     setCoordinates(undefined);
//   };

//   // Function to refresh location and reset form
//   const refreshLocationAndResetForm = useCallback(
//     async (showFeedback: boolean = false) => {
//       await deleteData('@currentCoordinates');
//       setPreLoading(true);

//       try {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
//           setPreLoading(false);
//           return;
//         }

//         const currentLocation = await Location.getCurrentPositionAsync({});
//         // Snap to G-square grid
//         const snapped = snapToPlusCodeGrid(
//           currentLocation.coords.latitude,
//           currentLocation.coords.longitude,
//         );
//         setCoordinates({
//           ...currentLocation.coords,
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//         });
//         await storeData('@currentCoordinates', {
//           ...currentLocation.coords,
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//         });

//         setSelectedLocation({
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         });

//         // Get plus code and what3words
//         try {
//           const [plusCodeResponse, w3wResponse] = await Promise.all([
//             getPlusCode({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//             getWhat3Words({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//           ]);

//           const plusCode = plusCodeResponse?.plus_code?.global_code;
//           const what3words = w3wResponse?.words;

//           setCurrentPlusCode(plusCode);
//           setCurrentWhat3Words(what3words);

//           // Show rectangle for current location - snap to G-square grid
//           if (plusCode) {
//             const decodedBounds = decodePlusCodeToBounds(plusCode);
//             // Get exact grid cell boundaries for perfect alignment
//             const bounds =
//               decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
//             const snappedCoords = {
//               ...currentLocation.coords,
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             };
//             setCoordinates({
//               ...snappedCoords,
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//             });
//             setSelectedLocation({
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//               latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//               longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//             });
//             setSelectedGridRectangle({
//               coordinates: [
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.maxLng,
//                 },
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.maxLng,
//                 },
//               ],
//             });
//           }
//         } catch (error) {
//           console.warn('Error getting plus code/what3words:', error);
//         }
//       } catch {
//         // TODO: Handle errors if necessary
//       } finally {
//         setPreLoading(false);
//       }
//     },
//     [getPlusCode, getWhat3Words],
//   );

//   const onLocationChangeReset = useCallback((distance: number) => {
//     snackbarToast(
//       `Form reset: You moved ${Math.round(distance)}m from the original location. Please create address for your current location.`,
//       'info',
//     );
//   }, []);

//   // Use platform-specific hooks to handle form reset
//   // Only reset when app goes to background/inactive, not on screen touches or image selection
//   if (Platform.OS === 'android') {
//     const androidFormReset = useCallback(async () => {
//       await refreshLocationAndResetForm(true);
//       router.replace('/(tabs)');
//     }, [refreshLocationAndResetForm, router]);

//     useFormResetOnNavigationAndroid({
//       onFormReset: androidFormReset,
//       shouldResetOnAppStateChange: true, // Only reset when app goes to background
//       shouldResetOnLocationChange: false, // Disable location change resets during form use
//       resetRoute: '/(tabs)',
//       locationChangeThreshold: 50,
//       initialLocation: initialLocationRef.current,
//       onLocationChangeReset,
//       isImagePickerActive,
//       isImagePickerActiveRef,
//       imagePickerLaunchTime,
//     });
//   } else {
//     const iosFormReset = useCallback(async () => {
//       await refreshLocationAndResetForm(true);
//     }, [refreshLocationAndResetForm]);

//     useFormResetOnNavigation({
//       onFormReset: iosFormReset,
//       shouldResetOnFocus: false, // Disable focus reset - don't reload on screen touches
//       shouldResetOnAppStateChange: true, // Only reset when app goes to background/inactive
//       shouldResetOnLocationChange: false, // Disable location change resets during form use
//       resetRoute: '/(tabs)',
//       locationChangeThreshold: 50,
//       initialLocation: initialLocationRef.current,
//       onLocationChangeReset,
//       isImagePickerActive,
//       isImagePickerActiveRef,
//       imagePickerLaunchTime,
//     });
//   }

//   useEffect(() => {
//     const retrieveLocationFromStorage = async () => {
//       isInitializingRef.current = true; // Mark as initializing
//       setPreLoading(true);

//       // When opened from map tab (Create address), use route params as source of truth
//       const paramLat = params.latitude != null ? parseFloat(params.latitude) : NaN;
//       const paramLng = params.longitude != null ? parseFloat(params.longitude) : NaN;
//       if (!Number.isNaN(paramLat) && !Number.isNaN(paramLng)) {
//         const snapped = snapToPlusCodeGrid(paramLat, paramLng);
//         const snappedCoords: Location.LocationObjectCoords = {
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//           altitude: null,
//           accuracy: null,
//           altitudeAccuracy: null,
//           heading: null,
//           speed: null,
//         };
//         await storeData('@currentCoordinates', snappedCoords);
//         setCurrentPlusCode(params.plusCode ?? undefined);
//         setCurrentWhat3Words(params.what3Words ?? undefined);
//         const bounds = getGridCellBounds(snapped.lat, snapped.lng);
//         // Use the same snapped tap point as the map (do NOT use grid center). The map resolved
//         // street/address at this point; using grid center would shift ~7–14m and can miss the street.
//         setCoordinates(snappedCoords);
//         if (!initialLocationRef.current) initialLocationRef.current = snappedCoords;
//         setSelectedLocation({
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         });
//         setSelectedGridRectangle({
//           coordinates: [
//             { latitude: bounds.minLat, longitude: bounds.minLng },
//             { latitude: bounds.maxLat, longitude: bounds.minLng },
//             { latitude: bounds.maxLat, longitude: bounds.maxLng },
//             { latitude: bounds.minLat, longitude: bounds.maxLng },
//           ],
//         });
//         setPreLoading(false);
//         setTimeout(() => {
//           isInitializingRef.current = false;
//           setInitializationComplete(true);
//         }, 1000);
//         return;
//       }

//       const locationCoords = (await readData('@currentCoordinates')) as
//         | Location.LocationObjectCoords
//         | undefined;

//       if (locationCoords) {
//         // Snap to G-square grid
//         const snapped = snapToPlusCodeGrid(
//           locationCoords.latitude,
//           locationCoords.longitude,
//         );
//         const snappedCoords = {
//           ...locationCoords,
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//         };

//         // Get plus code and what3words first
//         let finalCoords = snappedCoords;
//         try {
//           const [plusCodeResponse, w3wResponse] = await Promise.all([
//             getPlusCode({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//             getWhat3Words({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//           ]);

//           const plusCode = plusCodeResponse?.plus_code?.global_code;
//           const what3words = w3wResponse?.words;

//           setCurrentPlusCode(plusCode);
//           setCurrentWhat3Words(what3words);

//           // Show rectangle for current location - snap to G-square grid
//           if (plusCode) {
//             const decodedBounds = decodePlusCodeToBounds(plusCode);
//             // Get exact grid cell boundaries for perfect alignment
//             const bounds =
//               decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
//             // Update final coordinates to grid center (only once)
//             finalCoords = {
//               ...snappedCoords,
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//             };
//             setSelectedLocation({
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//               latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//               longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//             });
//             setSelectedGridRectangle({
//               coordinates: [
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.maxLng,
//                 },
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.maxLng,
//                 },
//               ],
//             });
//           }
//         } catch (error) {
//           console.warn('Error getting plus code/what3words:', error);
//         }

//         // Set coordinates only once after all calculations
//         setCoordinates(finalCoords);
//         if (!initialLocationRef.current) {
//           initialLocationRef.current = finalCoords;
//         }
//         setSelectedLocation({
//           latitude: finalCoords.latitude,
//           longitude: finalCoords.longitude,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         });
//       } else {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
//           return;
//         }

//         const currentLocation = await Location.getCurrentPositionAsync({});
//         // Snap to G-square grid
//         const snapped = snapToPlusCodeGrid(
//           currentLocation.coords.latitude,
//           currentLocation.coords.longitude,
//         );
//         const snappedCoords = {
//           ...currentLocation.coords,
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//         };

//         // Get plus code and what3words first
//         let finalCoords = snappedCoords;
//         try {
//           const [plusCodeResponse, w3wResponse] = await Promise.all([
//             getPlusCode({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//             getWhat3Words({
//               latitude: snapped.lat,
//               longitude: snapped.lng,
//             }),
//           ]);

//           const plusCode = plusCodeResponse?.plus_code?.global_code;
//           const what3words = w3wResponse?.words;

//           setCurrentPlusCode(plusCode);
//           setCurrentWhat3Words(what3words);

//           // Show rectangle for current location - snap to G-square grid
//           if (plusCode) {
//             const decodedBounds = decodePlusCodeToBounds(plusCode);
//             // Get exact grid cell boundaries for perfect alignment
//             const bounds =
//               decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
//             // Update final coordinates to grid center (only once)
//             finalCoords = {
//               ...snappedCoords,
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//             };
//             setSelectedLocation({
//               latitude: bounds.centerLat,
//               longitude: bounds.centerLng,
//               latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//               longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//             });
//             setSelectedGridRectangle({
//               coordinates: [
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.minLng,
//                 },
//                 {
//                   latitude: bounds.maxLat,
//                   longitude: bounds.maxLng,
//                 },
//                 {
//                   latitude: bounds.minLat,
//                   longitude: bounds.maxLng,
//                 },
//               ],
//             });
//           }
//         } catch (error) {
//           console.warn('Error getting plus code/what3words:', error);
//         }

//         // Set coordinates only once after all calculations
//         setCoordinates(finalCoords);
//         if (!initialLocationRef.current) {
//           initialLocationRef.current = finalCoords;
//         }
//         setSelectedLocation({
//           latitude: finalCoords.latitude,
//           longitude: finalCoords.longitude,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         });
//       }
//       setPreLoading(false);

//       // Mark initialization as complete after a short delay to let coordinates stabilize
//       setTimeout(() => {
//         isInitializingRef.current = false;
//         setInitializationComplete(true);
//         console.log('[NewCreateAddress] Initialization complete, address fetching enabled');
//       }, 1000); // 1 second delay to ensure all coordinate updates are done
//     };
//     retrieveLocationFromStorage();
//   }, [getPlusCode, getWhat3Words, params.latitude, params.longitude, params.plusCode, params.what3Words]);

//   // Center map on coordinates ONLY when first set (initial load), offset to show top 0-35%
//   // Does NOT re-center when user drags the map
//   useEffect(() => {
//     if (coordinates && mapRef.current && !hasInitiallyCenteredRef.current) {
//       hasInitiallyCenteredRef.current = true; // Mark as centered to prevent re-centering on drag
//       // Offset camera down so top 0-35% is visible
//       const offsetLatitude = DEFAULT_MAP_ZOOM_DELTA * 0.175; // 17.5% offset down
//       mapRef.current.animateToRegion(
//         {
//           latitude: coordinates.latitude - offsetLatitude, // Move center down
//           longitude: coordinates.longitude,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         },
//         500,
//       );
//     }
//   }, [coordinates?.latitude, coordinates?.longitude]);

//   // Prefill form when opened from map tab: use route params first (exactly what the card showed), then fill gaps from store
//   useEffect(() => {
//     if (prefilledFromMapStoreRef.current) return;
//     const fromMap = params.latitude != null && params.longitude != null;
//     if (!fromMap || !coordinates) return;

//     prefilledFromMapStoreRef.current = true;

//     // 1) Prefill from route params (same data as AddressNotFoundCard / AddressFoundCard)
//     if (params.street?.trim()) setStreet(params.street.trim());
//     if (params.neighborhood?.trim()) setNeighbourhood(params.neighborhood.trim());
//     if (params.city?.trim()) {
//       setCity(params.city.trim());
//       setCityLabel(params.city.trim());
//     }
//     if (params.region?.trim()) setRegion(params.region.trim());
//     if (params.country?.trim()) setCountry(params.country.trim());
//     else if (params.countryCode?.trim()) setCountry(params.countryCode.trim());

//     // 2) Fill gaps from map store (house number, street key, geometry)
//     if (calculatedAddress) {
//       if (calculatedAddress.houseNumber != null) setHouseNumber(calculatedAddress.houseNumber.toString());
//       if (!params.street?.trim() && calculatedAddress.street) setStreet(calculatedAddress.street);
//       if (calculatedAddress.osmData) {
//         if (!params.neighborhood?.trim() && calculatedAddress.osmData.neighborhood) setNeighbourhood(calculatedAddress.osmData.neighborhood);
//         if (!params.city?.trim() && calculatedAddress.osmData.city) {
//           setCity(calculatedAddress.osmData.city);
//           setCityLabel(calculatedAddress.osmData.city);
//         }
//         if (!params.region?.trim() && calculatedAddress.osmData.region) setRegion(calculatedAddress.osmData.region);
//         if (!params.country?.trim() && calculatedAddress.osmData.country) setCountry(calculatedAddress.osmData.country);
//       }
//       if (calculatedAddress.distanceToStreet != null) setDistanceToStreet(calculatedAddress.distanceToStreet);
//     }
//     if (activeStreet?.name && !params.street?.trim() && !calculatedAddress?.street) setStreet(activeStreet.name);
//     if (activeStreetDirectionLock?.streetKey) setStreetKeyFromGeocode(activeStreetDirectionLock.streetKey);
//     const geom = resolvedStreetGeometry?.geometry;
//     if (geom && geom.length >= 2) setActiveStreetGeometry(geom);
//   }, [
//     params.latitude,
//     params.longitude,
//     params.street,
//     params.city,
//     params.neighborhood,
//     params.region,
//     params.country,
//     params.countryCode,
//     coordinates?.latitude,
//     coordinates?.longitude,
//     calculatedAddress,
//     activeStreet,
//     activeStreetDirectionLock,
//     resolvedStreetGeometry,
//   ]);

//   // Offline geocoding for address components
//   const [isLoadingAddressComponents, setIsLoadingAddressComponents] = useState(false);
//   const [addressComponents, setAddressComponents] = useState<any>(null);
//   const fetchingAddressRef = useRef(false);
//   const lastFetchedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
//   const isInitializingRef = useRef(true); // Track if we're still initializing
//   const [initializationComplete, setInitializationComplete] = useState(false);

//   useEffect(() => {
//     const fetchAddressComponents = async () => {
//       // Guard: prevent concurrent fetches
//       if (fetchingAddressRef.current) {
//         console.log('[NewCreateAddress] Skipping fetch - already fetching');
//         return;
//       }

//       // Guard: don't fetch during initialization (wait for coordinates to stabilize)
//       if (isInitializingRef.current || !initializationComplete) {
//         console.log('[NewCreateAddress] Skipping fetch - still initializing');
//         return;
//       }

//       // Guard: check required conditions
//       if (
//         !coordinates?.longitude ||
//         !coordinates?.latitude ||
//         !user?.id ||
//         isImagePickerActive ||
//         isImagePickerActiveRef.current ||
//         isSettingImageRef.current
//       ) {
//         return;
//       }

//       // Guard: prevent fetching same coordinates twice
//       const currentCoords = {
//         lat: coordinates.latitude,
//         lng: coordinates.longitude,
//       };
//       const lastCoords = lastFetchedCoordsRef.current;
//       if (
//         lastCoords &&
//         Math.abs(lastCoords.lat - currentCoords.lat) < 0.000001 &&
//         Math.abs(lastCoords.lng - currentCoords.lng) < 0.000001
//       ) {
//         console.log('[NewCreateAddress] Skipping fetch - same coordinates');
//         return; // Same coordinates, skip fetch
//       }

//       // Mark as fetching and store current coordinates
//       fetchingAddressRef.current = true;
//       lastFetchedCoordsRef.current = currentCoords;
//       console.log('[NewCreateAddress] Fetching address components for:', currentCoords);

//       try {
//         setIsLoadingAddressComponents(true);

//         // Ensure DB is ready before offline geocoding (getAddressComponents + resolveStreetAddress
//         // both use it). Without this, street_segments may be empty on first load and street won't load.
//         await initDB();

//         const components = await getAddressComponents({
//           latitude: coordinates.latitude,
//           longitude: coordinates.longitude,
//           lang,
//         });

//         setAddressComponents(components);

//         // Web parity: single source of truth = resolveStreetAddress at page coordinates (always run, overwrite form)
//         try {
//           console.log('[NewCreateAddress] resolveStreetAddress at page coords (canonical)', coordinates.latitude, coordinates.longitude, 'maxDist 60m');
//           const streetAddress = await resolveStreetAddress(
//             coordinates.latitude,
//             coordinates.longitude,
//             60
//           );

//           const streetNameFromResult = streetAddress.street?.name ?? streetAddress.activeStreet?.name ?? '';
//           const hasActive = !!(streetAddress.activeStreet?.geometry?.length);
//           console.log('[NewCreateAddress] resolveStreetAddress result:', {
//             hasActiveStreet: !!streetAddress.activeStreet,
//             geometryLength: streetAddress.activeStreet?.geometry?.length ?? 0,
//             streetName: streetNameFromResult,
//             distance: streetAddress.activeStreet?.distance ?? streetAddress.street?.distance,
//           });

//           // Canonical form fill from resolve result (same as web CreateAddressPage)
//           if (streetNameFromResult) setStreet(streetNameFromResult);
//           if (streetAddress.houseNumber != null) setHouseNumber(streetAddress.houseNumber.toString());
//           else setHouseNumber(''); // No valid projection → clear so we don't show stale "0"
//           if (streetAddress.streetKey) setStreetKeyFromGeocode(streetAddress.streetKey);

//           const admin = streetAddress.admin;
//           if (admin?.neighborhood) setNeighbourhood(admin.neighborhood);
//           if (admin?.city) {
//             setCity(admin.city);
//             setCityLabel(admin.city);
//           }
//           if (admin?.region) setRegion(admin.region);
//           if (admin?.country) setCountry(admin.country);

//           if (hasActive && streetAddress.activeStreet) {
//             setActiveStreetGeometry(streetAddress.activeStreet.geometry);
//             setDistanceToStreet(streetAddress.activeStreet.distance ?? null);
//           } else {
//             setActiveStreetGeometry([]);
//             setDistanceToStreet(streetAddress.street?.distance ?? null);
//           }

//           // Sync map store so StreetDirectionInfo and other store consumers see direction lock
//           syncMapStoreFromResolveResult(streetAddress, {
//             latitude: coordinates.latitude,
//             longitude: coordinates.longitude,
//           }).catch((syncErr) => {
//             console.warn('[NewCreateAddress] syncMapStoreFromResolveResult failed:', syncErr);
//           });

//           // Original API values for edit detection (web parity; used for future dual-address)
//           if (streetNameFromResult && !streetAddress.street?.isUnnamed && !streetAddress.activeStreet?.isUnnamed) {
//             setOriginalApiStreetName(streetNameFromResult);
//           } else {
//             setOriginalApiStreetName(null);
//           }
//           if (admin?.neighborhood) setOriginalApiNeighborhood(admin.neighborhood);
//           else setOriginalApiNeighborhood(null);
//         } catch (resolveErr) {
//           console.warn('[NewCreateAddress] resolveStreetAddress failed, keeping getAddressComponents data', resolveErr);
//           const newCountry = components?.country ?? components?.country_code ?? '';
//           const newCity = components?.city ?? '';
//           const newNeighbourhood = formatNeighborhood(components?.neighborhood ?? '', STREET_TYPES, lang);
//           const newStreet = components?.street_name ?? '';
//           const newRegion = components?.state ?? '';
//           if (newCountry) setCountry(newCountry);
//           if (newCity) { setCity(newCity); setCityLabel(newCity); }
//           if (newNeighbourhood) setNeighbourhood(newNeighbourhood);
//           if (newStreet) setStreet(newStreet);
//           if (newRegion) setRegion(newRegion);
//         }
//       } catch (error) {
//         console.log('[NewCreateAddress] Failed to geocode address:', error);
//         // Fallback: try to use expo-location reverse geocoding
//         try {
//           const location = await Location.reverseGeocodeAsync({
//             latitude: coordinates.latitude,
//             longitude: coordinates.longitude,
//           });
//           if (location && location.length > 0) {
//             const loc = location[0];
//             const fallbackCountry = loc.countryCode ?? '';
//             const fallbackCity = loc.city ?? loc.town ?? loc.village ?? '';
//             const fallbackNeighbourhood = loc.district ?? loc.subregion ?? '';
//             const fallbackStreet = loc.street ?? '';
//             const fallbackRegion = loc.region ?? '';

//             // Only update if values changed (handle undefined safely)
//             if (fallbackCountry !== (country ?? '')) setCountry(fallbackCountry);
//             if (fallbackCity !== (city ?? '')) {
//               setCity(fallbackCity);
//               setCityLabel(fallbackCity);
//             }
//             if (fallbackNeighbourhood !== (neighbourhood ?? '')) setNeighbourhood(fallbackNeighbourhood);
//             if (fallbackStreet !== (street ?? '')) setStreet(fallbackStreet);
//             if (fallbackRegion !== (region ?? '')) setRegion(fallbackRegion);
//           }
//         } catch (fallbackError) {
//           console.log('[NewCreateAddress] Fallback geocoding also failed:', fallbackError);
//         }
//       } finally {
//         setIsLoadingAddressComponents(false);
//         fetchingAddressRef.current = false;
//       }
//     };

//     fetchAddressComponents();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [coordinates?.latitude, coordinates?.longitude, user?.id, lang, isImagePickerActive, initializationComplete]);

//   // Animate active street ("marching ants" forward looped effect)
//   // Using slower updates to prevent glitching during map interaction
//   useEffect(() => {
//     if (!activeStreetGeometry || activeStreetGeometry.length < 2) {
//       return;
//     }

//     // Match web street-marching-ants: dasharray "12 6", 0.8s cycle
//     // Simulate by cycling lineDasharray [12*(1-phase), 6+12*phase], phase 0→1
//     let phase = 0;
//     const msPerTick = 50;
//     const cycleMs = 800;
//     const step = msPerTick / cycleMs;

//     const interval = setInterval(() => {
//       phase = (phase + step) % 1;
//       setRouteAnimPhase(phase);
//     }, msPerTick);

//     return () => clearInterval(interval);
//   }, [activeStreetGeometry]);

//   const handlePickStreet = useCallback(
//     async (selected: ActiveStreetData) => {
//       if (!coordinates?.latitude || !coordinates?.longitude) return;
//       const streetForCalc = activeStreetDataToStreet(selected);
//       const streetKey = createStreetKey(streetForCalc);
//       const directionLock = await getDirectionLock(streetKey);
//       const nearbyAsStreet: Street[] = nearbyStreets
//         .filter((s) => s.segment_id !== selected.segment_id)
//         .map((s) => activeStreetDataToStreet(s));
//       // Web parity: do NOT pass directionLock into house number calc (web CreateAddressPage uses no options on street change)
//       const calculated = calculateHouseNumberSync(
//         coordinates.latitude,
//         coordinates.longitude,
//         streetForCalc,
//         { nearbyStreets: nearbyAsStreet }
//       );
//       setStreet(selected.name);
//       setStreetKeyFromGeocode(streetKey);
//       setActiveStreetGeometry(selected.geometry);
//       setDistanceToStreet(selected.distance ?? null);
//       setHouseNumber(calculated?.houseNumber?.toString() ?? '');
//       const resolved = resolveStreetGeometry(streetForCalc, directionLock);
//       setActiveStreetData(selected);
//       setResolvedStreetGeometry(resolved);
//       setActiveStreetDirectionLock(directionLock);
//       setActiveStreet(streetForCalc);
//       setCalculatedAddress(calculated ?? null);
//     },
//     [
//       coordinates?.latitude,
//       coordinates?.longitude,
//       nearbyStreets,
//     ]
//   );

//   const handleTakePhoto = () => {
//     imagePickerLaunchTime.current = Date.now();
//     isImagePickerActiveRef.current = true;
//     setIsImagePickerActive(true);
//     takePhoto();
//   };

//   const takePhoto = async () => {
//     try {
//       const { status } = await ImagePicker.requestCameraPermissionsAsync();
//       if (status !== 'granted') {
//         isImagePickerActiveRef.current = false;
//         setIsImagePickerActive(false);
//         Alert.alert(
//           i18n.t('add-home-address.permissionDenied'),
//           i18n.t('add-home-address.allowAccessToCamera'),
//         );
//         return;
//       }

//       const result = await ImagePicker.launchCameraAsync({
//         mediaTypes: ['images'],
//         allowsEditing: true,
//         quality: 1,
//       });

//       if (!result.canceled) {
//         // Mark that we're setting an image to prevent loader from showing
//         isSettingImageRef.current = true;
//         setImage(result.assets[0]);
//         // Reset after image is set
//         setTimeout(() => {
//           isSettingImageRef.current = false;
//         }, 300);
//       }
//     } catch (error) {
//       console.warn('Error taking photo:', error);
//     } finally {
//       // Only reset if image wasn't selected (user canceled)
//       // If image was selected, it's already handled in the if block above
//       if (!image) {
//         setTimeout(() => {
//           isImagePickerActiveRef.current = false;
//           setIsImagePickerActive(false);
//         }, 500);
//       }
//     }
//   };

//   const handleExtensionChange = (value: string | undefined) => {
//     if (!value) {
//       setExtension(undefined);
//       setExtensionError(undefined);
//       return;
//     }

//     const letterValue = value.replace(/[^a-zA-Z]/g, '').toUpperCase();

//     if (letterValue.length > 1) {
//       setExtensionError('Extension must be a single letter');
//       return;
//     }

//     setExtensionError(undefined);
//     setExtension(letterValue);
//   };

//   const handleHouseNumberChange = (value: string | undefined) => {
//     if (!value) {
//       setHouseNumber(undefined);
//       setHouseNumberError(undefined);
//       return;
//     }

//     const numericValue = value.replace(/[^0-9]/g, '');

//     if (numericValue.length > 6) {
//       setHouseNumberError('House number cannot exceed 6 digits');
//       return;
//     }

//     setHouseNumberError(undefined);
//     setHouseNumber(numericValue);
//   };

//   const handleCreateAddress = async () => {
//     try {
//       setShowValidationError(true);
//       // Require an image before submitting
//       if (!image?.uri) {
//         setError(i18n.t('add-home-address.uploadImageRequired'));
//         await delay(3000);
//         setError(undefined);
//         return;
//       }
//       if (!checked) {
//         setError(i18n.t('add-home-address.pleaseCheck'));
//         await delay(3000);
//         setError(undefined);
//         return;
//       }

//       if (extensionError || houseNumberError) return;

//       if (
//         !(
//           (addressCategory && houseNumber && street && neighbourhood && region && connection)
//           // && city
//           // && connection
//           //  &&
//           // country
//         )
//       )
//         return;

//       let imageUri = '';

//       if (image?.uri) {
//         imageUri = await compressImage();
//       }

//       // Ensure database is initialized
//       await initDB();

//       // Check if address already exists at this location
//       try {
//         const addressCheck = await checkLocationAddress({
//           lat: coordinates.latitude,
//           lng: coordinates.longitude,
//           isOnline,
//           offlineReverseGeocode: async (lat, lng) => {
//             const result = await offlineReverseGeocode(lat, lng, { cameroonTuning: true });
//             return result.address;
//           },
//           onlineReverseGeocode: isOnline ? async (lat, lng) => {
//             try {
//               const location = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
//               if (location && location.length > 0) {
//                 const loc = location[0];
//                 return {
//                   road: loc.street || null,
//                   houseNumber: null,
//                   city: loc.city || loc.town || loc.village || null,
//                   neighborhood: loc.district || loc.subregion || null,
//                   region: loc.region || null,
//                   country: loc.country || null,
//                   country_code: loc.countryCode || null,
//                 };
//               }
//             } catch (error) {
//               console.warn('[NewCreateAddress] Online geocoding failed:', error);
//             }
//             return null;
//           } : undefined,
//         });

//         // If address already exists, warn user
//         if (addressCheck.status === 'FOUND') {
//           if (addressCheck.jangoMatch) {
//             Alert.alert(
//               'Address Already Exists',
//               'An address already exists at this location in JanGo. Do you want to continue creating a new address?',
//               [
//                 { text: 'Cancel', style: 'cancel' },
//                 { text: 'Continue', onPress: () => proceedWithCreation(imageUri) },
//               ]
//             );
//             return;
//           } else if (addressCheck.externalCandidate && addressCheck.externalCandidate.houseNumber) {
//             Alert.alert(
//               'Address May Already Exist',
//               `An address (${addressCheck.externalCandidate.houseNumber} ${addressCheck.externalCandidate.road}) may already exist at this location according to ${addressCheck.externalCandidate.source === 'online_osm' ? 'OpenStreetMap' : 'offline data'}. Do you want to continue?`,
//               [
//                 { text: 'Cancel', style: 'cancel' },
//                 { text: 'Continue', onPress: () => proceedWithCreation(imageUri) },
//               ]
//             );
//             return;
//           }
//         }
//       } catch (checkError) {
//         console.warn('[NewCreateAddress] Address check failed, proceeding anyway:', checkError);
//       }

//       // Proceed with address creation
//       await proceedWithCreation(imageUri);
//     } catch (error: any) {
//       setLoading(false);
//       const errorMessage = error?.message || i18n.t('add-home-address.unknownError');
//       setError(`${i18n.t('add-home-address.errorCreatingAddress')}: ${errorMessage}`);
//       await delay(5000);
//       setError(undefined);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const proceedWithCreation = async (imageUri: string) => {
//     try {
//       // Ensure database is initialized
//       await initDB();

//       // Convert form data to Address schema
//       const createAddressData: addressesCreateAddressRequest = {
//         image: imageUri,
//         latitude: (coordinates?.latitude ?? 0)?.toString(),
//         longitude: (coordinates?.longitude ?? 0)?.toString(),
//         unit_number: unitNumber,
//         unit_type: unitType as string,
//         house_plot_nbr: houseNumber,
//         house_plot_extension: extension,
//         userSSName: street,
//         userSSType: streetType,
//         userSNName: neighbourhood,
//         userSCity: city,
//         userSRegion: region,
//         address_category: addressCategory,
//         connection: connection ?? '',
//       };

//       if (businessName) {
//         createAddressData.business_name = businessName;
//       }

//       // Convert to Address schema
//       const addressData = convertRequestToAddress(createAddressData, user?.id);

//       // Use SyncManager to create address (works offline)
//       const createdAddress = await SyncManager.createAddress(addressData);

//       // Auto-lock street direction on first address (SRD: consistent numbering)
//       const streetKey = streetKeyFromGeocode ?? normalizeStreetKey(street ?? '', city ?? '');
//       if (streetKey) {
//         try {
//           await autoLockOnFirstAddress(streetKey, user?.id);
//         } catch (lockErr) {
//           console.warn('[NewCreateAddress] autoLockOnFirstAddress failed:', lockErr);
//         }
//       }

//       // Success - show success modal
//       setCreateAddressResponse({
//         message: i18n.t('add-home-address.yourAddressHasBeenCreated'),
//         address: {
//           id: createdAddress.id,
//           latitude: createdAddress.latitude.toString(),
//           longitude: createdAddress.longitude.toString(),
//           global_code: createdAddress.plus_code,
//           formatted_address: `${createdAddress.house_number}${createdAddress.extension || ''} ${createdAddress.street_name}${createdAddress.street_type ? ` ${createdAddress.street_type}` : ''}, ${createdAddress.neighborhood || ''}, ${createdAddress.city}, ${createdAddress.region}`,
//           address_components: {
//             house_number: createdAddress.house_number.toString(),
//             road: createdAddress.street_name,
//             neighbourhood: createdAddress.neighborhood,
//             city: createdAddress.city,
//             county: createdAddress.region,
//             country: createdAddress.country,
//           },
//         },
//       });

//       setShowSuccessModal(true);

//       // Clear form
//       setChecked(false);
//       setBusinessName(undefined);
//       setAddressCategory(undefined);
//       setHouseNumber(undefined);
//       setExtension(undefined);
//       setUnitNumber(undefined);
//       setUnitType(undefined);
//       setImage(undefined);
//       setError(undefined);
//       setShowValidationError(false);
//       setNeighbourhood(undefined);
//       setExtensionError(undefined);
//       setHouseNumberError(undefined);

//       // Invalidate the addresses cache
//       queryClient.invalidateQueries({
//         queryKey: ['/addresses/my-jango-addresses'],
//       });
//       queryClient.invalidateQueries({
//         queryKey: ['/addresses/my-alias-addresses'],
//       });
//     } catch (error: any) {
//       setLoading(false);
//       const errorMessage = error?.message || i18n.t('add-home-address.unknownError');
//       setError(`${i18n.t('add-home-address.errorCreatingAddress')}: ${errorMessage}`);
//       await delay(5000);
//       setError(undefined);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Initialize SyncManager on mount
//   useEffect(() => {
//     const initSync = async () => {
//       try {
//         await SyncManager.init();
//       } catch (error) {
//         console.log('[NewCreateAddress] Failed to initialize SyncManager:', error);
//       }
//     };
//     initSync();
//   }, []);

//   useEffect(() => {
//     const backAction = () => {
//       router.replace('/(tabs)');
//       return true;
//     };

//     const backHandler = BackHandler.addEventListener(
//       'hardwareBackPress',
//       backAction,
//     );

//     return () => backHandler.remove();
//   }, [router]);

//   useEffect(() => {
//     const regionZip = getRegionZip(country, lang);
//     setRegionLabel(regionZip.region);
//     setZipLabel(regionZip.zip);
//   }, [lang, country]);

//   useEffect(() => {
//     return () => {
//       isImagePickerActiveRef.current = false;
//       setIsImagePickerActive(false);
//     };
//   }, []);

//   // Map controls
//   const handleToggleGrid = () => {
//     setShowGrid(prev => !prev);
//     // Don't clear the rectangle when toggling grid - it should stay visible
//   };

//   const handleToggle3D = () => {
//     setShow3D(prev => !prev);
//   };

//   const handleZoomIn = () => {
//     if (mapRef.current) {
//       mapRef.current.getCamera().then(camera => {
//         mapRef.current?.animateCamera({
//           center: camera.center,
//           zoom: (camera.zoom || 15) + 1,
//         });
//       });
//     }
//   };

//   const handleZoomOut = () => {
//     if (mapRef.current) {
//       mapRef.current.getCamera().then(camera => {
//         mapRef.current?.animateCamera({
//           center: camera.center,
//           zoom: Math.max((camera.zoom || 15) - 1, 0),
//         });
//       });
//     }
//   };

//   const handleCenterLocation = async () => {
//     if (coordinates) {
//       if (mapRef.current) {
//         // Offset camera down so top 0-35% is visible for animations
//         const offsetLatitude = DEFAULT_MAP_ZOOM_DELTA * 0.175; // 17.5% offset down
//         mapRef.current.animateToRegion(
//           {
//             latitude: coordinates.latitude - offsetLatitude, // Move center down
//             longitude: coordinates.longitude,
//             latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//             longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           },
//           500,
//         );
//       }
//     } else {
//       try {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
//           return;
//         }

//         const currentLocation = await Location.getCurrentPositionAsync({});
//         // Snap to G-square grid
//         const snapped = snapToPlusCodeGrid(
//           currentLocation.coords.latitude,
//           currentLocation.coords.longitude,
//         );
//         setCoordinates({
//           ...currentLocation.coords,
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//         });
//         setSelectedLocation({
//           latitude: snapped.lat,
//           longitude: snapped.lng,
//           latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//           longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//         });

//         if (mapRef.current) {
//           // Offset camera down so top 0-35% is visible for animations
//           const offsetLatitude = DEFAULT_MAP_ZOOM_DELTA * 0.175; // 17.5% offset down
//           mapRef.current.animateToRegion(
//             {
//               latitude: snapped.lat - offsetLatitude, // Move center down
//               longitude: snapped.lng,
//               latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//               longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//             },
//             500,
//           );
//         }
//       } catch (error) {
//         console.warn('Error getting location:', error);
//       }
//     }
//   };

//   const displayAddressText = parseFormattedAddress(
//     createAddressResponse?.address?.formatted_address ?? '',
//   );
//   const formatedLength = Object.keys(displayAddressText).length;

//   // Get business name from address components

//   // Memoize centerLocation to prevent unnecessary re-renders of MapViewMapLibre
//   const memoizedCenterLocation = useMemo(
//     () =>
//       coordinates
//         ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
//         : null,
//     [coordinates?.latitude, coordinates?.longitude]
//   );

//   // Memoize active street GeoJSON shape to prevent recreation on animation ticks
//   const activeStreetShape = useMemo(() => {
//     if (!activeStreetGeometry || activeStreetGeometry.length < 2) return null;
//     return {
//       type: 'Feature' as const,
//       geometry: {
//         type: 'LineString' as const,
//         coordinates: activeStreetGeometry,
//       },
//       properties: {},
//     };
//   }, [activeStreetGeometry]);

//   return (
//     <>
//       <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         {/* Map View */}
//         <MapViewMapLibre
//           style={styles.map}
//           ref={mapRef}
//           initialRegion={INITIAL_REGION}
//           showGrid={showGrid}
//           selectedGridRectangle={selectedGridRectangle}
//           centerLocation={memoizedCenterLocation}
//           animateGridPulse
//           scrollEnabled={false}
//           zoomEnabled={false}
//         >
//           {/* Active street – marching ants (match web ActiveStreetLayer) */}
//           {activeStreetShape && (
//             <>
//               {/* White outline – web strokeWidth STREET_WIDTH + 4 */}
//               <ShapeSource id="active-street-outline" shape={activeStreetShape}>
//                 <LineLayer
//                   id="active-street-outline-layer"
//                   style={{
//                     lineColor: '#FFFFFF',
//                     lineWidth: 8,
//                     lineOpacity: 0.9,
//                     lineCap: 'round',
//                     lineJoin: 'round',
//                   }}
//                 />
//               </ShapeSource>
//               {/* Marching ants: dash 12, gap 6. Cycle [12*(1-phase), 6+12*phase] */}
//               <ShapeSource id="active-street" shape={activeStreetShape}>
//                 <LineLayer
//                   id="active-street-line"
//                   style={{
//                     lineColor: '#0000EE',
//                     lineWidth: 4,
//                     lineDasharray: [
//                       Math.max(0.5, 12 * (1 - routeAnimPhase)),
//                       6 + 12 * routeAnimPhase,
//                     ],
//                     lineOpacity: 1,
//                     lineCap: 'round',
//                     lineJoin: 'round',
//                   }}
//                 />
//               </ShapeSource>
//             </>
//           )}
//           {coordinates && (
//             <MapLibreMarker
//               coordinate={{
//                 latitude: coordinates.latitude,
//                 longitude: coordinates.longitude,
//               }}
//               pinColor={Colors.primary[500]}
//               draggable={!showGrid}
//               tappable={true}
//               onPress={() => {
//                 // Toggle card marker visibility when clicking the pin
//                 setShowCardMarker(!showCardMarker);
//               }}
//               onDragEnd={async e => {
//                 const newCoordinates = e.nativeEvent.coordinate;
//                 // Snap to G-square grid
//                 const snapped = snapToPlusCodeGrid(
//                   newCoordinates.latitude,
//                   newCoordinates.longitude,
//                 );
//                 setCoordinates({
//                   latitude: snapped.lat,
//                   longitude: snapped.lng,
//                   altitude: null,
//                   accuracy: null,
//                   altitudeAccuracy: null,
//                   heading: null,
//                   speed: null,
//                 });
//                 setSelectedLocation({
//                   latitude: snapped.lat,
//                   longitude: snapped.lng,
//                   latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//                   longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//                 });

//                 // Update plus code and what3words for new location
//                 try {
//                   const [plusCodeResponse, w3wResponse] = await Promise.all([
//                     getPlusCode({
//                       latitude: snapped.lat,
//                       longitude: snapped.lng,
//                     }),
//                     getWhat3Words({
//                       latitude: snapped.lat,
//                       longitude: snapped.lng,
//                     }),
//                   ]);

//                   const plusCode = plusCodeResponse?.plus_code?.global_code;
//                   const what3words = w3wResponse?.words;

//                   setCurrentPlusCode(plusCode);
//                   setCurrentWhat3Words(what3words);

//                   // Update rectangle for new location - snap to G-square grid
//                   if (plusCode) {
//                     // Get exact grid cell boundaries for perfect alignment
//                     const decodedBounds = decodePlusCodeToBounds(plusCode);
//                     const bounds =
//                       decodedBounds ?? getGridCellBounds(snapped.lat, snapped.lng);
//                     setCoordinates({
//                       latitude: bounds.centerLat,
//                       longitude: bounds.centerLng,
//                       altitude: null,
//                       accuracy: null,
//                       altitudeAccuracy: null,
//                       heading: null,
//                       speed: null,
//                     });
//                     setSelectedLocation({
//                       latitude: bounds.centerLat,
//                       longitude: bounds.centerLng,
//                       latitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//                       longitudeDelta: DEFAULT_MAP_ZOOM_DELTA,
//                     });
//                     setSelectedGridRectangle({
//                       coordinates: [
//                         {
//                           latitude: bounds.minLat,
//                           longitude: bounds.minLng,
//                         },
//                         {
//                           latitude: bounds.maxLat,
//                           longitude: bounds.minLng,
//                         },
//                         {
//                           latitude: bounds.maxLat,
//                           longitude: bounds.maxLng,
//                         },
//                         {
//                           latitude: bounds.minLat,
//                           longitude: bounds.maxLng,
//                         },
//                       ],
//                     });
//                   }
//                 } catch (error) {
//                   console.warn('Error getting plus code/what3words:', error);
//                 }
//               }}
//             />
//           )}

          
//         </MapViewMapLibre>

//         {/* Map Controls */}
//         <MapControls
//           mapRef={mapRef}
//           showGrid={showGrid}
//           onToggleGrid={handleToggleGrid}
//           onZoomIn={handleZoomIn}
//           onZoomOut={handleZoomOut}
//           onToggle3D={handleToggle3D}
//           onCenterLocation={handleCenterLocation}
//           show3D={show3D}
//           top="15%"
//         />

//         {/* Live Preview Card is now shown as a marker on the map above */}

//         {/* Form Section - Bottom Sheet */}
//         <KeyboardAvoidingView
//           style={styles.formContainer}
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
//           <TouchableWithoutFeedback
//             onPress={Keyboard.dismiss}
//             accessible={false}>
//             <KeyboardAwareScrollView
//               style={styles.formScrollView}
//               contentContainerStyle={styles.formContent}
//               enableOnAndroid={true}
//               keyboardShouldPersistTaps="handled"
//               showsVerticalScrollIndicator={false}>
//               {/* Sheet header */}
//               <View style={styles.formHeader}>
//                 <Text style={styles.formHeaderText}>
//                   {i18n.t('add-home-address.createAJanGoAddress')}
//                 </Text>
//                 <TouchableOpacity
//                   onPress={() => router.replace('/(tabs)')}
//                   style={styles.closeButton}>
//                   <Icon source={'close'} size={24} color={Colors.light[10]} />
//                 </TouchableOpacity>
//               </View>

//               <View style={styles.headerCardTopRow}>
//                 <Text style={styles.headerTabActive}>
//                   {i18n.t('add-home-address.addressInformation') || 'Address Information'}
//                 </Text>
//                 <View style={styles.autoGeneratedPill}>
//                   <Text style={styles.autoGeneratedText}>
//                     {i18n.t('add-home-address.autoGenerated') || '✨ Auto-Generated'}
//                   </Text>
//                 </View>
//               </View>

//               <View style={styles.headerCardSeparator} />

//               {/* Header card with live text preview */}
//               <View style={styles.headerCard}>
//                 {/* Show business name when entering it (Step 2) */}
//                 {businessName != null && businessName.trim() !== '' && (

//                   <Text style={styles.headerBusinessNameValue} numberOfLines={1} ellipsizeMode="tail">
//                     {businessName.trim()}
//                   </Text>
//                 )}
//                 <View style={styles.headerAddressText}>
//                   <Text style={styles.headerAddressLine1}>
//                     {`${houseNumber?.trim() ? `${houseNumber}${extension ?? ''}` : '—'} ${street || i18n.t('add-home-address.unnamedStreet')
//                       }`}
//                   </Text>
//                   {(neighbourhood || city) && (
//                     <Text style={styles.headerAddressLine2}>
//                       {[neighbourhood, city].filter(Boolean).join(', ')}
//                     </Text>
//                   )}
//                   {(region || country) && (
//                     <Text style={styles.headerAddressLine3}>
//                       {formatRegionCountryPair(region, country)}
//                     </Text>
//                   )}
//                 </View>
//               </View>

              

//               {/* Step indicator */}
//               <View style={styles.stepIndicator}>
//                 <Text style={styles.stepIndicatorText}>
//                   {i18n.t('common.step')} {currentStep} / 2
//                 </Text>
//               </View>

//               {/* Step 1: image + street + neighborhood */}
//               {currentStep === 1 && (
//                 <>
//                   {/* Upload image row - web-style card */}
//                   <View style={styles.uploadRow}>
//                     <TouchableOpacity
//                       style={styles.uploadCard}
//                       onPress={handleTakePhoto}>
//                       {image ? (
//                         <>
//                           <Image
//                             source={{ uri: image.uri }}
//                             style={styles.uploadCardImage}
//                           />
//                           <Text style={styles.uploadChangeText}>
//                             {i18n.t('add-home-address.change') || 'Change'}
//                           </Text>
//                         </>
//                       ) : (
//                         <>
//                           <Icon
//                             source="upload"
//                             size={20}
//                             color={Colors.primary[500]}
//                           />
//                           <Text style={styles.uploadTitleText}>
//                             {i18n.t('add-home-address.uploadImage') || 'Upload Image'}
//                           </Text>
//                           <Text style={styles.uploadSubtitleText}>
//                             {i18n.t('add-home-address.uploadImageFormats') || 'PNG, JPG'}
//                           </Text>
//                         </>
//                       )}
//                     </TouchableOpacity>

//                     <View style={styles.uploadMeta}>
//                       <Text style={styles.uploadLabelText}>
//                         {i18n.t('add-home-address.uploadImageLabel') || 'UPLOAD IMAGE'}
//                         <Text style={styles.requiredAsterisk}> *</Text>
//                       </Text>

//                     </View>
//                   </View>

//                   {/* Location fields */}
//                   <View style={styles.formFieldsContainer}>
//                     <InputComponent
//                       icon={require('@/assets/images/ic_street.png')}
//                       title1={i18n.t('add-home-address.street')}
//                       required
//                       placeHolder1={i18n.t('add-home-address.street')}
//                       value1={street}
//                       setValue1={setStreet}
//                       defaultDisabled={true}
//                       onPress={() => setIsEditingStreet(true)}
//                       isEditing={isEditingStreet}
//                       editable
//                       error={i18n.t('add-home-address.pleaseEnterAStreet')}
//                       showError={showValidationError && !street}
//                     />
//                     <InputComponent
//                       icon={require('@/assets/images/ic_neighbour.png')}
//                       title1={zipLabel}
//                       required
//                       placeHolder1={`${i18n.t('add-home-address.enter')}${zipLabel}`}
//                       value1={neighbourhood}
//                       setValue1={setNeighbourhood}
//                       onDone={() => {
//                         setNeighbourhood(prev =>
//                           formatNeighborhood(prev ?? '', STREET_TYPES, lang),
//                         );
//                       }}
//                       editable
//                       error={`${i18n.t('add-home-address.pleaseEnterA')}${zipLabel}`}
//                       showError={showValidationError && !neighbourhood}
//                     />
//                     {/* <Text style={styles.cityRegionCountryText}>
//                       {city} {region}, {country}
//                     </Text> */}
//                   </View>
//                 </>
//               )}

//               {/* Step 2: business name, property type, connection, house/unit */}
//               {currentStep === 2 && (
//                 <View style={styles.formFieldsContainer}>
//                   <InputComponent
//                     icon={require('@/assets/images/ic_building.png')}
//                     optional
//                     title1={i18n.t('add-home-address.businessName')}
//                     placeHolder1={i18n.t('add-home-address.enterBusinessName')}
//                     value1={businessName}
//                     setValue1={setBusinessName}
//                     tooltip={i18n.t('add-home-address.ifThisAddressIs')}
//                     toolTipVisible={visibleToolTip === 'business_name'}
//                     onToggleTooltip={() => {
//                       visibleToolTip === 'business_name'
//                         ? setVisibleToolTip(undefined)
//                         : setVisibleToolTip('business_name');
//                     }}
//                   />
//                   <AddressCategoryDropdown
//                     label={i18n.t('add-home-address.addressCategory')}
//                     value={addressCategory}
//                     onChange={value => setAddressCategory(value)}
//                     placeholder={i18n.t('add-home-address.selectAddressCategory')}
//                     error={i18n.t('add-home-address.pleaseSelectAddressCategory')}
//                     showError={showValidationError && !addressCategory}
//                     onClose={() => { }}
//                   />
//                   <InputComponent
//                     icon={require('@/assets/images/connections.png')}
//                     title1={i18n.t('add-home-address.connection') || 'Connection'}
//                     required
//                     placeHolder1={
//                       i18n.t('add-home-address.selectConnection') ||
//                       'Select Connection'
//                     }
//                     value1={connection}
//                     setValue1={setConnection}
//                     options1={CONNECTIONS.map(conn => ({
//                       label:
//                         lang === 'pt'
//                           ? conn.Portuguese
//                           : lang === 'fr'
//                             ? conn.French
//                             : conn.English,
//                       value:
//                         lang === 'pt'
//                           ? conn.Portuguese
//                           : lang === 'fr'
//                             ? conn.French
//                             : conn.English,
//                     }))}
//                   />
//                   {/* House/plot number and extension inputs – commented out for now */}
//                   {/* <InputComponent
//                     icon={require('@/assets/images/house_number.png')}
//                     title1={i18n.t('add-home-address.housePlotNumber')}
//                     title2={i18n.t('add-home-address.extension')}
//                     required
//                     maxLength1={6}
//                     placeHolder1={i18n.t('add-home-address.enterNumber')}
//                     value1={houseNumber}
//                     setValue1={handleHouseNumberChange}
//                     inputMode1="numeric"
//                     placeHolder2={i18n.t('add-home-address.enterExtension')}
//                     value2={extension}
//                     setValue2={handleExtensionChange}
//                     maxLength2={1}
//                     tooltip={i18n.t('add-home-address.aLetterCanBe')}
//                     toolTipVisible={visibleToolTip === 'extension'}
//                     onToggleTooltip={() => {
//                       visibleToolTip === 'extension'
//                         ? setVisibleToolTip(undefined)
//                         : setVisibleToolTip('extension');
//                     }}
//                     error={
//                       houseNumberError
//                         ? houseNumberError
//                         : extensionError
//                           ? extensionError
//                           : i18n.t('add-home-address.pleaseEnterAHouseNumber')
//                     }
//                     showError={
//                       !!houseNumberError ||
//                       !!extensionError ||
//                       (showValidationError && !houseNumber)
//                     }
//                   /> */}
//                   {/* Optional unit type/number could be added here if needed */}
//                 </View>
//               )}

//               {/* Footer with step navigation */}
//               <View style={styles.footer}>
//                 {currentStep === 1 ? (
//                   // <View style={styles.footerButtonContainer}>
//                     <Button
//                       mode="contained"
//                       buttonColor={Colors.primary['500']}
//                       style={styles.footerButtonContainer}
//                       disabled={!street || !neighbourhood}
//                       onPress={() => setCurrentStep(2)}>
//                       <Text style={styles.buttonText}>
//                         {i18n.t('common.next') || 'Next'}
//                       </Text>
//                     </Button>
//                   // </View>
//                 ) : (
//                   <>
//                     <View style={defaultStyles.checkboxContainer}>
//                       <Checkbox.Android
//                         status={checked ? 'checked' : 'unchecked'}
//                         onPress={() => setChecked(prev => !prev)}
//                         color={Colors.primary[500]}
//                         uncheckedColor={Colors.error}
//                       />
//                       <Text
//                         style={[
//                           defaultStyles.checkboxText,
//                           !checked && { color: Colors.error },
//                         ]}>
//                         {i18n.t('add-home-address.checkTheBox')}
//                       </Text>
//                     </View>
//                     <View style={{ flexDirection: 'row', gap: 12 }}>
//                       <Button
//                         mode="outlined"
//                         textColor={Colors.primary[500]}
//                         buttonColor={Colors.light[10]}
//                         style={[defaultStyles.button, { flex: 1 }]}
//                         onPress={() => setCurrentStep(1)}>
//                         <Text>
//                           {i18n.t('common.back') || 'Back'}
//                         </Text>
//                       </Button>
//                       <Button
//                         mode="contained"
//                         buttonColor={Colors.primary['500']}
//                         style={[defaultStyles.button, { flex: 1 }]}
//                         disabled={loading}
//                         loading={loading}
//                         onPress={handleCreateAddress}>
//                         <Text style={defaultStyles.buttonText}>
//                           {i18n.t('add-home-address.submitAddress')}
//                         </Text>
//                       </Button>
//                     </View>
//                   </>
//                 )}
//               </View>
//             </KeyboardAwareScrollView>
//           </TouchableWithoutFeedback>
//         </KeyboardAvoidingView>
//       </SafeAreaView>

//       <Snackbar
//         visible={!!error}
//         onDismiss={() => { }}
//         duration={3000}
//         style={defaultStyles.snackbar}>
//         <Text style={defaultStyles.errorText}>{error}</Text>
//       </Snackbar>
//       <Loader
//         visible={loading}
//         text={i18n.t('add-home-address.creatingAddress')}
//       />
//       <Dialog
//         visible={!!createAddressResponse && showSuccessModal}
//         onDismiss={() => { }}
//         style={styles.dialogContainer}>
//         <Dialog.Content
//           style={[styles.dialogSubtitleContainer, styles.paddingHorizontal]}>
//           <Icon source={'check-circle'} size={24} color={Colors.success} />
//           <Text style={styles.addressSuccessfullyCreatedText}>
//             {i18n.t('add-home-address.yourAddressHasBeenCreated')}
//           </Text>
//           <TouchableOpacity
//             onPress={() => {
//               setShowSuccessModal(false);
//               router.replace('/(tabs)');
//             }}>
//             <Icon source="close" color={Colors.error} size={24} />
//           </TouchableOpacity>
//         </Dialog.Content>
//         <Dialog.Content style={styles.dialogContentContainer}>
//           <Text style={styles.jangoAddress}>
//             {i18n.t('add-home-address.jangoGPS')}
//           </Text>
//         </Dialog.Content>
//         <Dialog.Content>
//           <View style={styles.addressContainer}>
//             {displayAddressText.line1 && (
//               <Text
//                 style={[
//                   styles.addressLine,
//                   formatedLength > 3 && styles.addressLineBold,
//                 ]}>
//                 {displayAddressText.line1}
//               </Text>
//             )}
//             {displayAddressText.line2 && (
//               <Text style={styles.addressLine}>{displayAddressText.line2}</Text>
//             )}
//             {displayAddressText.line3 && (
//               <Text style={styles.addressLine}>{displayAddressText.line3}</Text>
//             )}
//             {displayAddressText.line4 && (
//               <Text style={styles.addressLine}>{displayAddressText.line4}</Text>
//             )}
//             {displayAddressText.line5 && (
//               <Text style={styles.addressLine}>{displayAddressText.line5}</Text>
//             )}
//           </View>
//           {/* <Text style={styles.dialogTitle}>
//             {createAddressResponse?.address?.formatted_address}
//           </Text> */}
//         </Dialog.Content>
//         <Dialog.Actions style={styles.dialogActionContainer}>
//           <Button
//             mode="contained"
//             textColor={Colors.light['10']}
//             buttonColor={Colors.primary[500]}
//             style={[defaultStyles.flexButton, styles.shareAddressButton]}
//             onPress={() => {
//               setShowSuccessModal(false);
//               openShareSheet(
//                 {
//                   latitude: createAddressResponse?.address?.latitude,
//                   longitude: createAddressResponse?.address?.longitude,
//                   global_code: createAddressResponse?.address?.global_code,
//                   formatted_address:
//                     createAddressResponse?.address?.formatted_address,
//                   house_number:
//                     createAddressResponse?.address?.address_components
//                       ?.house_number,
//                   street_name:
//                     createAddressResponse?.address?.address_components?.road,
//                 },
//                 user?.full_names,
//               )
//             }}
//             labelStyle={[
//               defaultStyles.buttonText,
//               styles.shareAddressText,
//               styles.font14,
//             ]}>
//             {i18n.t('add-home-address.shareAddress')}
//           </Button>
//           <Button
//             mode="contained"
//             textColor={Colors.light['10']}
//             buttonColor={Colors.primary[500]}
//             style={defaultStyles.button}
//             onPress={() => {
//               setShowSuccessModal(false);
//               router.push('/my-addresses');
//             }}
//             labelStyle={[
//               defaultStyles.buttonText,
//               styles.gentiumText,
//               styles.font14,
//             ]}>
//             {i18n.t('add-home-address.viewAddress')}
//           </Button>
//         </Dialog.Actions>
//       </Dialog>
//       <Loader
//         visible={
//           (preLoading || loading) &&
//           !isImagePickerActive &&
//           !isImagePickerActiveRef.current &&
//           !isSettingImageRef.current // Don't show loader when setting image
//         }
//         text={i18n.t('add-home-address.loadingAddressComponents')}
//       />
//       <EditStreet
//         onClose={() => setIsEditingStreet(false)}
//         visible={isEditingStreet}
//         setStreet={setStreet}
//         setStreetType={setStreetType}
//         defaultStreetName={street}
//       />
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#F9F9F9',
//   },
//   map: {
//     width: '100%',
//     height: '100%',
//     flex: 1,
//     bottom: 100,
//     right: 0,
//     left: 0,
//     position: 'absolute',
//   },
//   formContainer: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: Colors.light[10],
//     maxHeight: '68%',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: -3,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 5,
//     elevation: 5,
//     paddingBottom: 40,
//   },
//   formScrollView: {
//     flex: 1,
//   },
//   formContent: {
//     paddingBottom: 20,
//   },
//   formHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 20,
//     paddingVertical: 8,
//     borderBottomWidth: 0.5,
//     borderBottomColor: Colors.dark['0.1'],
//     backgroundColor: Colors.primary[500],
//   },
//   closeButton: {
//     width: 20,
//     height: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   formHeaderText: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: 'white',
//     fontFamily: 'gentium-bold',
//     textAlign: 'center',
//   },
//   imageParentContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 20,
//     borderBottomWidth: 0.5,
//     marginBottom: 6,
//     borderBottomColor: Colors.dark['0.1'],
//     width: '100%',
//   },
//   uploadRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'flex-start',
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     borderBottomWidth: 0.5,
//     borderBottomColor: Colors.dark['0.1'],
//     gap: 16,
//   },
//   uploadCard: {
//     width: 100,
//     height: 70,
//     borderRadius: 6,
//     borderWidth: 1.5,
//     borderStyle: 'dashed',
//     borderColor: Colors.primary[500],
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: Colors.light[10],
//     padding: 6,
//   },
//   uploadCardImage: {
//     width: '100%',
//     height: '100%',
//     borderRadius: 4,
//   },
//   uploadTitleText: {
//     marginTop: 4,
//     fontSize: 10,
//     fontFamily: 'gentium-bold',
//     color: Colors.dark[10],
//   },
//   uploadSubtitleText: {
//     fontSize: 9,
//     fontFamily: 'gentium',
//     color: Colors.grey,
//   },
//   uploadChangeText: {
//     position: 'absolute',
//     bottom: 4,
//     fontSize: 9,
//     fontFamily: 'gentium',
//     color: Colors.light[10],
//     backgroundColor: Colors.dark[0.5],
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 8,
//   },
//   uploadMeta: {
//     flex: 1,
//     justifyContent: 'center',
//   },
//   uploadLabelText: {
//     fontSize: 12,
//     fontFamily: 'gentium-bold',
//     color: Colors.primary[500],
//     marginBottom: 4,
//   },
//   uploadCheckboxRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   uploadCheckboxLabel: {
//     fontSize: 12,
//     fontFamily: 'gentium',
//     color: Colors.dark[10],
//   },
//   requiredAsterisk: {
//     color: Colors.error,
//   },
//   imageContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: 70,
//     backgroundColor: Colors.light[10],
//     borderRadius: 4,
//     width: '10%',
//     marginLeft: 12,
//   },
//   image: {
//     width: 60,
//     height: 60,
//   },
//   closeImageContainer: {
//     backgroundColor: Colors.dark[0.5],
//     width: 12,
//     height: 12,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     position: 'absolute',
//     top: 8,
//     right: 8,
//   },
//   changeImageContainer: {
//     backgroundColor: Colors.dark[0.5],
//     flexDirection: 'row',
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     columnGap: 8,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     position: 'absolute',
//     bottom: 8,
//     right: 8,
//   },
//   changeText: {
//     fontSize: 10,
//     color: Colors.light[10],
//   },
//   addAPictureContainer: {
//     flexDirection: 'row',
//     columnGap: 2,
//     alignItems: 'center',
//   },
//   addAPictureText: {
//     fontSize: 8,
//     color: Colors.primary[500],
//   },
//   formFieldsContainer: {
//     marginHorizontal: 20,
//     gap: 6,
//     paddingBottom: 6,
//   },
//   footer: {
//     gap: 12,
//     marginHorizontal: 20,
//   },
//   dialogContainer: {
//     backgroundColor: Colors.light['10'],
//     borderRadius: 8,
//     position: 'relative',
//     rowGap: 0,
//     paddingVertical: 4,
//     width: sizes.windowWidth * 0.94,
//     alignSelf: 'center',
//     marginHorizontal: 0,
//   },
//   paddingHorizontal: {
//     marginTop: 16,
//     paddingLeft: 12,
//     paddingRight: 12,
//     columnGap: 16,
//   },
//   dialogSubtitleContainer: {
//     flexDirection: 'row',
//     alignItems: 'flex-start',
//     justifyContent: 'space-between',
//     columnGap: 4,
//     paddingHorizontal: 12,
//     paddingBottom: 16,
//     overflowX: 'hidden',
//     flexShrink: 1,
//   },
//   dialogContentContainer: {
//     paddingTop: 0,
//     paddingBottom: 2,
//   },
//   dialogTitle: {
//     fontSize: 16,
//     color: Colors.primary[500],
//     textAlign: 'center',
//     fontFamily: 'gentium',
//     marginHorizontal: 24,
//   },
//   dialogActionContainer: {
//     flexDirection: 'row',
//     columnGap: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 16,
//     paddingBottom: 0,
//     overflowX: 'hidden',
//   },
//   jangoAddress: {
//     fontFamily: 'gentium-bold',
//     textAlign: 'center',
//   },
//   addressSuccessfullyCreatedText: {
//     color: Colors.success,
//     fontFamily: 'gentium-bold',
//     textAlign: 'center',
//     flexShrink: 1,
//   },
//   shareAddressButton: {
//     borderWidth: 1,
//     borderColor: Colors.dark[0.1],
//     backgroundColor: Colors.secondary[10],
//   },
//   shareAddressText: {
//     color: Colors.dark[0],
//     fontFamily: 'gentium',
//   },
//   font14: {
//     fontSize: 14,
//   },
//   gentiumText: {
//     fontFamily: 'gentium',
//   },
//   addressContainer: {
//     marginBottom: 12,
//     borderBottomWidth: 0.5,
//     borderColor: Colors.dark['0.1'],
//   },
//   addressLine: {
//     fontSize: 14,
//     color: Colors.dark[10],
//     fontFamily: 'gentium',
//     marginBottom: 2,
//     textAlign: 'center',
//   },
//   addressLineBold: {
//     fontWeight: '700',
//     fontFamily: 'gentium-bold',
//   },
//   cityRegionCountryText: {
//     fontSize: 14,
//     color: Colors.dark[10],
//     fontFamily: 'gentium',
//     marginBottom: 2,
//     textAlign: 'center',
//   },
//   headerCard: {
//     paddingHorizontal: 20,
//     paddingVertical: 6,
//     borderBottomWidth: 0.5,
//     borderBottomColor: Colors.dark['0.1'],
//     backgroundColor: Colors.light[10],
//   },

//   headerBusinessNameLabel: {
//     fontSize: 12,
//     fontFamily: 'gentium',
//     color: Colors.dark[10],
//     opacity: 0.8,
//   },
//   headerBusinessNameValue: {
//     fontSize: 14,
//     fontFamily: 'gentium-bold',
//     color: Colors.dark[10],
//   },
//   headerCardTopRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingVertical: 8,
//     paddingHorizontal: 20

//   },
//   headerTabActive: {
//     fontSize: 14,
//     fontFamily: 'gentium-bold',
//     color: Colors.primary[500],
//   },
//   autoGeneratedPill: {
//     backgroundColor: Colors.primary[500],
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     borderRadius: 999,
//   },
//   autoGeneratedText: {
//     fontSize: 12,
//     fontFamily: 'gentium-bold',
//     color: Colors.light[10],
//   },
//   headerAddressText: {
//   },
//   headerAddressLine1: {
//     fontSize: 14,
//     fontFamily: 'gentium-bold',
//     color: Colors.dark[10],
//   },
//   headerAddressLine2: {
//     fontSize: 14,
//     fontFamily: 'gentium',
//     color: Colors.dark[10],
//   },
//   headerAddressLine3: {
//     fontSize: 14,
//     fontFamily: 'gentium',
//     color: Colors.dark[10],
//   },
//   previewCardWrapper: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 8,
//   },
//   stepIndicator: {
//     alignItems: 'center',
//     marginBottom: 4,
//     marginTop: 8,
//   },
//   stepIndicatorText: {
//     fontSize: 12,
//     color: Colors.grey,
//     fontFamily: 'gentium',
//   },
//   headerCardSeparator: {
//     height: 1,
//     backgroundColor: Colors.dark[0.1]
//   },
//   footerButtonContainer: {
//     width: '35%',
//     alignSelf: 'center',
 
//     justifyContent: 'center',
//     borderRadius: 4,
//   },
//   buttonText: {
//     // flexShrink: 1,
//     flexWrap: 'wrap',
//     fontWeight: '500',
//     color: Colors.light['10'],
//     fontSize: 10,
//     textAlign: 'center',
//   },
// });