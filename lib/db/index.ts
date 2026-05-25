/**
 * Database Module Exports
 * 
 * Central export point for all database-related functionality.
 */

// Core database functions
export { initDB, getDB, closeDB, deleteDB, getDBStats, checkAndRepairDB, ensureDBReady } from './database';

// Schema types
export * from './schemas';

// Schema and index definitions
export { CREATE_TABLES, CREATE_INDEXES, getAllCreateTableStatements, SQLITE_SCHEMA_VERSION } from './sqlite-schema';
export { getAllCreateIndexStatements } from './indexes';

// Migration system
export { runMigrations } from './migrations';

// Helper functions
export {
  transaction,
  parseJSON,
  stringifyJSON,
  buildWhereClause,
  buildInsert,
  buildUpdate,
  buildSelect,
  queryAll,
  queryFirst,
  queryValue,
  execute,
  exists,
  count,
  deleteRecords,
} from './helpers';

// Database operations for each table
export * from './addresses';
export * from './addressBook';
export * from './syncQueue';
export * from './streetSegments';
export * from './adminBoundaries';
export * from './settlements';
export * from './dataPacks';
export * from './pois';

// User roles (getLocalUserRoles, upsertLocalUserRoles; AppRole is in schemas)
export { getLocalUserRoles, upsertLocalUserRoles } from './userRoles';
