/**
 * Build POIRecord from raw OSM/pack data (Phase 1).
 * Minimal classification aligned with web's poiClassification + poiStability.
 */

import type { POIRecord, POICategory, POITier, POIOSMTags } from '../db/schemas';

// ----- Tier 1 (primary landmarks) -----
const TIER_1 = new Set([
  'hospital', 'clinic', 'doctors', 'marketplace', 'school', 'university', 'college',
  'place_of_worship', 'fuel', 'bus_station', 'ferry_terminal',
  'church', 'mosque', 'temple', 'stadium', 'train_station',
  'mini_roundabout', 'motorway_junction', 'station', 'halt', 'aerodrome', 'terminal',
]);

// ----- Tier 2 (secondary) -----
const TIER_2 = new Set([
  'pharmacy', 'bank', 'atm', 'fire_station', 'police', 'post_office', 'townhall',
  'supermarket', 'mall', 'hotel', 'motel', 'guest_house', 'museum', 'government',
]);

function isTier1(tags: POIOSMTags): boolean {
  const v = tags.amenity || tags.shop || tags.tourism || tags.building || tags.railway || tags.aeroway || tags.highway || tags.public_transport;
  return v ? TIER_1.has(String(v)) : false;
}

function isTier2(tags: POIOSMTags): boolean {
  const v = tags.amenity || tags.shop || tags.tourism || tags.office || tags.building;
  return v ? TIER_2.has(String(v)) : false;
}

export function classifyTier(tags: POIOSMTags): POITier {
  if (isTier1(tags)) return 1;
  if (isTier2(tags)) return 2;
  return 3;
}

export function classifyCategory(tags: POIOSMTags): POICategory {
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors' || tags.amenity === 'pharmacy' || tags.healthcare || tags.building === 'hospital') return 'healthcare';
  if (tags.amenity === 'school' || tags.amenity === 'university' || tags.amenity === 'college' || tags.building === 'school' || tags.building === 'university') return 'education';
  if (tags.amenity === 'place_of_worship' || tags.building === 'church' || tags.building === 'mosque' || tags.building === 'temple') return 'religious';
  if (tags.public_transport || tags.railway || tags.aeroway || tags.amenity === 'bus_station' || tags.amenity === 'ferry_terminal' || tags.building === 'train_station') return 'transport';
  if (tags.shop || tags.amenity === 'marketplace' || tags.amenity === 'fuel' || tags.craft) return 'commerce';
  if (tags.office === 'government' || tags.amenity === 'townhall') return 'government';
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'guest_house' || tags.tourism === 'hostel') return 'accommodation';
  if (tags.amenity === 'bank' || tags.amenity === 'atm') return 'finance';
  if (tags.amenity === 'fire_station' || tags.amenity === 'police' || tags.emergency) return 'emergency';
  if (tags.leisure || tags.sport || tags.building === 'stadium') return 'leisure';
  if (tags.historic) return 'historic';
  if (tags.natural) return 'natural';
  if (tags.building === 'house' || tags.building === 'residential' || tags.building === 'apartments') return 'residential';
  if (tags.man_made) return 'infrastructure';
  return 'other';
}

const TAG_KEYS = ['amenity', 'shop', 'tourism', 'office', 'leisure', 'healthcare', 'historic', 'natural', 'building', 'railway', 'aeroway', 'public_transport', 'highway', 'junction', 'craft', 'sport', 'emergency', 'man_made'];

export function getSubcategory(tags: POIOSMTags): string {
  for (const key of TAG_KEYS) {
    const value = tags[key];
    if (value && value !== 'yes') return value;
  }
  return 'unknown';
}

const CATEGORY_BASE: Record<POICategory, number> = {
  healthcare: 90, education: 85, religious: 85, transport: 80, government: 80, finance: 75,
  emergency: 75, historic: 90, natural: 95, accommodation: 60, commerce: 40, leisure: 50,
  residential: 30, infrastructure: 70, other: 30,
};

export function getStabilityScore(
  category: POICategory,
  _subcategory: string,
  tags: POIOSMTags,
  _osmType?: 'node' | 'way' | 'relation'
): number {
  let score = CATEGORY_BASE[category] ?? 30;
  if (tags.name) score += 5;
  if (tags.brand) score += 5;
  return Math.min(100, Math.max(0, score));
}

export interface BuildPOIFromOSMRaw {
  id: string;
  osm_id?: number;
  osm_type?: 'node' | 'way' | 'relation';
  lat: number;
  lon: number;
  tags: Record<string, string | undefined>;
}

/**
 * Build POIRecord from raw OSM/pack feature (used during data pack download).
 */
export function buildPOIFromOSM(raw: BuildPOIFromOSMRaw, packId: string, countryCode: string): POIRecord {
  const tags = raw.tags as POIOSMTags;
  const tier = classifyTier(tags);
  const category = classifyCategory(tags);
  const subcategory = getSubcategory(tags);
  const stabilityScore = getStabilityScore(category, subcategory, tags, raw.osm_type);

  return {
    id: raw.id,
    osm_id: raw.osm_id,
    osm_type: raw.osm_type,
    lat: raw.lat,
    lon: raw.lon,
    name: tags.name || '',
    name_en: tags['name:en'],
    name_fr: tags['name:fr'],
    brand: tags.brand,
    operator: tags.operator,
    category,
    subcategory,
    tier,
    tags,
    stabilityScore,
    packId,
    countryCode,
    cached_at: new Date().toISOString(),
  };
}
