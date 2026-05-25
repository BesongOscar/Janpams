# Database Schema Documentation

## Overview

The JanGO mobile app uses SQLite as its local database, matching the web app's IndexedDB schemas exactly. This ensures data compatibility and consistency across platforms.

## Schema Version

**Current Version**: 9 (matches web implementation)

## Tables

### 1. addresses

Primary table for storing user-created addresses.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Server-assigned UUID
- `local_id` (TEXT, NOT NULL): Local UUID for offline creation
- `house_number` (INTEGER, NOT NULL): House/plot number
- `extension` (TEXT): Address extension (e.g., "A", "B")
- `parent_address_id` (TEXT): Reference to parent address for compound addressing
- `street_name` (TEXT, NOT NULL): Street name
- `street_type` (TEXT): Street type (e.g., "Street", "Avenue")
- `neighborhood` (TEXT): Neighborhood name
- `city` (TEXT, NOT NULL): City name
- `region` (TEXT, NOT NULL): Region/state name
- `country` (TEXT, NOT NULL): Country code (ISO 3166-1 alpha-2)
- `latitude` (REAL, NOT NULL): Latitude coordinate
- `longitude` (REAL, NOT NULL): Longitude coordinate
- `plus_code` (TEXT, NOT NULL): Plus Code (10+ characters)
- `side_of_street` (TEXT): Side of street ('L' or 'R')
- `chainage_meters` (REAL): Distance along street in meters
- `spacing_constant` (REAL): Spacing constant for house numbering
- `distance_from_street` (REAL): Distance from street in meters
- `business_name` (TEXT): Business/property name
- `property_category` (TEXT, NOT NULL): Category (residential, commercial, etc.)
- `property_type` (TEXT, NOT NULL): Type (House, Shop, Office, etc.)
- `created_by` (TEXT): User ID who created the address
- `connection_type` (TEXT): Connection type (owner, tenant, manager, etc.)
- `image_url` (TEXT): URL to address image
- `image_storage_path` (TEXT): Local storage path for image
- `status` (TEXT, NOT NULL): Status ('pending', 'verified', 'rejected')
- `verified_at` (TEXT): ISO timestamp of verification
- `verified_by` (TEXT): User ID who verified
- `name_source` (TEXT): Source of name ('api_official' or 'user_suggested')
- `linked_address_id` (TEXT): ID of linked address for dual creation
- `street_suggestion_id` (TEXT): Reference to street name suggestion
- `neighborhood_suggestion_id` (TEXT): Reference to neighborhood suggestion
- `sync_status` (TEXT, NOT NULL): Sync status ('pending', 'synced', 'conflict')
- `last_synced_at` (TEXT): ISO timestamp of last sync
- `created_at` (TEXT, NOT NULL): ISO timestamp of creation
- `updated_at` (TEXT, NOT NULL): ISO timestamp of last update

**Indexes**:
- `addresses_plus_code_idx`: On `plus_code`
- `addresses_sync_status_idx`: On `sync_status`
- `addresses_created_by_idx`: On `created_by`

### 2. streets

Street geometry and metadata.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Street ID
- `osm_id` (INTEGER): OSM way ID
- `name` (TEXT): Street name
- `alt_name` (TEXT): Alternative name
- `geometry` (TEXT, NOT NULL): JSON string of LineString coordinates
- `direction_locked` (INTEGER): Whether direction is locked (0 or 1)
- `start_node` (TEXT): JSON string of start node [lat, lon]
- `end_node` (TEXT): JSON string of end node [lat, lon]
- `street_type` (TEXT): Street classification
- `surface_type` (TEXT): Surface type
- `numbering_direction` (TEXT): Numbering direction
- `spacing_constant` (REAL): Spacing constant
- `city` (TEXT): City name
- `region` (TEXT): Region name
- `country` (TEXT): Country code
- `source` (TEXT): Data source ('osm', 'local', 'manual')
- `cached_at` (TEXT, NOT NULL): ISO timestamp of cache

### 3. sync_queue

Queue of operations waiting to sync with server.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Queue item ID
- `operation` (TEXT, NOT NULL): Operation type ('CREATE', 'UPDATE', 'DELETE')
- `table` (TEXT, NOT NULL): Table name
- `record_id` (TEXT, NOT NULL): Record ID
- `local_id` (TEXT, NOT NULL): Local ID for offline-created records
- `data` (TEXT, NOT NULL): JSON string of operation data
- `status` (TEXT, NOT NULL): Status ('pending', 'processing', 'synced', 'failed')
- `attempts` (INTEGER, NOT NULL): Number of sync attempts
- `last_error` (TEXT): Last error message
- `created_at` (TEXT, NOT NULL): ISO timestamp of creation
- `updated_at` (TEXT, NOT NULL): ISO timestamp of last update

