import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Text,
  TextInput,
  Animated,
  SafeAreaView,
  AppStateStatus,
  AppState,
  ActivityIndicator,
  StyleSheet,
  Switch,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { defaultStyles, tabIndexStyles as styles } from '@/styles';
import {
  Loader,
  SearchResultsContainer,
  MapViewComponent,
  MapViewModal,
  MapControls,
  NavigationOverlay,
  NoRoutingDataCard,
  OfflineDataManager,
  SwipeableBottomSheet,
} from '@/components';
import { RouteModal } from '@/components/modals/RouteModal';
import { NavigationErrorCard } from '@/components/NavigationErrorCard';
import { Button, Icon, Snackbar } from 'react-native-paper';
import { Colors } from '@/constants';
import {
  useGetJangoRoute,
  useSearchGlobalAddresses,
  useSearchJangoAddresses,
} from '@/hooks/addresses.hooks';
import { encode as encodePlusCode } from '@janpams/core/pluscode';
import { Context, ContextType } from '../_layout';
import {
  decodePolyline,
  delay,
  estimateTravelTime,
  getLocationWithFallback,
  createRegionFromCoords,
  getLocationSourceDescription,
  decodePlusCodeToBounds,
} from '@/utils';
import { useOfflineRoute } from '@/hooks/useOfflineRoute';
import { useOffline } from '@/hooks/useOffline';
import { useBottomSheet } from '@/contexts/BottomSheetContext';
import { useRouteOptions, getValhallaCostingModel, type TransportMode } from '@/hooks/useRouteOptions';
import { useNavigationCore } from '@/hooks/useNavigationCore';
import type { NavigationIntent, RoutingProfile } from '@janpams/core/navigation';
import type { GetRouteOptions } from '@/lib/routing';
import { getInstalledPacks } from '@/lib/japaState';

import addressFormatter from '@fragaria/address-formatter';
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from '@/components/Drawer';
import { useNavigation, useRouter } from 'expo-router';
import { Result, type addressesGlobalAddress, type addressesJangoAddress } from '@/interfaces';
import i18n from '../../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { isLargeDevice, isSmallDevice } from '@/constants/sizes';
import { getGridCellBounds } from '@/lib/routeDirections/gridUtils';
import { DirectionsRidesPanel } from '@/components/route-directions';

const MAP_ZOOM_DELTA = 0.0001; // zoom-18 street level

const INITIAL_REGION = {
  latitude: 4.1594, // Latitude of Buea
  longitude: 9.2481, // Longitude of Buea
  latitudeDelta: MAP_ZOOM_DELTA,
  longitudeDelta: MAP_ZOOM_DELTA,
};

