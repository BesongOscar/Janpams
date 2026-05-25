import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { LOCATION_THRESHOLDS } from '@/constants/locationThresholds';
import { UseLocationContextOptions, useLocationContext } from './useLocationContext';

export type ResetType = 'soft' | 'hard';

export interface ResetReason {
  type: ResetType;
  reason: string;
  distance?: number; // Distance moved in meters
  backgroundTime?: number; // Time in background in ms
  locationAge?: number; // Location age in ms
}

export interface UseFormResetWithLocationOptions {
  /** Location context options */
  locationOptions?: UseLocationContextOptions;
  /** Callback for soft reset (refresh location, keep inputs) */
  onSoftReset: (reason: ResetReason) => void | Promise<void>;
  /** Callback for hard reset (clear everything, navigate home) */
  onHardReset: (reason: ResetReason) => void | Promise<void>;
  /** Whether to reset on focus (iOS only) */
  shouldResetOnFocus?: boolean;
  /** Whether to reset on app state change */
  shouldResetOnAppStateChange?: boolean;
  /** Whether to monitor location changes */
  shouldResetOnLocationChange?: boolean;
  /** Route to navigate to on hard reset */
  resetRoute?: string;
  /** Initial location to compare against (optional, will use locationContext if not provided) */
  initialLocation?: Location.LocationObjectCoords;
  /** Image picker state to prevent false resets */
  isImagePickerActive?: boolean;
  isImagePickerActiveRef?: React.MutableRefObject<boolean>;
  imagePickerLaunchTime?: React.MutableRefObject<number>;
}

/**
 * Unified hook to handle form resets based on location changes, app state, and navigation
 * Provides soft reset (refresh location, keep inputs) and hard reset (clear everything)
 */
