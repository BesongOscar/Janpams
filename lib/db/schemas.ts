/**
 * Database Schemas for Mobile (SQLite)
 * 
 * These schemas match the web's IndexedDB schemas exactly.
 * Field names, types, and relationships are identical to ensure data compatibility.
 * 
 * Reference: docs/src/lib/db.ts (web implementation)
 */

// Name source type for dual address creation
export type AddressNameSource = 'api_official' | 'user_suggested';

export interface Address {
  id: string;
  local_id: string;
  
  // Core Address Components
  house_number: number;
  extension?: string;  // e.g., "A", "B" for subdivisions/compound addresses
  parent_address_id?: string;  // Reference to parent address for compound addressing
  street_name: string;
  street_type?: string;  // e.g., "Avenue", "Street", "Road"
  
  // Location Hierarchy
  neighborhood?: string;
  city: string;
  region: string;
  country: string;
  
  // Coordinates
  latitude: number;
  longitude: number;
  plus_code: string;
  
  // Calculation Metadata
  side_of_street?: 'L' | 'R';
  chainage_meters?: number;
  spacing_constant?: number;
  distance_from_street?: number;
  
  // Property Information
  business_name?: string;
  property_category: string;  // residential, commercial, etc.
  property_type: string;  // House, Shop, Office, etc.
  
  // User Relationship
  created_by?: string;
  connection_type?: string;  // owner, tenant, manager, etc.
  
  // Media
  image_url?: string;
  image_storage_path?: string;
  
  // Status
  status: 'pending' | 'verified' | 'rejected';
  verified_at?: string;
  verified_by?: string;
  
  // Name Source (for dual address creation)
  // 'api_official' = original name from API/OSM data
  // 'user_suggested' = user edited the name (triggers community voting)
  name_source?: AddressNameSource;
  // ID of linked address when dual creation occurred
  linked_address_id?: string;
  // Reference to the street name suggestion if user_suggested
  street_suggestion_id?: string;
  neighborhood_suggestion_id?: string;
  
  // Sync Support
  sync_status: 'pending' | 'synced' | 'conflict';
  last_synced_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Street {
  id: string;
  osm_id?: number;
  name?: string;
  alt_name?: string;
  
  // Geometry (LineString as array of [lon, lat] points)
  geometry: string; // JSON string in SQLite: [number, number][]
  
  // Direction
  direction_locked?: boolean;
  start_node?: string; // JSON string: [number, number] [lat, lon]
  end_node?: string;   // JSON string: [number, number] [lat, lon]
  
  // Classification
  street_type?: string;  // primary, secondary, residential, etc.
  surface_type?: string;
  
  // Addressing Config
  numbering_direction?: 'west_to_east' | 'east_to_west' | 'north_to_south' | 'south_to_north';
  spacing_constant?: number;
  
  // Admin
  city?: string;
  region?: string;
  country?: string;
  
  // Metadata
  source?: 'osm' | 'local' | 'manual';
  cached_at: string;
}

export interface SyncQueueItem {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  record_id?: string;
  local_id?: string;
  data: string; // JSON string in SQLite: Record<string, unknown>
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  last_error?: string;
  device_id?: string;
  created_at: string;
  processed_at?: string;
}

export interface TileCache {
  url: string;
  blob: string; // Base64 encoded blob in SQLite
  cached_at: string;
  expires_at?: string;
}

export interface StreetSegment {
  id: string;
  osm_id?: number;
  name: string | null;
  name_en?: string;
  name_fr?: string;
  alt_name?: string;
  ref?: string;
  street_type: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'unclassified' | 'path';
  oneway?: boolean;
  layer?: number;
  geometry: string; // JSON string: [number, number][]
  bbox: string; // JSON string: { minLat, maxLat, minLon, maxLon }
  spacing_constant: number;
  numbering_direction: 'ascending' | 'descending';
  city_id?: string;
  region_id?: string;
  source: 'osm' | 'local' | 'user';
  cached_at: string;
}

export interface AdminBoundary {
  id: string;
  osm_id?: number;
  osm_type?: 'node' | 'way' | 'relation';
  name: string;
  name_en?: string;
  name_fr?: string;
  level: 'country' | 'region' | 'county' | 'city' | 'neighborhood';
  admin_level: number;
  polygon: string; // JSON string: [number, number][]
  bbox: string; // JSON string: { minLat, maxLat, minLon, maxLon }
  area?: number; // polygon area in sq meters for tie-breaking
  parent_id?: string;
  country_code: string;
  packId?: string; // for filtering by data pack
  token?: string;
  source: 'osm' | 'local';
  cached_at: string;
}

// Settlement place types for Nominatim-like city/neighborhood resolution
export type SettlementPlaceType = 
  | 'city' 
  | 'town' 
  | 'village' 
  | 'hamlet' 
  | 'suburb' 
  | 'neighbourhood' 
  | 'neighborhood'  // US spelling variant
  | 'quarter' 
  | 'city_district'
  | 'postcode';  // For neighborhood fallback per spec

export interface SettlementPlace {
  id: string;
  packId: string;
  name: string;
  name_en?: string;
  name_fr?: string;
  place: SettlementPlaceType;
  lat: number;
  lon: number;
  osm_id?: number;
  osm_type?: 'node' | 'way' | 'relation';
  polygon?: string; // JSON string: optional polygon for containment checks
  bbox?: string; // JSON string: { minLat, maxLat, minLon, maxLon }
  geoCell?: string; // grid cell for spatial indexing
  source: 'osm' | 'local';
  cached_at: string;
}

export interface StreetSuggestion {
  id: string;
  street_segment_id?: string;
  original_name: string | null;
  suggested_name: string;
  location: string; // JSON string: { lat: number; lon: number }
  status: 'pending' | 'approved' | 'rejected';
  created_by?: string;
  created_at: string;
}

export interface DataPackManifest {
  id: string;
  name: string;
  region: string;
  country: string;
  version: string;
  street_count: number;
  boundary_count: number;
  settlement_count?: number;
  /** Match web DataPackManifest; set when available from manifest or download. */
  settlement_place_count?: number;
  poi_count?: number;
  valhalla_tile_count?: number;
  size_bytes: number;
  sha256?: string;
  created_at: string;
  downloaded_at?: string;
}

// Location Capture for Trust Policy
export interface LocationCapture {
  id: string;
  // GPS data
  samples: string; // JSON string: Array<{ latitude, longitude, accuracy, timestamp, plusCode }>
  centroid: string; // JSON string: { lat: number; lon: number }
  centroidPlusCode: string;
  averageAccuracy: number;
  spread: number;
  
