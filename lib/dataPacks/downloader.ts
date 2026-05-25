/**
 * Data Pack Downloader
 *
 * Matches web (mbukanji-maps) flow: fetch manifest, get pack URL from manifest, then
 * download pack (.json or .tar.gz). Supports .tar.gz unpack + merge.
 */

import { gunzipSync } from 'fflate';
import { stringifyJSON } from '../db';
import { getDataPackManifestById } from '../db/dataPacks';
import type { StreetSegment, AdminBoundary, SettlementPlace, DataPackManifest } from '../db/schemas';
import { getAdminLevelForStorage } from '../geocoding/adminResolver';
import { getGeoCell } from '../geocoding/settlementResolver';
import { getVpsDataUrl, getVpsPacksUrl, getVpsValhallaTilesUrl } from './config';
import { buildPOIFromOSM } from '../poi/buildPOIFromOSM';
import type { POIRecord } from '../db/schemas';
import { cacheRoutesBatch, clearRoutesForPack } from '../routing/routeCache';
import { buildPackIndex } from '../search/searchIndex';
import { setPackState, getPackState, purgeTmpAndStagingForRegion } from '../japaState';
import {
  clearStagingTablesForRegion,
  batchInsertStreetSegmentsStg,
  batchInsertAdminBoundariesStg,
  batchInsertSettlementPlacesStg,
  batchInsertPOIsStg,
  insertPackStagingManifest,
  getStagingCounts,
  copyStagingToProd,
} from '../db/staging';
import { deleteByPack as deletePOIsByPack } from '../db/pois';
import { deleteStreetSegmentsByRegion } from '../db/streetSegments';
import { deleteAdminBoundariesByPack } from '../db/adminBoundaries';
import { deleteSettlementPlacesByPack } from '../db/settlements';
import {
  storeValhallaTilesForPack,
  hasStagingTilesForRegion,
  commitValhallaStagingToProd,
} from '../valhalla/tileStorage';

// ===== CONSTANTS =====

// ===== TYPES =====

export interface DataPackInfo {
  region_code: string;
  region_name: string;
  country_code: string;
  file_size_bytes: number;
  street_count: number;
  admin_boundary_count: number;
  settlement_place_count?: number;
  version: string;
  updated_at: string;
}

export interface DataPackContent {
  streets: Array<{
    id: string;
    name: string | null;
    names?: Record<string, string>;
    coordinates: Array<[number, number]>;
    geometry?: {
      type: string;
      coordinates: Array<[number, number]>;
    };
    properties?: {
      id?: string;
      name?: string;
      name_en?: string;
      name_fr?: string;
      names?: Record<string, string>;
      highway?: string;
    };
    highway_type?: string;
  }>;
  admin_boundaries: Array<{
    id: string;
    name: string;
    admin_level: number;
    geometry: Array<[number, number]>;
    parent_id?: string;
    country_code?: string;
    osm_id?: number;
    osm_type?: 'node' | 'way' | 'relation';
    area?: number;
  }>;
  settlement_places?: Array<{
    id: string;
    name: string;
    place: string;
    lat: number;
    lon: number;
    osm_id?: number;
    osm_type?: 'node' | 'way' | 'relation';
    geometry?: Array<[number, number]>;
  }>;
  metadata: {
    region_code: string;
    region_name: string;
    version: string;
    generated_at: string;
    bbox: [number, number, number, number];
    country_code?: string;
  };
  /** Optional POIs (GeoJSON features or array of { id, lat, lon, properties/tags }) */
  pois?: unknown[];
  /** Optional legacy pre-computed routes (unused — routing is Valhalla-only) */
  routes?: Array<{
    id?: string;
    start_poi_id?: string;
    start_coord: [number, number];
    end_coord: [number, number];
    path: Array<[number, number]>;
    distance: number;
    duration?: number;
  }>;
}

// ===== HELPER FUNCTIONS =====

/**
 * Normalize OSM place type to our schema's allowed place values
 * Maps OSM place types to: 'city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'neighborhood', 'quarter', 'city_district', 'postcode'
 * 
 * Reference: OSM place tag values and their typical classifications
 */
