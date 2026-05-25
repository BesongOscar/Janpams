/**
 * Subdivision / Country Pair Lookup
 *
 * Ported from web's lib/subdivisions.ts.
 * Provides formatted subdivision_country_pair strings (e.g. "SW, CMR")
 * for address display. Works fully offline — data is bundled JSON.
 */

import subdivisionData from '@/data/subdivision_country_pair.json';

interface SubdivisionEntry {
  country_code: string;
  subdivision_name: string;
  subdivision_code: string;
  subdivision_code_local: string;
  country_code_alpha3: string;
  subdivision_country_pair: string;
}

const subdivisions = subdivisionData as SubdivisionEntry[];

export function getSubdivisionCountryPair(
  subdivisionCode: string,
  countryCode?: string,
): string | null {
  let entry = subdivisions.find(s => s.subdivision_code === subdivisionCode);

  if (!entry && countryCode) {
    const fullCode = `${countryCode}-${subdivisionCode}`;
    entry = subdivisions.find(s => s.subdivision_code === fullCode);
  }

  if (!entry) {
    entry = subdivisions.find(
      s =>
        s.subdivision_code_local === subdivisionCode &&
        (!countryCode || s.country_code === countryCode),
    );
  }

  if (!entry) {
    const searchName = subdivisionCode.toLowerCase();
    entry = subdivisions.find(
      s =>
        s.subdivision_name.toLowerCase() === searchName &&
        (!countryCode || s.country_code === countryCode),
    );
  }

  return entry?.subdivision_country_pair || null;
}

const normalizeForComparison = (str: string) =>
  str.toLowerCase().replace(/[-\s]+/g, '').trim();

export function getSubdivisionByRegion(
  regionName: string,
  countryCode?: string,
): SubdivisionEntry | null {
  const searchName = normalizeForComparison(regionName);

  let entry = subdivisions.find(
    s =>
      normalizeForComparison(s.subdivision_name) === searchName &&
      (!countryCode || s.country_code === countryCode),
  );

  if (!entry) {
    entry = subdivisions.find(s => {
      const subName = normalizeForComparison(s.subdivision_name);
      return (
        (subName.includes(searchName) || searchName.includes(subName)) &&
        (!countryCode || s.country_code === countryCode)
      );
    });
  }

  return entry || null;
}

const REGION_CODE_FALLBACK: Record<string, string> = {
  southwest: 'SW', northwest: 'NW', littoral: 'LT',
  centre: 'CE', center: 'CE', west: 'OU', east: 'ES',
  south: 'SU', north: 'NO', adamawa: 'AD', adamaoua: 'AD',
  farnorth: 'EN', extremenord: 'EN',
};

const COUNTRY_ALPHA3: Record<string, string> = {
  CM: 'CMR', NG: 'NGA', US: 'USA', GB: 'GBR', FR: 'FRA', DE: 'DEU',
  GH: 'GHA', SN: 'SEN', CI: 'CIV',
};

export function formatSubdivisionPair(
  region: string,
  countryCode: string = 'CM',
): string {
  const entryByCode = subdivisions.find(s => s.subdivision_code === region);
  if (entryByCode) return entryByCode.subdivision_country_pair;

  const entry = getSubdivisionByRegion(region, countryCode);
  if (entry) return entry.subdivision_country_pair;

  const normalizedRegion = region.toLowerCase().replace(/[-\s]+/g, '');
  const regionCode =
    REGION_CODE_FALLBACK[normalizedRegion] ||
    region.substring(0, 2).toUpperCase();
  const countryAlpha3 = COUNTRY_ALPHA3[countryCode] || countryCode;

  return `${regionCode}, ${countryAlpha3}`;
}
