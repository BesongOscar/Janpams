import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import {
  checkNetworkAndShowError,
  isNetworkError,
  getNetworkState,
} from './networkCheck';
import { readData, storeData } from './storage';
import { getAuthTokens, setAuthTokens } from './secureAuthStorage';
import {
  logout,
  getIsRefreshing,
  setIsRefreshing,
  subscribeToTokenRefresh,
  notifyTokenRefresh,
  notifyTokenRefreshFailure,
  resetRefreshState,
} from './auth';
import { getExpiresAtFromToken } from './jwt';
import { getSupabase } from '@/lib/supabase/client';

// Force the base URL to always be available
// Points to the new NestJS mobile-api running on dev machine.
// Android emulator uses 10.0.2.2 to reach host localhost.
const FORCE_BASE_URL = 'http://10.0.2.2:3001';

// Override the environment variable completely for now
process.env.EXPO_PUBLIC_BASE_URL_VERSION_TWO = FORCE_BASE_URL;

// Ultimate fallback function that NEVER returns undefined
const getGuaranteedBaseURL = (): string => {
  return FORCE_BASE_URL;
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Start with 1 second
  retryDelayMultiplier: 2, // Double the delay each retry
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// Function to create retry delay
const createRetryDelay = (retryCount: number): number => {
  return (
    RETRY_CONFIG.retryDelay *
    Math.pow(RETRY_CONFIG.retryDelayMultiplier, retryCount - 1)
  );
};

// Function to check if error is retryable
const isRetryableError = (error: AxiosError): boolean => {
  // Network timeout or connection errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Server errors that might be temporary
  if (
    error.response?.status &&
    RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)
  ) {
    return true;
  }

  return false;
};

// Retry function with exponential backoff
const retryRequest = async (
  config: AxiosRequestConfig,
  retryCount: number = 0,
): Promise<any> => {
  try {
    const instance = getAxiosInstance();
    return await instance.request(config);
  } catch (error) {
    const axiosError = error as AxiosError;

    if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(axiosError)) {
      const delay = createRetryDelay(retryCount + 1);
      console.warn(
        `🔄 Retry attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms for ${config.url}`,
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(config, retryCount + 1);
    }

    throw error;
  }
};

// Lazy initialization variables
let _axiosInstance: ReturnType<typeof axios.create> | null = null;
let _axiosFormDataInstance: ReturnType<typeof axios.create> | null = null;

// Global variable to store logout callback for redirect
let logoutCallback: (() => void) | null = null;
let sessionExpiryCallback: ((expiresAtMs: number | null) => void) | null = null;

/**
 * Set the logout callback function that will be called when token refresh fails
 * This should be set by the app root component to handle navigation
 */
export const setLogoutCallback = (callback: () => void) => {
  logoutCallback = callback;
};

/**
 * Set the session expiry callback (called when auth header is set from token).
 * Used to expose sessionExpiresAt in app context.
 */
export const setSessionExpiryCallback = (callback: (expiresAtMs: number | null) => void) => {
  sessionExpiryCallback = callback;
};

/**
 * Invoke the registered logout callback (clear user, navigate to login).
 * Call after performLogout() for user-initiated or 401 logout.
 */
export const triggerLogoutNavigation = (): void => {
  if (logoutCallback) logoutCallback();
};

// Central error logging function
const logError = (error: any) => {
  const config = error.config || {};
  const duration = config.metadata?.startTime
    ? Date.now() - config.metadata.startTime
    : 'N/A';

  const errorLog = {
    type: 'API_ERROR',
    method: config.method?.toUpperCase() || 'UNKNOWN',
    url: config.url ? `${config.baseURL || ''}${config.url}` : 'UNKNOWN',
    fullUrl: config.url ? `${config.baseURL || ''}${config.url}` : 'UNKNOWN',
    timestamp: new Date().toISOString(),
    duration: `${duration}ms`,
    error: {
      message: error.message || 'Unknown error',
      code: error.code,
      name: error.name,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      requestData: config.data,
      headers: error.response?.headers,
    },
    stack: error.stack,
  };

  console.log('❌ API Error:', JSON.stringify(errorLog, null, 2));
  
  // Also log a simplified version for quick debugging
  console.log(
    `❌ API Error [${errorLog.method}] ${errorLog.url}:`,
    error.response?.status || error.code || 'NO_STATUS',
    error.response?.data || error.message,
  );
};

