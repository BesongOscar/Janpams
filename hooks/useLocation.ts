import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';
import i18n from '../i18n';

interface LocationState {
  description: string;
  region: Region;
}

interface LocationOptions {
  accuracy?: Location.Accuracy;
  timeout?: number;
  maximumAge?: number;
  retries?: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationState>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const getCurrentLocation = async (options: LocationOptions = {}) => {
    const {
      accuracy = Location.Accuracy.Balanced,
      timeout = 60000, // 30 seconds
      maximumAge = 60000, // 1 minute
      retries = 3,
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastError: Error | null | any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        setIsLoading(true);
        setError(undefined);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError(i18n.t('(tabs).index.pleaseAcceptPermissions'));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy,
          timeout,
          maximumAge,
        });

        const address = await Location.reverseGeocodeAsync(
          currentLocation.coords,
        );

        setLocation({
          description: `${address[0].name}, ${address[0].city}, ${address[0].country}`,
          region: {
            ...currentLocation.coords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
        });

        return; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;

        // Handle specific error types
        if (error?.code === 'E_LOCATION_TIMEOUT') {
          console.warn(`⏰ Location timeout on attempt ${attempt}`);
        } else if (error?.code === 'E_LOCATION_SERVICES_DISABLED') {
          setError(
            'Location services are disabled. Please enable them in your device settings.',
          );
          break; // Don't retry if location services are disabled
        } else if (error?.code === 'E_LOCATION_UNAVAILABLE') {
          console.warn(`📍 Location unavailable on attempt ${attempt}`);
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < retries) {
          const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } finally {
        if (attempt === retries) {
          setIsLoading(false);
        }
      }
    }

    // If we get here, all retries failed

    if (lastError) {
      let errorMessage = i18n.t('(tabs).index.errorGettingLocation');

      if (lastError?.code === 'E_LOCATION_TIMEOUT') {
        errorMessage =
          'Location request timed out. Please check your GPS signal and try again.';
      } else if (lastError?.code === 'E_LOCATION_SERVICES_DISABLED') {
        errorMessage =
          'Location services are disabled. Please enable them in your device settings.';
      } else if (lastError?.code === 'E_LOCATION_UNAVAILABLE') {
        errorMessage =
          'Location is currently unavailable. Please try again in a moment.';
      } else if (lastError?.message?.includes('timeout')) {
        errorMessage =
          'Location request timed out. Please check your internet connection and GPS signal.';
      }

      setError(errorMessage);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    location,
    isLoading,
    error,
    getCurrentLocation,
  };
};
