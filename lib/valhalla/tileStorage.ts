/**
 * Valhalla tile storage (SQLite) — Phase 4
 *
 * Staging: during pack install. Prod: after commit.
 * getTilesArrayBufferForRegion returns a single tar ArrayBuffer for loadTiles().
 */

import { getDB } from '../db/database';

const TAR_HEADER_SIZE = 512;
const TAR_BLOCK_SIZE = 512;
const TAR_MAGIC = 'ustar';

function writeTarString(view: Uint8Array, offset: number, value: string, maxLen: number): void {
  const bytes = new TextEncoder().encode(value.slice(0, maxLen));
  view.set(bytes, offset);
}

function writeTarOctal(view: Uint8Array, offset: number, fieldLen: number, value: number): void {
  const octal = Math.max(0, value).toString(8).padStart(fieldLen - 1, '0').slice(0, fieldLen - 1);
  writeTarString(view, offset, octal + '\0', fieldLen);
}

function createTarHeader(name: string, size: number): ArrayBuffer {
  const header = new ArrayBuffer(TAR_HEADER_SIZE);
  const v = new Uint8Array(header);
  writeTarString(v, 0, name, 100);
  writeTarOctal(v, 100, 8, 0o644);
  writeTarOctal(v, 108, 8, 0);
  writeTarOctal(v, 116, 8, 0);
  writeTarOctal(v, 124, 12, size);
  writeTarOctal(v, 136, 12, Math.floor(Date.now() / 1000));
  v[156] = 0x30;
  writeTarString(v, 257, TAR_MAGIC, 6);
  writeTarString(v, 263, '00', 2);
  for (let i = 148; i < 156; i++) v[i] = 0x20;
  let sum = 0;
  for (let i = 0; i < TAR_HEADER_SIZE; i++) sum += v[i];
  writeTarString(v, 148, sum.toString(8).padStart(6, '0'), 6);
  v[154] = 0;
  v[155] = 0x20;
  return header;
}

function buildTarArchive(files: { name: string; buffer: ArrayBuffer }[]): ArrayBuffer {
  const parts: ArrayBuffer[] = [];
  for (const { name, buffer } of files) {
    const size = buffer.byteLength;
    const normalizedName = name.replace(/^\.\//, '').replace(/\\/g, '/').slice(0, 100);
    parts.push(createTarHeader(normalizedName, size));
    parts.push(buffer);
    const pad = (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
    if (pad > 0) parts.push(new ArrayBuffer(pad));
  }
  parts.push(new ArrayBuffer(TAR_BLOCK_SIZE * 2));
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p), offset);
    offset += p.byteLength;
  }
  return out.buffer;
}

/** Tile entry: id = filename, data = file content (e.g. single tar or per-tile buffer). */
export interface ValhallaTileEntry {
  id: string;
  data: ArrayBuffer;
}

export async function hasProdTilesForRegion(regionCode: string): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ regionCode: string }>(
    'SELECT regionCode FROM valhalla_tiles WHERE regionCode = ?',
    [regionCode]
  );
  return !!row;
}

export async function hasStagingTilesForRegion(regionCode: string): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ regionCode: string }>(
    'SELECT regionCode FROM valhalla_tiles_stg WHERE regionCode = ?',
    [regionCode]
  );
  return !!row;
}

export async function storeValhallaTilesForPack(
  regionCode: string,
  tiles?: ValhallaTileEntry[]
): Promise<void> {
  const db = await getDB();
  if (!tiles?.length) return;
  let data: ArrayBuffer;
  if (tiles.length === 1 && tiles[0].id.toLowerCase().endsWith('.tar')) {
    data = tiles[0].data;
  } else {
    data = buildTarArchive(tiles.map((t) => ({ name: t.id, buffer: t.data })));
  }
  const blob = new Uint8Array(data);
  await db.runAsync(
    'INSERT OR REPLACE INTO valhalla_tiles_stg (regionCode, data) VALUES (?, ?)',
    [regionCode, blob]
  );
}

export async function commitValhallaStagingToProd(regionCode: string): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ data: Uint8Array }>(
    'SELECT data FROM valhalla_tiles_stg WHERE regionCode = ?',
    [regionCode]
  );
  if (row?.data) {
    await db.runAsync(
      'INSERT OR REPLACE INTO valhalla_tiles (regionCode, data) VALUES (?, ?)',
      [regionCode, row.data]
    );
    console.log(`[Valhalla] Committed tiles to prod for ${regionCode}`);
  }
  await db.runAsync('DELETE FROM valhalla_tiles_stg WHERE regionCode = ?', [regionCode]);
}

export async function clearValhallaStagingForPack(regionCode: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM valhalla_tiles_stg WHERE regionCode = ?', [regionCode]);
}

export async function clearValhallaTilesForPack(regionCode: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM valhalla_tiles WHERE regionCode = ?', [regionCode]);
}

export async function getTilesArrayBufferForRegion(regionCode: string): Promise<ArrayBuffer | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ data: Uint8Array }>(
    'SELECT data FROM valhalla_tiles WHERE regionCode = ?',
    [regionCode]
  );
  if (!row?.data) return null;
  return row.data.buffer.slice(row.data.byteOffset, row.data.byteOffset + row.data.byteLength);
}