**Indexes**:
- `sync_queue_status_idx`: On `status`
- `sync_queue_created_at_idx`: On `created_at`

### 4. street_segments

Street segment geometry from data packs.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Segment ID
- `osm_id` (INTEGER): OSM way ID
- `osm_type` (TEXT): OSM type ('way', 'relation')
- `name` (TEXT): Street name
- `name_en` (TEXT): English name
- `name_fr` (TEXT): French name
- `ref` (TEXT): Reference code
- `highway` (TEXT): Highway type
- `street_type` (TEXT): Street classification
- `geometry` (TEXT, NOT NULL): JSON string of LineString coordinates
- `bbox` (TEXT, NOT NULL): JSON string of bounding box
- `region_id` (TEXT): Region ID
- `city` (TEXT): City name
- `pack_id` (TEXT): Data pack ID
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `street_segments_region_id_idx`: On `region_id`
- `street_segments_pack_id_idx`: On `pack_id`
- `street_segments_bbox_idx`: On `bbox` (spatial index)

### 5. admin_boundaries

Administrative boundaries from data packs.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Boundary ID
- `osm_id` (INTEGER): OSM relation ID
- `osm_type` (TEXT): OSM type ('relation')
- `name` (TEXT): Boundary name
- `name_en` (TEXT): English name
- `name_fr` (TEXT): French name
- `admin_level` (INTEGER): Administrative level
- `boundary_type` (TEXT): Boundary type
- `geometry` (TEXT, NOT NULL): JSON string of Polygon coordinates
- `bbox` (TEXT, NOT NULL): JSON string of bounding box
- `parent_id` (TEXT): Parent boundary ID
- `country_code` (TEXT): Country code
- `pack_id` (TEXT): Data pack ID
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `admin_boundaries_level_idx`: On `admin_level`
- `admin_boundaries_parent_idx`: On `parent_id`
- `admin_boundaries_pack_id_idx`: On `pack_id`

### 6. settlement_places

Settlement places (cities, towns, villages, etc.) from data packs.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Place ID
- `osm_id` (INTEGER): OSM node/way/relation ID
- `osm_type` (TEXT): OSM type
- `name` (TEXT): Place name
- `name_en` (TEXT): English name
- `name_fr` (TEXT): French name
- `place` (TEXT): Place type (city, town, village, etc.)
- `geometry` (TEXT): JSON string of Point or Polygon coordinates
- `bbox` (TEXT): JSON string of bounding box
- `geo_cell` (TEXT): Geo cell identifier
- `pack_id` (TEXT): Data pack ID
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `settlement_places_type_idx`: On `place`
- `settlement_places_geo_cell_idx`: On `geo_cell`
- `settlement_places_pack_id_idx`: On `pack_id`

### 7. data_packs

Data pack manifests.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Pack ID
- `name` (TEXT, NOT NULL): Pack name
- `version` (TEXT, NOT NULL): Pack version
- `country_code` (TEXT): Country code
- `region_id` (TEXT): Region ID
- `size_bytes` (INTEGER): Pack size in bytes
- `street_count` (INTEGER): Number of street segments
- `admin_count` (INTEGER): Number of admin boundaries
- `settlement_count` (INTEGER): Number of settlement places
- `download_url` (TEXT): URL to download pack
- `downloaded_at` (TEXT): ISO timestamp of download
- `installed_at` (TEXT): ISO timestamp of installation
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `data_packs_country_idx`: On `country_code`
- `data_packs_region_idx`: On `region_id`

### 8. tile_cache

Cached map tiles for offline use.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Tile ID (z/x/y format)
- `zoom` (INTEGER, NOT NULL): Zoom level
- `x` (INTEGER, NOT NULL): Tile X coordinate
- `y` (INTEGER, NOT NULL): Tile Y coordinate
- `tile_data` (TEXT, NOT NULL): Base64-encoded tile image
- `tile_url` (TEXT, NOT NULL): Original tile URL
- `expires_at` (TEXT): ISO timestamp of expiration
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `tile_cache_zoom_xy_idx`: Composite on `zoom`, `x`, `y`
- `tile_cache_expires_idx`: On `expires_at`

### 9. search_items

