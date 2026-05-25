/**
 * Database Helper Functions
 * 
 * Common database operations, query builders, and transaction helpers.
 * Provides utilities for working with SQLite database.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { getDB } from './database';
import { logRead, logWrite } from './dbLogger';

/**
 * Retry a database operation with exponential backoff for locked errors
 */
async function retryOperation<T>(
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
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (db: SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDB();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');
    const result = await callback(db);
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Parse JSON string from database
 */
export function parseJSON<T>(jsonString: string | null | undefined): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.log('[DB Helpers] Error parsing JSON:', error);
    return null;
  }
}

/**
 * Stringify object to JSON for database storage
 */
export function stringifyJSON(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.log('[DB Helpers] Error stringifying JSON:', error);
    return '{}';
  }
}

/**
 * Build WHERE clause with parameters
 */
export function buildWhereClause(
  conditions: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const keys = Object.keys(conditions);
  if (keys.length === 0) {
    return { sql: '', params: [] };
  }

  const clauses = keys.map((key, index) => {
    const paramName = `?${index + 1}`;
    return `${key} = ${paramName}`;
  });

  return {
    sql: `WHERE ${clauses.join(' AND ')}`,
    params: Object.values(conditions),
  };
}

/**
 * Build INSERT statement
 */
export function buildInsert(
  table: string,
  data: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const keys = Object.keys(data);
  const placeholders = keys.map((_, index) => `?${index + 1}`).join(', ');
  const columns = keys.join(', ');

  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    params: Object.values(data),
  };
}

/**
 * Build UPDATE statement
 */
export function buildUpdate(
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const setClauses = Object.keys(data).map((key, index) => {
    const paramName = `?${index + 1}`;
    return `${key} = ${paramName}`;
  });

  const whereClause = buildWhereClause(where);
  const setParams = Object.values(data);
  const whereParams = whereClause.params;

  return {
    sql: `UPDATE ${table} SET ${setClauses.join(', ')} ${whereClause.sql}`,
    params: [...setParams, ...whereParams],
  };
}

/**
 * Build SELECT statement
 */
export function buildSelect(
  table: string,
  options: {
    columns?: string[];
    where?: Record<string, unknown>;
    orderBy?: string;
    limit?: number;
    offset?: number;
  } = {}
): { sql: string; params: unknown[] } {
  const columns = options.columns?.join(', ') || '*';
  const whereClause = options.where ? buildWhereClause(options.where) : { sql: '', params: [] };
  
  let sql = `SELECT ${columns} FROM ${table} ${whereClause.sql}`;
  const params = [...whereClause.params];

  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy}`;
  }

  if (options.limit) {
    sql += ` LIMIT ?${params.length + 1}`;
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ` OFFSET ?${params.length + 1}`;
    params.push(options.offset);
  }

  return { sql, params };
}

/**
 * Execute a query and return all results
 */
export async function queryAll<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return retryOperation(async () => {
    const db = await getDB();
    const rows = await db.getAllAsync<T>(sql, params);
    logRead('queryAll', sql.trim().replace(/\s+/g, ' ').slice(0, 80), rows.length);
    return rows;
  });
}

/**
 * Execute a query and return first result
 */
export async function queryFirst<T>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return retryOperation(async () => {
    const db = await getDB();
    const row = await db.getFirstAsync<T>(sql, params);
    logRead('queryFirst', sql.trim().replace(/\s+/g, ' ').slice(0, 80), row ? 1 : 0);
    return row;
  });
}

/**
 * Execute a query and return a single value
 */
export async function queryValue<T>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return retryOperation(async () => {
    const db = await getDB();
    const result = await db.getFirstAsync<Record<string, T>>(sql, params);
    logRead('queryValue', sql.trim().replace(/\s+/g, ' ').slice(0, 80), result ? 1 : 0);
    if (!result) return null;
    return Object.values(result)[0] || null;
  });
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement
 */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertRowId: number; changes: number }> {
  return retryOperation(async () => {
    const db = await getDB();
    const result = await db.runAsync(sql, params);
    const changes = result.changes || 0;
    logWrite('execute', sql.trim().replace(/\s+/g, ' ').slice(0, 80), changes);
    return {
      lastInsertRowId: result.lastInsertRowId || 0,
      changes,
    };
  });
}

/**
 * Check if a record exists
 */
export async function exists(
  table: string,
  where: Record<string, unknown>
): Promise<boolean> {
  const whereClause = buildWhereClause(where);
  const sql = `SELECT 1 FROM ${table} ${whereClause.sql} LIMIT 1`;
  const result = await queryFirst<{ '1': number }>(sql, whereClause.params);
  return result !== null;
}

/**
 * Count records in a table
 */
export async function count(
  table: string,
  where?: Record<string, unknown>
): Promise<number> {
  const whereClause = where ? buildWhereClause(where) : { sql: '', params: [] };
  const sql = `SELECT COUNT(*) as count FROM ${table} ${whereClause.sql}`;
  const result = await queryValue<number>(sql, whereClause.params);
  return result || 0;
}

/**
 * Delete records from a table
 */
export async function deleteRecords(
  table: string,
  where: Record<string, unknown>
): Promise<number> {
  const whereClause = buildWhereClause(where);
  const sql = `DELETE FROM ${table} ${whereClause.sql}`;
  const result = await execute(sql, whereClause.params);
  return result.changes;
}
