/**
 * Offline DB logging – all reads and writes use this so you can see what's going on.
 * Prefix [OfflineDB] for easy filtering in logs (same idea as custom URL logging).
 */

const PREFIX = '[OfflineDB]';

export function logRead(operation: string, detail: string, rowCount?: number): void {
  const countStr = rowCount !== undefined ? ` (${rowCount} row(s))` : '';
  console.log(`${PREFIX} READ  ${operation}${countStr} | ${detail}`);
}

export function logWrite(operation: string, detail: string, changes?: number): void {
  const changeStr = changes !== undefined ? ` (${changes} change(s))` : '';
  console.log(`${PREFIX} WRITE ${operation}${changeStr} | ${detail}`);
}

export function logSuccess(message: string): void {
  console.log(`${PREFIX} ${message}`);
}