  // Trust classification
  trustLevel: 'L1' | 'L2' | 'FAIL';
  trustReason: string;
  
  // User confirmation
  selectedPlusCode: string;
  selectionMethod: 'center' | 'neighbor';
  
  // Device info
  deviceInfo: string; // JSON string: { userAgent, platform, highAccuracySupported }
  
  // Metadata
  capturedAt: string;
  confirmedAt: string;
  
  // Sync status
  syncStatus: 'pending' | 'synced';
  addressId?: string;
}

// Street Number Reservation for duplicate prevention
export interface StreetNumberReservation {
  id: string;
  streetKey: string;
  houseNumber: number;
  lat: number;
  lon: number;
  source: 'JANGO_ASSIGNED' | 'OSM_OFFICIAL' | 'USER_CONFIRMED';
  createdAt: string;
  addressId?: string; // linked when address is created
}

// ===== STREET DIRECTION LOCK TYPES (Phase 2) =====

export type DirectionState = 'unlocked' | 'locked';
export type LockedDirection = 'as_is' | 'reversed';
export type LockSource = 'auto_on_first_address' | 'authority_override';

export interface StreetDirectionLock {
  /** Unique key for the street (e.g., "name:rue_principale:douala") */
  streetKey: string;
  /** Whether direction is locked or unlocked */
  directionState: DirectionState;
  /** The locked direction value (null if unlocked) */
  lockedDirection: LockedDirection | null;
  /** ISO timestamp when direction was locked */
  lockedAt: string | null;
  /** User ID or system identifier that created the lock */
  lockedBy: string | null;
  /** How the lock was created */
  lockSource: LockSource | null;
  /** Sync status for offline-first */
  syncStatus: 'pending' | 'synced' | 'conflict';
  /** Last synced timestamp */
  lastSyncedAt?: string;
}

// ===== LOCAL USER ROLES (Phase 3 - Offline-first, parity with web) =====

/** Matches web AppRole; stored in local_user_roles.role after migration 13. */
export type AppRole = 'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin';

export interface LocalUserRole {
  id: string;
  userId: string;
  role: AppRole;
  grantedBy?: string;
  grantedAt: string;
  syncStatus: 'pending' | 'synced';
}

// ===== DIRECTION AUDIT LOG (Phase 3 - Offline-first) =====

export interface DirectionAuditLog {
  id: string;
  streetKey: string;
  previousDirection: string | null;
  newDirection: string;
  action: 'auto_lock' | 'authority_override';
  reason?: string;
  performedBy: string;
  performedAt: string;
  syncStatus: 'pending' | 'synced';
}

// ===== COMMUNITY VOTING SYSTEM TYPES (Phase 1 - v9) =====

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'superseded' | 'alias';
export type VoteType = 'up' | 'down';
export type OriginalSource = 'api' | 'offline' | 'none';
export type NameType = 'street' | 'neighborhood';

export interface StreetNameSuggestionLocal {
  id: string;
  localId: string;  // UUID generated locally for offline tracking
  plusCode: string;
  streetKey: string;
  suggestedName: string;
  suggestedType?: string;  // Street type (Avenue, Road, etc.)
  fullSuggestedName: string;
  languageCode: string;  // ISO 639-1 (en, fr, pt)
  originalName?: string;
  originalSource: OriginalSource;
  aliasGroupId?: string;
  isPrimaryName: boolean;
  suggestedBy?: string;  // User ID if authenticated
  suggestedAt: string;
  status: SuggestionStatus;
  voteCountUp: number;
  voteCountDown: number;
  reportCount: number;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

export interface NeighborhoodNameSuggestionLocal {
  id: string;
  localId: string;
  plusCode: string;
  neighborhoodKey: string;  // Geohash or admin boundary ID
  suggestedName: string;
  languageCode: string;
  originalName?: string;
  originalSource: OriginalSource;
  aliasGroupId?: string;
  isPrimaryName: boolean;
  suggestedBy?: string;
  suggestedAt: string;
  status: SuggestionStatus;
  voteCountUp: number;
  voteCountDown: number;
  reportCount: number;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

export interface VoteLocal {
  id: string;
  localId: string;
  suggestionId: string;
  suggestionType: NameType;  // 'street' or 'neighborhood'
  userId?: string;
  voteType: VoteType;
  votedAt: string;
  userLocationAtVote?: string; // JSON string: { lat: number; lon: number; accuracy: number }
  distanceFromStreet?: number;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

export interface NameAliasGroupLocal {
  id: string;
  streetKey?: string;
  neighborhoodKey?: string;
  createdAt: string;
  createdBy?: string;
  primarySuggestionId?: string;
  primaryNameType: NameType;
  linkedSuggestionIds: string; // JSON string: string[] - All suggestions in this alias group
  syncStatus: 'pending' | 'synced' | 'conflict';
}

// ===== SEARCH INDEX TYPES (v0.1.1) =====

export type SearchItemType = 'address' | 'street' | 'place' | 'admin';

export interface SearchItem {
  itemId: string;
  type: SearchItemType;
  label: string;
  subtitle?: string;
  lat: number;
  lon: number;
  packId?: string;
  countryCode?: string;
  adminPath?: string;
  entityId?: string;
  extra?: string; // JSON string: Record<string, unknown>
  updatedAt: number;
}

export interface SearchToken {
  tokenPrefix: string;
  itemIds: string; // JSON string: string[]
  updatedAt: number;
}

export interface SearchItemTokens {
  itemId: string;
  tokenPrefixes: string; // JSON string: string[]
  updatedAt: number;
}

export interface SearchPackMeta {
  packVersion: string;
  indexedAt: number;
  itemCount?: number;
  countryCode?: string;
}

export interface SearchIndexMeta {
  key: 'meta';
  indexSchemaVersion: number;
  crashFlag: boolean;
  lastBuildStartedAt?: number;
  lastBuildCompletedAt?: number;
  packs: string; // JSON string: Record<string, SearchPackMeta>
}

// ===== POI (Point of Interest) TYPES (Phase 1 - v10) =====

export type POITier = 1 | 2 | 3;

export type POICategory =
  | 'healthcare'
  | 'education'
  | 'religious'
  | 'transport'
  | 'commerce'
  | 'government'
  | 'accommodation'
  | 'finance'
  | 'emergency'
  | 'leisure'
  | 'historic'
  | 'natural'
  | 'residential'
  | 'infrastructure'
  | 'other';

export interface POIOSMTags {
  amenity?: string;
  shop?: string;
  tourism?: string;
  office?: string;
  leisure?: string;
  public_transport?: string;
  healthcare?: string;
  sport?: string;
  craft?: string;
  emergency?: string;
  historic?: string;
  railway?: string;
  aeroway?: string;
  man_made?: string;
  highway?: string;
  junction?: string;
  natural?: string;
  building?: string;
  name?: string;
  'name:en'?: string;
  'name:fr'?: string;
  brand?: string;
  operator?: string;
  [key: string]: string | undefined;
}

export interface POIRecord {
  id: string;
  osm_id?: number;
  osm_type?: 'node' | 'way' | 'relation';
  lat: number;
  lon: number;
  name: string;
  name_en?: string;
  name_fr?: string;
  brand?: string;
  operator?: string;
  category: POICategory;
  subcategory: string;
  tier: POITier;
  tags: POIOSMTags;
  stabilityScore: number;
  packId: string;
  countryCode: string;
  cached_at: string;
}

// ===== ROUTE CACHE TYPES (Phase 1 - v10) =====

export type RouteSource = 'valhalla_local' | 'valhalla_online' | 'dijkstra' | 'legacy';
export type RouteQuality = 1 | 2 | 3; // 1=high (Valhalla), 2=medium, 3=low

export interface CachedRoute {
  id: string;
  startCoord: [number, number];
  endCoord: [number, number];
  startPOIId?: string;
  endPOIId?: string;
  path: [number, number][];
  distance: number;
  duration?: number;
  source: RouteSource;
  quality: RouteQuality;
  packId: string;
  cachedAt: string;
  expiresAt?: string;
}

// ===== JAPA PACK LIFECYCLE (Phase 2) =====

export type PackState =
  | 'NOT_INSTALLED'
  | 'DOWNLOADING'
  | 'STAGING'
  | 'VALIDATING'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'FAILED';

export interface PackStateRecord {
  regionCode: string;
  state: PackState;
  updatedAt: string;
}
