import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { LOCATION_THRESHOLDS } from '@/constants/locationThresholds';

export interface LocationContextState {
  currentLocation: Location.LocationObjectCoords | null;
  locationAge: number; // Age in milliseconds
  isStale: boolean; // Soft stale (>30s)
  isHardStale: boolean; // Hard stale (>120s)
  accuracy: number | null; // Accuracy in meters
  isFetching: boolean;
  error: string | null;
  lastFetchTime: number | null;
}

export interface UseLocationContextOptions {
  /** Maximum age before location is considered stale (default: 30s) */
  maxAge?: number;
  /** Maximum age before location is considered hard stale (default: 120s) */
  hardStaleAge?: number;
  /** Accuracy threshold in meters (default: 50m) */
  accuracyThreshold?: number;
  /** Whether to start monitoring immediately */
  autoStart?: boolean;
  /** Callback when location becomes stale */
  onStale?: () => void;
  /** Callback when location becomes hard stale */
  onHardStale?: () => void;
}

/**
 * Hook to manage location context with freshness validation
 * Ensures location is always fresh and accurate for form submission
 */
export function useLocationContext(options: UseLocationContextOptions = {}) {
  const {
    maxAge = LOCATION_THRESHOLDS.MAX_AGE_MS,
    hardStaleAge = LOCATION_THRESHOLDS.HARD_STALE_AGE_MS,
    accuracyThreshold = LOCATION_THRESHOLDS.ACCURACY_THRESHOLD_M,
    autoStart = true,
    onStale,
    onHardStale,
  } = options;

  const [state, setState] = useState<LocationContextState>({
    currentLocation: null,
    locationAge: Infinity,
    isStale: false,
    isHardStale: false,
    accuracy: null,
    isFetching: false,
    error: null,
    lastFetchTime: null,
  });

  const onStaleRef = useRef(onStale);
  const onHardStaleRef = useRef(onHardStale);

  useEffect(() => {
    onStaleRef.current = onStale;
    onHardStaleRef.current = onHardStale;
  }, [onStale, onHardStale]);

  // Update location age and staleness
  useEffect(() => {
    if (!state.lastFetchTime) return;

    const updateAge = () => {
      const age = Date.now() - state.lastFetchTime!;
      const isStale = age > maxAge;
      const isHardStale = age > hardStaleAge;

      setState(prev => ({
        ...prev,
        locationAge: age,
        isStale,
        isHardStale,
      }));

      // Trigger callbacks
      if (isHardStale && onHardStaleRef.current) {
        onHardStaleRef.current();
      } else if (isStale && onStaleRef.current) {
        onStaleRef.current();
      }
    };

    updateAge();
    const interval = setInterval(updateAge, 1000); // Update every second

    return () => clearInterval(interval);
  }, [state.lastFetchTime, maxAge, hardStaleAge]);

  /**
   * Fetch fresh location from device
   */
  const refreshLocation = useCallback(async (): Promise<Location.LocationObjectCoords | null> => {
    try {
      setState(prev => ({ ...prev, isFetching: true, error: null }));

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const error = 'Location permission not granted';
        setState(prev => ({ ...prev, isFetching: false, error }));
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const accuracy = currentLocation.coords.accuracy ?? null;

      setState(prev => ({
        ...prev,
        currentLocation: currentLocation.coords,
        accuracy,
        isFetching: false,
        error: null,
        lastFetchTime: Date.now(),
        locationAge: 0,
        isStale: false,
        isHardStale: false,
      }));

      return currentLocation.coords;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to get location';
      setState(prev => ({ ...prev, isFetching: false, error: errorMessage }));
      return null;
    }
  }, []);

  /**
   * Validate location for form submission
   * Returns true if location is valid, false otherwise
   */
  const validateForSubmit = useCallback((): {
    isValid: boolean;
    reason?: string;
  } => {
    if (!state.currentLocation) {
      return { isValid: false, reason: 'No location available' };
    }

    if (state.isHardStale) {
      return { isValid: false, reason: 'Location is too old. Please refresh.' };
    }

    if (state.accuracy !== null && state.accuracy > accuracyThreshold) {
      return {
        isValid: false,
        reason: `Location accuracy is low (${Math.round(state.accuracy)}m). Please move to an open area or retry.`,
      };
    }

    if (state.locationAge > maxAge) {
      return { isValid: false, reason: 'Location is stale. Please refresh.' };
    }

    return { isValid: true };
  }, [state, accuracyThreshold, maxAge]);

  /**
   * Calculate distance between current location and another location
   */
  const calculateDistance = useCallback(
    (lat: number, lon: number): number => {
      if (!state.currentLocation) return Infinity;

      const R = 6371e3; // Earth's radius in meters
      const φ1 = (state.currentLocation.latitude * Math.PI) / 180;
      const φ2 = (lat * Math.PI) / 180;
      const Δφ = ((lat - state.currentLocation.latitude) * Math.PI) / 180;
      const Δλ = ((lon - state.currentLocation.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    },
    [state.currentLocation],
  );

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      refreshLocation();
    }
  }, [autoStart]); // Only run once on mount

  return {
    ...state,
    refreshLocation,
    validateForSubmit,
    calculateDistance,
  };
}