// Function to get or create axios instance
const getAxiosInstance = (): ReturnType<typeof axios.create> => {
  if (!_axiosInstance) {
    const baseURL = getGuaranteedBaseURL();
    _axiosInstance = axios.create({
      baseURL,
      timeout: 45000, // 45 seconds timeout for all endpoints
      headers: {
        'X-App-Client': 'com.janitsolutions.jangoaddressmaker',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      // Add additional axios configuration for better reliability
      maxRedirects: 5,
      // Treat 401 as error so it goes through error handler for token refresh
      // Other 4xx errors (except 401) can be handled as non-errors if needed
      validateStatus: status => {
        // 401 must be treated as error to trigger token refresh
        if (status === 401) return false;
        // Treat 5xx as errors
        if (status >= 500) return false;
        // Everything else (2xx, 3xx, other 4xx) is considered success
        return true;
      },
    });

    // Add interceptors to the instance
    _axiosInstance.interceptors.request.use(
      async config => {
        // Check network connectivity before making the request (but don't block if check fails)
        try {
          const hasNetwork = await checkNetworkAndShowError();
          if (!hasNetwork) {
            console.warn(
              '⚠️ Network check failed, but proceeding with request',
            );
          }
        } catch (networkCheckError) {
          console.warn(
            '⚠️ Network check error, proceeding with request:',
            networkCheckError,
          );
        }

        // Ensure base URL is always correct
        const guaranteedBaseURL = getGuaranteedBaseURL();
        if (config.baseURL !== guaranteedBaseURL) {
          console.warn(
            '🔄 Updating base URL from',
            config.baseURL,
            'to',
            guaranteedBaseURL,
          );
          config.baseURL = guaranteedBaseURL;
        }

        // Ensure auth header is set for non-auth endpoints
        const isAuthEndpoint = config.url?.includes('/auth/login') ||
                              config.url?.includes('/auth/refresh') ||
                              config.url?.includes('/auth/register');

        if (!isAuthEndpoint && !config.headers?.Authorization) {
          const instance = getAxiosInstance();
          // Prefer Supabase session token when configured (same as web)
          const supabase = getSupabase();
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              config.headers = config.headers || {};
              config.headers.Authorization = `Bearer ${session.access_token}`;
            }
          }
          if (!config.headers?.Authorization) {
            const defaultAuth = instance.defaults.headers.common['Authorization'];
            if (defaultAuth) {
              config.headers = config.headers || {};
              config.headers.Authorization = defaultAuth;
            }
          }
        }

        // Add request timestamp for debugging
        (config as any).metadata = {
          ...(config as any).metadata,
          startTime: Date.now(),
        };
        
        // Log request details
        const requestLog = {
          type: 'API_REQUEST',
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          timestamp: new Date().toISOString(),
          headers: {
            ...config.headers,
            Authorization: config.headers?.Authorization ? 'Bearer ***' : undefined,
          },
          params: config.params,
          data: config.data,
        };
        
        console.log('🌐 API Request:', JSON.stringify(requestLog, null, 2));
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    _axiosInstance.interceptors.response.use(
      response => {
        // Check for 401 even in success handler (safety check)
        // This should not happen with the new validateStatus, but just in case
        if (response.status === 401) {
          console.warn('⚠️ 401 detected in success handler, converting to error...');
          const error = new Error('Unauthenticated') as any;
          error.response = response;
          error.config = response.config;
          error.isAxiosError = true;
          logError(error);
          return handleResponseError(error);
        }

        // Log successful responses
        const config = response.config;
        const duration = (config as any).metadata?.startTime
          ? Date.now() - (config as any).metadata.startTime
          : 'N/A';
        
        const logData = {
          type: 'API_RESPONSE',
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
          data: response.data,
        };

        console.log('✅ API Response:', JSON.stringify(logData, null, 2));
        
        return response;
      },
      async error => {
        // Log errors centrally
        logError(error);
        return handleResponseError(error);
      },
    );
  }
  return _axiosInstance;
};

// Function to get or create axios form data instance
const getAxiosFormDataInstance = (): ReturnType<typeof axios.create> => {
  if (!_axiosFormDataInstance) {
    const baseURL = getGuaranteedBaseURL();

    _axiosFormDataInstance = axios.create({
      baseURL,
      timeout: 45000, // 45 seconds timeout for file uploads
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-App-Client': 'com.janitsolutions.jangoaddressmaker',
      },
      maxRedirects: 5,
      // Treat 401 as error so it goes through error handler for token refresh
      validateStatus: status => {
        if (status === 401) return false; // 401 must trigger error handler
        if (status >= 500) return false; // 5xx are errors
        return true; // Everything else is success
      },
    });

    // Add interceptors to the form data instance
    _axiosFormDataInstance.interceptors.request.use(
      async config => {
        // Check network connectivity before making the request (but don't block if check fails)
        try {
          const hasNetwork = await checkNetworkAndShowError();
          if (!hasNetwork) {
            console.warn(
              '⚠️ Network check failed for FormData, but proceeding with request',
            );
          }
        } catch (networkCheckError) {
          console.warn(
            '⚠️ Network check error for FormData, proceeding with request:',
            networkCheckError,
          );
        }

        const guaranteedBaseURL = getGuaranteedBaseURL();
        if (config.baseURL !== guaranteedBaseURL) {
          console.warn(
            '🔄 Updating FormData base URL from',
            config.baseURL,
            'to',
            guaranteedBaseURL,
          );
          config.baseURL = guaranteedBaseURL;
        }

        (config as any).metadata = {
          ...(config as any).metadata,
          startTime: Date.now(),
        };
        
        // Log FormData request details
        const requestLog = {
          type: 'API_REQUEST_FORM_DATA',
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          timestamp: new Date().toISOString(),
          headers: {
            ...config.headers,
            Authorization: config.headers?.Authorization ? 'Bearer ***' : undefined,
          },
          params: config.params,
          // Note: FormData content is not logged as it's binary/multipart
        };
        
        console.log('🌐 API Request (FormData):', JSON.stringify(requestLog, null, 2));
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    _axiosFormDataInstance.interceptors.response.use(
      response => {
        // Check for 401 even in success handler (safety check)
        if (response.status === 401) {
          console.warn('⚠️ 401 detected in FormData success handler, converting to error...');
          const error = new Error('Unauthenticated') as any;
          error.response = response;
          error.config = response.config;
          error.isAxiosError = true;
          logError(error);
          return handleResponseError(error);
        }

        // Log successful FormData responses
        const config = response.config;
        const duration = (config as any).metadata?.startTime
          ? Date.now() - (config as any).metadata.startTime
          : 'N/A';
        
        const logData = {
          type: 'API_RESPONSE_FORM_DATA',
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
          data: response.data,
        };

        console.log('✅ API Response (FormData):', JSON.stringify(logData, null, 2));
        
        return response;
      },
      async error => {
        // Log errors centrally
        logError(error);
        return handleResponseError(error);
      },
    );
  }
  return _axiosFormDataInstance;
};

const updateAuthHeader = (newToken: string) => {
  const instance = getAxiosInstance();
  const formDataInstance = getAxiosFormDataInstance();

  instance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  formDataInstance.defaults.headers.common['Authorization'] =
    `Bearer ${newToken}`;

  const expiresAtMs = newToken ? getExpiresAtFromToken(newToken) : null;
  if (sessionExpiryCallback) sessionExpiryCallback(expiresAtMs);
};

/**
 * Proactively refresh token (called when app resumes after idle time)
 * This prevents 401 errors when user interacts with app after being idle
 */
export const proactivelyRefreshToken = async (): Promise<boolean> => {
  try {
    if (getIsRefreshing()) {
      console.log('⏳ Token refresh already in progress, skipping proactive refresh');
      return false;
    }

    const tokens = await getAuthTokens();
    if (!tokens?.userId || !tokens?.refreshToken) return false;

    // console.log('🔄 Proactively refreshing token after idle time...');
    setIsRefreshing(true);

    try {
      const newAccessToken = await refreshAccessToken();
      setIsRefreshing(false);

      if (newAccessToken) {
        // console.log('✅ Proactive token refresh successful');
        return true;
      } else {
        // console.warn('⚠️ Proactive token refresh failed - no access token returned');
        return false;
      }
    } catch (error) {
      setIsRefreshing(false);
      // console.log('❌ Proactive token refresh error:', error);
      return false;
    }
  } catch (error) {
    // console.log('❌ Error in proactive token refresh:', error);
    return false;
  }
};

/**
 * Attempt to refresh the access token using the refresh token
 */
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const tokens = await getAuthTokens();
    if (!tokens?.userId || !tokens?.refreshToken) return null;

    const baseURL = getGuaranteedBaseURL();
    const refreshInstance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'X-App-Client': 'com.janitsolutions.jangoaddressmaker',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const lang = (await readData('@lang')) || 'en';

    const response = await refreshInstance.post(
      `/auth/refresh?lang=${lang}`,
      {
        refresh_token: tokens.refreshToken,
        user_id: tokens.userId,
      },
    );

    if (response.data?.access_token) {
      const newAccessToken = response.data.access_token;
      const newRefreshToken = response.data.refresh_token;

      if (newRefreshToken) {
        await setAuthTokens({ userId: tokens.userId, refreshToken: newRefreshToken });
      }

      updateAuthHeader(newAccessToken);
      return newAccessToken;
    }

    return null;
  } catch (refreshError: any) {
    return null;
  }
};

