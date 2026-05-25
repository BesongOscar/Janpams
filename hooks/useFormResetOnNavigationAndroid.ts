import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

interface UseFormResetOnNavigationAndroidProps {
  onFormReset: () => void;
  shouldResetOnAppStateChange?: boolean;
  shouldResetOnLocationChange?: boolean;
  resetRoute?: string;
  locationChangeThreshold?: number;
  initialLocation?: Location.LocationObjectCoords;
  // eslint-disable-next-line no-unused-vars
  onLocationChangeReset?: (distance: number) => void;
  isImagePickerActive?: boolean; // New prop to track image picker state
  isImagePickerActiveRef?: React.MutableRefObject<boolean>; // Ref for immediate access
  imagePickerLaunchTime?: React.MutableRefObject<number>; // Ref for launch time tracking
}

/**
 * Simplified hook for Android that only handles app state and location changes
 * without the problematic focus effect that causes immediate resets
 */
export function useFormResetOnNavigationAndroid({
  onFormReset,
  shouldResetOnAppStateChange = true,
  shouldResetOnLocationChange = true,
  resetRoute,
  locationChangeThreshold = 100,
  initialLocation,
  onLocationChangeReset,
  isImagePickerActive = false,
  isImagePickerActiveRef,
  imagePickerLaunchTime,
}: UseFormResetOnNavigationAndroidProps) {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);
  const lastKnownLocation = useRef<Location.LocationObjectCoords | null>(
    initialLocation || null,
  );
  // eslint-disable-next-line no-undef
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line no-undef
  const imagePickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimeRef = useRef<number | null>(null);
  const onFormResetRef = useRef(onFormReset);
  const formMountTimeRef = useRef<number>(Date.now());
  const isInitialMountRef = useRef<boolean>(true);
  const isKeyboardVisibleRef = useRef<boolean>(false);
  const lastAppStateChangeTimeRef = useRef<number>(Date.now());

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

  // Update form reset ref when callback changes
  useEffect(() => {
    onFormResetRef.current = onFormReset;
  }, [onFormReset]);

  // Mark initial mount as complete after a short delay
  // This prevents false resets when the form first loads
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialMountRef.current = false;
      console.log('✅ Form mount grace period complete, monitoring enabled');
    }, 5000); // 5 second grace period after mount to prevent false triggers

    return () => clearTimeout(timer);
  }, []);

  // Monitor keyboard state to prevent false resets when keyboard opens/closes
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardVisibleRef.current = true;
      console.log('⌨️ Keyboard shown');
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardVisibleRef.current = false;
      console.log('⌨️ Keyboard hidden');
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    if (!shouldResetOnAppStateChange) return;

    const subscription = AppState.addEventListener('change', nextAppState => {
      // Clear any existing inactivity timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }

      const now = Date.now();
      const timeSinceLastStateChange = now - lastAppStateChangeTimeRef.current;
      lastAppStateChangeTimeRef.current = now;

      if (nextAppState === 'background') {
        // Record when app goes to background
        backgroundTimeRef.current = now;
        // Set a timeout for long inactivity (15 minutes) - same as iOS
        inactivityTimeoutRef.current = setTimeout(
          () => {
            onFormResetRef.current();
          },
          15 * 60 * 1000, // 15 minutes - same threshold as iOS
        );
      } else if (
        appState.current === 'background' &&
        nextAppState === 'active'
      ) {
        // Clear any existing image picker timeout
        if (imagePickerTimeoutRef.current) {
          clearTimeout(imagePickerTimeoutRef.current);
          imagePickerTimeoutRef.current = null;
        }

        // Check if form was just mounted or if we're still in the grace period
        // This prevents false resets when navigating to the form
        const timeSinceMount = now - formMountTimeRef.current;
        const isRecentlyMounted = timeSinceMount < 5000; // 5 seconds grace period

        if (isRecentlyMounted || isInitialMountRef.current) {
          console.log('⏸️ Form was just mounted, skipping reset to prevent false trigger');
          // Reset background time but don't reset form
          backgroundTimeRef.current = null;
          appState.current = nextAppState;
          return;
        }

        // Check if keyboard is visible - if so, this is likely a keyboard-related state change, not a real background
        if (isKeyboardVisibleRef.current) {
          console.log('⌨️ Keyboard is visible, skipping reset (likely keyboard-related state change)');
          backgroundTimeRef.current = null;
          appState.current = nextAppState;
          return;
        }

        // Check if the app was actually in background for a meaningful duration
        // Very short background periods (< 2 seconds) are likely keyboard/focus events, not real backgrounding
        const backgroundDuration = backgroundTimeRef.current 
          ? now - backgroundTimeRef.current 
          : 0;
        
        if (backgroundDuration < 2000) {
          console.log(`⏸️ App was in background for only ${backgroundDuration}ms, likely keyboard/focus event. Skipping reset.`);
          backgroundTimeRef.current = null;
          appState.current = nextAppState;
          return;
        }

        // Also check if state change happened very quickly (likely keyboard-related)
        if (timeSinceLastStateChange < 500) {
          console.log(`⏸️ State change happened too quickly (${timeSinceLastStateChange}ms), likely keyboard-related. Skipping reset.`);
          backgroundTimeRef.current = null;
          appState.current = nextAppState;
          return;
        }

        // Reset immediately when app comes back from background
        // This ensures forms requiring location are reset when user navigates away
        console.log(`🔄 App returned from background after ${backgroundDuration}ms, resetting form and navigating to home...`);
        
        // Add a delay when returning from background to allow image picker state to be properly set
        imagePickerTimeoutRef.current = setTimeout(() => {
          // Check both the ref (immediate) and state (may be stale) for image picker activity
          const isPickerActiveRef = isImagePickerActiveRef?.current ?? false;
          const isPickerActiveState = isImagePickerActive;
          const isPickerActive = isPickerActiveRef || isPickerActiveState;

          // Also check if image picker was launched recently (within last 5 seconds)
          const launchTime = imagePickerLaunchTime?.current ?? 0;
          const timeSinceLastLaunch = Date.now() - launchTime;
          const wasRecentlyLaunched = timeSinceLastLaunch < 5000; // 5 seconds

          // Double-check keyboard state before resetting
          if (!isPickerActive && !wasRecentlyLaunched && !isKeyboardVisibleRef.current) {
            onFormResetRef.current();
          } else {
            console.log('⏸️ Skipping reset - image picker active, recently launched, or keyboard visible');
          }
        }, 1000); // 1 second delay to ensure state is properly set
           
        // Reset background time
        backgroundTimeRef.current = null;
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      // Clear inactivity timeout on cleanup
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      // Clear image picker timeout on cleanup
      if (imagePickerTimeoutRef.current) {
        clearTimeout(imagePickerTimeoutRef.current);
        imagePickerTimeoutRef.current = null;
      }
    };
  }, [
    shouldResetOnAppStateChange,
    isImagePickerActive,
    isImagePickerActiveRef,
    imagePickerLaunchTime,
  ]);

  // Store callbacks in refs to prevent re-renders
  const onLocationChangeResetRef = useRef(onLocationChangeReset);
  const locationChangeThresholdRef = useRef(locationChangeThreshold);
  const isMonitoringActiveRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onLocationChangeResetRef.current = onLocationChangeReset;
    locationChangeThresholdRef.current = locationChangeThreshold;
  }, [onLocationChangeReset, locationChangeThreshold]);

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

    // Helper function to start location monitoring
    const startLocationMonitoring = async () => {
      if (isMonitoringActiveRef.current) return; // Already monitoring
      
      isMonitoringActiveRef.current = true;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          isMonitoringActiveRef.current = false;
          return;
        }

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

              if (distance > locationChangeThresholdRef.current) {
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
              } else {
                // Update last known location only if within threshold
                lastKnownLocation.current = location.coords;
              }
            } else {
              lastKnownLocation.current = location.coords;
            }
          },
        );
      } catch {
        isMonitoringActiveRef.current = false;
        // TODO: Handle error if necessary
      }
    };

    // Don't start monitoring immediately - wait for form to be fully loaded
    // This prevents false location change triggers on initial mount
    if (isInitialMountRef.current) {
      // Wait for the mount grace period to complete before starting location monitoring
      const timer = setTimeout(() => {
        // Double-check that we're still in a valid state to start monitoring
        if (!isMonitoringActiveRef.current && initialLocation && shouldResetOnLocationChange && !isInitialMountRef.current) {
          startLocationMonitoring();
        }
      }, 5500); // Slightly longer than mount grace period to ensure it's complete

      return () => clearTimeout(timer);
    }

    // If not initial mount, start monitoring immediately
    startLocationMonitoring();

    return () => {
      if (locationWatchId.current) {
        locationWatchId.current.remove();
        locationWatchId.current = null;
      }
      isMonitoringActiveRef.current = false;
    };
  }, [
    shouldResetOnLocationChange,
    initialLocation, // Only depend on initialLocation to set it once
  ]);
}