Search index items.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Item ID
- `type` (TEXT, NOT NULL): Item type ('street', 'admin', 'address', 'place')
- `name` (TEXT, NOT NULL): Item name
- `name_normalized` (TEXT, NOT NULL): Normalized name for search
- `pack_id` (TEXT): Data pack ID
- `metadata` (TEXT): JSON string of additional metadata
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `search_items_type_idx`: On `type`
- `search_items_pack_id_idx`: On `pack_id`
- `search_items_name_normalized_idx`: On `name_normalized`

### 10. search_tokens

Search tokens for prefix-based search.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Token ID
- `token` (TEXT, NOT NULL): Search token
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `search_tokens_token_idx`: On `token`

### 11. search_item_tokens

Junction table linking search items to tokens.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Junction ID
- `item_id` (TEXT, NOT NULL): Search item ID
- `token_id` (TEXT, NOT NULL): Token ID
- `created_at` (TEXT, NOT NULL): ISO timestamp

**Indexes**:
- `search_item_tokens_item_idx`: On `item_id`
- `search_item_tokens_token_idx`: On `token_id`

### 12. search_index_meta

Search index metadata.

**Fields**:
- `id` (TEXT, PRIMARY KEY): Always 'meta'
- `schema_version` (INTEGER, NOT NULL): Index schema version
- `last_build_at` (TEXT): ISO timestamp of last build
- `last_build_completed_at` (TEXT): ISO timestamp of last completed build
- `packs` (TEXT): JSON string of pack metadata

## Relationships

### Address Relationships
- `addresses.parent_address_id` → `addresses.id` (self-reference for compound addresses)
- `addresses.linked_address_id` → `addresses.id` (dual address creation)
- `addresses.street_suggestion_id` → `street_suggestions.id`
- `addresses.neighborhood_suggestion_id` → `neighborhood_suggestions.id`

### Data Pack Relationships
- `street_segments.pack_id` → `data_packs.id`
- `admin_boundaries.pack_id` → `data_packs.id`
- `settlement_places.pack_id` → `data_packs.id`
- `search_items.pack_id` → `data_packs.id`

### Search Relationships
- `search_item_tokens.item_id` → `search_items.id`
- `search_item_tokens.token_id` → `search_tokens.id`

## Data Types

### JSON Fields
Complex data types are stored as JSON strings:
- `geometry`: Array of coordinate pairs `[[lon, lat], ...]`
- `bbox`: Object `{ minLat, maxLat, minLon, maxLon }`
- `data`: Operation-specific data object
- `metadata`: Additional metadata object

### Timestamps
All timestamps are stored as ISO 8601 strings (e.g., "2024-01-01T12:00:00.000Z").

### Coordinates
- Latitude: -90 to 90 (degrees)
- Longitude: -180 to 180 (degrees)
- Stored as REAL (double precision floating point)

## Indexes

All indexes are defined in `lib/db/indexes.ts`. Key indexes:
- Foreign key indexes for joins
- Query performance indexes
- Spatial indexes for bounding box queries
- Search indexes for text matching

## Migrations

Schema changes are handled through migrations in `lib/db/migrations.ts`. Each migration:
- Increments schema version
- Applies schema changes
- Migrates existing data if needed
- Validates schema integrity

## Constraints

### Check Constraints
- `addresses.status`: Must be 'pending', 'verified', or 'rejected'
- `addresses.sync_status`: Must be 'pending', 'synced', or 'conflict'
- `addresses.side_of_street`: Must be 'L' or 'R'
- `sync_queue.operation`: Must be 'CREATE', 'UPDATE', or 'DELETE'
- `sync_queue.status`: Must be 'pending', 'processing', 'synced', or 'failed'

### Not Null Constraints
Critical fields are marked NOT NULL to ensure data integrity:
- `addresses.house_number`, `street_name`, `city`, `region`, `country`
- `addresses.latitude`, `longitude`, `plus_code`
- `addresses.property_category`, `property_type`, `status`, `sync_status`
- All `created_at` and `updated_at` fields

## Best Practices

1. **Always use transactions** for multiple related operations
2. **Use indexes** for frequently queried columns
3. **Parse JSON fields** when reading, stringify when writing
4. **Handle null values** appropriately
5. **Validate data** before inserting
6. **Use prepared statements** to prevent SQL injection
7. **Close connections** when done
8. **Handle errors** gracefully

## Performance Considerations

- Indexes improve query performance but slow down inserts
- JSON parsing adds overhead - cache parsed results when possible
- Large geometry fields can impact performance - consider simplification
- Batch operations are faster than individual operations
- Use LIMIT clauses to avoid loading large result sets
