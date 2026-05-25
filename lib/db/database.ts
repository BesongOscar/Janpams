/**
 * SQLite Database Initialization and Connection Management
 * 
 * Provides database connection management similar to web's getDB() function.
 * Handles database initialization, schema creation, and connection lifecycle.
 * 
 * Reference: docs/src/lib/db.ts (web's initDB and getDB functions)
 */

import { openDatabaseAsync, deleteDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES, getAllCreateTableStatements, SQLITE_SCHEMA_VERSION } from './sqlite-schema';
import { CREATE_INDEXES, getAllCreateIndexStatements } from './indexes';
import { runMigrations } from './migrations';

const DB_NAME = 'janpams.db';
let dbInstance: SQLiteDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<SQLiteDatabase> | null = null;
let isRepairing = false;
let repairPromise: Promise<boolean> | null = null;

/**
 * Retry a database operation with exponential backoff for locked errors
 */
async function retryDBOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let retries = maxRetries;
  let lastError: Error | null = null;
  
  while (retries > 0) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a database locked error
      const isLocked = error?.message?.includes('database is locked') || 
                      error?.message?.includes('locked') ||
                      error?.code === 5; // SQLITE_BUSY
      
      if (isLocked && retries > 1) {
        retries--;
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = Math.pow(2, maxRetries - retries) * 50;
        console.warn(`[DB] Database locked, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Not a locked error or out of retries
      throw error;
    }
  }
  
  throw lastError || new Error('Database operation failed');
}

/**
 * Initialize the SQLite database
 * Creates all tables and indexes if they don't exist
 * Runs migrations if needed
 * Prevents concurrent initialization and retries on "database is locked"
 */
export async function initDB(): Promise<SQLiteDatabase> {
  // If already initialized, return existing instance
  if (dbInstance) {
    return dbInstance;
  }

  // If initialization is in progress, wait for it (check initPromise first to avoid race)
  if (initPromise) {
    return initPromise;
  }

  // Start initialization: assign promise immediately so concurrent callers wait on the same one
  initPromise = (async () => {
    isInitializing = true;
    try {
      // Close any existing connection first (safety check)
      if (dbInstance) {
        try {
          await dbInstance.closeAsync();
        } catch (closeError) {
          console.warn('[DB] Error closing existing connection (ignored):', closeError);
        }
        dbInstance = null;
      }

      // Open database connection
      dbInstance = await openDatabaseAsync(DB_NAME);

      // Prefer WAL and wait up to 5s for lock instead of failing immediately
      await retryDBOperation(async () => {
        try {
          await dbInstance!.execAsync('PRAGMA journal_mode = WAL');
          await dbInstance!.execAsync('PRAGMA busy_timeout = 5000');
        } catch (pragmaErr) {
          // Some environments may not support these; continue
          console.warn('[DB] PRAGMA optional settings (ignored):', pragmaErr);
        }
      });

      // Run all schema work with retry on "database is locked"
      await retryDBOperation(async () => {
        const versionResult = await dbInstance!.getFirstAsync<{ user_version: number }>(
          'PRAGMA user_version'
        );
        const currentVersion = versionResult?.user_version || 0;

        console.log(`[DB] Current schema version: ${currentVersion}, Target: ${SQLITE_SCHEMA_VERSION}`);

        if (currentVersion < SQLITE_SCHEMA_VERSION) {
          console.log(`[DB] Running migrations from version ${currentVersion} to ${SQLITE_SCHEMA_VERSION}`);
          await runMigrations(dbInstance!, currentVersion, SQLITE_SCHEMA_VERSION);
        }

        if (currentVersion === 0) {
          console.log('[DB] Creating all tables...');
          await dbInstance!.execAsync(getAllCreateTableStatements());
          console.log('[DB] Creating all indexes...');
          await dbInstance!.execAsync(getAllCreateIndexStatements());
        } else {
          console.log('[DB] Ensuring all tables exist...');
          await dbInstance!.execAsync(getAllCreateTableStatements());
          console.log('[DB] Ensuring all indexes exist...');
          await dbInstance!.execAsync(getAllCreateIndexStatements());
        }

        await dbInstance!.execAsync(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
      });

      console.log('[DB] Database initialized successfully');
      return dbInstance!;
    } catch (error) {
      console.log('[DB] Error initializing database:', error);
      initPromise = null;
      dbInstance = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Get the database instance
 * Initializes if not already initialized
 */
export async function getDB(): Promise<SQLiteDatabase> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

/**
 * Close the database connection
 * Useful for cleanup or testing
 * Waits for any pending operations to complete first
 */
export async function closeDB(): Promise<void> {
  // Wait for initialization to complete if in progress
  if (isInitializing && initPromise) {
    try {
      await initPromise;
    } catch (error) {
      // Ignore initialization errors when closing
    }
  }
  
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch (error: any) {
      // Ignore close errors (connection might already be closed)
      if (!error?.message?.includes('closed')) {
        console.warn('[DB] Error closing database (ignored):', error);
      }
    }
    dbInstance = null;
    console.log('[DB] Database connection closed');
  }
  
  isInitializing = false;
  initPromise = null;
}

/**
 * Delete the database (for testing or reset)
 * WARNING: This will delete all data!
 */
export async function deleteDB(): Promise<void> {
  await closeDB();
  try {
    await deleteDatabaseAsync(DB_NAME);
    console.log('[DB] Database deleted');
  } catch (error) {
    console.log('[DB] Error deleting database:', error);
    throw error;
  }
}

/**
 * Get database statistics
 * Useful for debugging and monitoring
 */
export async function getDBStats(): Promise<{
  version: number;
  tableCount: number;
  tables: string[];
}> {
  const db = await getDB();
  
  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const version = versionResult?.user_version || 0;

  const tablesResult = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tables = tablesResult.map(row => row.name);

  return {
    version,
    tableCount: tables.length,
    tables,
  };
}

/**
 * Check database health and repair if needed
 * Returns true if DB is healthy, false if repair was attempted
 * 
 * This function checks for critical tables and ensures they exist.
 * If tables are missing, it re-runs initDB() to repair them.
 * 
 * Reference: Web's initDB() upgrade callback ensures all stores exist atomically
 * 
 * Prevents concurrent repair operations to avoid "database is locked" errors
 */
export async function checkAndRepairDB(): Promise<boolean> {
  // If repair is already in progress, wait for it
  if (isRepairing && repairPromise) {
    return repairPromise;
  }

  // Start repair operation
  isRepairing = true;
  repairPromise = retryDBOperation(async () => {
    try {
      // Wait for any initialization to complete first
      if (isInitializing && initPromise) {
        await initPromise;
      }

      const db = await getDB();
      
      // Check for critical tables that should always exist
      const criticalTables = [
        'addresses',
        'sync_queue',
        'street_segments',
        'admin_boundaries',
        'settlement_places',
        'data_packs',
      ];
      
      const tablesResult = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const existingTables = new Set(tablesResult.map(row => row.name));
      
      const missingTables = criticalTables.filter(table => !existingTables.has(table));
      
      if (missingTables.length > 0) {
        console.warn(`[DB Health] Missing critical tables: ${missingTables.join(', ')}. Repairing...`);
        
        // Close current connection safely
        if (dbInstance) {
          try {
            await dbInstance.closeAsync();
          } catch (closeError: any) {
            // Ignore close errors if connection is already closed or locked
            if (!closeError?.message?.includes('closed') && !closeError?.message?.includes('locked')) {
              console.warn('[DB Health] Error closing connection (ignored):', closeError);
            }
          }
          dbInstance = null;
        }
        
        // Wait a bit to ensure connection is fully closed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-initialize (this will create all missing tables)
        await initDB();
        
        console.log('[DB Health] Database repair completed');
        isRepairing = false;
        return false; // Repair was needed
      }
      
      isRepairing = false;
      return true; // DB is healthy
    } catch (error: any) {
      console.log('[DB Health] Error checking database health:', error);
      
      // Try to repair by re-initializing
      try {
        if (dbInstance) {
          try {
            await dbInstance.closeAsync();
          } catch (closeError: any) {
            // Ignore close errors
            if (!closeError?.message?.includes('closed') && !closeError?.message?.includes('locked')) {
              console.warn('[DB Health] Error closing connection (ignored):', closeError);
            }
          }
          dbInstance = null;
        }
        
        // Wait a bit before re-initializing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await initDB();
        console.log('[DB Health] Database repair attempted after error');
        isRepairing = false;
        return false;
      } catch (repairError) {
        console.log('[DB Health] Failed to repair database:', repairError);
        isRepairing = false;
        throw repairError;
      }
    }
  });

  return repairPromise;
}

/**
 * Ensure database is ready before operations
 * This is called before critical DB operations to ensure tables exist
 * 
 * Reference: Web's getDB() always ensures initDB() has completed
 */
export async function ensureDBReady(): Promise<SQLiteDatabase> {
  // First ensure DB instance exists
  const db = await getDB();
  
  // Then check health and repair if needed
  await checkAndRepairDB();
  
  return db;
}
