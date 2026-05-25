import './polyfills/crypto';

const SAFE_BOOT = process.env.EXPO_PUBLIC_SAFE_BOOT === '1';

if (SAFE_BOOT) {
  // eslint-disable-next-line no-console
  console.log('[safe-boot] enabled');

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native/Libraries/Core/InitializeCore');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[safe-boot] InitializeCore failed:', String(e?.message || e));
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native/Libraries/Core/setUpBatchedBridge');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native/Libraries/ReactNative/AppRegistry');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[safe-boot] bridge setup failed:', String(e?.message || e));
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppRegistry, View, Text } = require('react-native');

  const SafeBootApp = () =>
    React.createElement(
      View,
      {
        style: {
          flex: 1,
          backgroundColor: '#111827',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        },
      },
      React.createElement(Text, { style: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 8 } }, 'SAFE BOOT'),
      React.createElement(
        Text,
        { style: { color: '#E5E7EB', fontSize: 14, textAlign: 'center' } },
        'JS runtime rendered successfully. Next step: isolate the module causing the early crash.'
      )
    );

  AppRegistry.registerComponent('main', () => SafeBootApp);
} else {
  // Do NOT run InitializeCore/setUpBatchedBridge here — `expo-router/entry` loads
  // `@expo/metro-runtime` first; a second init creates a mismatched bridge (HMRClient n=1, black screen).
  try {
    // eslint-disable-next-line no-console
    console.log('[entry] loading expo-router/entry');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('expo-router/entry');
    // eslint-disable-next-line no-console
    console.log('[entry] loaded expo-router/entry');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[entry] error:', String(e?.message || e));
    // eslint-disable-next-line no-console
    console.log('[entry] stack:', String(e?.stack || 'no-stack'));
    throw e;
  }
}
