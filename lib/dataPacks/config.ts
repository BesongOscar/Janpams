/**
 * Data pack configuration
 *
 * VPS base URL for manifest and pack downloads. Matches web production by default;
 * set EXPO_PUBLIC_VPS_DATA_URL (e.g. in .env) to use staging.
 */

import Constants from 'expo-constants';

/** Production URL used by web (mbukanji-maps). Same as web: .../osm-data/packs */
export const VPS_DATA_URL_PROD = 'https://datapack.janpams.com/osm-data/packs';

/** Staging URL (optional override via env). Use same /packs path as web. */
export const VPS_DATA_URL_STAGING = 'https://openstreetmap-data.staging.mbukanji.org/osm-data/packs';

/**
 * Base URL for data pack manifest and pack JSON.
 * Reads from app config (EXPO_PUBLIC_VPS_DATA_URL at build time) or defaults to prod.
 */
export function getVpsDataUrl(): string {
  const extra = Constants.expoConfig?.extra as { vpsDataUrl?: string } | undefined;
  if (extra?.vpsDataUrl && typeof extra.vpsDataUrl === 'string') {
    return extra.vpsDataUrl.replace(/\/$/, '');
  }
  if (typeof process.env.EXPO_PUBLIC_VPS_DATA_URL === 'string' && process.env.EXPO_PUBLIC_VPS_DATA_URL) {
    return process.env.EXPO_PUBLIC_VPS_DATA_URL.replace(/\/$/, '');
  }
  return VPS_DATA_URL_PROD;
}

/**
 * Packs base URL (same as web mbukanji-maps VPS_DATA_URL).
 * Manifest and pack list live at .../packs/manifest.json so mobile and web use the same manifest and pack URLs.
 * If getVpsDataUrl() already ends with /packs (e.g. from .env), we use it as-is to avoid .../packs/packs/.
 */
export function getVpsPacksUrl(): string {
  const base = getVpsDataUrl();
  return base.endsWith('/packs') ? base : `${base}/packs`;
}

/**
 * URL for Valhalla tile archive for a region (Phase 4).
 * Server may expose e.g. {vpsDataUrl}/{regionCode}-valhalla.tar
 */
export function getVpsValhallaTilesUrl(regionCode: string): string {
  const base = getVpsDataUrl();
  return `${base}/${regionCode}-valhalla.tar`;
}