/**
 * Handle 401 Unauthenticated errors by attempting token refresh
 */
const handle401Error = async (
  error: AxiosError,
  originalRequest: InternalAxiosRequestConfig,
): Promise<any> => {
  const originalConfig = originalRequest;
  // NOTE (2025-02): Supabase is now the source of truth for auth.
  // We no longer want Laravel 401s to force a logout or navigation.
  // For now, treat 401s as normal request errors and do not log the user out.

  // Don't retry if this is already a refresh token request – just fail the call.
  if (originalConfig.url?.includes('/auth/refresh')) {
    return Promise.reject(error);
  }

  // If we're already refreshing, wait for it to complete
  // This handles the idle app scenario where multiple requests fire simultaneously
  if (getIsRefreshing()) {
    // console.log('⏳ Token refresh in progress, queuing request...');
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      
      const unsubscribe = subscribeToTokenRefresh(
        (token: string) => {
          // Clear timeout if refresh succeeds
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          // Update the original request with new token
          originalConfig.headers.Authorization = `Bearer ${token}`;
          // Clear _retry flag to allow future retries if needed
          delete (originalConfig as any)._retry;
          // Retry the original request
          const instance = getAxiosInstance();
          instance
            .request(originalConfig)
            .then(resolve)
            .catch(reject);
          unsubscribe();
        },
        (refreshError: Error) => {
          // Clear timeout if refresh fails
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          // If refresh fails, reject the request
          // console.log('❌ Token refresh failed for queued request:', refreshError);
          unsubscribe();
          reject(error);
        },
      );

      // Safety timeout in case refresh hangs
      timeoutId = setTimeout(() => {
        // console.warn('⚠️ Token refresh timeout for queued request, resetting state');
        unsubscribe();
        // Reset refresh state if it's stuck
        resetRefreshState();
        reject(new Error('Token refresh timeout'));
      }, 15000); // 15 second timeout
    });
  }

  // Start refresh process
  // This is the first request that detected 401, so it initiates the refresh
  // console.log('🔄 Starting token refresh due to 401 error...');
  setIsRefreshing(true);

  try {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken) {
      // Notify all waiting requests (from idle app scenario where multiple requests fired)
      // console.log('✅ Token refreshed successfully, notifying waiting requests');
      notifyTokenRefresh(newAccessToken);

      // Update the original request with new token
      originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
      // Clear _retry flag to allow future retries if this one fails
      delete (originalConfig as any)._retry;

      // Retry the original request
      const instance = getAxiosInstance();
      setIsRefreshing(false);
      return instance.request(originalConfig);
    } else {
      // Refresh failed, notify all waiting requests and logout
      // console.warn('⚠️ Token refresh failed, notifying waiting requests and logging out...');
      const refreshError = new Error('Token refresh failed - no access token returned');
      notifyTokenRefreshFailure(refreshError);
      setIsRefreshing(false);
      // Do NOT log the user out here; just surface the original error.
      return Promise.reject(error);
    }
  } catch (refreshError: any) {
    // Refresh failed, notify all waiting requests and logout
    // console.log('❌ Token refresh error:', refreshError);
    const error = refreshError instanceof Error 
      ? refreshError 
      : new Error(refreshError?.message || 'Token refresh failed');
    notifyTokenRefreshFailure(error);
    setIsRefreshing(false);
    // Do NOT log the user out here; just surface the error.
    return Promise.reject(error);
  }
};

