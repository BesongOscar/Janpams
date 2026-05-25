import { initializeFacebookSDK, setLogoutCallback, setSessionExpiryCallback, proactivelyRefreshToken, performLogout, triggerLogoutNavigation, updateAuthHeader } from '@/utils';
import { getSupabase } from '@/lib/supabase/client';
import { mapSupabaseUser } from '@/lib/supabase/mapSupabaseUser';
import { syncRolesFromBackend } from '@/lib/rolesSync';
import { Colors } from '@/constants';
import { Language, User } from '@/interfaces';
import { defaultStyles } from '@/styles';
import { useReactQueryDevTools } from '@dev-plugins/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useState, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DefaultTheme, PaperProvider } from 'react-native-paper';
import { AppState, AppStateStatus, Platform } from 'react-native';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { BottomSheetProvider } from '@/contexts/BottomSheetContext';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Must be `index` so `app/index.tsx` runs first (fonts + auth gate). Opening `(tabs)` directly
  // mounted MapLibre + heavy map before session was ready → black screen / ANR on Android.
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    // Initialize Facebook SDK when app starts
    initializeFacebookSDK();
  }, []);

  return (
    <>
      <StatusBar translucent style="auto" />
      <RootLayoutNav />
    </>
  );
}

// Configure QueryClient with proper cache settings
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always consider data stale to ensure fresh data on refetch
      gcTime: 10 * 60 * 1000, // 10 minutes - cache time (formerly cacheTime)
      refetchOnMount: 'always', // Always refetch when component mounts
      refetchOnWindowFocus: 'always', // Always refetch when window regains focus
      refetchOnReconnect: 'always', // Always refetch when network reconnects
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors - the interceptor handles token refresh
        // After token refresh, the request will be retried automatically
        if (error?.response?.status === 401) {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

interface ContextInfo {
  user: User | undefined;
  lang: Language;
  socialLoading: boolean;
  isLoggedIn: boolean;
  socialError: string | undefined;
  /** Session expiry time (access token) in ms since epoch, or null. From JWT exp when token is set. */
  sessionExpiresAt: number | null;
  /** True while app is restoring session (index checking tokens/refresh). Used by protected route guard. */
  isAuthLoading: boolean;
}
interface ContextSetters {
  // eslint-disable-next-line no-unused-vars
  setUser: (user: User | undefined) => void;
  // eslint-disable-next-line no-unused-vars
  setLang: (lang: Language) => void;
  // eslint-disable-next-line no-unused-vars
  setSocialLoading: (loading: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  setIsLoggedIn: (loggedIn: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  setSocialError: (error: string | undefined) => void;
  // eslint-disable-next-line no-unused-vars
  setSessionExpiresAt: (expiresAt: number | null) => void;
  // eslint-disable-next-line no-unused-vars
  setAuthLoading: (loading: boolean) => void;
}

export interface ContextType extends ContextInfo, ContextSetters {}

export const Context = createContext<ContextType | undefined>(undefined);

/** DevTools plugin uses `window.location` — only mount on web (crashes native if invoked). */
function ReactQueryDevToolsOnWeb({ queryClient }: { queryClient: QueryClient }) {
  useReactQueryDevTools(queryClient);
  return null;
}

function RootLayoutNav() {
  const router = useRouter();
  const initialState: ContextInfo = {
    user: undefined,
    lang: 'en',
    socialLoading: false,
    isLoggedIn: false,
    socialError: undefined,
    sessionExpiresAt: null,
    isAuthLoading: true,
  };
  const [contextInfo, setContextInfo] = useState(initialState);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  function setUser(user: User | undefined) {
    setContextInfo(prevState => ({ ...prevState, user }));
  }

  function setLang(lang: Language) {
    setContextInfo(prevState => ({ ...prevState, lang }));
  }

  const setIsLoggedIn = (isLoggedIn: boolean) => {
    setContextInfo(prevState => ({ ...prevState, isLoggedIn }));
  };
  const setSocialLoading = (socialLoading: boolean) => {
    setContextInfo(prevState => ({ ...prevState, socialLoading }));
  };

  const setSocialError = (socialError: string | undefined) => {
    setContextInfo(prevState => ({ ...prevState, socialError }));
  };
  const setSessionExpiresAt = (sessionExpiresAt: number | null) => {
    setContextInfo(prevState => ({ ...prevState, sessionExpiresAt }));
  };
  const setAuthLoading = (isAuthLoading: boolean) => {
    setContextInfo(prevState => ({ ...prevState, isAuthLoading }));
  };
  const contextSetters: ContextSetters = {
    setUser,
    setLang,
    setIsLoggedIn,
    setSocialLoading,
    setSocialError,
    setSessionExpiresAt,
    setAuthLoading,
  };

  // Refs so auth-related effects run once; setters are recreated every render and would cause infinite re-runs.
  const sessionSettersRef = useRef({ setUser, setSessionExpiresAt, setAuthLoading });
  sessionSettersRef.current = { setUser, setSessionExpiresAt, setAuthLoading };
  const logoutSettersRef = useRef({ setUser, setIsLoggedIn, setSessionExpiresAt, router });
  logoutSettersRef.current = { setUser, setIsLoggedIn, setSessionExpiresAt, router };

  // Supabase session restore and auth state listener (when Supabase is configured)
  // Timeout only stops blocking the UI; we never clear session so a slow getSession() still restores login
  const AUTH_SESSION_TIMEOUT_MS = 10_000;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      sessionSettersRef.current.setAuthLoading(false);
      return;
    }
    let cancelled = false;
    const applySession = (session: { user: { id: string }; access_token: string; expires_at?: number } | null) => {
      if (cancelled) return;
      const { setUser: sU, setSessionExpiresAt: sE, setAuthLoading: sA } = sessionSettersRef.current;
      if (session?.user) {
        sU(mapSupabaseUser(session.user));
        sE(session.expires_at ? session.expires_at * 1000 : null);
        updateAuthHeader(session.access_token);
        syncRolesFromBackend(session.user.id).catch(() => {});
      } else {
        sU(undefined);
        sE(null);
        updateAuthHeader('');
      }
      sA(false);
    };
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      sessionSettersRef.current.setAuthLoading(false);
    }, AUTH_SESSION_TIMEOUT_MS);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) applySession(session);
    }).catch(() => {
      if (!cancelled) applySession(null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Set up logout callback for token refresh failures (run once; callback uses ref for latest setters)
  useEffect(() => {
    setLogoutCallback(() => {
      const { setUser: sU, setIsLoggedIn: sL, setSessionExpiresAt: sE } = logoutSettersRef.current;
      sU(undefined);
      sL(false);
      sE(null);
    });
  }, []);

  // Expose session expiry when auth header is set (run once; global callback reads from ref)
  useEffect(() => {
    setSessionExpiryCallback((value: number | null) => {
      sessionSettersRef.current.setSessionExpiresAt(value);
    });
    return () => setSessionExpiryCallback(() => {});
  }, []);

  // When session expiry is set and user is logged in, check periodically and force re-login when expired
  useEffect(() => {
    const { sessionExpiresAt: exp, user: u } = contextInfo;
    if (exp == null || u == null) return;
    const check = () => {
      if (Date.now() >= exp) {
        performLogout().then(() => {
          setUser(undefined);
          setIsLoggedIn(false);
          setSessionExpiresAt(null);
          triggerLogoutNavigation();
        });
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [contextInfo.sessionExpiresAt, contextInfo.user]);

  // Handle app state changes to invalidate queries and ensure fresh data
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background - record the time and invalidate queries
        backgroundTime.current = Date.now();
        console.log('🔄 App going to background, invalidating queries...');
        client.invalidateQueries({
          queryKey: ['/addresses/my-jango-addresses'],
        });
        client.invalidateQueries({
          queryKey: ['/addresses/my-alias-addresses'],
        });
        client.invalidateQueries({
          queryKey: ['/addresses/my-home-address'],
        });
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App is coming back to foreground - always invalidate and refetch
        const timeInBackground = backgroundTime.current
          ? Date.now() - backgroundTime.current
          : 0;
        
        const timeInBackgroundMinutes = Math.round(timeInBackground / 1000 / 60);
        console.log(`🔄 App returning from background after ${timeInBackgroundMinutes} minutes, refreshing token and invalidating queries...`);
        
        // If app was idle for more than 15 minutes, proactively refresh token
        // This prevents 401 errors when queries fire after long idle time
        const shouldProactivelyRefresh = timeInBackground > 15 * 60 * 1000; // 15 minutes
        
        if (shouldProactivelyRefresh) {
          console.log('🔄 App was idle for extended period, proactively refreshing token...');
          proactivelyRefreshToken()
            .then(refreshSuccess => {
              if (refreshSuccess) {
                console.log('✅ Token refreshed proactively, now invalidating queries...');
              } else {
                console.warn('⚠️ Proactive token refresh failed, but continuing with query invalidation...');
              }
              
              // Invalidate ALL queries (not just specific ones)
              // This ensures all data is refreshed after long idle time
              client.invalidateQueries();
              
              // Clear any error states
              client.resetQueries();
              
              // Refetch all active queries to ensure fresh data
              client.refetchQueries();
            })
            .catch(error => {
              console.log('❌ Error during proactive token refresh:', error);
              // Even if refresh fails, still invalidate queries
              // The interceptor will handle 401 errors when queries fire
              client.invalidateQueries();
              client.resetQueries();
              client.refetchQueries();
            });
        } else {
          // For shorter idle times, just invalidate and refetch
          // Invalidate ALL queries (not just specific ones)
          client.invalidateQueries();
          
          // Clear any error states
          client.resetQueries();
          
          // Refetch all active queries to ensure fresh data
          client.refetchQueries();
        }
        
        backgroundTime.current = null;
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const theme = {
    // ...DefaultTheme,
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      text: Colors.dark['0'], // Override text color globally
    },
  };

  return (
    <QueryClientProvider client={client}>
      {Platform.OS === 'web' ? <ReactQueryDevToolsOnWeb queryClient={client} /> : null}
      <Context.Provider value={{ ...contextInfo, ...contextSetters }}>
        <BottomSheetProvider>
        <GestureHandlerRootView style={defaultStyles.flex}>
          <PaperProvider theme={theme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="new-create-address"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="my-addresses"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen
                name="update-profile"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="help" options={{ headerShown: false }} />
              <Stack.Screen
                name="add-home-address"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="notifications"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen
                name="email-verification"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-email-verification"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="qr-scan" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack>
            <Toast />
            <OfflineIndicator />
          </PaperProvider>
        </GestureHandlerRootView>
        </BottomSheetProvider>
      </Context.Provider>
    </QueryClientProvider>
  );
}
