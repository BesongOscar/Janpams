import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import pt from '@/locales/pt.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// import * as Localization from 'expo-localization';

// Configure i18n
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  // lng: Localization.locale.split('-')[0], // Detect device language
  // lng: 'en', // TODO: Detect the device language
  fallbackLng: 'en', // Fallback language
  interpolation: {
    escapeValue: false, // React already escapes strings
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