// Improved error handling with more specific error types
const handleResponseError = async (error: any) => {
  const originalRequest = error.config;

  // Handle 401 Unauthenticated errors with token refresh
  // Only skip if we've already retried AND we're currently refreshing
  // This allows retry if refresh completed but token is still invalid
  if (error.response?.status === 401 && originalRequest) {
    // If we've already retried once and refresh is in progress, wait for it
    if ((originalRequest as any)._retry && getIsRefreshing()) {
      // Wait for refresh to complete, then retry
      return new Promise((resolve, reject) => {
        const unsubscribe = subscribeToTokenRefresh(
          (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            delete (originalRequest as any)._retry; // Clear retry flag for new attempt
            const instance = getAxiosInstance();
            instance
              .request(originalRequest)
              .then(resolve)
              .catch(reject);
            unsubscribe();
          },
          (refreshError: Error) => {
            unsubscribe();
            reject(error);
          },
        );
        
        // Timeout for waiting on refresh
        setTimeout(() => {
          unsubscribe();
          reject(new Error('Token refresh timeout'));
        }, 15000);
      });
    }
    
    // First attempt or refresh not in progress - proceed with refresh
    if (!(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      return handle401Error(error, originalRequest);
    }
  }

  // Check if it's a network error and handle accordingly
  if (isNetworkError(error)) {
    // Provide more specific error messages based on the error type
    if (error.code === 'ERR_NETWORK') {
      const networkError = new Error(
        'Network connection failed. Please check your internet connection and try again.',
      );
      networkError.name = 'NetworkError';
      return Promise.reject(networkError);
    }
  }

  // Handle timeout errors specifically
  if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
    const timeoutError = new Error(
      'Request timed out. The server might be slow or unreachable. Please try again.',
    );
    timeoutError.name = 'TimeoutError';
    return Promise.reject(timeoutError);
  }

  // Handle DNS resolution errors
  if (error.code === 'ENOTFOUND') {
    const dnsError = new Error(
      'Unable to resolve server address. Please check your internet connection.',
    );
    dnsError.name = 'DNSError';
    return Promise.reject(dnsError);
  }

  // Handle connection refused errors
  if (error.code === 'ECONNREFUSED') {
    const connectionError = new Error(
      'Connection refused by server. Please try again later.',
    );
    connectionError.name = 'ConnectionError';
    return Promise.reject(connectionError);
  }

  // Handle other network-related errors
  if (error.message === 'Network Error') {
    const networkError = new Error(
      'Network error occurred. Please check your internet connection and try again.',
    );
    networkError.name = 'NetworkError';
    return Promise.reject(networkError);
  }

  return Promise.reject(error);
};