export default function TabOneScreen() {
  const mapRef = useRef<MapView>(null);
  const [activeNav, setActiveNav] = useState<'getDirection' | 'findRoute'>(
    'getDirection',
  );
  /** Web-flow panel state (Task 1-A2): only used when activeNav === 'findRoute'. */
  const [panelState, setPanelState] = useState<'default' | 'address-found' | 'planning'>('default');

  const { user, lang } = useContext(Context) as ContextType;

  const [location, setLocation] = useState<{
    description: string;
    region: Region;
  }>();
  // Stable ref so focus effect always reads the latest location without stale closure
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  // True once MapLibre fires onDidFinishLoadingMap (camera + tiles ready)
  const [isMapReady, setIsMapReady] = useState(false);
  // Guard: only auto-center once on initial load (not on every location update)
  const hasAutocenteredRef = useRef(false);

  // Center on GPS location once BOTH the map is ready AND location is known.
  // This fires whichever resolves last — GPS-first or map-first — and avoids the
  // 1-second applyInitialCamera fallback in MapViewMapLibre overwriting a premature call.
  useEffect(() => {
    if (!isMapReady || !location?.region || hasAutocenteredRef.current) return;
    hasAutocenteredRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: location.region.latitude,
        longitude: location.region.longitude,
        latitudeDelta: MAP_ZOOM_DELTA,
        longitudeDelta: MAP_ZOOM_DELTA,
      },
      600,
    );
  }, [isMapReady, location]);

  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [displayValue, setDisplayValue] = useState<string>();
  const [showSearchResults, setShowSearchResults] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);

  const [searchResults, setSearchResults] = useState<Array<Result>>();
  const [loadingText] = useState(i18n.t('(tabs).index.loadingLocation'));
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{
      longitude: number;
      latitude: number;
    }>
  >();
  const [startMarker, setStartMarker] = useState<{
    longitude: number;
    latitude: number;
  }>();
  const [endMarker, setEndMarker] = useState<{
    longitude: number;
    latitude: number;
  }>();

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string>();

  // Find routes hooks — waypoints from useRouteOptions (C2)
  const [startingLocation, setStartingLocation] = useState<{
    displayValue: string;
    coordinates: string;
  }>();
  const [destination, setDestination] = useState<{
    displayValue: string;
    coordinates: string;
  }>();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeSearchInput, setActiveSearchInput] = useState<string>();
  const [isRouteModalVisible, setIsRouteModalVisible] =
    useState<boolean>(false);
  const [isMapViewModalVisible, setIsMapViewModalVisible] =
    useState<boolean>(false);
  const [selectedAddressForModal, setSelectedAddressForModal] = useState<{
    displayValue: string;
    coordinates: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [selectedGridRectangle, setSelectedGridRectangle] = useState<{
    coordinates: Array<{ latitude: number; longitude: number }>;
  } | null>(null);
  const [isProcessingGridClick, setIsProcessingGridClick] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  /** Navigation panel (web-flow): when true, SwipeableBottomSheet with search/planning is visible. Dismissible; trigger in top bar reopens. */
  const [showNavigationPanel, setShowNavigationPanel] = useState(true);
  const [showNoRoutingData, setShowNoRoutingData] = useState(false);
  const [offlineRouteDistanceMeters, setOfflineRouteDistanceMeters] = useState<number | null>(null);

  const { path: offlineRoutePath, distance: offlineRouteDistance, steps: offlineRouteSteps, fetchRoute: fetchOfflineRoute, fetchRouteMulti, loading: offlineRouteLoading, reset: resetOfflineRoute } = useOfflineRoute();
  const { isOnline } = useOffline();
  const { setHideTabBar } = useBottomSheet();

  // Hide tab bar while the offline manager sheet is open
  useEffect(() => {
    setHideTabBar(showOfflineManager || showNavigationPanel);
  }, [showOfflineManager, showNavigationPanel, setHideTabBar]);

  const routeOptions = useRouteOptions();
  const [routeOptionsExpanded, setRouteOptionsExpanded] = useState(false);
  const [activeRouteCoords, setActiveRouteCoords] = useState<Array<[number, number]>>([]);

  const navCore = useNavigationCore();

  const [followMapEnabled, setFollowMapEnabled] = useState(true);
  const lastFollowMapPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const followMapThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, the last region change was from our follow-map animation; do not turn off follow. */
  const followMapProgrammaticRef = useRef(false);

  const [estimatedTravelTime, setEstimatedTravelTime] = useState<{
    driving: string;
    bicycling: string;
    walking: string;
  }>();

  const appState = useRef<AppStateStatus>(AppState.currentState);

  // const [status, setStatus] = useState('App is active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'background' && nextAppState === 'active') {
        // App is leaving foreground – clear state
        resetStates();
        // setStatus('App went to background or inactive – clear data');
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove(); // cleanup on unmount
    };
  }, []);

  useEffect(() => {
    // Clear search results immediately when query changes
    // This prevents previous results from showing when starting a new search
    if (query.trim() === '') {
      setSearchResults(undefined);
      setShowSearchResults(undefined);
      setDebounceQuery('');
      setIsSearching(false);
    } else {
      // Clear previous results immediately when user starts typing a new query
      setSearchResults(undefined);
      setShowSearchResults(undefined);
      setIsSearching(true);
      // Note: We can't directly clear React Query mutation results,
      // but the processing effect checks isSearching, so old results won't be processed
    }

    const handler = setTimeout(() => {
      if (query === '') {
        setSearchResults(undefined);
        setShowSearchResults(undefined);
        setDebounceQuery('');
        setIsSearching(false);
      } else {
        setDebounceQuery(query);
      }
    }, 300); // Wait for 300ms

    return () => clearTimeout(handler); // Cleanup timeout on every change
  }, [query]);

  // Plan routes: default start to "My Current Location" when planning panel is shown
  useEffect(() => {
    if (
      activeNav === 'findRoute' &&
      panelState === 'planning' &&
      location?.region &&
      !startingLocation
    ) {
      setStartingLocation({
        displayValue: i18n.t('(tabs).index.myCurrentLocation'),
        coordinates: `${location.region.longitude},${location.region.latitude}`,
      });
    }
  }, [activeNav, panelState, location?.region?.latitude, location?.region?.longitude]);

  useEffect(() => {
    const handleUseCurrentLocation = async () => {
      try {
        setIsLoading(true);
        setError(undefined);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError(i18n.t('(tabs).index.pleaseAcceptPermissions'));
          return;
        }

        // Use the fallback location system
        const locationResult = await getLocationWithFallback({
          enableNetworkLocation: true,
          enableCachedLocation: true,
          fallbackToLastKnown: true,
          accuracyThreshold: 100, // 100 meters
        });

        const address = await Location.reverseGeocodeAsync(
          locationResult.coords,
        );

        const locationDescription =
          locationResult.source === 'fallback'
            ? `Default location (${getLocationSourceDescription(locationResult.source)})`
            : `${address[0].name}, ${address[0].city}, ${address[0].country}`;

        setLocation({
          description: locationDescription,
          region: createRegionFromCoords(
            locationResult.coords,
            locationResult.accuracy,
          ),
        });

        setStartingLocation({
          displayValue:
            locationResult.source === 'fallback'
              ? `Default location (${getLocationSourceDescription(locationResult.source)})`
              : i18n.t('(tabs).index.myCurrentLocation'),
          coordinates: `${locationResult.coords.longitude},${locationResult.coords.latitude}`,
        });

        // Compute plus code locally — no network needed (open-location-code is offline)
        try {
          const plusCode = encodePlusCode(
            locationResult.coords.latitude,
            locationResult.coords.longitude,
            10,
          );

          // Snap location to grid cell center for accurate positioning
          if (plusCode) {
            // Prefer decoded bounds from plus code; fallback to computed grid
            const decodedBounds = decodePlusCodeToBounds(plusCode);
            const bounds =
              decodedBounds ??
              getGridCellBounds(
                locationResult.coords.latitude,
                locationResult.coords.longitude,
              );
            
            // Update location region to use grid cell center for marker positioning
            const gridCenteredRegion = createRegionFromCoords(
              {
                ...locationResult.coords,
                latitude: bounds.centerLat,
                longitude: bounds.centerLng,
              },
              locationResult.accuracy,
            );
            
            setLocation({
              description: locationDescription,
              region: gridCenteredRegion,
            });
            // selectedGridRectangle is intentionally NOT set here —
            // currentUserPosition handles the GPS location indicator via the
            // animated grid cell (pulsing fill + marching ants). Setting
            // selectedGridRectangle would render a second, misaligned box
            // because getGridCellBounds uses different alignment offsets than
            // the getGridBounds function used by currentUserPosition.
            
            // Centering is handled by the location useEffect (map ref guaranteed live there)
          }
        } catch (error) {
          console.warn('Error getting plus code/what3words for current location:', error);
        }

        // Show a subtle notification if using fallback location
        if (locationResult.source === 'fallback') {
          setError('Using default location. GPS signal may be weak.');
          setTimeout(() => setError(undefined), 30000);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        let errorMessage = i18n.t('(tabs).index.errorGettingLocation');

        // Handle specific error types with better user messages
        if (error?.code === 'E_LOCATION_TIMEOUT') {
          errorMessage =
            'Location request timed out. Please check your GPS signal and try again.';
        } else if (error?.code === 'E_LOCATION_SERVICES_DISABLED') {
          errorMessage =
            'Location services are disabled. Please enable them in your device settings.';
        } else if (error?.code === 'E_LOCATION_UNAVAILABLE') {
          errorMessage =
            'Location is currently unavailable. Please try again in a moment.';
        } else if (error?.message?.includes('timeout')) {
          errorMessage =
            'Location request timed out. Please check your internet connection and GPS signal.';
        } else if (error?.message?.includes('Network Error')) {
          errorMessage =
            'Network error: Unable to connect to location services. Please check your internet connection.';
        }

        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    handleUseCurrentLocation();
  }, []);

  useEffect(() => {
    // Clear all search-related state when switching tabs
    setQuery('');
    setDebounceQuery('');
    setSearchResults(undefined);
    setShowSearchResults(undefined);
    setIsSearching(false);
    setDisplayValue(undefined);
    setActiveSearchInput(undefined);
  }, [activeNav]);

  // Clear search when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Clear search when screen loses focus
        setQuery('');
        setDebounceQuery('');
        setSearchResults(undefined);
        setIsSearching(false);
        setDisplayValue(undefined);
      };
    }, []),
  );

  const { data: globalAddressesResult, mutateAsync: searchGlobalAddresses } =
    useSearchGlobalAddresses(
      lang,
      () => {},
      async error => {
        setIsLoading(false);
        if (typeof error?.response?.data?.message === 'string') {
          setError(error?.response?.data?.message);
          await delay(5000);
          setError(undefined);
        } else if (
          Array.isArray(error?.response?.data?.message) &&
          typeof error?.response?.data?.message[0] === 'string'
        ) {
          setError(error?.response?.data?.message[0]);
          await delay(5000);
          setError(undefined);
        } else {
          setError(i18n.t('(tabs).index.unknownError'));
          await delay(5000);
          setError(undefined);
        }
      },
    );

  const { data: jangoAddressesResult, mutateAsync: searchJangoAddresses } =
    useSearchJangoAddresses(
      lang,
      () => {},
      async error => {
        setIsLoading(false);
        if (typeof error?.response?.data?.message === 'string') {
          setError(
            `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message}`,
          );
          await delay(5000);
          setError(undefined);
        } else if (
          Array.isArray(error?.response?.data?.message) &&
          typeof error?.response?.data?.message[0] === 'string'
        ) {
          setError(
            `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message[0]}`,
          );
          await delay(5000);
          setError(undefined);
        } else {
          setError(
            `${i18n.t('(tabs).index.unknownError')} ${i18n.t('(tabs).index.whileFetchingAddresses')}`,
          );
          await delay(5000);
          setError(undefined);
        }
      },
    );

  useEffect(() => {
    if (!debounceQuery || !user?.id) {
      setSearchResults(undefined);
      setShowSearchResults(undefined);
      setIsSearching(false);
      return;
    }

    const searchAddress = async () => {
      try {
        setIsSearching(true);
        // Clear previous results before starting new search
        setSearchResults(undefined);
        setShowSearchResults(undefined);

        // Execute both searches in parallel
        await Promise.all([
          searchJangoAddresses({
            address: debounceQuery,
          }),
          // searchGlobalAddresses({
          //   address: debounceQuery,
          // }),
        ]);
      } catch {
        setError('Failed to search addresses. Please try again.');
        setTimeout(() => setError(undefined), 5000);
      } finally {
        setIsSearching(false);
      }
    };

    searchAddress();
  }, [debounceQuery, user, searchJangoAddresses, searchGlobalAddresses]);

  useEffect(() => {
    // Only process results if we have data and we're not currently searching
    // Also ensure we only process results if we have an active search query
    if (
      globalAddressesResult?.data === undefined &&
      jangoAddressesResult?.data === undefined
    ) {
      // Alert.alert('Something when wrong, try again later');
      return;
    }
    // Don't process results if there's no active search query
    if (!debounceQuery) {
      return;
    }
    if ((globalAddressesResult || jangoAddressesResult) && !isSearching) {
      const globalResults =
        globalAddressesResult?.data?.length &&
        globalAddressesResult?.data?.length > 0
          ? globalAddressesResult?.data?.map((item: addressesGlobalAddress) => {
              const addr = item?.address;
              const formattedAddress = addressFormatter.format({
                houseNumber: addr?.house_number || '',
                road: addr?.road || '',
                city: addr?.city || addr?.county || '',
                state: addr?.state || '',
                postcode: '',
                country: addr?.country || '',
                countryCode: addr?.country_code || '',
              });
              return {
                id: item?.place_id?.toString(),
                formattedAddress,
                latitude: item.lat,
                longitude: item.lon,
                type: 'global' as const,
                houseNumber: addr?.house_number,
                streetName: addr?.road,
                neighborhood: addr?.suburb,
                city: addr?.city ?? addr?.town ?? addr?.county,
                region: addr?.state,
                country: addr?.country,
                countryCode: addr?.country_code,
              };
            })
          : [];

      const jangoResults =
        jangoAddressesResult?.data && jangoAddressesResult?.data?.length > 0
          ? jangoAddressesResult.data.map((item: addressesJangoAddress) => {
              return {
                id: item.id,
                formattedAddress: item?.formatted_address,
                latitude: item.latitude,
                global_code: item?.global_code,
                longitude: item.longitude,
                businessName:
                  item?.address_components?.business_name ||
                  item?.address_components?.amenity ||
                  '',
                address_components: item?.address_components,
                type: 'jango' as const,
              };
            })
          : [];

      // Combine results from both APIs
      const combinedResults = [...jangoResults, ...globalResults];

      const uniqueResults = Array.from(
        new Set(combinedResults.map(item => JSON.stringify(item))),
      ).map(item => JSON.parse(item));

      setSearchResults(uniqueResults);
      // Only set showSearchResults if we have an active search input
      // This prevents showing results when switching between inputs
      if (activeSearchInput) {
        setShowSearchResults(activeSearchInput);
      }
    }
  }, [
    globalAddressesResult,
    jangoAddressesResult,
    isSearching,
    activeSearchInput,
    debounceQuery,
  ]);

  useEffect(() => {
    if (mapRef.current && location?.region) {
      mapRef.current.animateToRegion(location.region, 1000);
    }
  }, [location]);

  const navigation = useNavigation();
  const router = useRouter();

  // This hook listens to every back action and clears states
  useFocusEffect(
    useCallback(() => {
      // Center map on current GPS location when tab gains focus
      const loc = locationRef.current;
      if (mapRef.current && loc?.region) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.region.latitude,
            longitude: loc.region.longitude,
            latitudeDelta: MAP_ZOOM_DELTA,
            longitudeDelta: MAP_ZOOM_DELTA,
          },
          600,
        );
      }

      return () => {
        setIsDrawerOpen(false);
        resetStates();
      };
    }, []),
  );

  const [, setModalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(164)).current; // Starts off-screen

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(translateY, {
      toValue: 162,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const { data: routeData } = useGetJangoRoute(
    lang,
    async data => {
      if (Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];

        if (route.legs && route.legs.length > 0) {
          const fullCoordinates = route.legs.reduce(
            (acc: { latitude: number; longitude: number }[], leg) => {
              const legCoordinates = leg.steps?.reduce(
                (stepAcc: { latitude: number; longitude: number }[], step) => {
                  if (step.geometry) {
                    const coordinates = decodePolyline(step.geometry);
                    return [...stepAcc, ...coordinates];
                  }
                  return stepAcc;
                },
                [],
              );
              return [...acc, ...(legCoordinates || [])];
            },
            [],
          );

          if (fullCoordinates?.length > 0) {
            handlePathCalculated(fullCoordinates);
            // onSubmit();
            openModal();
          } else {
            setIsLoading(false);
            setError(i18n.t('(tabs).index.noValidPath'));
            await delay(5000);
            setError(undefined);
          }
        } else {
          setIsLoading(false);
          setError(i18n.t('(tabs).index.noLegsFound'));
          await delay(5000);
          setError(undefined);
        }
      } else {
        setIsLoading(false);
        setError(i18n.t('(tabs).index.failedToFetch'));
        await delay(5000);
        setError(undefined);
      }
    },
    async error => {
      setIsLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        setError(`${error?.response?.data?.message}`);
        await delay(5000);
        setError(undefined);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        setError(`${error?.response?.data?.message[0]}`);
        await delay(5000);
        setError(undefined);
      } else {
        setError(
          `${i18n.t('(tabs).index.unknownError')} ${i18n.t('(tabs).index.whileGettingRoute')}`,
        );
        await delay(5000);
        setError(undefined);
      }
    },
  );

  const handlePathCalculated = async (
    calculatedPath: Array<{
      longitude: number;
      latitude: number;
    }>,
  ) => {
    if (calculatedPath && calculatedPath.length > 0) {
      setRouteCoordinates(calculatedPath);

      // Set the start and end markers
      const startMarker = calculatedPath[0];
      const endMarker = calculatedPath[calculatedPath.length - 1];
      setStartMarker(startMarker);
      setEndMarker(endMarker);

      // Animate the map to fit the route coordinates
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(calculatedPath, {
          edgePadding: { top: 240, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } else {
      setIsLoading(false);
      setError(i18n.t('(tabs).index.noValidPath'));
      await delay(5000);
      setError(undefined);
    }
  };

  const handleNavChange = (nav: typeof activeNav) => {
    resetStates();
    if (nav === 'getDirection') {
      if (location) {
        setStartingLocation({
          displayValue: i18n.t('(tabs).index.myCurrentLocation'),
          coordinates: `${location.region.longitude},${location.region.latitude}`,
        });
      }
      setActiveNav('getDirection');
      if (mapRef.current && location?.region) {
        mapRef.current.animateToRegion(location.region, 1000);
      }
    } else {
      // Switch to Plan-Route tab — web flow starts at State 1 (Task 1-A2)
      setActiveNav('findRoute');
      setPanelState('default');
    }
  };

  const resetStates = () => {
    navCore.stop();
    setShowSearchResults(undefined);
    setSearchResults(undefined);
    setQuery('');
    setDebounceQuery('');
    setIsSearching(false);
    closeModal();
    setDestination(undefined);
    setStartMarker(undefined);
    setEndMarker(undefined);
    setRouteCoordinates(undefined);
    routeOptions.clearWaypoints();
    setDisplayValue(undefined);
    setShowNoRoutingData(false);
    setOfflineRouteDistanceMeters(null);
    resetOfflineRoute();
  };

  const handleStartInAppNavigation = useCallback(async () => {
    if (!destination?.coordinates) return;
    const [endLon, endLat] = destination.coordinates.split(',').map(Number);
    lastFollowMapPositionRef.current = null;

    const modeToProfile: Record<string, RoutingProfile> = {
      car: 'car', walk: 'walk', bike: 'car', motor_scooter: 'motor_scooter',
    };
    const intent: NavigationIntent = {
      mode: 'STANDARD',
      start: { type: 'MY_LOCATION' },
      destination: { lat: endLat, lon: endLon, label: destination.displayValue },
      routingProfile: modeToProfile[routeOptions.mode] ?? 'car',
    };

    try {
      let session = await navCore.startNavigation(intent);
      // When engine fails (e.g. Valhalla not on Android) but we have a route from "Let's go", use it for in-app nav
      if (
        session?.state === 'FAILED' &&
        activeRouteCoords.length >= 2 &&
        offlineRouteDistanceMeters != null
      ) {
        session = await navCore.startWithPrecomputedRoute(intent, {
          path: activeRouteCoords,
          distance: offlineRouteDistanceMeters,
        });
      }
      if (session?.state === 'ROUTE_PREVIEW_READY') {
        await navCore.confirmStart();
      }
      setIsRouteModalVisible(false);
      setShowNavigationPanel(false);
    } catch (err: any) {
      const rawMessage = err?.message ?? String(err ?? '');
      const isEngineUnavailableError =
        /native module not linked|JNI bridge|Phase 1|engine.*not.*available/i.test(
          rawMessage.trim(),
        );
      const friendlyEngineMessage = i18n.t(
        '(tabs).navigation.error.engineUnavailableOnDevice',
        {
          defaultValue:
            'In-app turn-by-turn is not available on this device. Use "Open in another app" to navigate with Google Maps or another app.',
        },
      );
      setError(
        isEngineUnavailableError
          ? friendlyEngineMessage
          : i18n.t('(tabs).index.navigationFailed', {
              defaultValue:
                'Unable to start in-app navigation. Please try again or use another app.',
            }),
      );
      await navCore.stop().catch(() => {});
      // Always close modal and panel so user sees either overlay or NavigationErrorCard (e.g. when init throws on iOS)
      setIsRouteModalVisible(false);
      setShowNavigationPanel(false);
    }
  }, [
    destination?.coordinates,
    destination?.displayValue,
    routeOptions.mode,
    navCore,
    activeRouteCoords,
    offlineRouteDistanceMeters,
  ]);

  /** Build routing options from current route options (mode, preferences) for getRoute. */
  const getRoutingOptions = useCallback(async (): Promise<GetRouteOptions> => {
    const packs = await getInstalledPacks();
    const packId = packs[0]?.id;
    return {
      ...(packId && { packId }),
      costing: getValhallaCostingModel(routeOptions.mode) as GetRouteOptions['costing'],
      routePreference: routeOptions.preferences.routeType,
      avoidSettings: {
        highways: routeOptions.preferences.avoidHighways,
        'toll-roads': routeOptions.preferences.avoidTolls,
        unpaved: routeOptions.preferences.avoidUnpaved,
        ferries: routeOptions.preferences.avoidFerries,
        'u-turns': routeOptions.preferences.avoidUturns,
      },
    };
  }, [routeOptions.mode, routeOptions.preferences.routeType, routeOptions.preferences.avoidHighways, routeOptions.preferences.avoidTolls, routeOptions.preferences.avoidUnpaved, routeOptions.preferences.avoidFerries, routeOptions.preferences.avoidUturns]);

  const handleReroute = useCallback(async () => {
    await navCore.reroute();
    const route = navCore.session?.activeRoute;
    if (route?.path?.length) {
      const pathForMap = route.path.map(([lon, lat]) => ({ longitude: lon, latitude: lat }));
      handlePathCalculated(pathForMap);
      setActiveRouteCoords(route.path);
      setOfflineRouteDistanceMeters(route.distance);
    }
  }, [navCore]);

  // Sync map polyline when navigation session has a route (e.g. after auto-start from Get Direction)
  useEffect(() => {
    const route = navCore.session?.activeRoute;
    if (route?.path?.length) {
      const pathForMap = route.path.map(([lon, lat]) => ({ longitude: lon, latitude: lat }));
      handlePathCalculated(pathForMap);
      setActiveRouteCoords(route.path);
      setOfflineRouteDistanceMeters(route.distance ?? null);
    }
  }, [navCore.session?.activeRoute]);

  const retryLocation = async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(i18n.t('(tabs).index.pleaseAcceptPermissions'));
        return;
      }

      // Use the fallback location system for retry as well
      const locationResult = await getLocationWithFallback({
        enableNetworkLocation: true,
        enableCachedLocation: true,
        fallbackToLastKnown: true,
        accuracyThreshold: 100, // 100 meters
      });

      const address = await Location.reverseGeocodeAsync(locationResult.coords);

      const locationDescription =
        locationResult.source === 'fallback'
          ? `Default location (${getLocationSourceDescription(locationResult.source)})`
          : `${address[0].name}, ${address[0].city}, ${address[0].country}`;

      setLocation({
        description: locationDescription,
        region: createRegionFromCoords(
          locationResult.coords,
          locationResult.accuracy,
        ),
      });

      setStartingLocation({
        displayValue:
          locationResult.source === 'fallback'
            ? `Default location (${getLocationSourceDescription(locationResult.source)})`
            : i18n.t('(tabs).index.myCurrentLocation'),
        coordinates: `${locationResult.coords.longitude},${locationResult.coords.latitude}`,
      });

      // Show a subtle notification if using fallback location
      if (locationResult.source === 'fallback') {
        setError('Using default location. GPS signal may be weak.');
        setTimeout(() => setError(undefined), 3000);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      let errorMessage = i18n.t('(tabs).index.errorGettingLocation');

      if (error?.code === 'E_LOCATION_TIMEOUT') {
        errorMessage =
          'Location request timed out. Please check your GPS signal and try again.';
      } else if (error?.code === 'E_LOCATION_SERVICES_DISABLED') {
        errorMessage =
          'Location services are disabled. Please enable them in your device settings.';
      } else if (error?.code === 'E_LOCATION_UNAVAILABLE') {
        errorMessage =
          'Location is currently unavailable. Please try again in a moment.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage =
          'Location request timed out. Please check your internet connection and GPS signal.';
      } else if (error?.message?.includes('Network Error')) {
        errorMessage =
          'Network error: Unable to connect to location services. Please check your internet connection.';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const travelTime = estimateTravelTime(
      routeData?.routes?.[0]?.duration ?? '',
    );
    setEstimatedTravelTime(travelTime);
  }, [routeData]);

  // When user pans/zooms the map during navigation, turn off follow mode (A3)
  const handleMapRegionChange = useCallback(() => {
    if (
      navCore.isNavigating &&
      followMapEnabled &&
      !followMapProgrammaticRef.current
    ) {
      setFollowMapEnabled(false);
    }
  }, [navCore.isNavigating, followMapEnabled]);

  // Follow map: center on user when navigating (throttled). Programmatic moves set a ref so onRegionDidChange does not turn off follow.
  useEffect(() => {
    if (!navCore.isNavigating || !followMapEnabled || !navCore.snappedPosition) return;
    const { lat, lon } = navCore.snappedPosition;
    const prev = lastFollowMapPositionRef.current;
    const dist = prev ? Math.hypot(lon - prev.lon, lat - prev.lat) : 1;
    const shouldMove = !prev || dist > 0.00025; // ~25m
    if (!shouldMove) return;
    lastFollowMapPositionRef.current = { lat, lon };
    if (followMapThrottleRef.current) clearTimeout(followMapThrottleRef.current);
    followMapThrottleRef.current = setTimeout(() => {
      followMapThrottleRef.current = null;
      if (mapRef.current?.animateToRegion) {
        followMapProgrammaticRef.current = true;
        mapRef.current.animateToRegion(
          { latitude: lat, longitude: lon, latitudeDelta: 0.004, longitudeDelta: 0.004 },
          400,
        );
        setTimeout(() => {
          followMapProgrammaticRef.current = false;
        }, 500);
      }
    }, 100);
    return () => {
      if (followMapThrottleRef.current) clearTimeout(followMapThrottleRef.current);
    };
  }, [navCore.isNavigating, followMapEnabled, navCore.snappedPosition?.lat, navCore.snappedPosition?.lon]);

  const insets = useSafeAreaInsets();

  // Map controls handlers
  const handleToggleGrid = () => {
    setShowGrid(!showGrid);
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
    if (mapRef.current && location?.region) {
      mapRef.current.animateToRegion(location.region, 1000);
    }
  };

  // Handle map press when grid is active
  const handleMapPress = async (e: any) => {
    // Disable square selection when grid overlay is off
    if (!showGrid) return;
    if (isProcessingGridClick) return;
    
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setIsProcessingGridClick(true);
    setSelectedGridRectangle(null);

    try {
      // Plus code computed locally — no network needed
      const plusCode = encodePlusCode(latitude, longitude, 11);

      // Show rectangle for the clicked grid cell
      const bounds = getGridCellBounds(latitude, longitude);
      setSelectedGridRectangle({
        coordinates: [
          { latitude: bounds.minLat, longitude: bounds.minLng },
          { latitude: bounds.maxLat, longitude: bounds.minLng },
          { latitude: bounds.maxLat, longitude: bounds.maxLng },
          { latitude: bounds.minLat, longitude: bounds.maxLng },
        ],
      });

      // Center map on clicked cell
      if (mapRef.current && plusCode) {
        mapRef.current.animateToRegion(
          {
            latitude: bounds.centerLat,
            longitude: bounds.centerLng,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          500,
        );
      }
    } catch (error) {
      console.warn('Error processing grid click:', error);
    } finally {
      setIsProcessingGridClick(false);
    }
  };

  // Remove rectangle when grid is toggled off
  useEffect(() => {
    if (!showGrid) {
      setSelectedGridRectangle(null);
    }
  }, [showGrid]);

  return (
    <View style={styles.container}>
      <MapViewComponent
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        mapType={show3D ? 'hybrid' : 'standard'}
        routeCoordinates={routeCoordinates}
        startMarker={startMarker}
        endMarker={endMarker}
        location={location}
        startingLocation={startingLocation}
        destination={destination}
        onMapLoad={() => setIsMapReady(true)}
        navigationPosition={
          navCore.isNavigating && navCore.snappedPosition
            ? { longitude: navCore.snappedPosition.lon, latitude: navCore.snappedPosition.lat }
            : null
        }
        currentUserPosition={
          navCore.isNavigating && navCore.snappedPosition
            ? { latitude: navCore.snappedPosition.lat, longitude: navCore.snappedPosition.lon }
            : location?.region
              ? { latitude: location.region.latitude, longitude: location.region.longitude }
              : null
        }
        style={[
          styles.map,
          {
            marginBottom: insets.bottom - 12,
          },
        ]}
        showGrid={showGrid}
        selectedGridRectangle={selectedGridRectangle}
        onMapPress={handleMapPress}
        onRegionDidChange={handleMapRegionChange}
      />
      {/* Map Controls: only when bottom sheet is dismissed so they don't sit on top of Directions/Routes panel */}
      {!showNavigationPanel && (
      <MapControls
        mapRef={mapRef}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggle3D={handleToggle3D}
        onCenterLocation={handleCenterLocation}
        show3D={show3D}
        onOpenOfflineManager={() => setShowOfflineManager(true)}
      />
      )}
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        pointerEvents="box-none">
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setShowSearchResults(undefined);
            setSearchResults(undefined);
            setQuery('');
            setDebounceQuery('');
          }}>
          <View style={styles.container} pointerEvents="box-none">
            <View style={styles.topBar}>
              <SafeAreaView style={styles.topNav}>
                <TouchableOpacity
                  onPress={() => {
                    resetStates();
                    setIsDrawerOpen(true);
                  }}>
                  <Icon source={'menu'} size={32} color={Colors.light[10]} />
                </TouchableOpacity>
                <View style={styles.topNavItemsContainer}>
                  <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => handleNavChange('getDirection')}>
                    <Text
                      style={[
                        styles.navItemText,
                        activeNav === 'getDirection' &&
                          styles.activeNavItemText,
                      ]}>
                      {i18n.t('(tabs).index.getDirection')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleNavChange('findRoute')}>
                    <Text
                      style={[
                        styles.navItemText,
                        activeNav === 'findRoute' && styles.activeNavItemText,
                      ]}>
                      {i18n.t('(tabs).index.findRoute')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
              {/* Task 1-A1: Navigation UI moved into SwipeableBottomSheet; top bar only shows menu + tabs. Trigger to reopen panel when dismissed. */}
              {!showNavigationPanel && (
                <TouchableOpacity
                  onPress={() => setShowNavigationPanel(true)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'center' }}>
                  <Ionicons name="chevron-up" size={24} color={Colors.primary[500]} />
                </TouchableOpacity>
              )}
            </View>

            {/* Navigation Panel: Directions - Rides = single search only (tap address → in-app nav). Plan - Routes = search + "Get Directions →" + planning form (start, destination, add stop, Let's go). */}
            <SwipeableBottomSheet
              visible={showNavigationPanel}
              onDismiss={() => setShowNavigationPanel(false)}
              collapsedHeight={72}
              expandedHeight={420}
              fullHeight={680}>
              {activeNav === 'getDirection' ? (
                <DirectionsRidesPanel
                  value={displayValue ?? query}
                  onFocus={() => {
                    if (showSearchResults && showSearchResults !== 'search') {
                      setSearchResults(undefined);
                      setShowSearchResults(undefined);
                    }
                    setActiveSearchInput('search');
                  }}
                  onChangeText={e => {
                    if (displayValue) setDisplayValue(undefined);
                    if (e.trim() !== query.trim()) {
                      setSearchResults(undefined);
                      setShowSearchResults(undefined);
                    }
                    setQuery(e);
                    setActiveSearchInput('search');
                  }}
                  isSearching={isSearching}
                  onClose={() => {
                    resetStates();
                    setShowNavigationPanel(false);
                    router.replace('/(tabs)');
                  }}
                />
              ) : (
                <>
                  {/* Task 1-A2: State 1 (default) and State 2 (address-found) — single search + "Get Directions →" */}
                  {(panelState === 'default' || panelState === 'address-found') && (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[0.6], marginBottom: 12, lineHeight: 18 }}>
                        {i18n.t('(tabs).index.planRoutesHint')}
                      </Text>
                      <View style={styles.searchContainer}>
                        <View style={styles.searchInputContainer}>
                          <View style={styles.searchInput}>
                            <TouchableOpacity style={styles.searchIconContainer}>
                              <Icon source={'magnify'} size={18} color={Colors.grey} />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.search}
                              value={panelState === 'address-found' ? (destination?.displayValue ?? query) : query}
                              onFocus={() => {
                                setSearchResults(undefined);
                                setShowSearchResults(undefined);
                                setActiveSearchInput('destination');
                              }}
                              onChangeText={e => {
                                if (panelState === 'address-found') setDestination(undefined);
                                if (e.trim() !== query.trim()) {
                                  setSearchResults(undefined);
                                  setShowSearchResults(undefined);
                                }
                                setQuery(e);
                              }}
                              placeholder={i18n.t('(tabs).index.searchJanGoAddress')}
                              placeholderTextColor={Colors.grey}
                              numberOfLines={1}
                            />
                            {isSearching && <ActivityIndicator color={Colors.primary['500']} />}
                          </View>
                        </View>
                      </View>
                      {panelState === 'address-found' && (
                        <TouchableOpacity
                          onPress={() => {
                            setPanelState('planning');
                            setActiveSearchInput(undefined);
                            if (!startingLocation && location?.region) {
                              setStartingLocation({
                                displayValue: i18n.t('(tabs).index.myCurrentLocation'),
                                coordinates: `${location.region.longitude},${location.region.latitude}`,
                              });
                            }
                          }}
                          style={{ marginTop: 12, paddingVertical: 8 }}>
                          <Text style={{ fontSize: 14, fontFamily: 'gentium', color: Colors.primary[500], fontWeight: '600' }}>
                            Get Directions →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {/* State 3 (planning) — waypoints, transport, preferences, route card */}
                  {panelState === 'planning' && (
                <ScrollView
                  style={{ maxHeight: 620 }}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator>
                <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[0.6], marginBottom: 12, paddingHorizontal: 12, lineHeight: 18 }}>
                  {i18n.t('(tabs).index.planRoutesPlanningHint')}
                </Text>
                <View style={[styles.findRouteMainContainer, { flexDirection: 'column' }]}>
                  {/* Transport mode selector */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 12 }}>
                    {(['car', 'bike', 'walk'] as TransportMode[]).map(m => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => routeOptions.setMode(m)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 6,
                          paddingHorizontal: 14,
                          borderRadius: 20,
                          backgroundColor: routeOptions.mode === m ? Colors.primary[500] : Colors.light[10.5],
                        }}>
                        <Ionicons
                          name={m === 'car' ? 'car-outline' : m === 'bike' ? 'bicycle-outline' : 'walk-outline'}
                          size={18}
                          color={routeOptions.mode === m ? Colors.light[10] : Colors.dark[10]}
                        />
                        <Text style={{
                          marginLeft: 4,
                          fontSize: 13,
                          fontFamily: 'gentium',
                          color: routeOptions.mode === m ? Colors.light[10] : Colors.dark[10],
                        }}>
                          {m === 'car' ? 'Drive' : m === 'bike' ? 'Bike' : 'Walk'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Collapsible Route options: avoid toggles + Fastest/Shortest */}
                  <View style={{ marginBottom: 8, paddingHorizontal: 12 }}>
                    <TouchableOpacity
                      onPress={() => setRouteOptionsExpanded(prev => !prev)}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'gentium', color: Colors.dark[10] }}>
                        {i18n.t('(tabs).index.routeOptions')}
                      </Text>
                      <Ionicons
                        name={routeOptionsExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={Colors.dark[10]}
                      />
                    </TouchableOpacity>
                    {routeOptionsExpanded && (
                      <View style={{ paddingVertical: 8, paddingLeft: 4, rowGap: 12 }}>
                        <View>
                          <Text style={{ fontSize: 12, fontFamily: 'gentium', color: Colors.dark[0.6], marginBottom: 6 }}>
                            {i18n.t('(tabs).index.routeType')}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {(['fastest', 'shortest'] as const).map(type => (
                              <TouchableOpacity
                                key={type}
                                onPress={() => routeOptions.setRouteType(type)}
                                style={{
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  borderRadius: 16,
                                  backgroundColor: routeOptions.preferences.routeType === type ? Colors.primary[500] : Colors.light[10.5],
                                }}>
                                <Text style={{
                                  fontSize: 13,
                                  fontFamily: 'gentium',
                                  color: routeOptions.preferences.routeType === type ? Colors.light[10] : Colors.dark[10],
                                }}>
                                  {type === 'fastest' ? i18n.t('(tabs).index.routeTypeFastest') : i18n.t('(tabs).index.routeTypeShortest')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={{ rowGap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[10], flex: 1 }}>
                              {i18n.t('(tabs).index.avoidHighways')}
                            </Text>
                            <Switch
                              value={routeOptions.preferences.avoidHighways}
                              onValueChange={() => routeOptions.togglePreference('avoidHighways')}
                              trackColor={{ false: Colors.light[10.5], true: Colors.primary[300] }}
                              thumbColor={routeOptions.preferences.avoidHighways ? Colors.primary[500] : Colors.light[10]}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[10], flex: 1 }}>
                              {i18n.t('(tabs).index.avoidTolls')}
                            </Text>
                            <Switch
                              value={routeOptions.preferences.avoidTolls}
                              onValueChange={() => routeOptions.togglePreference('avoidTolls')}
                              trackColor={{ false: Colors.light[10.5], true: Colors.primary[300] }}
                              thumbColor={routeOptions.preferences.avoidTolls ? Colors.primary[500] : Colors.light[10]}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[10], flex: 1 }}>
                              {i18n.t('(tabs).index.avoidUnpaved')}
                            </Text>
                            <Switch
                              value={routeOptions.preferences.avoidUnpaved}
                              onValueChange={() => routeOptions.togglePreference('avoidUnpaved')}
                              trackColor={{ false: Colors.light[10.5], true: Colors.primary[300] }}
                              thumbColor={routeOptions.preferences.avoidUnpaved ? Colors.primary[500] : Colors.light[10]}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[10], flex: 1 }}>
                              {i18n.t('(tabs).index.avoidFerries')}
                            </Text>
                            <Switch
                              value={routeOptions.preferences.avoidFerries}
                              onValueChange={() => routeOptions.togglePreference('avoidFerries')}
                              trackColor={{ false: Colors.light[10.5], true: Colors.primary[300] }}
                              thumbColor={routeOptions.preferences.avoidFerries ? Colors.primary[500] : Colors.light[10]}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[10], flex: 1 }}>
                              {i18n.t('(tabs).index.avoidUturns')}
                            </Text>
                            <Switch
                              value={routeOptions.preferences.avoidUturns}
                              onValueChange={() => routeOptions.togglePreference('avoidUturns')}
                              trackColor={{ false: Colors.light[10.5], true: Colors.primary[300] }}
                              thumbColor={routeOptions.preferences.avoidUturns ? Colors.primary[500] : Colors.light[10]}
                            />
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={[styles.findRouteContentContainer]}>
                    <View
                      style={[
                        styles.inputRowAlign,
                        showSearchResults === 'start' ? styles.z99 : styles.z9,
                      ]}>
                      <View
                        style={[
                          styles.searchInput,
                          styles.findRouteSearchInput,
                          styles.findRouteInputWithIcon,
                        ]}>
                        <Icon
                          source={'circle-slice-8'}
                          size={20}
                          color={Colors.primary[500]}
                        />
                        <View style={[styles.relativeContainer, styles.findRouteInputContainer, { flex: 1 }]}>
                          <TextInput
                            style={styles.search}
                            value={
                              activeSearchInput === 'start'
                                ? query
                                : startingLocation?.displayValue
                            }
                            onFocus={() => {
                              // Clear all search results when focusing on any input in findRoute
                              setSearchResults(undefined);
                              setShowSearchResults(undefined);
                              // Clear query so previous input's value doesn't appear
                              setQuery('');
                              setDebounceQuery('');
                              setActiveSearchInput('start');
                            }}
                            onChangeText={e => {
                              if (startingLocation)
                                setStartingLocation(undefined);
                              // Clear search results immediately when user types a new query
                              if (e.trim() !== query.trim()) {
                                setSearchResults(undefined);
                                setShowSearchResults(undefined);
                              }
                              setQuery(e);
                              setActiveSearchInput('start');
                            }}
                            onBlur={() => {
                              if (!startingLocation) {
                                setStartingLocation({
                                  displayValue: i18n.t(
                                    '(tabs).index.myCurrentLocation',
                                  ),
                                  coordinates: `${location?.region.longitude},${location?.region.latitude}`,
                                });
                              }
                            }}
                            placeholder={i18n.t(
                              '(tabs).index.startingLocation',
                            )}
                            placeholderTextColor={Colors.grey}
                            // onFocus={handleOutsidePress}
                            numberOfLines={1}
                          />
                          {activeSearchInput === 'start' && isSearching && (
                            <View style={loaderStyles.indicator}>
                              <ActivityIndicator
                                color={Colors.primary['500']}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    {routeOptions.waypoints.map((waypoint, index) => {
                      return (
                        <View
                          style={[
                            styles.inputRowAlign,
                            { flexDirection: 'row', alignItems: 'center', gap: 12 },
                            showSearchResults === `waypoint-${index}`
                              ? styles.z99
                              : styles.z9,
                          ]}
                          key={waypoint.id}>
                          <View
                            style={[
                              styles.searchInput,
                              styles.findRouteSearchInput,
                              styles.findRouteInputWithIcon,
                              { flex: 1, minWidth: 0 },
                            ]}>
                            <Icon
                              source={'map-marker-outline'}
                              size={20}
                              color={Colors.primary[500]}
                            />
                            <View style={[styles.findRouteInputContainer, { flex: 1 }]}>
                              <TextInput
                                style={styles.search}
                                value={
                                  activeSearchInput === `waypoint-${index}`
                                    ? query
                                    : waypoint.label ?? ''
                                }
                                onFocus={() => {
                                  setSearchResults(undefined);
                                  setShowSearchResults(undefined);
                                  setQuery('');
                                  setDebounceQuery('');
                                  setActiveSearchInput(`waypoint-${index}`);
                                }}
                                onChangeText={e => {
                                  routeOptions.updateWaypoint(waypoint.id, { label: e });
                                  if (e.trim() !== query.trim()) {
                                    setSearchResults(undefined);
                                    setShowSearchResults(undefined);
                                  }
                                  setQuery(e);
                                  setActiveSearchInput(`waypoint-${index}`);
                                }}
                                placeholder={i18n.t(
                                  '(tabs).index.enterWayPoint',
                                )}
                                placeholderTextColor={Colors.grey}
                                numberOfLines={1}
                              />
                              {activeSearchInput === `waypoint-${index}` &&
                                isSearching && (
                                  <View style={loaderStyles.indicator}>
                                    <ActivityIndicator
                                      color={Colors.primary['500']}
                                    />
                                  </View>
                                )}
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[styles.arrowsContainer, { padding: 8, flexShrink: 0 }]}
                            onPress={() => routeOptions.removeWaypoint(waypoint.id)}
                            accessibilityLabel={i18n.t('(tabs).index.removeStop', { defaultValue: 'Remove stop' })}>
                            <Icon
                              source={'close'}
                              size={22}
                              color={Colors.primary[500]}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    <View
                      style={[
                        styles.inputRowAlign,
                        showSearchResults === 'destination'
                          ? styles.z99
                          : styles.z9,
                      ]}>
                      <View
                        style={[
                          styles.searchInput,
                          styles.findRouteSearchInput,
                          styles.findRouteInputWithIcon,
                        ]}>
                        <Icon
                          source={'map-marker-outline'}
                          size={20}
                          color={Colors.primary[500]}
                        />
                        <View style={[styles.relativeContainer, styles.findRouteInputContainer, { flex: 1 }]}>
                          <TextInput
                            style={styles.search}
                            value={
                              activeSearchInput === 'destination'
                                ? query
                                : destination?.displayValue
                            }
                            onFocus={() => {
                              setSearchResults(undefined);
                              setShowSearchResults(undefined);
                              setQuery('');
                              setDebounceQuery('');
                              setActiveSearchInput('destination');
                            }}
                            onChangeText={e => {
                              if (destination) setDestination(undefined);
                              if (e.trim() !== query.trim()) {
                                setSearchResults(undefined);
                                setShowSearchResults(undefined);
                              }
                              setQuery(e);
                              setActiveSearchInput('destination');
                            }}
                            placeholder={i18n.t('(tabs).index.endLocation')}
                            placeholderTextColor={Colors.grey}
                            numberOfLines={1}
                          />
                          {activeSearchInput === 'destination' &&
                            isSearching && (
                              <View style={loaderStyles.indicator}>
                                <ActivityIndicator
                                  color={Colors.primary['500']}
                                />
                              </View>
                            )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.findRouteBottomContainer}>
                      <TouchableOpacity
                        style={styles.addDestinationContainer}
                        onPress={async () => {
                          if (!routeOptions.canAddWaypoint) {
                            setError(i18n.t('(tabs).index.cannotAdd'));
                            await delay(3000);
                            setError(undefined);
                          } else {
                            routeOptions.addWaypoint();
                          }
                        }}
                        disabled={!routeOptions.canAddWaypoint}>
                        <Icon
                          source={'plus-box'}
                          size={20}
                          color={Colors.primary[500]}
                        />
                        <Text style={styles.addDestinationText}>
                          {i18n.t('(tabs).index.addStop')}
                        </Text>
                      </TouchableOpacity>
                      <Button
                        style={styles.findRouteCTAButton}
                        loading={offlineRouteLoading}
                        disabled={offlineRouteLoading || !destination || !startingLocation}
                        onPress={async e => {
                          e.stopPropagation();
                          if (!destination?.coordinates || !startingLocation?.coordinates) return;
                          const [startLon, startLat] = startingLocation.coordinates.split(',').map(Number);
                          const [endLon, endLat] = destination.coordinates.split(',').map(Number);
                          const origin: [number, number] = [startLon, startLat];
                          const dest: [number, number] = [endLon, endLat];
                          const ordered = routeOptions.getOrderedCoordinates(origin, dest);
                          const options = await getRoutingOptions();
                          const routeOptionsWithStops =
                            ordered && ordered.length > 2
                              ? { ...options, waypoints: ordered.slice(1, -1) }
                              : options;
                          const result = await fetchOfflineRoute(origin, dest, routeOptionsWithStops);
                          if (result?.success && result.path?.length) {
                            const pathForMap = result.path.map(([lon, lat]: [number, number]) => ({ longitude: lon, latitude: lat }));
                            handlePathCalculated(pathForMap);
                            setActiveRouteCoords(result.path);
                            setOfflineRouteDistanceMeters(result.distance);
                            setIsRouteModalVisible(true);
                          } else {
                            setShowNoRoutingData(true);
                          }
                        }}>
                        <Text style={styles.findRouteCTAText}>
                          {i18n.t('(tabs).index.letsGo')}
                        </Text>
                      </Button>
                    </View>
                  </View>

                  <View style={styles.arrowsContainer}>
                    {routeOptions.waypoints.length === 0 && (
                      <Ionicons
                        name="swap-vertical"
                        size={24}
                        color={Colors.light[10]}
                      />
                    )}
                  </View>

                  {/* Task 1-A2: Clear and Back to search */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 12, paddingBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setPanelState('default');
                        setDestination(undefined);
                        setStartingLocation(undefined);
                        routeOptions.clearWaypoints();
                        setShowSearchResults(undefined);
                        setRouteCoordinates(undefined);
                        setOfflineRouteDistanceMeters(null);
                        resetOfflineRoute();
                      }}>
                      <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.primary[500], fontWeight: '600' }}>
                        Clear
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPanelState('address-found')}>
                      <Text style={{ fontSize: 13, fontFamily: 'gentium', color: Colors.dark[0.6] }}>
                        ← Back to search
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
                  )}
                </>
              )}
            </SwipeableBottomSheet>

            {/* Search result for Directions - Rides Search. */}
            {activeNav === 'getDirection' &&
              showSearchResults === 'search' &&
              searchResults && (
                <View
                  style={[
                    loaderStyles.searchResultsContainer,
                    { top: isSmallDevice ? 100 : isLargeDevice ? 100 : 130 },
                  ]}>
                  <SearchResultsContainer
                    searchResults={searchResults || []}
                    setMapScrollEnabled={() => {}}
                    onSelect={async item => {
                      const displayText = item?.businessName
                        ? item.businessName
                        : item?.formattedAddress?.includes('\n')
                          ? item.formattedAddress.split('\n')[0]
                          : (item?.formattedAddress?.split(',')[0] ?? '');
                      const coordinates = `${item?.longitude},${item?.latitude}`;

                      setDestination({ displayValue: displayText, coordinates });
                      setDisplayValue(displayText);
                      setShowSearchResults(undefined);
                      navigation.setOptions({ gestureEnabled: false });

                      // Ensure start is set for intent (NavigationCore uses MY_LOCATION and resolves it)
                      if (!startingLocation && location?.region) {
                        setStartingLocation({
                          displayValue: i18n.t('(tabs).index.myCurrentLocation'),
                          coordinates: `${location.region.longitude},${location.region.latitude}`,
                        });
                      }

                      const modeToProfile: Record<string, RoutingProfile> = {
                        car: 'car',
                        walk: 'walk',
                        bike: 'car',
                        motor_scooter: 'motor_scooter',
                      };
                      const intent: NavigationIntent = {
                        mode: 'STANDARD',
                        start: { type: 'MY_LOCATION' },
                        destination: {
                          lat: Number(item?.latitude) ?? 0,
                          lon: Number(item?.longitude) ?? 0,
                          label: displayText,
                        },
                        routingProfile: modeToProfile[routeOptions.mode] ?? 'car',
                      };

                      try {
                        await navCore.startNavigation(intent);
                        await navCore.confirmStart();
                        setShowSearchResults(undefined);
                        setShowNavigationPanel(false);
                        navigation.setOptions({ gestureEnabled: true });
                      } catch (err: any) {
                        navigation.setOptions({ gestureEnabled: true });
                        const rawMessage = err?.message ?? String(err ?? '');
                        const isEngineUnavailableError =
                          /native module not linked|JNI bridge|Phase 1|engine.*not.*available/i.test(
                            rawMessage.trim(),
                          );
                        const friendlyEngineMessage = i18n.t(
                          '(tabs).navigation.error.engineUnavailableOnDevice',
                          {
                            defaultValue:
                              'In-app turn-by-turn is not available on this device. Use \"Open in another app\" to navigate with Google Maps or another app.',
                          },
                        );
                        setError(
                          isEngineUnavailableError
                            ? friendlyEngineMessage
                            : i18n.t('(tabs).index.navigationFailed', {
                                defaultValue:
                                  'Unable to start in-app navigation. Please try again or use another app.',
                              }),
                        );
                      }
                    }}
                    containerStyle={styles.marginTop}
                  />
                </View>
              )}
            {/* End of Get Directions - Rides */}

            {/* Search result for Plan Routs start search field. */}
            {activeNav === 'findRoute' &&
              showSearchResults === 'start' &&
              searchResults && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: isSmallDevice ? 118 : 147,
                    left: 20,
                    right: 20,
                    zIndex: 99999,
                    elevation: 10, // Android elevation
                  }}>
                  <View
                    style={[
                      loaderStyles.searchResultsContainer,
                      {
                        position: 'relative',
                      },
                    ]}>
                    <SearchResultsContainer
                      searchResults={searchResults || []}
                      // setMapScrollEnabled={setMapScrollEnabled}
                      setMapScrollEnabled={() => {}}
                      onSelect={item => {
                        setStartingLocation({
                          displayValue: item?.businessName
                            ? item?.businessName
                            : ((item?.formattedAddress?.includes('\n')
                                ? item.formattedAddress.split('\n')[0]
                                : item?.formattedAddress?.split(',')[0]) ?? ''),
                          coordinates: `${item?.longitude},${item?.latitude}`,
                        });
                        setShowSearchResults(undefined);
                      }}
                    />
                  </View>
                </View>
              )}
            {/* End of Get Plan - Routes start field */}

            {/* Search result for Plan Routs destination search field. (Task 1-A2: also when panelState default/address-found) */}
            {activeNav === 'findRoute' &&
              showSearchResults === 'destination' &&
              (panelState !== 'planning' || routeOptions.waypoints.length === 0) &&
              searchResults && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: isSmallDevice ? 170 : 200,
                    left: 20,
                    right: 20,
                    zIndex: 99999,
                    elevation: 10, // Android elevation
                  }}>
                  <View
                    style={[
                      loaderStyles.searchResultsContainer,
                      {
                        position: 'relative',
                      },
                    ]}>
                    <SearchResultsContainer
                      searchResults={searchResults || []}
                      // isSearching={isSearching}
                      setMapScrollEnabled={() => {}}
                      onSelect={item => {
                        const displayValue = item?.businessName
                          ? item?.businessName
                          : ((item?.formattedAddress?.includes('\n')
                              ? item.formattedAddress.split('\n')[0]
                              : item?.formattedAddress?.split(',')[0]) ?? '');
                        const coordinates = `${item?.longitude},${item?.latitude}`;

                        setDestination({
                          displayValue,
                          coordinates,
                        });

                        if (panelState === 'default') {
                          setPanelState('address-found');
                          setShowSearchResults(undefined);
                          setActiveSearchInput(undefined);
                          return;
                        }

                        setSelectedAddressForModal({
                          displayValue,
                          coordinates,
                          latitude: Number(item?.latitude) || 0,
                          longitude: Number(item?.longitude) || 0,
                        });
                        setIsRouteModalVisible(true);
                        setShowSearchResults(undefined);
                        setActiveSearchInput(undefined);
                      }}
                    />
                  </View>
                </View>
              )}
            {/* End of Get Plan - Routes destination field */}
 
            {/* Search result for Plan Routes waypoint search fields */}
            {activeNav === 'findRoute' &&
              routeOptions.waypoints.map((waypoint, waypointIndex) => {
                if (showSearchResults === `waypoint-${waypointIndex}` && searchResults) {
                  const baseTop = isSmallDevice ? 118 : 147;
                  const waypointOffset = (waypointIndex + 1) * 52;
                  return (
                    <View
                      key={`waypoint-results-${waypoint.id}`}
                      pointerEvents="box-none"
                      style={{
                        position: 'absolute',
                        top: baseTop + waypointOffset,
                        left: 20,
                        right: 20,
                        zIndex: 99999,
                        elevation: 10,
                      }}>
                      <View
                        style={[
                          loaderStyles.searchResultsContainer,
                          { position: 'relative' },
                        ]}>
                        <SearchResultsContainer
                          searchResults={searchResults || []}
                          setMapScrollEnabled={() => {}}
                          onSelect={item => {
                            const label = item?.businessName
                              ? item.businessName
                              : ((item?.formattedAddress?.includes('\n')
                                  ? item.formattedAddress.split('\n')[0]
                                  : item?.formattedAddress?.split(',')[0]) ?? '');
                            const coordinates: [number, number] = [
                              Number(item?.longitude) ?? 0,
                              Number(item?.latitude) ?? 0,
                            ];
                            routeOptions.updateWaypoint(waypoint.id, { label, coordinates });
                            setShowSearchResults(undefined);
                            setActiveSearchInput(undefined);
                          }}
                        />
                      </View>
                    </View>
                  );
                }
                return null;
              })}

            {/* Search result for Plan Routs destination search field when waypoints are added. */}
            {activeNav === 'findRoute' &&
              showSearchResults === 'destination' &&
              routeOptions.waypoints.length > 0 &&
              searchResults && (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: isSmallDevice ? 170 + (routeOptions.waypoints.length * 52) : 200 + (routeOptions.waypoints.length * 52),
                    left: 20,
                    right: 20,
                    zIndex: 99999,
                    elevation: 10, // Android elevation
                  }}>
                  <View
                    style={[
                      loaderStyles.searchResultsContainer,
                      {
                        position: 'relative',
                      },
                    ]}>
                    <SearchResultsContainer
                      searchResults={searchResults || []}
                      // isSearching={isSearching}
                      setMapScrollEnabled={() => {}}
                      onSelect={item => {
                        const displayValue = item?.businessName
                          ? item?.businessName
                          : ((item?.formattedAddress?.includes('\n')
                              ? item.formattedAddress.split('\n')[0]
                              : item?.formattedAddress?.split(',')[0]) ?? '');
                        const coordinates = `${item?.longitude},${item?.latitude}`;

                        // Set the destination
                        setDestination({
                          displayValue,
                          coordinates,
                        });

                        // Prepare address data for modal
                        setSelectedAddressForModal({
                          displayValue,
                          coordinates,
                          latitude: Number(item?.latitude) || 0,
                          longitude: Number(item?.longitude) || 0,
                        });

                        // Show the MapViewModal
                        setIsRouteModalVisible(true);
                        setShowSearchResults(undefined);
                        setActiveSearchInput(undefined);
                      }}
                    />
                  </View>
                </View>
              )}
            {/* End of Get Plan - Routes destination field when waypoint field are added.  */}
          </View>
        </TouchableWithoutFeedback>
        <Snackbar
          visible={!!error}
          onDismiss={() => setError(undefined)}
          duration={
            error?.includes('timeout') || error?.includes('unavailable')
              ? 0
              : 5000
          }
          style={[defaultStyles.snackbar, defaultStyles.marginBottom]}
          action={{
            label:
              error?.includes('timeout') || error?.includes('unavailable')
                ? 'Retry'
                : 'Dismiss',
            onPress: () => {
              if (
                error?.includes('timeout') ||
                error?.includes('unavailable')
              ) {
                retryLocation();
              } else {
                setError(undefined);
              }
            },
          }}>
          <Text style={defaultStyles.errorText}>{error}</Text>
        </Snackbar>
      </KeyboardAvoidingView>
      {showNoRoutingData && (
        <View style={loaderStyles.noRoutingCard}>
          <NoRoutingDataCard
            onManageDataPacks={() => {
              setShowNoRoutingData(false);
              setShowOfflineManager(true);
            }}
            onDismiss={() => setShowNoRoutingData(false)}
          />
        </View>
      )}
      <Loader visible={isLoading || offlineRouteLoading} text={offlineRouteLoading ? i18n.t('(tabs).index.gettingRoute', { defaultValue: 'Getting route…' }) : loadingText} />
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {navCore.isNavigating && (
        <NavigationOverlay
          formattedETA={navCore.eta?.formattedETA ?? ''}
          formattedDistance={navCore.eta?.formattedDistance ?? ''}
          currentStepIndex={navCore.currentManeuverIndex}
          progress={0}
          steps={navCore.session?.activeRoute?.maneuvers?.map(m => ({ instruction: m.instruction, distance: m.distance })) ?? []}
          offRouteAction={navCore.isOffRoute ? { type: 'reroute', message: 'Recalculating route...' } : { type: 'none' }}
          onStop={() => navCore.stop()}
          onReroute={handleReroute}
          followMap={followMapEnabled}
          onFollowMapChange={setFollowMapEnabled}
          arrived={navCore.state === 'ARRIVED'}
        />
      )}

      {navCore.error && (
        <NavigationErrorCard
          failureCode={navCore.error.code}
          failureMessage={navCore.error.message}
          onDismiss={() => navCore.stop()}
          onRetry={() => {
            const intent = navCore.session?.intent;
            if (intent) {
              navCore.stop().then(() => navCore.startNavigation(intent));
            }
          }}
          onDownloadPack={() => {
            navCore.stop();
            setShowOfflineManager(true);
          }}
          onSwitchProfile={() => {
            navCore.stop();
          }}
        />
      )}

      <RouteModal
        visible={isRouteModalVisible}
        onClose={() => {
          setIsRouteModalVisible(false);
          navCore.stop();
        }}
        onStartInAppNavigation={destination?.coordinates ? handleStartInAppNavigation : undefined}
        startingLocation={startingLocation}
        destination={destination}
        waypoints={routeOptions.waypoints.map(w => ({
          displayValue: w.label,
          coordinates: w.coordinates ? `${w.coordinates[0]},${w.coordinates[1]}` : '',
        }))}
        routeDetails={{
          distance:
            offlineRouteDistanceMeters != null
              ? `${(offlineRouteDistanceMeters / 1000).toFixed(1)} km`
              : routeData?.routes?.[0]?.distance_km
                ? `${routeData.routes[0].distance_km} km`
                : '',
          duration:
            navCore.isNavigating && navCore.eta?.formattedETA
              ? navCore.eta.formattedETA
              : estimatedTravelTime?.[routeOptions.mode === 'bike' ? 'bicycling' : routeOptions.mode === 'walk' ? 'walking' : 'driving'] || '',
        }}
      />

      <MapViewModal
        visible={isMapViewModalVisible}
        onClose={() => setIsMapViewModalVisible(false)}
        selectedAddress={selectedAddressForModal}
      />

      {/* Offline Data Manager — SwipeableBottomSheet covers the tab bar (same as Find/Create tab) */}
      <SwipeableBottomSheet
        visible={showOfflineManager}
        onDismiss={() => setShowOfflineManager(false)}
        collapsedHeight={600}
        expandedHeight={600}
        fullHeight={750}>
        <OfflineDataManager onClose={() => setShowOfflineManager(false)} />
      </SwipeableBottomSheet>
    </View>
  );
}

export const loaderStyles = StyleSheet.create({
  noRoutingCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    zIndex: 1000,
  },
  searchResultsContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    borderRadius: 8,
    height: 240,
    // width: '80%',
    zIndex: 9999,
  },
  indicatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  indicatorContent: {
    width: 140,
    height: 80,
    backgroundColor: Colors.primary['500'],
    borderRadius: 4,
  },
  indicator: {
    position: 'absolute',
    right: 16,
    top: 10,
  },
  text: { color: Colors.light['10'], marginTop: 12, textAlign: 'center' },
});
