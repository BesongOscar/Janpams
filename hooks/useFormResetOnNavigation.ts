import React, { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

interface UseFormResetOnNavigationProps {
  onFormReset: () => void;
  shouldResetOnFocus?: boolean;
  shouldResetOnAppStateChange?: boolean;
  shouldResetOnLocationChange?: boolean;
  resetRoute?: string; // Route to navigate to when form should be reset
  locationChangeThreshold?: number; // Distance in meters to trigger reset (default: 100m)
  initialLocation?: Location.LocationObjectCoords; // Initial location when form was opened
  // eslint-disable-next-line no-unused-vars
  onLocationChangeReset?: (distance: number) => void; // Callback when form resets due to location change
  isImagePickerActive?: boolean; // Track image picker state
  isImagePickerActiveRef?: React.MutableRefObject<boolean>; // Ref for immediate access
  imagePickerLaunchTime?: React.MutableRefObject<number>; // Ref for launch time tracking
}

/**
 * Custom hook to handle form reset when:
 * 1. App goes to background and comes back to foreground
 * 2. User navigates away from the form and returns
 * 3. App state changes that might affect location accuracy
 * 4. User moves to a significantly different location while form is open
 */
export function useFormResetOnNavigation({
  onFormReset,
  shouldResetOnFocus = true,
  shouldResetOnAppStateChange = true,
  shouldResetOnLocationChange = true,
  resetRoute,
  locationChangeThreshold = 100, // 100 meters default
  initialLocation,
  onLocationChangeReset,
  isImagePickerActive = false,
  isImagePickerActiveRef,
  imagePickerLaunchTime,
}: UseFormResetOnNavigationProps) {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const hasResetOnFocus = useRef(false);
  const isInitialMount = useRef(true);
  // eslint-disable-next-line no-undef
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);
  const lastKnownLocation = useRef<Location.LocationObjectCoords | null>(
    initialLocation || null,
  );

  // Helper function to calculate distance between two coordinates
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
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
  };

  // On Android, if focus reset is disabled, completely skip the focus effect
  if (Platform.OS === 'android' && !shouldResetOnFocus) {
    // Only handle app state and location changes
    useEffect(() => {
      if (!shouldResetOnAppStateChange) return;

      const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current === 'background' && nextAppState === 'active') {
          onFormReset();
          if (resetRoute) {
            router.replace(resetRoute as unknown as never);
          }
        }
        appState.current = nextAppState;
      });

      return () => {
        subscription.remove();
      };
    }, [onFormReset, shouldResetOnAppStateChange, resetRoute, router]);

    // Handle location changes
    useEffect(() => {
      if (!shouldResetOnLocationChange || !initialLocation) return;

      const startLocationMonitoring = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            return;
          }

          locationWatchId.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 30000,
              distanceInterval: 10,
            },
            location => {
              if (lastKnownLocation.current) {
                const distance = calculateDistance(
                  lastKnownLocation.current.latitude,
                  lastKnownLocation.current.longitude,
                  location.coords.latitude,
                  location.coords.longitude,
                );

                if (distance > locationChangeThreshold) {
                  if (onLocationChangeReset) {
                    onLocationChangeReset(distance);
                  }
                  onFormReset();
                  if (resetRoute) {
                    router.replace(resetRoute as unknown as never);
                  }
                  lastKnownLocation.current = location.coords;
                }
              } else {
                lastKnownLocation.current = location.coords;
              }
            },
          );
        } catch {
          // TODO: Handle error if necessary
        }
      };

      startLocationMonitoring();

      return () => {
        if (locationWatchId.current) {
          locationWatchId.current.remove();
          locationWatchId.current = null;
        }
      };
    }, [
      shouldResetOnLocationChange,
      initialLocation,
      locationChangeThreshold,
      onFormReset,
      resetRoute,
      router,
      onLocationChangeReset,
    ]);

    return; // Early return for Android with focus reset disabled
  }

  // Reset form when user navigates away and comes back
  useFocusEffect(
    useCallback(() => {
      // Early return if focus reset is disabled
      if (!shouldResetOnFocus) {
        return;
      }

      // Skip reset on initial mount to prevent immediate reset when screen first opens
      if (isInitialMount.current) {
        isInitialMount.current = false;
        hasResetOnFocus.current = true;
        return;
      }

      // Clear any existing timeout
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }

      // Only reset if the user has previously navigated away from this screen
      if (hasResetOnFocus.current) {
        // Add a small delay on Android to prevent immediate resets
        const delay = Platform.OS === 'android' ? 200 : 0;

        focusTimeoutRef.current = setTimeout(() => {
          // User has navigated away and returned, reset the form
          onFormReset();
          if (resetRoute) {
            router.replace(resetRoute as unknown as never);
          }
        }, delay);
      }

      return () => {
        // Clear timeout on cleanup
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = null;
        }

        // This runs when the screen loses focus
        // Mark that the user has navigated away
        hasResetOnFocus.current = false;
      };
    }, [onFormReset, shouldResetOnFocus, resetRoute, router]),
  );

  // Handle app state changes (background/foreground)
  useEffect(() => {
    if (!shouldResetOnAppStateChange) return;

    const subscription = AppState.addEventListener('change', nextAppState => {
      // If app was in background and is now active, reset the form immediately
      // This ensures forms requiring location are reset when user navigates away
      if (appState.current === 'background' && nextAppState === 'active') {
        // Add a delay to allow image picker state to be properly set
        setTimeout(() => {
          // Check both the ref (immediate) and state (may be stale) for image picker activity
          const isPickerActiveRef = isImagePickerActiveRef?.current ?? false;
          const isPickerActiveState = isImagePickerActive;
          const isPickerActive = isPickerActiveRef || isPickerActiveState;

          // Also check if image picker was launched recently (within last 5 seconds)
          const launchTime = imagePickerLaunchTime?.current ?? 0;
          const timeSinceLastLaunch = Date.now() - launchTime;
          const wasRecentlyLaunched = timeSinceLastLaunch < 5000; // 5 seconds

          // Only reset if image picker is not active and wasn't recently launched
          if (!isPickerActive && !wasRecentlyLaunched) {
            console.log('🔄 App returned from background, resetting form and navigating to home...');
            onFormReset();
            if (resetRoute) {
              router.replace(resetRoute as unknown as never);
            }
          } else {
            console.log('⏸️ Skipping reset - image picker active or recently launched');
          }
        }, 1000); // 1 second delay to ensure state is properly set
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [onFormReset, shouldResetOnAppStateChange, resetRoute, router, isImagePickerActive, isImagePickerActiveRef, imagePickerLaunchTime]);

  // Store callbacks in refs to prevent re-renders
  const onFormResetRef = useRef(onFormReset);
  const onLocationChangeResetRef = useRef(onLocationChangeReset);
  const locationChangeThresholdRef = useRef(locationChangeThreshold);
  const resetRouteRef = useRef(resetRoute);
  const isMonitoringActiveRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onFormResetRef.current = onFormReset;
    onLocationChangeResetRef.current = onLocationChangeReset;
    locationChangeThresholdRef.current = locationChangeThreshold;
    resetRouteRef.current = resetRoute;
  }, [onFormReset, onLocationChangeReset, locationChangeThreshold, resetRoute]);

  // Store initial location in ref to prevent re-initialization
  useEffect(() => {
    if (initialLocation && !lastKnownLocation.current) {
      lastKnownLocation.current = initialLocation;
    }
  }, [initialLocation]);

  // Monitor location changes when form is active
  useEffect(() => {
    if (!shouldResetOnLocationChange || !initialLocation || isMonitoringActiveRef.current) {
      return;
    }

    isMonitoringActiveRef.current = true;

    const startLocationMonitoring = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          isMonitoringActiveRef.current = false;
          return;
        }

        // Start watching location changes
        locationWatchId.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High, // Use high accuracy for precise addressing
            timeInterval: 15000, // Check every 15 seconds (more frequent for better responsiveness)
            distanceInterval: 10, // Check when moved 10 meters
          },
          location => {
            if (lastKnownLocation.current) {
              const distance = calculateDistance(
                lastKnownLocation.current.latitude,
                lastKnownLocation.current.longitude,
                location.coords.latitude,
                location.coords.longitude,
              );

              // If user moved more than the threshold, reset the form
              if (distance > locationChangeThresholdRef.current) {
                // Call the location change callback if provided
                if (onLocationChangeResetRef.current) {
                  onLocationChangeResetRef.current(distance);
                }

                // Stop monitoring before reset to prevent re-render loop
                if (locationWatchId.current) {
                  locationWatchId.current.remove();
                  locationWatchId.current = null;
                  isMonitoringActiveRef.current = false;
                }

                onFormResetRef.current();
                if (resetRouteRef.current) {
                  router.replace(resetRouteRef.current as unknown as never);
                }
              } else {
                // Update last known location only if within threshold
                lastKnownLocation.current = location.coords;
              }
            } else {
              // First location reading, just store it
              lastKnownLocation.current = location.coords;
            }
          },
        );
      } catch {
        isMonitoringActiveRef.current = false;
        // TODO: Handle error if necessary
      }
    };

    startLocationMonitoring();

    // Cleanup location monitoring
    return () => {
      if (locationWatchId.current) {
        locationWatchId.current.remove();
        locationWatchId.current = null;
      }
      isMonitoringActiveRef.current = false;

      // Clear any pending focus timeout
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [
    shouldResetOnLocationChange,
    initialLocation, // Only depend on initialLocation to set it once
    router,
  ]);
}
