/**
 * Database Migration System
 * 
 * Handles schema evolution and version upgrades.
 * Migrations run automatically when schema version changes.
 * 
 * Reference: docs/src/lib/db.ts (web's upgrade function)
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES } from './sqlite-schema';
import { CREATE_INDEXES } from './indexes';

/**
 * Run migrations from oldVersion to newVersion
 */
export async function runMigrations(
  db: SQLiteDatabase,
  oldVersion: number,
  newVersion: number
): Promise<void> {
  console.log(`[Migrations] Running migrations from ${oldVersion} to ${newVersion}`);

  // Migration 1: Initial schema (addresses, streets, sync_queue, tiles)
  if (oldVersion < 1) {
    await migrateToVersion1(db);
  }

  // Migration 2: Add offline data pack tables
  if (oldVersion < 2) {
    await migrateToVersion2(db);
  }

  // Migration 3: Add location captures
  if (oldVersion < 3) {
    await migrateToVersion3(db);
  }

  // Migration 4: Add street number reservations
  if (oldVersion < 4) {
    await migrateToVersion4(db);
  }

  // Migration 5: Add search index tables
  if (oldVersion < 5) {
    await migrateToVersion5(db);
  }

  // Migration 6: Add settlement places and packId indexes
  if (oldVersion < 6) {
    await migrateToVersion6(db);
  }

  // Migration 7: Add street direction locks
  if (oldVersion < 7) {
    await migrateToVersion7(db);
  }

  // Migration 8: Add local user roles and direction audit log
  if (oldVersion < 8) {
    await migrateToVersion8(db);
  }

  // Migration 9: Add community voting system tables
  if (oldVersion < 9) {
    await migrateToVersion9(db);
  }

  // Migration 10: Add POIs and route_cache (Phase 1)
  if (oldVersion < 10) {
    await migrateToVersion10(db);
  }

  // Migration 11: JAPA pack_state and staging tables (Phase 2)
  if (oldVersion < 11) {
    await migrateToVersion11(db);
  }

  // Migration 12: Valhalla tile storage (Phase 4)
  if (oldVersion < 12) {
    await migrateToVersion12(db);
  }

  // Migration 13: DB parity — local_user_roles AppRole, data_packs manifest columns
  if (oldVersion < 13) {
    await migrateToVersion13(db);
  }

  // Migration 14: pack_staging manifest columns (A.3 — set when available)
  if (oldVersion < 14) {
    await migrateToVersion14(db);
  }

  // Migration 15: address_book for My Address Book (alias entries)
  if (oldVersion < 15) {
    await migrateToVersion15(db);
  }

  console.log('[Migrations] Migrations completed successfully');
}

async function migrateToVersion1(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 1...');
  
  await db.execAsync(CREATE_TABLES.addresses);
  await db.execAsync(CREATE_TABLES.streets);
  await db.execAsync(CREATE_TABLES.sync_queue);
  await db.execAsync(CREATE_TABLES.tiles);
  
  await db.execAsync(CREATE_INDEXES.addresses_by_plus_code);
  await db.execAsync(CREATE_INDEXES.addresses_by_sync_status);
}

async function migrateToVersion2(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 2...');
  
  await db.execAsync(CREATE_TABLES.street_segments);
  await db.execAsync(CREATE_TABLES.admin_boundaries);
  await db.execAsync(CREATE_TABLES.street_suggestions);
  await db.execAsync(CREATE_TABLES.data_packs);
  
  await db.execAsync(CREATE_INDEXES.street_segments_by_region);
  await db.execAsync(CREATE_INDEXES.admin_boundaries_by_level);
  await db.execAsync(CREATE_INDEXES.admin_boundaries_by_parent);
  await db.execAsync(CREATE_INDEXES.street_suggestions_by_status);
}

async function migrateToVersion3(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 3...');
  
  await db.execAsync(CREATE_TABLES.location_captures);
  await db.execAsync(CREATE_INDEXES.location_captures_by_sync_status);
}

