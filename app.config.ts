import { ExpoConfig, ConfigContext } from '@expo/config';
import * as dotenv from 'dotenv';
// Expo config is evaluated via Node; keep custom plugins in JS for require() compatibility.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withAndroidCmakeVersion } = require('./plugins/withAndroidCmakeVersion');

// initialize dotenv
dotenv.config();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'jango',
  slug: 'jango-glopams',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'jango-glopams',
  userInterfaceStyle: 'light',
  // Hermes provides BigInt and URL APIs required by Supabase realtime / modern fetch stacks; Android JSC does not.
  newArchEnabled: false,
  owner: 'jan-it-admin',
  runtimeVersion: {
    policy: 'appVersion',
  },
  splash: {
    image: './assets/images/splash-icon.png',
    backgroundColor: '#0000EE',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.janitsolutions.jangoaddressmaker',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_IOS_MAP_QUERY_KEY,
    },
    infoPlist: {
      GMSApiKey: process.env.EXPO_PUBLIC_IOS_MAP_QUERY_KEY,
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
      NSLocationWhenInUseUsageDescription:
        'This app requires access to your location when open.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'This app requires access to your location even when closed.',
      NSLocationAlwaysUsageDescription:
        'This app requires access to your location when open.',
      deploymentTarget: '15.1',
      NSUserTrackingUsageDescription:
        'This app would like to track you to provide better ads and user experience.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    softwareKeyboardLayoutMode: 'pan',
    package: 'com.janitsolutions.jangoaddressmaker',
    config: {
      googleMaps: {
        // Google Maps key must be provided via env; no hardcoded fallback
        apiKey: process.env.EXPO_PUBLIC_ANDROID_MAP_QUERY_KEY ?? '',
      },
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera',
        microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos',
        cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera',
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.836423461636-fhut0ph229act0f37vh0eu0qdfid2otb',
      },
    ],
    [
      'react-native-fbsdk-next',
      {
        appID: '1159621655510526',
        clientToken: '4adc9df5036260ddf74d77d3f586fdc1',
        displayName: 'JanGO Address Maker',
        scheme: 'fb1159621655510526',
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
        iosUserTrackingPermission:
          'This identifier will be used to deliver personalized ads to you.',
      },
    ],
    'expo-localization',
    'expo-background-fetch',
    [
      'expo-build-properties',
      {
        android: {
          hermesEnabled: true,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: '35.0.0',
        },
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
    [withAndroidCmakeVersion, { version: '3.31.6' }],
    [
      'expo-task-manager',
      {
        ios: {
          minimumOSVersion: '15.1',
        },
      },
    ],
    [
      'expo-background-fetch',
      {
        ios: {
          minimumOSVersion: '15.1',
        },
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow $(PRODUCT_NAME) to use your location.',
        locationAlwaysPermission: 'Allow $(PRODUCT_NAME) to use your location.',
        locationWhenInUsePermission:
          'Allow $(PRODUCT_NAME) to use your location.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '6ed77c99-67bd-43a6-8559-1d9c84775506',
    },
    googleMapsApiKey: process.env.EXPO_PUBLIC_ANDROID_MAP_QUERY_KEY,
    /** Base URL for offline data packs (manifest + pack JSON). Prod default matches web; set EXPO_PUBLIC_VPS_DATA_URL for staging. */
    vpsDataUrl:
      process.env.EXPO_PUBLIC_VPS_DATA_URL ?? 'https://datapack.janpams.com/osm-data/packs',
  },
});
