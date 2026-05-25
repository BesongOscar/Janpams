import * as Location from 'expo-location';
import { Region } from 'react-native-maps';

export interface LocationFallbackOptions {
  enableNetworkLocation?: boolean;
  enableCachedLocation?: boolean;
  fallbackToLastKnown?: boolean;
  accuracyThreshold?: number;
}

export interface LocationResult {
  coords: Location.LocationObjectCoords;
  source: 'gps' | 'network' | 'cached' | 'fallback';
  accuracy: number;
}

/**
 * Attempts to get location with multiple fallback strategies
 */
export const getLocationWithFallback = async (
  options: LocationFallbackOptions = {},
): Promise<LocationResult> => {
  const {
    enableNetworkLocation = true,
    enableCachedLocation = true,
    fallbackToLastKnown = true,
    accuracyThreshold = 100, // meters
  } = options;

  let lastError: Error | null = null;

  // Strategy 1: Try high accuracy GPS first
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeout: 20000, // 20 seconds for high accuracy
      maximumAge: 30000, // 30 seconds
    });

    if (
      location.coords.accuracy &&
      location.coords.accuracy <= accuracyThreshold
    ) {
      return {
        coords: location.coords,
        source: 'gps',
        accuracy: location.coords.accuracy || 0,
      };
    }
  } catch (error) {
    lastError = error as Error;
    console.warn('❌ High accuracy GPS failed:', error);
  }

  // Strategy 2: Try balanced accuracy GPS
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 30000, // 30 seconds
      maximumAge: 60000, // 1 minute
    });

    return {
      coords: location.coords,
      source: 'gps',
      accuracy: location.coords.accuracy || 0,
    };
  } catch (error) {
    lastError = error as Error;
    console.warn('❌ Balanced accuracy GPS failed:', error);
  }

  // Strategy 3: Try low accuracy GPS (faster, less precise)
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeout: 15000, // 15 seconds
      maximumAge: 120000, // 2 minutes
    });

    return {
      coords: location.coords,
      source: 'gps',
      accuracy: location.coords.accuracy || 0,
    };
  } catch (error) {
    lastError = error as Error;
    console.warn('❌ Low accuracy GPS failed:', error);
  }

  // Strategy 4: Try network-based location (if enabled)
  if (enableNetworkLocation) {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        timeout: 10000, // 10 seconds
        maximumAge: 300000, // 5 minutes
      });

      return {
        coords: location.coords,
        source: 'network',
        accuracy: location.coords.accuracy || 0,
      };
    } catch (error) {
      lastError = error as Error;
      console.warn('❌ Network-based location failed:', error);
    }
  }

  // Strategy 5: Try cached location (if enabled)
  if (enableCachedLocation) {
    try {
      const location = await Location.getLastKnownPositionAsync({
        maxAge: 300000, // 5 minutes
        requiredAccuracy: 1000, // 1km accuracy threshold
      });

      if (location) {
        return {
          coords: location.coords,
          source: 'cached',
          accuracy: location.coords.accuracy || 0,
        };
      }
    } catch (error) {
      lastError = error as Error;
      console.warn('❌ Cached location failed:', error);
    }
  }

  // Strategy 6: Fallback to default location (if enabled)
  if (fallbackToLastKnown) {
    const fallbackCoords: Location.LocationObjectCoords = {
      latitude: 4.1594,
      longitude: 9.2481,
      altitude: null,
      accuracy: 1000, // 1km accuracy
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    };

    return {
      coords: fallbackCoords,
      source: 'fallback',
      accuracy: 1000,
    };
  }

  // If all strategies fail, throw the last error
  throw (
    lastError ||
    new Error('Unable to obtain location using any available method')
  );
};

/**
 * Creates a region from coordinates with appropriate deltas
 */
export const createRegionFromCoords = (
  coords: Location.LocationObjectCoords,
  accuracy?: number,
): Region => {
  // Adjust delta based on accuracy
  const baseDelta = 0.01;
  const accuracyMultiplier = accuracy ? Math.max(1, accuracy / 100) : 1;
  const delta = baseDelta * accuracyMultiplier;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
};

/**
 * Checks if location accuracy is acceptable
 */
export const isLocationAccurate = (
  accuracy: number,
  threshold: number = 100,
): boolean => {
  return accuracy <= threshold;
};

/**
 * Gets a user-friendly description of location source
 */
export const getLocationSourceDescription = (
  source: LocationResult['source'],
): string => {
  switch (source) {
    case 'gps':
      return 'GPS location';
    case 'network':
      return 'Network location';
    case 'cached':
      return 'Cached location';
    case 'fallback':
      return 'Default location';
    default:
      return 'Unknown source';
  }
};