async function migrateToVersion4(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 4...');
  
  await db.execAsync(CREATE_TABLES.street_number_reservations);
  await db.execAsync(CREATE_INDEXES.street_number_reservations_by_street_key);
}

async function migrateToVersion5(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 5...');
  
  await db.execAsync(CREATE_TABLES.search_items);
  await db.execAsync(CREATE_TABLES.search_tokens);
  await db.execAsync(CREATE_TABLES.search_item_tokens);
  await db.execAsync(CREATE_TABLES.search_index_meta);
  
  await db.execAsync(CREATE_INDEXES.search_items_by_type);
  await db.execAsync(CREATE_INDEXES.search_items_by_packId);
}

async function migrateToVersion6(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 6...');
  
  await db.execAsync(CREATE_TABLES.settlement_places);
  
  await db.execAsync(CREATE_INDEXES.settlement_places_by_packId);
  await db.execAsync(CREATE_INDEXES.settlement_places_by_place);
  await db.execAsync(CREATE_INDEXES.settlement_places_by_geoCell);
  
  // Add packId indexes to existing tables (if they don't exist)
  try {
    await db.execAsync(CREATE_INDEXES.street_segments_by_packId);
    await db.execAsync(CREATE_INDEXES.admin_boundaries_by_packId);
  } catch (error) {
    // Index might already exist, ignore
    console.warn('[Migrations] Some packId indexes may already exist:', error);
  }
}

async function migrateToVersion7(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 7...');
  
  await db.execAsync(CREATE_TABLES.street_direction_locks);
  await db.execAsync(CREATE_INDEXES.street_direction_locks_by_sync_status);
}

async function migrateToVersion8(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 8...');
  
  await db.execAsync(CREATE_TABLES.local_user_roles);
  await db.execAsync(CREATE_TABLES.direction_audit_log);
  
  await db.execAsync(CREATE_INDEXES.local_user_roles_by_user_id);
  await db.execAsync(CREATE_INDEXES.direction_audit_log_by_sync_status);
}

async function migrateToVersion9(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 9...');
  
  await db.execAsync(CREATE_TABLES.street_name_suggestions);
  await db.execAsync(CREATE_TABLES.neighborhood_name_suggestions);
  await db.execAsync(CREATE_TABLES.suggestion_votes);
  await db.execAsync(CREATE_TABLES.name_alias_groups);
  
  await db.execAsync(CREATE_INDEXES.street_name_suggestions_by_street_key);
  await db.execAsync(CREATE_INDEXES.street_name_suggestions_by_status);
  await db.execAsync(CREATE_INDEXES.street_name_suggestions_by_sync_status);
  await db.execAsync(CREATE_INDEXES.street_name_suggestions_by_alias_group);
  
  await db.execAsync(CREATE_INDEXES.neighborhood_name_suggestions_by_neighborhood_key);
  await db.execAsync(CREATE_INDEXES.neighborhood_name_suggestions_by_status);
  await db.execAsync(CREATE_INDEXES.neighborhood_name_suggestions_by_sync_status);
  await db.execAsync(CREATE_INDEXES.neighborhood_name_suggestions_by_alias_group);
  
  await db.execAsync(CREATE_INDEXES.suggestion_votes_by_suggestion_id);
  await db.execAsync(CREATE_INDEXES.suggestion_votes_by_user_id);
  await db.execAsync(CREATE_INDEXES.suggestion_votes_by_sync_status);
  
  await db.execAsync(CREATE_INDEXES.name_alias_groups_by_street_key);
  await db.execAsync(CREATE_INDEXES.name_alias_groups_by_neighborhood_key);
  await db.execAsync(CREATE_INDEXES.name_alias_groups_by_sync_status);
}

