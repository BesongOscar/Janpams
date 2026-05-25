/**
 * SQLite Schema Definitions
 * 
 * CREATE TABLE statements matching web's IndexedDB object stores exactly.
 * Field names, types, and relationships match web implementation.
 * 
 * Reference: docs/src/lib/db.ts (web IndexedDB schemas)
 */

export const SQLITE_SCHEMA_VERSION = 15; // address_book: local alias/saved addresses (My Address Book)

/**
 * SQL CREATE TABLE statements for all tables
 * Matches web's IndexedDB object stores
 */
export const CREATE_TABLES = {
  addresses: `
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL,
      house_number INTEGER NOT NULL,
      extension TEXT,
      parent_address_id TEXT,
      street_name TEXT NOT NULL,
      street_type TEXT,
      neighborhood TEXT,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      plus_code TEXT NOT NULL,
      side_of_street TEXT CHECK(side_of_street IN ('L', 'R')),
      chainage_meters REAL,
      spacing_constant REAL,
      distance_from_street REAL,
      business_name TEXT,
      property_category TEXT NOT NULL,
      property_type TEXT NOT NULL,
      created_by TEXT,
      connection_type TEXT,
      image_url TEXT,
      image_storage_path TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'verified', 'rejected')),
      verified_at TEXT,
      verified_by TEXT,
      name_source TEXT CHECK(name_source IN ('api_official', 'user_suggested')),
      linked_address_id TEXT,
      street_suggestion_id TEXT,
      neighborhood_suggestion_id TEXT,
      sync_status TEXT NOT NULL CHECK(sync_status IN ('pending', 'synced', 'conflict')),
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,

  address_book: `
    CREATE TABLE IF NOT EXISTS address_book (
      id TEXT PRIMARY KEY,
      address_id TEXT NOT NULL,
      alias_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,

  streets: `
    CREATE TABLE IF NOT EXISTS streets (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      name TEXT,
      alt_name TEXT,
      geometry TEXT NOT NULL,
      direction_locked INTEGER DEFAULT 0,
      start_node TEXT,
      end_node TEXT,
      street_type TEXT,
      surface_type TEXT,
      numbering_direction TEXT CHECK(numbering_direction IN ('west_to_east', 'east_to_west', 'north_to_south', 'south_to_north')),
      spacing_constant REAL,
      city TEXT,
      region TEXT,
      country TEXT,
      source TEXT CHECK(source IN ('osm', 'local', 'manual')),
      cached_at TEXT NOT NULL
    )
  `,

  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
      "table" TEXT NOT NULL,
      record_id TEXT,
      local_id TEXT,
      data TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    )
  `,

  tiles: `
    CREATE TABLE IF NOT EXISTS tiles (
      url TEXT PRIMARY KEY,
      blob TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      expires_at TEXT
    )
  `,

  street_segments: `
    CREATE TABLE IF NOT EXISTS street_segments (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      name TEXT,
      name_en TEXT,
      name_fr TEXT,
      alt_name TEXT,
      ref TEXT,
      street_type TEXT NOT NULL CHECK(street_type IN ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'path')),
      oneway INTEGER DEFAULT 0,
      layer INTEGER,
      geometry TEXT NOT NULL,
      bbox TEXT NOT NULL,
      spacing_constant REAL NOT NULL,
      numbering_direction TEXT NOT NULL CHECK(numbering_direction IN ('ascending', 'descending')),
      city_id TEXT,
      region_id TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local', 'user')),
      cached_at TEXT NOT NULL
    )
  `,

  admin_boundaries: `
    CREATE TABLE IF NOT EXISTS admin_boundaries (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      level TEXT NOT NULL CHECK(level IN ('country', 'region', 'county', 'city', 'neighborhood')),
      admin_level INTEGER NOT NULL,
      polygon TEXT NOT NULL,
      bbox TEXT NOT NULL,
      area REAL,
      parent_id TEXT,
      country_code TEXT NOT NULL,
      packId TEXT,
      token TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local')),
      cached_at TEXT NOT NULL
    )
  `,

  settlement_places: `
    CREATE TABLE IF NOT EXISTS settlement_places (
      id TEXT PRIMARY KEY,
      packId TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      place TEXT NOT NULL CHECK(place IN ('city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'neighborhood', 'quarter', 'city_district', 'postcode')),
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      polygon TEXT,
      bbox TEXT,
      geoCell TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local')),
      cached_at TEXT NOT NULL
    )
  `,

  street_suggestions: `
    CREATE TABLE IF NOT EXISTS street_suggestions (
      id TEXT PRIMARY KEY,
      street_segment_id TEXT,
      original_name TEXT,
      suggested_name TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
      created_by TEXT,
      created_at TEXT NOT NULL
    )
  `,

  data_packs: `
    CREATE TABLE IF NOT EXISTS data_packs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      version TEXT NOT NULL,
      street_count INTEGER NOT NULL,
      boundary_count INTEGER NOT NULL,
      settlement_count INTEGER,
      settlement_place_count INTEGER,
      poi_count INTEGER,
      valhalla_tile_count INTEGER,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT,
      created_at TEXT NOT NULL,
      downloaded_at TEXT
    )
  `,

  location_captures: `
    CREATE TABLE IF NOT EXISTS location_captures (
      id TEXT PRIMARY KEY,
      samples TEXT NOT NULL,
      centroid TEXT NOT NULL,
      centroidPlusCode TEXT NOT NULL,
      averageAccuracy REAL NOT NULL,
      spread REAL NOT NULL,
      trustLevel TEXT NOT NULL CHECK(trustLevel IN ('L1', 'L2', 'FAIL')),
      trustReason TEXT NOT NULL,
      selectedPlusCode TEXT NOT NULL,
      selectionMethod TEXT NOT NULL CHECK(selectionMethod IN ('center', 'neighbor')),
      deviceInfo TEXT NOT NULL,
      capturedAt TEXT NOT NULL,
      confirmedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced')),
      addressId TEXT
    )
  `,

  street_number_reservations: `
    CREATE TABLE IF NOT EXISTS street_number_reservations (
      id TEXT PRIMARY KEY,
      streetKey TEXT NOT NULL,
      houseNumber INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('JANGO_ASSIGNED', 'OSM_OFFICIAL', 'USER_CONFIRMED')),
      createdAt TEXT NOT NULL,
      addressId TEXT
    )
  `,

  street_direction_locks: `
    CREATE TABLE IF NOT EXISTS street_direction_locks (
      streetKey TEXT PRIMARY KEY,
      directionState TEXT NOT NULL CHECK(directionState IN ('unlocked', 'locked')),
      lockedDirection TEXT CHECK(lockedDirection IN ('as_is', 'reversed')),
      lockedAt TEXT,
      lockedBy TEXT,
      lockSource TEXT CHECK(lockSource IN ('auto_on_first_address', 'authority_override')),
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced', 'conflict')),
      lastSyncedAt TEXT
    )
  `,

  local_user_roles: `
    CREATE TABLE IF NOT EXISTS local_user_roles (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('basic_user', 'advanced_agent', 'org_admin', 'system_admin')),
      grantedBy TEXT,
      grantedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced'))
    )
  `,

  direction_audit_log: `
    CREATE TABLE IF NOT EXISTS direction_audit_log (
      id TEXT PRIMARY KEY,
      streetKey TEXT NOT NULL,
      previousDirection TEXT,
      newDirection TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('auto_lock', 'authority_override')),
      reason TEXT,
      performedBy TEXT NOT NULL,
      performedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced'))
    )
  `,

  street_name_suggestions: `
    CREATE TABLE IF NOT EXISTS street_name_suggestions (
      id TEXT PRIMARY KEY,
      localId TEXT NOT NULL,
      plusCode TEXT NOT NULL,
      streetKey TEXT NOT NULL,
      suggestedName TEXT NOT NULL,
      suggestedType TEXT,
      fullSuggestedName TEXT NOT NULL,
      languageCode TEXT NOT NULL,
      originalName TEXT,
      originalSource TEXT NOT NULL CHECK(originalSource IN ('api', 'offline', 'none')),
      aliasGroupId TEXT,
      isPrimaryName INTEGER NOT NULL DEFAULT 0,
      suggestedBy TEXT,
      suggestedAt TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'superseded', 'alias')),
      voteCountUp INTEGER NOT NULL DEFAULT 0,
      voteCountDown INTEGER NOT NULL DEFAULT 0,
      reportCount INTEGER NOT NULL DEFAULT 0,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced', 'conflict'))
    )
  `,

  neighborhood_name_suggestions: `
    CREATE TABLE IF NOT EXISTS neighborhood_name_suggestions (
      id TEXT PRIMARY KEY,
      localId TEXT NOT NULL,
      plusCode TEXT NOT NULL,
      neighborhoodKey TEXT NOT NULL,
      suggestedName TEXT NOT NULL,
      languageCode TEXT NOT NULL,
      originalName TEXT,
      originalSource TEXT NOT NULL CHECK(originalSource IN ('api', 'offline', 'none')),
      aliasGroupId TEXT,
      isPrimaryName INTEGER NOT NULL DEFAULT 0,
      suggestedBy TEXT,
      suggestedAt TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'superseded', 'alias')),
      voteCountUp INTEGER NOT NULL DEFAULT 0,
      voteCountDown INTEGER NOT NULL DEFAULT 0,
      reportCount INTEGER NOT NULL DEFAULT 0,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced', 'conflict'))
    )
  `,

  suggestion_votes: `
    CREATE TABLE IF NOT EXISTS suggestion_votes (
      id TEXT PRIMARY KEY,
      localId TEXT NOT NULL,
      suggestionId TEXT NOT NULL,
      suggestionType TEXT NOT NULL CHECK(suggestionType IN ('street', 'neighborhood')),
      userId TEXT,
      voteType TEXT NOT NULL CHECK(voteType IN ('up', 'down')),
      votedAt TEXT NOT NULL,
      userLocationAtVote TEXT,
      distanceFromStreet REAL,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced', 'conflict'))
    )
  `,

  name_alias_groups: `
    CREATE TABLE IF NOT EXISTS name_alias_groups (
      id TEXT PRIMARY KEY,
      streetKey TEXT,
      neighborhoodKey TEXT,
      createdAt TEXT NOT NULL,
      createdBy TEXT,
      primarySuggestionId TEXT,
      primaryNameType TEXT NOT NULL CHECK(primaryNameType IN ('street', 'neighborhood')),
      linkedSuggestionIds TEXT NOT NULL,
      syncStatus TEXT NOT NULL CHECK(syncStatus IN ('pending', 'synced', 'conflict'))
    )
  `,

  search_items: `
    CREATE TABLE IF NOT EXISTS search_items (
      itemId TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('address', 'street', 'place', 'admin')),
      label TEXT NOT NULL,
      subtitle TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      packId TEXT,
      countryCode TEXT,
      adminPath TEXT,
      entityId TEXT,
      extra TEXT,
      updatedAt INTEGER NOT NULL
    )
  `,

  search_tokens: `
    CREATE TABLE IF NOT EXISTS search_tokens (
      tokenPrefix TEXT PRIMARY KEY,
      itemIds TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `,

  search_item_tokens: `
    CREATE TABLE IF NOT EXISTS search_item_tokens (
      itemId TEXT PRIMARY KEY,
      tokenPrefixes TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `,

  search_index_meta: `
    CREATE TABLE IF NOT EXISTS search_index_meta (
      key TEXT PRIMARY KEY CHECK(key = 'meta'),
      indexSchemaVersion INTEGER NOT NULL,
      crashFlag INTEGER NOT NULL DEFAULT 0,
      lastBuildStartedAt INTEGER,
      lastBuildCompletedAt INTEGER,
      packs TEXT NOT NULL
    )
  `,

  // Phase 1: POIs (match web pois store)
  pois: `
    CREATE TABLE IF NOT EXISTS pois (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      brand TEXT,
      operator TEXT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      tier INTEGER NOT NULL CHECK(tier IN (1, 2, 3)),
      tags TEXT NOT NULL,
      stabilityScore REAL NOT NULL,
      packId TEXT NOT NULL,
      countryCode TEXT NOT NULL,
      cached_at TEXT NOT NULL
    )
  `,

  // Phase 1: Route cache (pre-computed routes from data packs)
  route_cache: `
    CREATE TABLE IF NOT EXISTS route_cache (
      id TEXT PRIMARY KEY,
      startCoord TEXT NOT NULL,
      endCoord TEXT NOT NULL,
      startPOIId TEXT,
      endPOIId TEXT,
      path TEXT NOT NULL,
      distance REAL NOT NULL,
      duration REAL,
      source TEXT NOT NULL,
      quality INTEGER NOT NULL CHECK(quality IN (1, 2, 3)),
      packId TEXT NOT NULL,
      cachedAt TEXT NOT NULL,
      expiresAt TEXT
    )
  `,

  // Phase 2: JAPA pack lifecycle state
  pack_state: `
    CREATE TABLE IF NOT EXISTS pack_state (
      regionCode TEXT PRIMARY KEY,
      state TEXT NOT NULL CHECK(state IN ('NOT_INSTALLED', 'DOWNLOADING', 'STAGING', 'VALIDATING', 'INSTALLING', 'INSTALLED', 'FAILED')),
      updatedAt TEXT NOT NULL
    )
  `,

  // Phase 2: Staging tables (same shape as prod; data written here before validation and commit)
  street_segments_stg: `
    CREATE TABLE IF NOT EXISTS street_segments_stg (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      name TEXT,
      name_en TEXT,
      name_fr TEXT,
      alt_name TEXT,
      ref TEXT,
      street_type TEXT NOT NULL CHECK(street_type IN ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'path')),
      oneway INTEGER DEFAULT 0,
      layer INTEGER,
      geometry TEXT NOT NULL,
      bbox TEXT NOT NULL,
      spacing_constant REAL NOT NULL,
      numbering_direction TEXT NOT NULL CHECK(numbering_direction IN ('ascending', 'descending')),
      city_id TEXT,
      region_id TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local', 'user')),
      cached_at TEXT NOT NULL
    )
  `,
  admin_boundaries_stg: `
    CREATE TABLE IF NOT EXISTS admin_boundaries_stg (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      level TEXT NOT NULL CHECK(level IN ('country', 'region', 'county', 'city', 'neighborhood')),
      admin_level INTEGER NOT NULL,
      polygon TEXT NOT NULL,
      bbox TEXT NOT NULL,
      area REAL,
      parent_id TEXT,
      country_code TEXT NOT NULL,
      packId TEXT,
      token TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local')),
      cached_at TEXT NOT NULL
    )
  `,
  settlement_places_stg: `
    CREATE TABLE IF NOT EXISTS settlement_places_stg (
      id TEXT PRIMARY KEY,
      packId TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      place TEXT NOT NULL CHECK(place IN ('city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'neighborhood', 'quarter', 'city_district', 'postcode')),
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      polygon TEXT,
      bbox TEXT,
      geoCell TEXT,
      source TEXT NOT NULL CHECK(source IN ('osm', 'local')),
      cached_at TEXT NOT NULL
    )
  `,
  pois_stg: `
    CREATE TABLE IF NOT EXISTS pois_stg (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      osm_type TEXT CHECK(osm_type IN ('node', 'way', 'relation')),
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_fr TEXT,
      brand TEXT,
      operator TEXT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      tier INTEGER NOT NULL CHECK(tier IN (1, 2, 3)),
      tags TEXT NOT NULL,
      stabilityScore REAL NOT NULL,
      packId TEXT NOT NULL,
      countryCode TEXT NOT NULL,
      cached_at TEXT NOT NULL
    )
  `,
  pack_staging: `
    CREATE TABLE IF NOT EXISTS pack_staging (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      version TEXT NOT NULL,
      street_count INTEGER NOT NULL,
      boundary_count INTEGER NOT NULL,
      settlement_count INTEGER,
      settlement_place_count INTEGER,
      poi_count INTEGER,
      valhalla_tile_count INTEGER,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT,
      created_at TEXT NOT NULL,
      downloaded_at TEXT
    )
  `,
  // Phase 4: Valhalla tiles (staging = during pack install; prod = after commit)
  valhalla_tiles_stg: `
    CREATE TABLE IF NOT EXISTS valhalla_tiles_stg (
      regionCode TEXT PRIMARY KEY,
      data BLOB NOT NULL
    )
  `,
  valhalla_tiles: `
    CREATE TABLE IF NOT EXISTS valhalla_tiles (
      regionCode TEXT PRIMARY KEY,
      data BLOB NOT NULL
    )
  `,
};

/**
 * Get all CREATE TABLE statements as a single string
 */
export function getAllCreateTableStatements(): string {
  return Object.values(CREATE_TABLES).join(';\n\n');
}