function normalizePlaceType(place: string | undefined | null): 'city' | 'town' | 'village' | 'hamlet' | 'suburb' | 'neighbourhood' | 'neighborhood' | 'quarter' | 'city_district' | 'postcode' {
  if (!place || typeof place !== 'string') {
    return 'village'; // Default fallback
  }

  const normalized = place.toLowerCase().trim();

  // Direct matches (exact schema values)
  const allowedTypes: Array<'city' | 'town' | 'village' | 'hamlet' | 'suburb' | 'neighbourhood' | 'neighborhood' | 'quarter' | 'city_district' | 'postcode'> = 
    ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'neighborhood', 'quarter', 'city_district', 'postcode'];
  
  if (allowedTypes.includes(normalized as any)) {
    return normalized as any;
  }

  // Map OSM place types to schema values
  // City-level places
  if (['metropolis'].includes(normalized)) {
    return 'city';
  }

  // Hamlet-level places (smallest settlements)
  if (['isolated_dwelling', 'locality'].includes(normalized)) {
    return 'hamlet';
  }

  // Neighborhood variations
  if (['neighbourhood'].includes(normalized)) {
    return 'neighborhood'; // Use 'neighborhood' (US spelling) as standard
  }

  // City district variations
  if (['district'].includes(normalized)) {
    return 'city_district';
  }

  // Postcode variations
  if (['postal_code'].includes(normalized)) {
    return 'postcode';
  }

  // Default fallback for unknown types
  console.warn(`[DataPack] Unknown place type "${place}", defaulting to "village"`);
  return 'village';
}

/**
 * Normalize OSM highway type to our schema's allowed street_type values
 * Maps OSM highway types to: 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'path'
 * 
 * Reference: OSM highway tag values and their typical classifications
 */
function normalizeStreetType(highway: string | undefined | null): 'primary' | 'secondary' | 'tertiary' | 'residential' | 'unclassified' | 'path' {
  if (!highway || typeof highway !== 'string') {
    return 'residential';
  }

  const normalized = highway.toLowerCase().trim();

  // Primary roads (major highways, motorways, trunks)
  if (['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(normalized)) {
    return 'primary';
  }

  // Secondary roads
  if (['primary', 'primary_link'].includes(normalized)) {
    return 'primary';
  }
  if (['secondary', 'secondary_link'].includes(normalized)) {
    return 'secondary';
  }

  // Tertiary roads
  if (['tertiary', 'tertiary_link'].includes(normalized)) {
    return 'tertiary';
  }

  // Residential roads
  if (['residential', 'living_street', 'residential_link'].includes(normalized)) {
    return 'residential';
  }

  // Paths (walking/cycling paths)
  if (['path', 'footway', 'cycleway', 'bridleway', 'steps', 'pedestrian'].includes(normalized)) {
    return 'path';
  }

  // Service roads, tracks, and other minor roads -> unclassified
  if (['service', 'track', 'unclassified', 'road'].includes(normalized)) {
    return 'unclassified';
  }

  // Default fallback for unknown types
  console.warn(`[DataPack] Unknown highway type "${highway}", defaulting to "residential"`);
  return 'residential';
}

/**
 * Calculate bounding box from coordinates
 */
function calculateBbox(coords: Array<[number, number]>): [number, number, number, number] {
  if (coords.length === 0) {
    return [0, 0, 0, 0];
  }

  let minLon = coords[0][0];
  let maxLon = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLon, minLat, maxLon, maxLat];
}

// ===== DOWNLOADER FUNCTIONS =====

/**
 * Fetch list of available data packs from VPS
 */
export async function getAvailableDataPacks(countryCode: string = 'CM'): Promise<DataPackInfo[]> {
  let response: Response;
  try {
    // Create abort controller for timeout (React Native compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    response = await fetch(`${getVpsPacksUrl()}/manifest.json`, {
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (error: any) {
    // Handle network errors with better messages
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to fetch')) {
      throw new Error(
        'Network error: Unable to connect to data server. Please check your internet connection.'
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      throw new Error(
        'Request timeout: Unable to fetch data pack list. Please check your internet connection.'
      );
    }
    
    throw new Error(`Failed to fetch available data packs: ${errorMessage}`);
  }

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new Error(
      `Server error: Failed to fetch available data packs (HTTP ${response.status}: ${statusText})`
    );
  }

  const manifest = await response.json();

  // Filter by country code if needed
  const packs = (manifest.packs || []).filter(
    (pack: DataPackInfo) => pack.country_code === countryCode || countryCode === 'CM'
  );

  return packs;
}

