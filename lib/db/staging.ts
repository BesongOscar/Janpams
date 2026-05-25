/**
 * JAPA staging tables: batch insert into _stg and copy STG → PROD.
 * Phase 2: used by downloader before validation and commit.
 */

import { getDB } from './database';
import { stringifyJSON } from './helpers';
import type {
  StreetSegment,
  AdminBoundary,
  SettlementPlace,
  POIRecord,
  DataPackManifest,
} from './schemas';

const BATCH = 100;

async function runMany(
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDB();
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.withTransactionAsync(async () => {
      for (const row of chunk) {
        await db.runAsync(sql, row);
      }
    });
  }
}

export async function batchInsertStreetSegmentsStg(segments: StreetSegment[]): Promise<void> {
  const columns = [
    'id', 'osm_id', 'name', 'name_en', 'name_fr', 'alt_name', 'ref',
    'street_type', 'oneway', 'layer', 'geometry', 'bbox',
    'spacing_constant', 'numbering_direction', 'city_id', 'region_id',
    'source', 'cached_at',
  ];
  const geometry = (s: StreetSegment) => typeof s.geometry === 'string' ? s.geometry : stringifyJSON(s.geometry);
  const bbox = (s: StreetSegment) => typeof s.bbox === 'string' ? s.bbox : stringifyJSON(s.bbox);
  const rows = segments.map(s => [
    s.id, s.osm_id ?? null, s.name, s.name_en ?? null, s.name_fr ?? null, s.alt_name ?? null, s.ref ?? null,
    s.street_type, s.oneway ? 1 : 0, s.layer ?? null, geometry(s), bbox(s),
    s.spacing_constant, s.numbering_direction, s.city_id ?? null, s.region_id ?? null,
    s.source, s.cached_at,
  ]);
  await runMany('street_segments_stg', columns, rows);
}

export async function batchInsertAdminBoundariesStg(boundaries: AdminBoundary[]): Promise<void> {
  const columns = [
    'id', 'osm_id', 'osm_type', 'name', 'name_en', 'name_fr', 'level', 'admin_level',
    'polygon', 'bbox', 'area', 'parent_id', 'country_code', 'packId', 'token',
    'source', 'cached_at',
  ];
  const polygon = (b: AdminBoundary) => typeof b.polygon === 'string' ? b.polygon : stringifyJSON(b.polygon);
  const bbox = (b: AdminBoundary) => typeof b.bbox === 'string' ? b.bbox : stringifyJSON(b.bbox);
  const rows = boundaries.map(b => [
    b.id, b.osm_id ?? null, b.osm_type ?? null, b.name, b.name_en ?? null, b.name_fr ?? null,
    b.level, b.admin_level, polygon(b), bbox(b), b.area ?? null, b.parent_id ?? null,
    b.country_code, b.packId ?? null, b.token ?? null, b.source, b.cached_at,
  ]);
  await runMany('admin_boundaries_stg', columns, rows);
}

export async function batchInsertSettlementPlacesStg(places: SettlementPlace[]): Promise<void> {
  const columns = [
    'id', 'packId', 'name', 'name_en', 'name_fr', 'place', 'lat', 'lon',
    'osm_id', 'osm_type', 'polygon', 'bbox', 'geoCell', 'source', 'cached_at',
  ];
  const polygon = (p: SettlementPlace) => p.polygon ? (typeof p.polygon === 'string' ? p.polygon : stringifyJSON(p.polygon)) : null;
  const bbox = (p: SettlementPlace) => p.bbox ? (typeof p.bbox === 'string' ? p.bbox : stringifyJSON(p.bbox)) : null;
  const rows = places.map(p => [
    p.id, p.packId, p.name, p.name_en ?? null, p.name_fr ?? null, p.place, p.lat, p.lon,
    p.osm_id ?? null, p.osm_type ?? null, polygon(p), bbox(p), p.geoCell ?? null,
    p.source, p.cached_at,
  ]);
  await runMany('settlement_places_stg', columns, rows);
}

