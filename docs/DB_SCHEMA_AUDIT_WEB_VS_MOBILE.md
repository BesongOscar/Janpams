# DB Schema Audit: Web IndexedDB vs Mobile SQLite

**Purpose:** Ensure mobile SQLite schema matches web IndexedDB (v14) for parity.

**Web reference:** `apps/core/mbukanji-maps/src/lib/db.ts`  
**Mobile reference:** `apps/core/address-maker-glopams/lib/db/sqlite-schema.ts`, `lib/db/indexes.ts`

---

## Store/Table mapping

| Web store (IndexedDB) | Mobile table (SQLite) | KeyPath / PK |
|------------------------|------------------------|--------------|
| addresses | addresses | id |
| streets | streets | id |
| sync_queue | sync_queue | id |
| tiles | tiles | url |
| street_segments | street_segments | id |
| admin_boundaries | admin_boundaries | id |
| settlement_places | settlement_places | id |
| street_suggestions | street_suggestions | id |
| data_packs | data_packs | id |
| location_captures | location_captures | id |
| street_number_reservations | street_number_reservations | id |
| search_items | search_items | itemId |
| search_tokens | search_tokens | tokenPrefix |
| search_item_tokens | search_item_tokens | itemId |
| search_index_meta | search_index_meta | key |
| street_direction_locks | street_direction_locks | streetKey |
| local_user_roles | local_user_roles | id |
| direction_audit_log | direction_audit_log | id |
| street_name_suggestions | street_name_suggestions | id |
| neighborhood_name_suggestions | neighborhood_name_suggestions | id |
| suggestion_votes | suggestion_votes | id |
| name_alias_groups | name_alias_groups | id |
| pois | pois | id |
| route_cache | route_cache | id |
| pack_state | pack_state | regionCode |
| street_segments_stg | street_segments_stg | id |
| admin_boundaries_stg | admin_boundaries_stg | id |
| settlement_places_stg | settlement_places_stg | id |
| pois_stg | pois_stg | id |
| pack_staging | pack_staging | id |
| (Valhalla) | valhalla_tiles_stg, valhalla_tiles | regionCode |

All web stores have a corresponding mobile table. Mobile additionally has Valhalla tile tables (web may use Cache API or core package).

---

## Gaps addressed in implementation

### 1. local_user_roles.role enum (fixed in migration 13)

- **Web:** `role: AppRole` = `'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin'`
- **Mobile (before):** CHECK(role IN ('user', 'field_agent', 'municipality_admin', 'system_admin'))
- **Action:** Migration 13 updates existing rows to AppRole; CREATE_TABLES for new installs uses AppRole-only CHECK. Code uses AppRole only (see A.5).

### 2. data_packs columns (fixed in migration 13)

- **Web DataPackManifest:** settlement_count?, settlement_place_count?, poi_count?, valhalla_tile_count?
- **Mobile (before):** had settlement_count; missing settlement_place_count, poi_count, valhalla_tile_count
- **Action:** Migration 13 adds missing columns (ALTER TABLE). CREATE_TABLES for new installs includes them.

### 3. Indexes

- **Web** street_segments: by-region (region_id), by-packId (packId). Mobile had both indexes but street_segments_by_packId was incorrectly on region_id; web StreetSegment may not have packId in all versions — audit left as-is; add packId index only if column exists.
- All other indexes verified present on mobile.

---

## Verification

- After migration 13: `local_user_roles.role` contains only AppRole values; new installs have CHECK(role IN ('basic_user', 'advanced_agent', 'org_admin', 'system_admin')).
- After migration 13: `data_packs` has settlement_place_count, poi_count, valhalla_tile_count (nullable INTEGER).
- All other tables and indexes already aligned per prior phases.
