/**
 * SQLite Index Definitions
 * 
 * Indexes matching web's IndexedDB indexes exactly.
 * These indexes improve query performance for common access patterns.
 * 
 * Reference: docs/src/lib/db.ts (web IndexedDB indexes)
 */

export const CREATE_INDEXES = {
  // Addresses indexes
  'addresses_by_plus_code': `
    CREATE INDEX IF NOT EXISTS idx_addresses_by_plus_code 
    ON addresses(plus_code)
  `,
  'addresses_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_addresses_by_sync_status 
    ON addresses(sync_status)
  `,

  'address_book_by_address_id': `
    CREATE INDEX IF NOT EXISTS idx_address_book_by_address_id 
    ON address_book(address_id)
  `,

  // Street segments indexes
  'street_segments_by_region': `
    CREATE INDEX IF NOT EXISTS idx_street_segments_by_region 
    ON street_segments(region_id)
  `,
  'street_segments_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_street_segments_by_packId 
    ON street_segments(region_id)
  `,

  // Admin boundaries indexes (Phase 7.5: bbox/point lookups via packId)
  'admin_boundaries_by_level': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_by_level 
    ON admin_boundaries(level)
  `,
  'admin_boundaries_by_parent': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_by_parent 
    ON admin_boundaries(parent_id)
  `,
  'admin_boundaries_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_by_packId 
    ON admin_boundaries(packId)
  `,

  // Settlement places indexes (Phase 7.5: bbox/point lookups via packId, geoCell)
  'settlement_places_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_by_packId 
    ON settlement_places(packId)
  `,
  'settlement_places_by_place': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_by_place 
    ON settlement_places(place)
  `,
  'settlement_places_by_geoCell': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_by_geoCell 
    ON settlement_places(geoCell)
  `,

  // Street suggestions indexes
  'street_suggestions_by_status': `
    CREATE INDEX IF NOT EXISTS idx_street_suggestions_by_status 
    ON street_suggestions(status)
  `,

  // Location captures indexes
  'location_captures_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_location_captures_by_sync_status 
    ON location_captures(syncStatus)
  `,

  // Street number reservations indexes
  'street_number_reservations_by_street_key': `
    CREATE INDEX IF NOT EXISTS idx_street_number_reservations_by_street_key 
    ON street_number_reservations(streetKey)
  `,

  // Street direction locks indexes
  'street_direction_locks_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_street_direction_locks_by_sync_status 
    ON street_direction_locks(syncStatus)
  `,

  // Local user roles indexes
  'local_user_roles_by_user_id': `
    CREATE INDEX IF NOT EXISTS idx_local_user_roles_by_user_id 
    ON local_user_roles(userId)
  `,

  // Direction audit log indexes
  'direction_audit_log_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_direction_audit_log_by_sync_status 
    ON direction_audit_log(syncStatus)
  `,

  // Street name suggestions indexes
  'street_name_suggestions_by_street_key': `
    CREATE INDEX IF NOT EXISTS idx_street_name_suggestions_by_street_key 
    ON street_name_suggestions(streetKey)
  `,
  'street_name_suggestions_by_status': `
    CREATE INDEX IF NOT EXISTS idx_street_name_suggestions_by_status 
    ON street_name_suggestions(status)
  `,
  'street_name_suggestions_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_street_name_suggestions_by_sync_status 
    ON street_name_suggestions(syncStatus)
  `,
  'street_name_suggestions_by_alias_group': `
    CREATE INDEX IF NOT EXISTS idx_street_name_suggestions_by_alias_group 
    ON street_name_suggestions(aliasGroupId)
  `,

  // Neighborhood name suggestions indexes
  'neighborhood_name_suggestions_by_neighborhood_key': `
    CREATE INDEX IF NOT EXISTS idx_neighborhood_name_suggestions_by_neighborhood_key 
    ON neighborhood_name_suggestions(neighborhoodKey)
  `,
  'neighborhood_name_suggestions_by_status': `
    CREATE INDEX IF NOT EXISTS idx_neighborhood_name_suggestions_by_status 
    ON neighborhood_name_suggestions(status)
  `,
  'neighborhood_name_suggestions_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_neighborhood_name_suggestions_by_sync_status 
    ON neighborhood_name_suggestions(syncStatus)
  `,
  'neighborhood_name_suggestions_by_alias_group': `
    CREATE INDEX IF NOT EXISTS idx_neighborhood_name_suggestions_by_alias_group 
    ON neighborhood_name_suggestions(aliasGroupId)
  `,

  // Suggestion votes indexes
  'suggestion_votes_by_suggestion_id': `
    CREATE INDEX IF NOT EXISTS idx_suggestion_votes_by_suggestion_id 
    ON suggestion_votes(suggestionId)
  `,
  'suggestion_votes_by_user_id': `
    CREATE INDEX IF NOT EXISTS idx_suggestion_votes_by_user_id 
    ON suggestion_votes(userId)
  `,
  'suggestion_votes_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_suggestion_votes_by_sync_status 
    ON suggestion_votes(syncStatus)
  `,

  // Name alias groups indexes
  'name_alias_groups_by_street_key': `
    CREATE INDEX IF NOT EXISTS idx_name_alias_groups_by_street_key 
    ON name_alias_groups(streetKey)
  `,
  'name_alias_groups_by_neighborhood_key': `
    CREATE INDEX IF NOT EXISTS idx_name_alias_groups_by_neighborhood_key 
    ON name_alias_groups(neighborhoodKey)
  `,
  'name_alias_groups_by_sync_status': `
    CREATE INDEX IF NOT EXISTS idx_name_alias_groups_by_sync_status 
    ON name_alias_groups(syncStatus)
  `,

  // Search items indexes
  'search_items_by_type': `
    CREATE INDEX IF NOT EXISTS idx_search_items_by_type 
    ON search_items(type)
  `,
  'search_items_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_search_items_by_packId 
    ON search_items(packId)
  `,

  // POIs indexes (Phase 1)
  'pois_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_pois_by_packId 
    ON pois(packId)
  `,
  'pois_by_tier': `
    CREATE INDEX IF NOT EXISTS idx_pois_by_tier 
    ON pois(tier)
  `,
  'pois_by_category': `
    CREATE INDEX IF NOT EXISTS idx_pois_by_category 
    ON pois(category)
  `,

  // Route cache indexes (Phase 1)
  'route_cache_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_route_cache_by_packId 
    ON route_cache(packId)
  `,
  'route_cache_by_quality': `
    CREATE INDEX IF NOT EXISTS idx_route_cache_by_quality 
    ON route_cache(quality)
  `,

  // Phase 2: Staging table indexes (match web: by-region, by-level, by-parent, by-packId, by-place, by-geoCell, by-tier, by-category)
  'street_segments_stg_by_region': `
    CREATE INDEX IF NOT EXISTS idx_street_segments_stg_by_region 
    ON street_segments_stg(region_id)
  `,
  'admin_boundaries_stg_by_level': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_stg_by_level 
    ON admin_boundaries_stg(level)
  `,
  'admin_boundaries_stg_by_parent': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_stg_by_parent 
    ON admin_boundaries_stg(parent_id)
  `,
  'admin_boundaries_stg_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_stg_by_packId 
    ON admin_boundaries_stg(packId)
  `,
  'settlement_places_stg_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_stg_by_packId 
    ON settlement_places_stg(packId)
  `,
  'settlement_places_stg_by_place': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_stg_by_place 
    ON settlement_places_stg(place)
  `,
  'settlement_places_stg_by_geoCell': `
    CREATE INDEX IF NOT EXISTS idx_settlement_places_stg_by_geoCell 
    ON settlement_places_stg(geoCell)
  `,
  'pois_stg_by_packId': `
    CREATE INDEX IF NOT EXISTS idx_pois_stg_by_packId 
    ON pois_stg(packId)
  `,
  'pois_stg_by_tier': `
    CREATE INDEX IF NOT EXISTS idx_pois_stg_by_tier 
    ON pois_stg(tier)
  `,
  'pois_stg_by_category': `
    CREATE INDEX IF NOT EXISTS idx_pois_stg_by_category 
    ON pois_stg(category)
  `,
};

/**
 * Get all CREATE INDEX statements as a single string
 */
export function getAllCreateIndexStatements(): string {
  return Object.values(CREATE_INDEXES).join(';\n\n');
}
