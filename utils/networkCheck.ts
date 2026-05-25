import Toast from 'react-native-toast-message';
import i18n from '../i18n';

// Lazy initialization of NetInfo to prevent re-render issues
let NetInfo: any = null;
let netInfoInitialized = false;
let netInfoInitError: Error | null = null;

/**
 * Safely initialize NetInfo only once
 * This prevents re-renders and crashes on Android
 */
const initializeNetInfo = (): any => {
  if (netInfoInitialized) {
    return NetInfo;
  }

  netInfoInitialized = true;

  try {
    const netInfoModule = require('@react-native-community/netinfo');
    NetInfo = netInfoModule.default || netInfoModule;
    
    // Verify NetInfo has required methods
    if (NetInfo && typeof NetInfo.fetch === 'function') {
      return NetInfo;
    } else {
      console.warn('⚠️ NetInfo native module not properly linked');
      NetInfo = null;
      return null;
    }
  } catch (error) {
    netInfoInitError = error as Error;
    console.warn('⚠️ Failed to import NetInfo:', error);
    NetInfo = null;
    return null;
  }
};

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Check if the device has network connectivity
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  // Lazy initialize NetInfo
  const netInfo = initializeNetInfo();
  
  // If NetInfo is not available, assume connected to prevent blocking functionality
  if (!netInfo) {
    return true;
  }

  try {
    const state = await netInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    console.warn('Error checking network connectivity:', error);
    // Return true as fallback to not block app functionality
    return true;
  }
};

/**
 * Get detailed network state information
 * @returns Promise<NetworkState> - detailed network state
 */
export const getNetworkState = async (): Promise<NetworkState> => {
  // Lazy initialize NetInfo
  const netInfo = initializeNetInfo();
  
  // If NetInfo is not available, return a default connected state
  if (!netInfo) {
    return {
      isConnected: true,
      isInternetReachable: true,
      type: 'unknown',
    };
  }

  try {
    const state = await netInfo.fetch();
    return {
      isConnected: state.isConnected === true,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  } catch (error) {
    console.warn('Error getting network state:', error);
    // Return connected state as fallback
    return {
      isConnected: true,
      isInternetReachable: true,
      type: 'unknown',
    };
  }
};

/**
 * Show network error toast with appropriate message
 * @param networkState - current network state
 */
export const showNetworkErrorToast = (networkState: NetworkState) => {
  let message = i18n.t('common.noInternetConnection', 'No internet connection');
  let description = i18n.t(
    'common.checkConnection',
    'Please check your internet connection and try again',
  );

  if (!networkState.isConnected) {
    message = i18n.t('common.noConnection', 'No connection');
    description = i18n.t(
      'common.enableWifiOrData',
      'Please enable WiFi or mobile data',
    );
  } else if (networkState.isInternetReachable === false) {
    message = i18n.t('common.noInternetAccess', 'No internet access');
    description = i18n.t(
      'common.checkInternetConnection',
      'Connected to network but no internet access',
    );
  }

  Toast.show({
    type: 'error',
    text1: message,
    text2: description,
    position: 'top',
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 60,
  });
};

/**
 * Show network success toast when connection is restored
 */
export const showNetworkSuccessToast = () => {
  Toast.show({
    type: 'success',
    text1: i18n.t('common.connectionRestored', 'Connection restored'),
    text2: i18n.t(
      'common.youCanNowContinue',
      'You can now continue using the app',
    ),
    position: 'top',
    visibilityTime: 3000,
    autoHide: true,
    topOffset: 60,
  });
};

/**
 * Check network connectivity and show error toast if no connection
 * @returns Promise<boolean> - true if connected, false if not connected (and shows toast)
 */
export const checkNetworkAndShowError = async (): Promise<boolean> => {
  const networkState = await getNetworkState();

  if (!networkState.isConnected || networkState.isInternetReachable === false) {
    showNetworkErrorToast(networkState);
    return false;
  }

  return true;
};

/**
 * Set up network state listener to show toasts when connection changes
 * @param onConnectionChange - callback when connection state changes
 */
export const setupNetworkListener = (
  // eslint-disable-next-line no-unused-vars
  onConnectionChange?: (isConnected: boolean) => void,
) => {
  // Lazy initialize NetInfo
  const netInfo = initializeNetInfo();
  
  // If NetInfo is not available, return a no-op unsubscribe function
  if (!netInfo) {
    return () => {}; // Return empty unsubscribe function
  }

  try {
    return netInfo.addEventListener((state: any) => {
    const isConnected =
      state.isConnected === true && state.isInternetReachable === true;

    if (onConnectionChange) {
      onConnectionChange(isConnected);
    }

    // Show success toast when connection is restored
    if (isConnected && state.isInternetReachable === true) {
      showNetworkSuccessToast();
    }
  });
  } catch (error) {
    console.warn('Error setting up network listener:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Check if the current network state indicates a network error
 * @param error - axios error object
 * @returns boolean - true if it's a network error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;

  // Check for common network error patterns
  const networkErrorPatterns = [
    'Network Error',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_CONNECTION_RESET',
    'ERR_NAME_NOT_RESOLVED',
    'timeout',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
  ];

  const errorMessage = error?.message || error?.code || '';
  const errorString = errorMessage.toString().toLowerCase();

  return networkErrorPatterns.some(pattern =>
    errorString.includes(pattern.toLowerCase()),
  );
};

/**
 * Enhanced network check with retry logic
 * @param maxRetries - maximum number of retries
 * @param retryDelay - delay between retries in ms
 * @returns Promise<boolean> - true if connected after retries
 */
export const checkNetworkWithRetry = async (
  maxRetries: number = 3,
  retryDelay: number = 1000,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isConnected = await checkNetworkConnectivity();

    if (isConnected) {
      return true;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // Show error toast on final failure
  const networkState = await getNetworkState();
  showNetworkErrorToast(networkState);
  return false;
};