export async function batchInsertPOIsStg(pois: POIRecord[]): Promise<void> {
  const columns = [
    'id', 'osm_id', 'osm_type', 'lat', 'lon', 'name', 'name_en', 'name_fr', 'brand', 'operator',
    'category', 'subcategory', 'tier', 'tags', 'stabilityScore', 'packId', 'countryCode', 'cached_at',
  ];
  const rows = pois.map(p => [
    p.id, p.osm_id ?? null, p.osm_type ?? null, p.lat, p.lon, p.name ?? '', p.name_en ?? null, p.name_fr ?? null,
    p.brand ?? null, p.operator ?? null, p.category, p.subcategory, p.tier, stringifyJSON(p.tags),
    p.stabilityScore, p.packId, p.countryCode, p.cached_at,
  ]);
  await runMany('pois_stg', columns, rows);
}

export async function insertPackStagingManifest(manifest: DataPackManifest): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO pack_staging (id, name, region, country, version, street_count, boundary_count, settlement_count, settlement_place_count, poi_count, valhalla_tile_count, size_bytes, sha256, created_at, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manifest.id,
      manifest.name,
      manifest.region,
      manifest.country,
      manifest.version,
      manifest.street_count,
      manifest.boundary_count,
      manifest.settlement_count ?? null,
      manifest.settlement_place_count ?? null,
      manifest.poi_count ?? null,
      manifest.valhalla_tile_count ?? null,
      manifest.size_bytes,
      manifest.sha256 ?? null,
      manifest.created_at,
      manifest.downloaded_at ?? null,
    ]
  );
}

export interface StagingCounts {
  streetCount: number;
  boundaryCount: number;
  settlementCount: number;
  poiCount: number;
}

async function countStaging(db: Awaited<ReturnType<typeof getDB>>, sql: string, params: unknown[]): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>(sql, params);
  return row?.c ?? 0;
}

export async function getStagingCounts(regionCode: string): Promise<StagingCounts> {
  const db = await getDB();
  const [streetCount, boundaryCount, settlementCount, poiCount] = await Promise.all([
    countStaging(db, 'SELECT COUNT(*) as c FROM street_segments_stg WHERE region_id = ?', [regionCode]),
    countStaging(db, 'SELECT COUNT(*) as c FROM admin_boundaries_stg WHERE packId = ?', [regionCode]),
    countStaging(db, 'SELECT COUNT(*) as c FROM settlement_places_stg WHERE packId = ?', [regionCode]),
    countStaging(db, 'SELECT COUNT(*) as c FROM pois_stg WHERE packId = ?', [regionCode]),
  ]);
  return { streetCount, boundaryCount, settlementCount, poiCount };
}

/** Clear only staging tables for a region (no state change). Call at start of download. */
export async function clearStagingTablesForRegion(regionCode: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM street_segments_stg WHERE region_id = ?', [regionCode]);
  await db.runAsync('DELETE FROM admin_boundaries_stg WHERE packId = ?', [regionCode]);
  await db.runAsync('DELETE FROM settlement_places_stg WHERE packId = ?', [regionCode]);
  await db.runAsync('DELETE FROM pois_stg WHERE packId = ?', [regionCode]);
  await db.runAsync('DELETE FROM pack_staging WHERE id = ?', [regionCode]);
}

/** Copy all staging data for region to prod and remove from staging. Call inside INSTALLING. */
export async function copyStagingToProd(regionCode: string): Promise<void> {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO street_segments SELECT * FROM street_segments_stg WHERE region_id = ?`,
      [regionCode]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO admin_boundaries SELECT * FROM admin_boundaries_stg WHERE packId = ?`,
      [regionCode]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO settlement_places SELECT * FROM settlement_places_stg WHERE packId = ?`,
      [regionCode]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO pois SELECT * FROM pois_stg WHERE packId = ?`,
      [regionCode]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO data_packs SELECT * FROM pack_staging WHERE id = ?`,
      [regionCode]
    );
    await db.runAsync('DELETE FROM street_segments_stg WHERE region_id = ?', [regionCode]);
    await db.runAsync('DELETE FROM admin_boundaries_stg WHERE packId = ?', [regionCode]);
    await db.runAsync('DELETE FROM settlement_places_stg WHERE packId = ?', [regionCode]);
    await db.runAsync('DELETE FROM pois_stg WHERE packId = ?', [regionCode]);
    await db.runAsync('DELETE FROM pack_staging WHERE id = ?', [regionCode]);
  });
}
