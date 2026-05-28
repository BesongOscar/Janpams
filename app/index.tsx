import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Context, SessionContext } from './_layout';
import { readData, testBaseURL } from '@/utils';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import i18n from '../i18n';

export default function Index() {
  const router = useRouter();

  // Test the base URL to make sure it's working
  useEffect(() => {
    const initializeEnvironment = async () => {
      await testBaseURL();
    };
    initializeEnvironment();
  }, []);

  const configGoogleSignIn = () => {
    GoogleSignin.configure({
      offlineAccess: true,
      webClientId:
        '836423461636-f8nfnaln80bp1q4ndrclpnrfa2den5k7.apps.googleusercontent.com',
      iosClientId:
        '836423461636-fhut0ph229act0f37vh0eu0qdfid2otb.apps.googleusercontent.com',
      scopes: ['profile'],
    });
  };

  useEffect(() => {
    configGoogleSignIn(); // will execute everytime the component mounts
  }, []);

  const [
    loaded,
    // error
  ] = useFonts({
    SpaceMono: require('@/assets/fonts/SpaceMono-Regular.ttf'),
    gentium: require('@/assets/fonts/gentium-book-basic.regular.ttf'),
    'gentium-bold': require('@/assets/fonts/gentium-book-basic.bold.ttf'),
    ...FontAwesome.font,
  });

  // const [loading, setLoading] = useState(true);
  const [delay, setDelay] = useState(5000);
  const [appIsReady, setAppIsReady] = useState(false);

  const { user, setLang } = useContext(Context)!;
  const sessionCtx = useContext(SessionContext);
  const isAuthLoading = sessionCtx?.isAuthLoading ?? true;

  const fadeAnim = useRef(new Animated.Value(0)).current; // Initial opacity: 0

  // Countdown effect: We need the splash screen to atleast display for 3 seconds so as to load the animation
  useEffect(() => {
    if (delay > 0) {
      const interval = setInterval(() => {
        setDelay(prev => Math.max(prev - 1000, 0));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [delay]);

  // Language preference on load
  useEffect(() => {
    readData('@lang').then(languagePreference => {
      i18n.changeLanguage(languagePreference ?? 'en');
      setLang(languagePreference ?? 'en');
    });
  }, [setLang]);

  // Auth state is resolved by _layout (Supabase getSession / onAuthStateChange). Mark app ready when auth loading is done and splash delay passed.
  useEffect(() => {
    if (!loaded || isAuthLoading) return;
    const timeLeft = Math.max(delay, 0);
    const t = setTimeout(() => setAppIsReady(true), timeLeft);
    return () => clearTimeout(t);
  }, [loaded, isAuthLoading, delay]);

  // If auth or fonts hang, force navigation after max splash time so the app is never stuck unclickable
  const MAX_SPLASH_MS = 12_000;
  useEffect(() => {
    const t = setTimeout(() => setAppIsReady(true), MAX_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Navigation: after splash delay and app ready, go to tabs if user else auth
  useEffect(() => {
    if (!(loaded && appIsReady)) return;
    void SplashScreen.hideAsync();
    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)');
    }
  }, [loaded, appIsReady, user, router]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, // Fully visible
      duration: 3000, // 3 seconds
      useNativeDriver: true, // Better performance
    }).start();
  }, []);

  return (
    <LinearGradient
      colors={['#3366FF', '#0000FF']} // Light blue to deep blue
      start={{ x: 0, y: 0 }} // Left side
      end={{ x: 1, y: 0 }} // Right side
      style={styles.container}>
      <Animated.Image
        source={require('@/assets/images/splash.png')}
        style={[{ opacity: fadeAnim }]}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    color: '#fff',
  },
});
