import { Stack, useRouter } from 'expo-router';
import React, { useContext, useEffect } from 'react';
import { Context } from '../_layout';
import { SocialAuthProvider } from '@/contexts/SocialAuthContext';

export default function AuthLayout() {
  const router = useRouter();
  const { user } = useContext(Context)!;

  // If session is restored while on auth (e.g. after slow getSession), go to tabs
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user, router]);

  return (
    <SocialAuthProvider>
    <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-pin" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-pin" options={{ headerShown: false }} />
      <Stack.Screen
        name="email-verification"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="phone-number-verification"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="phone-number-verification-pin-reset"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="email-verification-reset-password"
        options={{ headerShown: false }}
      />
    </Stack>
    </SocialAuthProvider>
  );
}
