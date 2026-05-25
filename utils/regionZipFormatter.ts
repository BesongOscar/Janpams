import { RegionZip } from '@/constants';
import {
  addressesGetAddressComponentResponse,
  Language,
  RegionZipCountry,
} from '@/interfaces';

export type RegionZipResult = {
  region: string;
  zip: string;
};

export function getRegionZip(
  country: string | undefined,
  lang: Language = 'en',
): RegionZipResult {
  if (!country) {
    return {
      region: RegionZip.default.region[lang],
      zip: RegionZip.default.zip[lang],
    };
  }

  const mapping =
    country in RegionZip
      ? RegionZip[country as RegionZipCountry]
      : RegionZip.default;

  return {
    region: mapping.region[lang],
    zip: mapping.zip[lang],
  };
}

type LabelKey = 'city' | 'town' | 'village';

const translations: Record<Language, Record<LabelKey, string>> = {
  en: {
    city: 'City',
    town: 'Town',
    village: 'Village',
  },
  fr: {
    city: 'Ville',
    town: 'Bourg',
    village: 'Village',
  },
  pt: {
    city: 'Cidade',
    town: 'Cidade pequena',
    village: 'Aldeia',
  },
};

export function getLocationLabel(
  result: addressesGetAddressComponentResponse,
  language: Language,
): string {
  let label: LabelKey = 'city'; // default

  if (result.city != null) {
    label = 'city';
  } else if (result.town != null) {
    label = 'town';
  } else if (result.village != null) {
    label = 'village';
  }

  const selectedLanguage = translations[language] || translations.en;

  return selectedLanguage[label];
}