// Function to force reinitialize axios instances
const reinitializeAxiosInstances = () => {
  _axiosInstance = null;
  _axiosFormDataInstance = null;

  getAxiosInstance();
  getAxiosFormDataInstance();
};

// Export the getter functions as the instances
export const axiosInstance = getAxiosInstance();
export const axiosFormDataInstance = getAxiosFormDataInstance();

// Test function to verify the base URL is working
const testBaseURL = async (): Promise<boolean> => {
  try {
    const instance = getAxiosInstance();
    // Try different endpoints to test connectivity
    const testEndpoints = ['/health', '/ping', '/status', '/'];

    for (const endpoint of testEndpoints) {
      try {
        const response = await instance.get(endpoint, { timeout: 5000 });
        console.warn(
          `✅ Base URL test successful with ${endpoint}:`,
          response.status,
        );
        return true;
      } catch {
        continue;
      }
    }

    console.warn(
      '⚠️ All test endpoints failed, but base URL might still be valid',
    );
    return false;
  } catch {
    return false;
  }
};

// Enhanced connectivity test function
const testAPIConnectivity = async (): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    // Test basic connectivity first
    const networkState = await getNetworkState();

    if (!networkState.isConnected) {
      return {
        success: false,
        error: 'No network connection detected',
        details: networkState,
      };
    }

    if (networkState.isInternetReachable === false) {
      return {
        success: false,
        error: 'Connected to network but no internet access',
        details: networkState,
      };
    }

    // Test the actual API endpoint
    const instance = getAxiosInstance();
    // Try a simple request to test connectivity
    const response = await instance.get('/auth/login?lang=en', {
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status code
    });

    return {
      success: true,
      details: {
        status: response.status,
        statusText: response.statusText,
        networkState,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      details: {
        code: error.code,
        message: error.message,
        stack: error.stack,
      },
    };
  }
};

export {
  updateAuthHeader,
  reinitializeAxiosInstances,
  testBaseURL,
  testAPIConnectivity,
  retryRequest,
};