export function useFormResetWithLocation(
  options: UseFormResetWithLocationOptions,
) {
  const {
    locationOptions = {},
    onSoftReset,
    onHardReset,
    shouldResetOnFocus = true,
    shouldResetOnAppStateChange = true,
    shouldResetOnLocationChange = true,
    resetRoute = '/(tabs)',
    initialLocation,
    isImagePickerActive = false,
    isImagePickerActiveRef,
    imagePickerLaunchTime,
  } = options;

  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);
  const lastKnownLocation = useRef<Location.LocationObjectCoords | null>(
    initialLocation || null,
  );
  const isInitialMount = useRef(true);
  const hasResetOnFocus = useRef(false);
  const onSoftResetRef = useRef(onSoftReset);
  const onHardResetRef = useRef(onHardReset);
  const isMonitoringActiveRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onSoftResetRef.current = onSoftReset;
    onHardResetRef.current = onHardReset;
  }, [onSoftReset, onHardReset]);

  // Get location context
  const locationContext = useLocationContext({
    ...locationOptions,
    autoStart: true,
  });

  // Update lastKnownLocation when locationContext updates
  useEffect(() => {
    if (locationContext.currentLocation && !lastKnownLocation.current) {
      lastKnownLocation.current = locationContext.currentLocation;
    }
  }, [locationContext.currentLocation]);

  // Calculate distance between two coordinates
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    },
    [],
  );

  // Determine reset type based on distance
  const determineResetType = useCallback(
    (distance: number): ResetType => {
      if (distance >= LOCATION_THRESHOLDS.MAX_MOVE_HARD_M) {
        return 'hard';
      }
      if (distance >= LOCATION_THRESHOLDS.MAX_MOVE_SOFT_M) {
        return 'soft';
      }
      return 'soft'; // Default to soft for small changes
    },
    [],
  );

  // Handle reset with reason
  const handleReset = useCallback(
    async (reason: ResetReason) => {
      if (reason.type === 'hard') {
        await onHardResetRef.current(reason);
        if (resetRoute) {
          router.replace(resetRoute as unknown as never);
        }
      } else {
        await onSoftResetRef.current(reason);
      }
    },
    [resetRoute, router],
  );

  // Handle app state changes
  useEffect(() => {
    if (!shouldResetOnAppStateChange) return;

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        backgroundTimeRef.current = Date.now();
      } else if (
        appState.current === 'background' &&
        nextAppState === 'active'
      ) {
        const backgroundTime = backgroundTimeRef.current
          ? Date.now() - backgroundTimeRef.current
          : 0;

        // Skip if image picker is active
        setTimeout(() => {
          const isPickerActiveRef = isImagePickerActiveRef?.current ?? false;
          const isPickerActiveState = isImagePickerActive;
          const isPickerActive = isPickerActiveRef || isPickerActiveState;

          const launchTime = imagePickerLaunchTime?.current ?? 0;
          const timeSinceLastLaunch = Date.now() - launchTime;
          const wasRecentlyLaunched = timeSinceLastLaunch < 5000;

          if (isPickerActive || wasRecentlyLaunched) {
            return;
          }

          // Check if background time exceeds threshold
          if (backgroundTime >= LOCATION_THRESHOLDS.MAX_BG_MS) {
            // Hard reset if background time > 60s
            handleReset({
              type: 'hard',
              reason: `App was idle for ${Math.round(backgroundTime / 1000)}s — location refreshed`,
              backgroundTime,
            });
          } else if (backgroundTime > 2000) {
            // Soft reset for shorter background times
            // Refresh location context
            locationContext.refreshLocation().then(freshLocation => {
              if (freshLocation && lastKnownLocation.current) {
                const distance = calculateDistance(
                  lastKnownLocation.current.latitude,
                  lastKnownLocation.current.longitude,
                  freshLocation.latitude,
                  freshLocation.longitude,
                );

                if (distance >= LOCATION_THRESHOLDS.MAX_MOVE_SOFT_M) {
                  handleReset({
                    type: determineResetType(distance),
                    reason: 'App was idle — location refreshed',
                    distance,
                    backgroundTime,
                  });
                }
              }
            });
          }
        }, 1000);

        backgroundTimeRef.current = null;
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [
    shouldResetOnAppStateChange,
    isImagePickerActive,
    isImagePickerActiveRef,
    imagePickerLaunchTime,
    handleReset,
    locationContext,
    calculateDistance,
    determineResetType,
  ]);

  // Handle location monitoring
  useEffect(() => {
    if (
      !shouldResetOnLocationChange ||
      !locationContext.currentLocation ||
      isMonitoringActiveRef.current
    ) {
      return;
    }

    // Set initial location if not set
    if (!lastKnownLocation.current) {
      lastKnownLocation.current = locationContext.currentLocation;
      return;
    }

    isMonitoringActiveRef.current = true;

    const startLocationMonitoring = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          isMonitoringActiveRef.current = false;
          return;
        }

        locationWatchId.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_THRESHOLDS.LOCATION_CHECK_INTERVAL_MS,
            distanceInterval: LOCATION_THRESHOLDS.LOCATION_CHECK_DISTANCE_M,
          },
          location => {
            if (lastKnownLocation.current) {
              const distance = calculateDistance(
                lastKnownLocation.current.latitude,
                lastKnownLocation.current.longitude,
                location.coords.latitude,
                location.coords.longitude,
              );

              if (distance >= LOCATION_THRESHOLDS.MAX_MOVE_SOFT_M) {
                const resetType = determineResetType(distance);

                // Stop monitoring before reset
                if (locationWatchId.current) {
                  locationWatchId.current.remove();
                  locationWatchId.current = null;
                  isMonitoringActiveRef.current = false;
                }

                handleReset({
                  type: resetType,
                  reason:
                    resetType === 'hard'
                      ? `You moved ${Math.round(distance)}m — form reset to current location`
                      : `You moved ${Math.round(distance)}m — location refreshed`,
                  distance,
                });
              } else {
                // Update last known location for small movements
                lastKnownLocation.current = location.coords;
              }
            } else {
              lastKnownLocation.current = location.coords;
            }
          },
        );
      } catch {
        isMonitoringActiveRef.current = false;
      }
    };

    // Wait a bit before starting monitoring to avoid false triggers
    const timer = setTimeout(() => {
      startLocationMonitoring();
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (locationWatchId.current) {
        locationWatchId.current.remove();
        locationWatchId.current = null;
      }
      isMonitoringActiveRef.current = false;
    };
  }, [
    shouldResetOnLocationChange,
    locationContext.currentLocation,
    calculateDistance,
    determineResetType,
    handleReset,
  ]);

  // Handle focus reset (iOS only)
  if (Platform.OS !== 'android' && shouldResetOnFocus) {
    useFocusEffect(
      useCallback(() => {
        if (isInitialMount.current) {
          isInitialMount.current = false;
          hasResetOnFocus.current = true;
          return;
        }

        if (hasResetOnFocus.current) {
          // Check location staleness on focus
          if (locationContext.isHardStale) {
            handleReset({
              type: 'hard',
              reason: 'Location is old — please confirm current position',
              locationAge: locationContext.locationAge,
            });
          } else if (locationContext.isStale) {
            // Soft refresh on focus if stale
            locationContext.refreshLocation();
          }
        }

        return () => {
          hasResetOnFocus.current = false;
        };
      }, [locationContext, handleReset]),
    );
  }

  return {
    locationContext,
    handleReset,
  };
}

