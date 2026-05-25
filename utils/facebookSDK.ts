import { Settings } from 'react-native-fbsdk-next';

let isSDKInitialized = false;

export const initializeFacebookSDK = () => {
  try {
    Settings.initializeSDK();
    Settings.setAutoLogAppEventsEnabled(true);
    Settings.setAdvertiserIDCollectionEnabled(true);
    isSDKInitialized = true;
    return true;
  } catch {
    return false;
  }
};

export const isFacebookSDKInitialized = (): boolean => {
  return isSDKInitialized;
};