/** Get pack download URL from manifest (same as web: use packs base so we get same manifest and pack URLs). */
async function getPackDownloadUrl(regionCode: string): Promise<{ url: string; version: string }> {
  const base = getVpsPacksUrl();
  const response = await fetch(`${base}/manifest.json`, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest (HTTP ${response.status}). Check that ${base}/manifest.json is reachable.`);
  }
  const data = (await response.json()) as {
    packs?: Array<{ region_code?: string; url?: string; file_path?: string; version?: string }>;
  };
  const packs = Array.isArray(data?.packs) ? data.packs : [];
  const pack = packs.find((p) => p?.region_code === regionCode);
  if (!pack) {
    throw new Error(`Pack ${regionCode} not found in manifest. Available: ${packs.map((p) => p?.region_code).filter(Boolean).join(', ') || 'none'}.`);
  }
  let url: string;
  if (typeof pack.url === 'string' && pack.url.length > 0) {
    url = pack.url.startsWith('http') ? pack.url : `${base.replace(/\/$/, '')}/${pack.url.replace(/^\//, '')}`;
  } else if (typeof pack.file_path === 'string' && pack.file_path.length > 0) {
    url = `${base.replace(/\/$/, '')}/${pack.file_path.replace(/^\//, '')}`;
  } else {
    url = `${base.replace(/\/$/, '')}/${regionCode}.json`;
  }
  return { url, version: String(pack.version ?? '') };
}

/** Parse tar bytes (after gunzip) into filename -> content. Same as web. */
function parseTarBytes(tarBytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const block = 512;
  let offset = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  while (offset + block <= tarBytes.length) {
    const header = tarBytes.slice(offset, offset + block);
    offset += block;
    const name = decoder.decode(header.slice(0, 100)).replace(/\0.*$/, '').trim();
    if (!name) break;
    const sizeStr = decoder.decode(header.slice(124, 136)).trim();
    const size = parseInt(sizeStr, 8) || 0;
    if (size > 0 && offset + size <= tarBytes.length) {
      files.set(name, tarBytes.slice(offset, offset + size));
    }
    offset += (size + block - 1) & ~(block - 1);
  }
  return files;
}

/**
 * Download and store a data pack for offline use
 * @param regionCode - Region code (e.g., 'CM-LT' for Littoral)
 * @param onProgress - Progress callback (0-100)
 * @param forceRefresh - If true, re-downloads even if pack already exists
 */
export async function downloadDataPack(
  regionCode: string,
  onProgress?: (progress: number) => void,
  forceRefresh?: boolean
): Promise<void> {
  console.log(`[DataPack] Downloading data pack for region: ${regionCode} from VPS${forceRefresh ? ' (force refresh)' : ''}`);

  const state = await getPackState(regionCode);
  if (!forceRefresh && state === 'INSTALLED') {
    const existing = await getDataPackManifestById(regionCode);
    if (existing) {
      console.log(`[DataPack] Pack ${regionCode} already installed, skipping download`);
      onProgress?.(100);
      return;
    }
  }

  await setPackState(regionCode, 'DOWNLOADING');
  onProgress?.(5);

  try {
    const { url: packUrl } = await getPackDownloadUrl(regionCode);
    console.log(`[DataPack] Fetching from: ${packUrl}`);

    let dataResponse: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[DataPack] Request timeout after 5 minutes for ${regionCode}`);
        controller.abort();
      }, 300000);
      const fetchStartTime = Date.now();
      dataResponse = await fetch(packUrl, {
        headers: packUrl.endsWith('.json') ? { Accept: 'application/json' } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[DataPack] Fetch completed in ${(fetchDuration / 1000).toFixed(1)}s for ${regionCode}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';
      if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
        throw new Error(
          `Download timeout: The data pack took too long to download. Try again with a stronger connection.`
        );
      }
      if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to fetch')) {
        throw new Error(`Network error: Unable to connect to data server. Please check your internet connection.`);
      }
      throw new Error(`Failed to download data pack: ${errorMessage}. Please check your internet connection.`);
    }

    if (!dataResponse.ok) {
      const statusText = dataResponse.statusText || 'Unknown error';
      if (dataResponse.status === 404) {
        throw new Error(
          `Data pack for ${regionCode} is not available (HTTP 404). URL: ${packUrl} — check that the pack is in the manifest and published.`
        );
      }
      throw new Error(
        `Server error: Failed to download data pack for ${regionCode} (HTTP ${dataResponse.status}: ${statusText}). Please try again later.`
      );
    }

    onProgress?.(30);

    type VPSRawContent = Record<string, unknown> & {
      streets?: unknown[];
      admin_boundaries?: unknown[];
      street_segments?: unknown[] | { features?: unknown[] };
      boundaries?: unknown[] | { features?: unknown[] };
      settlement_places?: unknown[] | { features?: unknown[] };
      metadata?: DataPackContent['metadata'];
      pois?: unknown[];
      routes?: unknown[];
      country_code?: string;
    };

    let rawContent: VPSRawContent;
    if (packUrl.endsWith('.tar.gz')) {
      const ab = await dataResponse.arrayBuffer();
      const tarBytes = gunzipSync(new Uint8Array(ab));
      const files = parseTarBytes(tarBytes);
      console.log('[DataPack] Tar contents:', [...files.keys()]);
      const textDecoder = new TextDecoder('utf-8');
      const hasDataShape = (obj: Record<string, unknown>): boolean =>
        obj.streets != null || obj.admin_boundaries != null || obj.metadata != null ||
        obj.pois != null || obj.settlement_places != null || obj.routes != null ||
        obj.street_segments != null || obj.boundaries != null;
      const merge = (target: VPSRawContent, src: Record<string, unknown>): void => {
        const take = (key: string, asArray: boolean): void => {
          const v = src[key];
          if (v == null) return;
          if (asArray) {
            const arr = Array.isArray(v) ? v : (v as { features?: unknown[] }).features;
            if (!arr || arr.length === 0) return;
            const current = target[key];
            const currentLen = Array.isArray(current) ? (current as unknown[]).length : 0;
            // Prefer the largest array so we get full data regardless of tar file order (fixes mobile getting 1 street, 0 places, 0 routes)
            if (arr.length > currentLen) {
              (target as Record<string, unknown>)[key] = arr;
            }
          } else {
            if (typeof v === 'object' && v !== null && (target[key] == null || (typeof target[key] === 'object' && Object.keys((target[key] as object) || {}).length === 0))) {
              (target as Record<string, unknown>)[key] = v;
            }
          }
        };
        take('streets', true);
        take('admin_boundaries', true);
        take('street_segments', true);
        take('boundaries', true);
        take('settlement_places', true);
        take('pois', true);
        take('routes', true);
        take('metadata', false);
        if (src.country_code != null && target.country_code == null) target.country_code = src.country_code as string;
      };
      const merged: VPSRawContent = {};
      let anyParsed = false;
      const valhallaTiles: Array<{ id: string; data: ArrayBuffer }> = [];
      const featureCount = (v: unknown): number =>
        Array.isArray((v as { features?: unknown[] })?.features) ? (v as { features: unknown[] }).features.length : 0;
      const hasFeatures = (v: unknown): boolean => featureCount(v) > 0;
      for (const [name, bytes] of files.entries()) {
        try {
          const baseName = name.replace(/^\.\//, '').toLowerCase();
          let rawBytes = bytes;
          if (baseName.endsWith('.gz')) {
            try {
              rawBytes = gunzipSync(bytes);
            } catch {
              continue;
            }
          }
          const tarName = baseName.endsWith('.gz') ? baseName.slice(0, -3) : baseName;
          const isTarFile = tarName.endsWith('.tar');
          const isValhallaTar = isTarFile && tarName.includes('valhalla');
          if (isValhallaTar) {
            const tarId = `${regionCode}-valhalla-tiles.tar`;
            const buf = rawBytes.buffer.byteLength === rawBytes.byteLength
              ? (rawBytes.buffer as ArrayBuffer)
              : rawBytes.slice().buffer;
            valhallaTiles.push({ id: tarId, data: buf });
            console.log(`[DataPack] Stored Valhalla tar payload from ${name}`);
            continue;
          }
          const obj = JSON.parse(textDecoder.decode(rawBytes)) as Record<string, unknown>;
          const isFeatureCollection = obj.type === 'FeatureCollection' && Array.isArray(obj.features);
          if (isFeatureCollection) {
            const featLen = (obj.features as unknown[]).length;
            if (baseName.includes('street') && featLen > featureCount(merged.streets)) {
              (merged as Record<string, unknown>).streets = obj;
              anyParsed = true;
            } else if (baseName.includes('boundar') && featLen > featureCount(merged.admin_boundaries)) {
              (merged as Record<string, unknown>).admin_boundaries = obj;
              anyParsed = true;
            } else if (baseName.includes('settlement') && featLen > featureCount(merged.settlement_places)) {
              (merged as Record<string, unknown>).settlement_places = obj;
              anyParsed = true;
            }
            continue;
          }
          let data = obj;
          const topLevelKeys = Object.keys(obj);
          if (topLevelKeys.length === 1 && typeof obj[topLevelKeys[0]] === 'object' && obj[topLevelKeys[0]] != null && hasDataShape(obj[topLevelKeys[0]] as Record<string, unknown>)) {
            data = obj[topLevelKeys[0]] as Record<string, unknown>;
          }
          if (hasDataShape(data)) {
            merge(merged, data);
            anyParsed = true;
            continue;
          }
          const looksLikeMetadata = obj.region_code != null && (obj.stats != null || obj.version != null);
          if (looksLikeMetadata && (merged.metadata == null || (merged.metadata as Record<string, unknown>)?.stats == null)) {
            (merged as Record<string, unknown>).metadata = obj;
            anyParsed = true;
          }
        } catch {
          // skip unparseable entries
        }
      }
      if (valhallaTiles.length > 0) {
        await storeValhallaTilesForPack(regionCode, valhallaTiles);
      }
      if (!anyParsed) throw new Error('No valid data JSON found in pack. Files: ' + [...files.keys()].join(', '));
      rawContent = merged;
    } else {
      try {
        rawContent = (await dataResponse.json()) as VPSRawContent;
        console.log(`[DataPack] JSON parsed for ${regionCode}`);
      } catch (parseError: unknown) {
        throw new Error(
          `Failed to parse data pack: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}.`
        );
      }
    }

    onProgress?.(50);

    // Normalize: same as web (street_segments, boundaries, FeatureCollection)
    let streets: unknown[] = Array.isArray(rawContent.streets) ? rawContent.streets : [];
    let boundaries: unknown[] = Array.isArray(rawContent.admin_boundaries) ? rawContent.admin_boundaries : [];
    if (streets.length === 0 && rawContent.street_segments != null) {
      const segs = rawContent.street_segments;
      streets = Array.isArray(segs) ? segs : (segs as { features?: unknown[] }).features ?? [];
    }
    if (boundaries.length === 0 && rawContent.boundaries != null) {
      const b = rawContent.boundaries;
      boundaries = Array.isArray(b) ? b : (b as { features?: unknown[] }).features ?? [];
    }
    if (streets.length === 0 && rawContent.streets != null && typeof rawContent.streets === 'object' && (rawContent.streets as { type?: string }).type === 'FeatureCollection') {
      streets = (rawContent.streets as { features?: unknown[] }).features ?? [];
    }
    if (boundaries.length === 0 && rawContent.admin_boundaries != null && typeof rawContent.admin_boundaries === 'object' && (rawContent.admin_boundaries as { type?: string }).type === 'FeatureCollection') {
      boundaries = (rawContent.admin_boundaries as { features?: unknown[] }).features ?? [];
    }
    const settlements = Array.isArray(rawContent.settlement_places)
      ? rawContent.settlement_places
      : (rawContent.settlement_places as { features?: unknown[] })?.features ?? [];

    const metadata = (rawContent.metadata && typeof rawContent.metadata === 'object' ? rawContent.metadata : {
      region_code: regionCode,
      region_name: regionCode,
      version: '1.0',
      generated_at: new Date().toISOString(),
      bbox: [0, 0, 0, 0] as [number, number, number, number],
    }) as { region_code: string; region_name: string; version: string; generated_at: string; bbox: [number, number, number, number]; country_code?: string };

    const countryCode = metadata.country_code ?? (boundaries[0] as { country_code?: string } | undefined)?.country_code ?? 'CM';

  console.log(`[DataPack] Processing ${streets.length} streets, ${boundaries.length} boundaries, ${settlements.length} settlements for ${countryCode}`);

  onProgress?.(60);

  // Prepare data for storage
  const storedStreets: StreetSegment[] = [];
  const storedBoundaries: AdminBoundary[] = [];
  const storedSettlements: SettlementPlace[] = [];

  // Process street segments
  for (const street of streets) {
    // Unified packs provide GeoJSON Features with properties.osm_id (often no id field).
    const s = street as Record<string, unknown> & {
      properties?: Record<string, unknown> & { names?: { en?: string; fr?: string } };
      geometry?: { coordinates?: [number, number][] };
      coordinates?: [number, number][];
      id?: string | number;
      osm_id?: string | number;
      highway_type?: string;
    };
    const props = (s.properties || s) as Record<string, unknown> & {
      names?: { en?: string; fr?: string };
      id?: string | number;
      osm_id?: string | number;
      name?: string;
      name_en?: string;
      name_fr?: string;
      display_name_en?: string;
      display_name_fr?: string;
      highway?: string;
      highway_type?: string;
    };
    const coords = (s.geometry?.coordinates || s.coordinates || []) as [number, number][];

    if (coords.length < 2) continue;

    const bbox = calculateBbox(coords);
    const rawHighway = (props.highway || props.highway_type || s.highway_type || null) as string | null;
    
    // Normalize highway type to match schema constraint
    const normalizedStreetType = normalizeStreetType(rawHighway);
    
    const rawId = props.id ?? s.id ?? props.osm_id ?? s.osm_id;
    const segment: StreetSegment = {
      id: rawId != null && String(rawId) !== '' ? String(rawId) : `${metadata.region_code}-street-${storedStreets.length}`,
      name: (props.name as string) || null,
      name_en: (props.name_en as string) || (props.display_name_en as string) || props?.names?.en || undefined,
      name_fr: (props.name_fr as string) || (props.display_name_fr as string) || props?.names?.fr || undefined,
      geometry: stringifyJSON(coords),
      street_type: normalizedStreetType,
      region_id: metadata.region_code,
      bbox: stringifyJSON(bbox),
      spacing_constant: 12,
      numbering_direction: 'ascending',
      source: 'osm',
      cached_at: new Date().toISOString(),
    };
    storedStreets.push(segment);
  }

  onProgress?.(70);

  // Process admin boundaries (name may be top-level or in properties for GeoJSON)
  type BoundaryLike = {
    id?: string;
    name?: string | null;
    admin_level?: number;
    geometry?: Array<[number, number]> | { coordinates?: unknown[] };
    parent_id?: string;
    country_code?: string;
    osm_id?: number;
    osm_type?: string;
    area?: number;
    properties?: Record<string, unknown> & { name?: string; name_en?: string; name_fr?: string; admin_level?: number; country_code?: string; osm_id?: number; osm_type?: string; area?: number };
  };
  for (const boundary of boundaries) {
    const b = boundary as BoundaryLike;
    const props = b.properties ?? {};
    const name = String(b.name ?? props.name ?? '').trim() || '(unnamed)';
    const geom = Array.isArray(b.geometry) ? b.geometry : (b.geometry && typeof b.geometry === 'object' && Array.isArray((b.geometry as { coordinates?: unknown[] }).coordinates)) ? (b.geometry as { coordinates: Array<[number, number]> }).coordinates : [];
    const adminLevel = getAdminLevelForStorage(b.admin_level ?? (props.admin_level as number));
    const bbox = geom.length > 0 ? calculateBbox(geom) : [0, 0, 0, 0] as [number, number, number, number];

    const adminBoundary: AdminBoundary = {
      id: (b.id ?? (props.id as string) ?? '') || String(storedBoundaries.length),
      name,
      admin_level: b.admin_level ?? (props.admin_level as number) ?? 0,
      level: adminLevel,
      polygon: stringifyJSON(geom),
      parent_id: b.parent_id ?? (props.parent_id as string) ?? undefined,
      country_code: (b.country_code ?? (props.country_code as string)) || countryCode,
      osm_id: b.osm_id ?? (props.osm_id as number) ?? undefined,
      osm_type: (b.osm_type ?? props.osm_type as string) as 'node' | 'way' | 'relation' | undefined,
      area: b.area ?? (props.area as number) ?? undefined,
      bbox: stringifyJSON(bbox),
      packId: metadata.region_code,
      source: 'osm',
      cached_at: new Date().toISOString(),
    };
    storedBoundaries.push(adminBoundary);
  }

  onProgress?.(80);

  // Process settlement places
  let storedSettlementCount = 0;
  let skippedSettlementCount = 0;

  for (const settlement of settlements) {
    const place = settlement as Record<string, unknown> & {
      id?: string | number;
      name?: string;
      place?: string;
      lat?: number;
      lon?: number;
      osm_id?: number;
      osm_type?: 'node' | 'way' | 'relation';
      geometry?: { type?: string; coordinates?: unknown[] } | [number, number][];
      properties?: Record<string, unknown>;
    };
    const props = (place.properties || {}) as Record<string, unknown>;
    let lat = typeof place.lat === 'number' ? place.lat : (typeof props.lat === 'number' ? (props.lat as number) : undefined);
    let lon = typeof place.lon === 'number' ? place.lon : (typeof props.lon === 'number' ? (props.lon as number) : undefined);
    const geom = place.geometry as { type?: string; coordinates?: unknown[] } | [number, number][] | undefined;
    if ((lat === undefined || lon === undefined) && geom && !Array.isArray(geom) && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      lon = Number(geom.coordinates[0]);
      lat = Number(geom.coordinates[1]);
    }

    // Skip if missing required fields (lat/lon)
    if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
      skippedSettlementCount++;
      continue;
    }

    // Skip if name is missing or empty (name is NOT NULL in schema)
    // Settlements without names aren't useful for geocoding
    const settlementName = String(place.name ?? props.name ?? '').trim();
    if (!settlementName) {
      skippedSettlementCount++;
      console.warn(`[DataPack] Skipping settlement ${String(place.id ?? props.id ?? 'unknown')} - missing name`);
      continue;
    }

    const geoCell = getGeoCell(lat, lon);
    const geometry = Array.isArray(geom) ? geom : [];

    // Normalize place type to match schema constraint
    const normalizedPlaceType = normalizePlaceType(String(place.place ?? props.place ?? 'village'));
    const rawSettlementId = place.id ?? props.id ?? place.osm_id ?? props.osm_id;
    const settlementId =
      rawSettlementId != null && String(rawSettlementId) !== ''
        ? String(rawSettlementId)
        : `${metadata.region_code}-settlement-${storedSettlements.length}`;

    const settlementPlace: SettlementPlace = {
      id: settlementId,
      packId: metadata.region_code,
      name: settlementName, // Guaranteed to be non-empty after check above
      place: normalizedPlaceType,
      lat,
      lon,
      polygon: geometry.length > 0 ? stringifyJSON(geometry) : undefined,
      geoCell: geoCell,
      osm_id: (place.osm_id ?? (props.osm_id as number | undefined)) || undefined,
      osm_type: (place.osm_type ?? (props.osm_type as 'node' | 'way' | 'relation' | undefined)) || undefined,
      source: 'osm',
      cached_at: new Date().toISOString(),
    };
    storedSettlements.push(settlementPlace);
    storedSettlementCount++;
  }

  console.log(`[DataPack] Stored ${storedSettlementCount} settlement places, skipped ${skippedSettlementCount}`);

  onProgress?.(82);

  // Process POIs (Phase 1)
  const poisRaw = rawContent.pois;
  const poisData = Array.isArray(poisRaw)
    ? poisRaw
    : (((poisRaw as unknown) as { features?: unknown[] } | undefined)?.features ?? []);
  const storedPOIs: POIRecord[] = [];
  type PoiRawLike = Record<string, unknown> & { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown[] }; id?: string };
  for (const poiRaw of poisData as PoiRawLike[]) {
    const props = (poiRaw.properties || poiRaw) as Record<string, unknown>;
    const geom = poiRaw.geometry as { type?: string; coordinates?: unknown[] } | undefined;
    let lat = props.lat as number | undefined;
    let lon = props.lon as number | undefined;
    if ((lat === undefined || lon === undefined) && geom?.coordinates && Array.isArray(geom.coordinates)) {
      if (geom.type === 'Point') {
        lon = geom.coordinates[0] as number;
        lat = geom.coordinates[1] as number;
      }
    }
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) continue;
    const tagSource = (props.tags || props) as Record<string, unknown>;
    const mergedTags: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(tagSource)) {
      if (key === 'geometry' || key === 'coordinates' || key === 'type' || key === 'id') continue;
      if (typeof value === 'string') mergedTags[key] = value;
    }
    if (typeof props.category === 'string' && typeof props.type === 'string') {
      mergedTags[props.category] = props.type;
    }
    if (props.name_en != null) mergedTags['name:en'] = String(props.name_en);
    if (props.name_fr != null) mergedTags['name:fr'] = String(props.name_fr);
    const poi = buildPOIFromOSM(
      {
        id: String(props.id ?? poiRaw.id ?? `poi_${Date.now()}_${Math.random().toString(36).slice(2)}`),
        osm_id: props.osm_id as number | undefined,
        osm_type: props.osm_type as 'node' | 'way' | 'relation' | undefined,
        lat,
        lon,
        tags: mergedTags,
      },
      metadata.region_code,
      countryCode
    );
    storedPOIs.push(poi);
  }
  if (storedPOIs.length > 0) {
    console.log(`[DataPack] Parsed ${storedPOIs.length} POIs`);
  }

  // Pre-computed routes (stored after commit)
  const routesRaw: unknown[] = Array.isArray(rawContent.routes) ? rawContent.routes : [];
  type RouteRaw = {
    start_coord?: unknown;
    end_coord?: unknown;
    path?: unknown;
    distance?: number;
    duration?: number;
    start_poi_id?: string;
  };
  const routeRecords = routesRaw
    .filter((r) => {
      const rr = r as RouteRaw;
      return Array.isArray(rr.start_coord) && Array.isArray(rr.end_coord) && Array.isArray(rr.path);
    })
    .map((r) => {
      const rr = r as RouteRaw;
      return {
        startCoord: rr.start_coord as [number, number],
        endCoord: rr.end_coord as [number, number],
        path: rr.path as [number, number][],
        distance: rr.distance ?? 0,
        duration: rr.duration,
        startPOIId: rr.start_poi_id,
        endPOIId: undefined,
        source: 'legacy' as const,
        quality: 1 as const,
        packId: metadata.region_code,
      };
    });

  onProgress?.(65);

  // Force refresh: delete existing prod data and clear staging
  if (forceRefresh) {
    console.log(`[DataPack] Force refresh: deleting existing data for ${regionCode}...`);
    await Promise.all([
      deleteStreetSegmentsByRegion(regionCode).catch(err => console.warn('[DataPack] Error deleting streets:', err)),
      deleteAdminBoundariesByPack([regionCode]).catch(err => console.warn('[DataPack] Error deleting boundaries:', err)),
      deleteSettlementPlacesByPack([regionCode]).catch(err => console.warn('[DataPack] Error deleting settlements:', err)),
      deletePOIsByPack(regionCode).catch(err => console.warn('[DataPack] Error deleting POIs:', err)),
      clearRoutesForPack(regionCode).catch(err => console.warn('[DataPack] Error clearing route cache:', err)),
      clearStagingTablesForRegion(regionCode),
    ]);
  }

  // Deduplicate by ID
  const uniqueStreets = Array.from(new Map(storedStreets.map(seg => [seg.id, seg])).values());
  const uniqueBoundaries = Array.from(new Map(storedBoundaries.map(b => [b.id, b])).values());
  const uniqueSettlements = Array.from(new Map(storedSettlements.map(s => [s.id, s])).values());
  console.log(`[DataPack] Deduplicated: ${uniqueStreets.length} streets, ${uniqueBoundaries.length} boundaries, ${uniqueSettlements.length} settlements, ${storedPOIs.length} POIs`);

  // Clear staging and write to STG
  await clearStagingTablesForRegion(regionCode);
  await batchInsertStreetSegmentsStg(uniqueStreets);
  await batchInsertAdminBoundariesStg(uniqueBoundaries);
  await batchInsertSettlementPlacesStg(uniqueSettlements);
  await batchInsertPOIsStg(storedPOIs);

  const valhallaTileCount =
    (metadata as Record<string, unknown>).valhalla_tile_count as number | undefined ??
    (metadata as { stats?: { valhalla_tile_count?: number } }).stats?.valhalla_tile_count ??
    0;
  const manifest: DataPackManifest = {
    id: metadata.region_code,
    name: metadata.region_name,
    region: metadata.region_code,
    country: countryCode,
    version: metadata.version,
    street_count: uniqueStreets.length,
    boundary_count: uniqueBoundaries.length,
    settlement_count: uniqueSettlements.length,
    settlement_place_count: uniqueSettlements.length,
    poi_count: storedPOIs.length,
    valhalla_tile_count: valhallaTileCount > 0 ? valhallaTileCount : undefined,
    size_bytes: 0,
    created_at: metadata.generated_at,
    downloaded_at: new Date().toISOString(),
  };
  await insertPackStagingManifest(manifest);

  // Phase 4: fetch and store Valhalla tiles if pack declares them
  if (valhallaTileCount > 0) {
    try {
      const valhallaUrl = getVpsValhallaTilesUrl(regionCode);
      const res = await fetch(valhallaUrl);
      if (res.ok) {
        const data = await res.arrayBuffer();
        await storeValhallaTilesForPack(regionCode, [{ id: `${regionCode}-valhalla.tar`, data }]);
        console.log(`[DataPack] Stored Valhalla tiles for ${regionCode} (${data.byteLength} bytes)`);
      } else {
        console.warn(`[DataPack] Valhalla tiles not found at ${valhallaUrl} (${res.status})`);
      }
    } catch (valhallaErr) {
      console.warn('[DataPack] Valhalla tiles fetch failed:', valhallaErr);
    }
  }

  onProgress?.(75);
  await setPackState(regionCode, 'STAGING');
  await setPackState(regionCode, 'VALIDATING');

  // Validate staging counts vs manifest
  const counts = await getStagingCounts(regionCode);
  if (
    counts.streetCount !== manifest.street_count ||
    counts.boundaryCount !== manifest.boundary_count ||
    counts.settlementCount !== manifest.settlement_count ||
    counts.poiCount !== storedPOIs.length
  ) {
    await purgeTmpAndStagingForRegion(regionCode);
    await setPackState(regionCode, 'FAILED');
    throw new Error(
      `Validation failed: staging counts (streets=${counts.streetCount}, boundaries=${counts.boundaryCount}, settlements=${counts.settlementCount}, pois=${counts.poiCount}) do not match manifest (${manifest.street_count}, ${manifest.boundary_count}, ${manifest.settlement_count}, ${storedPOIs.length})`
    );
  }

  // Phase 4: if manifest requires Valhalla tiles, staging must have them
  if (valhallaTileCount > 0) {
    const hasTiles = await hasStagingTilesForRegion(regionCode);
    if (!hasTiles) {
      await purgeTmpAndStagingForRegion(regionCode);
      await setPackState(regionCode, 'FAILED');
      throw new Error(
        `Validation failed: manifest requires Valhalla tiles (${valhallaTileCount}) but none in staging`
      );
    }
  }

  onProgress?.(80);
  await setPackState(regionCode, 'INSTALLING');
  await copyStagingToProd(regionCode);
  if (valhallaTileCount > 0) {
    await commitValhallaStagingToProd(regionCode);
  }

  // Store routes after commit (not in staging)
  if (routeRecords.length > 0) {
    const routesStored = await cacheRoutesBatch(routeRecords);
    console.log(`[DataPack] Stored ${routesStored} cached routes`);
  }

  await setPackState(regionCode, 'INSTALLED');
  await purgeTmpAndStagingForRegion(regionCode);

  onProgress?.(92);
  try {
    const indexResult = await buildPackIndex(
      metadata.region_code,
      metadata.version,
      uniqueStreets,
      uniqueBoundaries,
      countryCode,
      storedPOIs
    );
    console.log(`[DataPack] Search index built: ${indexResult.itemCount} items indexed`);
  } catch (indexError) {
    console.warn('[DataPack] Search index build failed (data still usable):', indexError);
  }

  onProgress?.(100);
  console.log(`[DataPack] Successfully installed data pack for ${regionCode}`);
  } catch (err) {
    await purgeTmpAndStagingForRegion(regionCode).catch(() => {});
    await setPackState(regionCode, 'FAILED').catch(() => {});
    throw err;
  }
}

/**
 * Check if a data pack is downloaded
 */
export async function isDataPackDownloaded(regionCode: string): Promise<boolean> {
  const manifest = await getDataPackManifestById(regionCode);
  return manifest !== null;
}