async function migrateToVersion10(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 10 (POIs + route_cache)...');

  await db.execAsync(CREATE_TABLES.pois);
  await db.execAsync(CREATE_TABLES.route_cache);

  await db.execAsync(CREATE_INDEXES.pois_by_packId);
  await db.execAsync(CREATE_INDEXES.pois_by_tier);
  await db.execAsync(CREATE_INDEXES.pois_by_category);
  await db.execAsync(CREATE_INDEXES.route_cache_by_packId);
  await db.execAsync(CREATE_INDEXES.route_cache_by_quality);
}

async function migrateToVersion11(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 11 (JAPA pack_state + staging)...');

  await db.execAsync(CREATE_TABLES.pack_state);
  await db.execAsync(CREATE_TABLES.street_segments_stg);
  await db.execAsync(CREATE_TABLES.admin_boundaries_stg);
  await db.execAsync(CREATE_TABLES.settlement_places_stg);
  await db.execAsync(CREATE_TABLES.pois_stg);
  await db.execAsync(CREATE_TABLES.pack_staging);

  await db.execAsync(CREATE_INDEXES.street_segments_stg_by_region);
  await db.execAsync(CREATE_INDEXES.admin_boundaries_stg_by_packId);
  await db.execAsync(CREATE_INDEXES.settlement_places_stg_by_packId);
  await db.execAsync(CREATE_INDEXES.pois_stg_by_packId);
}

async function migrateToVersion12(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 12 (Valhalla tile storage)...');

  await db.execAsync(CREATE_TABLES.valhalla_tiles_stg);
  await db.execAsync(CREATE_TABLES.valhalla_tiles);
}

/**
 * Migration 13: DB parity with web
 * - local_user_roles.role: migrate legacy enum to AppRole
 * - data_packs: add settlement_place_count, poi_count, valhalla_tile_count if missing
 */
async function migrateToVersion13(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 13 (DB parity: AppRole, data_packs columns)...');

  // Migrate local_user_roles.role from legacy enum to AppRole
  await db.execAsync(`
    UPDATE local_user_roles SET role = CASE role
      WHEN 'user' THEN 'basic_user'
      WHEN 'field_agent' THEN 'advanced_agent'
      WHEN 'municipality_admin' THEN 'org_admin'
      WHEN 'system_admin' THEN 'system_admin'
      ELSE role
    END WHERE role IN ('user', 'field_agent', 'municipality_admin', 'system_admin')
  `);

  // Add data_packs columns if missing (ALTER fails if column exists; ignore)
  const columnsToAdd = [
    { name: 'settlement_place_count', sql: 'ALTER TABLE data_packs ADD COLUMN settlement_place_count INTEGER' },
    { name: 'poi_count', sql: 'ALTER TABLE data_packs ADD COLUMN poi_count INTEGER' },
    { name: 'valhalla_tile_count', sql: 'ALTER TABLE data_packs ADD COLUMN valhalla_tile_count INTEGER' },
  ];
  for (const { name, sql } of columnsToAdd) {
    try {
      await db.execAsync(sql);
      console.log(`[Migrations] Added column data_packs.${name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        // Column already present (e.g. new install or prior partial run)
        console.log(`[Migrations] Column data_packs.${name} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }
}

async function migrateToVersion14(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 14 (pack_staging manifest columns)...');
  const columnsToAdd = [
    { name: 'settlement_place_count', sql: 'ALTER TABLE pack_staging ADD COLUMN settlement_place_count INTEGER' },
    { name: 'poi_count', sql: 'ALTER TABLE pack_staging ADD COLUMN poi_count INTEGER' },
    { name: 'valhalla_tile_count', sql: 'ALTER TABLE pack_staging ADD COLUMN valhalla_tile_count INTEGER' },
  ];
  for (const { name, sql } of columnsToAdd) {
    try {
      await db.execAsync(sql);
      console.log(`[Migrations] Added column pack_staging.${name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        console.log(`[Migrations] Column pack_staging.${name} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }
}

async function migrateToVersion15(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Migrating to version 15 (address_book for My Address Book)...');
  await db.execAsync(CREATE_TABLES.address_book);
  await db.execAsync(CREATE_INDEXES.address_book_by_address_id);
}
