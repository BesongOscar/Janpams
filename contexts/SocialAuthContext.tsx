import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface SocialAuthState {
  socialLoading: boolean;
  socialError: string | undefined;
}

interface SocialAuthActions {
  setSocialLoading: (loading: boolean) => void;
  setSocialError: (error: string | undefined) => void;
}

type SocialAuthContextType = SocialAuthState & SocialAuthActions;

const SocialAuthContext = createContext<SocialAuthContextType | undefined>(undefined);

export function SocialAuthProvider({ children }: { children: React.ReactNode }) {
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | undefined>(undefined);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSocialLoadingWithCleanup = useCallback((loading: boolean) => {
    setSocialLoading(loading);
  }, []);

  const setSocialErrorWithAutoClear = useCallback((error: string | undefined) => {
    setSocialError(error);
    if (error && !errorTimerRef.current) {
      errorTimerRef.current = setTimeout(() => {
        setSocialError(undefined);
        errorTimerRef.current = null;
      }, 5000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  return (
    <SocialAuthContext.Provider
      value={{
        socialLoading,
        socialError,
        setSocialLoading: setSocialLoadingWithCleanup,
        setSocialError: setSocialErrorWithAutoClear,
      }}
    >
      {children}
    </SocialAuthContext.Provider>
  );
}

export function useSocialAuth(): SocialAuthContextType {
  const ctx = useContext(SocialAuthContext);
  if (!ctx) {
    throw new Error('useSocialAuth must be used within a SocialAuthProvider');
  }
  return ctx;
}
