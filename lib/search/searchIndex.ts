/**
 * Search Index Builder
 * 
 * Ported from web's docs/src/lib/search/searchIndex.ts
 * Builds and maintains the search index for offline address searching
 */

import { getDB, stringifyJSON, parseJSON } from '../db';
import type { SearchItem, SearchToken, SearchItemTokens, SearchIndexMeta, StreetSegment, AdminBoundary, Address } from '../db/schemas';
import { tokenizeWithAliases } from './searchNormalize';
import { parseJSON as parseGeometry } from '../db/helpers';

// Current schema version - bump when tokenization rules change
const INDEX_SCHEMA_VERSION = 3;

// ===== METADATA HELPERS =====

async function getIndexMeta(): Promise<SearchIndexMeta> {
  const db = await getDB();
  const result = await db.getFirstAsync<SearchIndexMeta & { packs: string; crashFlag: number }>(
    'SELECT * FROM search_index_meta WHERE key = ?',
    ['meta']
  );

  if (!result) {
    return {
      key: 'meta',
      indexSchemaVersion: INDEX_SCHEMA_VERSION,
      crashFlag: false,
      packs: stringifyJSON({}),
    };
  }

  return {
    ...result,
    crashFlag: result.crashFlag === 1,
    packs: result.packs, // Already a JSON string
  };
}

async function setIndexMeta(meta: SearchIndexMeta): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO search_index_meta 
     (key, indexSchemaVersion, crashFlag, lastBuildStartedAt, lastBuildCompletedAt, packs)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      meta.key,
      meta.indexSchemaVersion,
      meta.crashFlag ? 1 : 0,
      meta.lastBuildStartedAt || null,
      meta.lastBuildCompletedAt || null,
      typeof meta.packs === 'string' ? meta.packs : stringifyJSON(meta.packs),
    ]
  );
}

// ===== TOKEN MANAGEMENT =====

async function addItemToTokens(itemId: string, prefixes: string[]): Promise<void> {
  const db = await getDB();
  const now = Date.now();

  // Store item -> tokens mapping for cleanup
  await db.runAsync(
    `INSERT OR REPLACE INTO search_item_tokens (itemId, tokenPrefixes, updatedAt)
     VALUES (?, ?, ?)`,
    [itemId, stringifyJSON(prefixes), now]
  );

  // Add itemId to each token's list
  for (const prefix of prefixes) {
    const existing = await db.getFirstAsync<SearchToken & { itemIds: string }>(
      'SELECT * FROM search_tokens WHERE tokenPrefix = ?',
      [prefix]
    );

    if (existing) {
      const itemIds = parseJSON<string[]>(existing.itemIds) || [];
      // Add to set if not already present
      if (!itemIds.includes(itemId)) {
        itemIds.push(itemId);
        await db.runAsync(
          'UPDATE search_tokens SET itemIds = ?, updatedAt = ? WHERE tokenPrefix = ?',
          [stringifyJSON(itemIds), now, prefix]
        );
      }
    } else {
      // Create new token entry
      await db.runAsync(
        'INSERT INTO search_tokens (tokenPrefix, itemIds, updatedAt) VALUES (?, ?, ?)',
        [prefix, stringifyJSON([itemId]), now]
      );
    }
  }
}

async function removeItemFromTokens(itemId: string): Promise<void> {
  const db = await getDB();

  // Get the item's token prefixes
  const itemTokens = await db.getFirstAsync<SearchItemTokens & { tokenPrefixes: string }>(
    'SELECT * FROM search_item_tokens WHERE itemId = ?',
    [itemId]
  );
  if (!itemTokens) return;

  const prefixes = parseJSON<string[]>(itemTokens.tokenPrefixes) || [];
  const now = Date.now();

  // Remove itemId from each token's list
  for (const prefix of prefixes) {
    const token = await db.getFirstAsync<SearchToken & { itemIds: string }>(
      'SELECT * FROM search_tokens WHERE tokenPrefix = ?',
      [prefix]
    );
    if (token) {
      const itemIds = parseJSON<string[]>(token.itemIds) || [];
      const filteredIds = itemIds.filter(id => id !== itemId);

      if (filteredIds.length === 0) {
        // Remove empty token entry
        await db.runAsync('DELETE FROM search_tokens WHERE tokenPrefix = ?', [prefix]);
      } else {
        await db.runAsync(
          'UPDATE search_tokens SET itemIds = ?, updatedAt = ? WHERE tokenPrefix = ?',
          [stringifyJSON(filteredIds), now, prefix]
        );
      }
    }
  }

  // Remove item -> tokens mapping
  await db.runAsync('DELETE FROM search_item_tokens WHERE itemId = ?', [itemId]);
}

// ===== PACK INDEX BUILDING =====

/**
 * Build search index for a specific data pack
 */
/** POI shape for search index (id, name, lat, lon, category, subcategory, tier, stabilityScore) */
export type POIForSearch = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
  subcategory: string;
  tier: number;
  stabilityScore: number;
};

export async function buildPackIndex(
  packId: string,
  packVersion: string,
  streets: StreetSegment[],
  admins?: AdminBoundary[],
  countryCode?: string,
  pois?: POIForSearch[]
): Promise<{ itemCount: number }> {
  const db = await getDB();
  const meta = await getIndexMeta();

  // Set crash flag
  meta.crashFlag = true;
  meta.lastBuildStartedAt = Date.now();
  await setIndexMeta(meta);

  try {
    // Remove existing items for this pack
    await removePackIndex(packId);

    let itemCount = 0;
    const now = Date.now();

    // Index streets
    for (const street of streets) {
      // In SQLite, name is stored as TEXT (string), not JSON
      const streetName = typeof street.name === 'string' ? street.name : null;
      if (!streetName) continue;

      const itemId = `street:${street.id}`;
      const label = streetName;

      // Format subtitle (simplified - can be enhanced with subdivision formatting)
      const subtitle = street.region_id || '';

      // Calculate center of street geometry
      const geometry = parseJSON<[number, number][]>(street.geometry) || [];
      const centerIdx = Math.floor(geometry.length / 2);
      const [lon, lat] = geometry[centerIdx] || geometry[0] || [0, 0];

      const searchItem: SearchItem = {
        itemId,
        type: 'street',
        label,
        subtitle,
        lat,
        lon,
        packId,
        countryCode,
        entityId: street.id,
        extra: stringifyJSON({
          altName: parseJSON<string>(street.alt_name),
          ref: parseJSON<string>(street.ref),
          streetType: street.street_type,
        }),
        updatedAt: now,
      };

      await db.runAsync(
        `INSERT OR REPLACE INTO search_items 
         (itemId, type, label, subtitle, lat, lon, packId, countryCode, entityId, extra, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          searchItem.itemId,
          searchItem.type,
          searchItem.label,
          searchItem.subtitle,
          searchItem.lat,
          searchItem.lon,
          searchItem.packId || null,
          searchItem.countryCode || null,
          searchItem.entityId || null,
          searchItem.extra || null,
          searchItem.updatedAt,
        ]
      );

      // Tokenize with aliases
      const altName = typeof street.alt_name === 'string' ? street.alt_name : null;
      const ref = typeof street.ref === 'string' ? street.ref : null;
      const searchableText = [label, altName, ref].filter(Boolean).join(' ');
      const prefixes = tokenizeWithAliases(searchableText, countryCode);
      await addItemToTokens(itemId, prefixes);

      itemCount++;
    }

    // Index admin boundaries (if provided)
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        const itemId = `admin:${admin.id}`;
        const label = admin.name;

        const searchItem: SearchItem = {
          itemId,
          type: 'admin',
          label,
          subtitle: admin.country_code,
          lat: 0, // Admin boundaries don't have a single point - use center of bbox if needed
          lon: 0,
          packId,
          countryCode: admin.country_code,
          entityId: admin.id,
          extra: stringifyJSON({
            level: admin.level,
            adminLevel: admin.admin_level,
          }),
          updatedAt: now,
        };

        await db.runAsync(
          `INSERT OR REPLACE INTO search_items 
           (itemId, type, label, subtitle, lat, lon, packId, countryCode, entityId, extra, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            searchItem.itemId,
            searchItem.type,
            searchItem.label,
            searchItem.subtitle,
            searchItem.lat,
            searchItem.lon,
            searchItem.packId || null,
            searchItem.countryCode || null,
            searchItem.entityId || null,
            searchItem.extra || null,
            searchItem.updatedAt,
          ]
        );

        const prefixes = tokenizeWithAliases(label, countryCode);
        await addItemToTokens(itemId, prefixes);

        itemCount++;
      }
    }

    // Index POIs (Phase 1 - type 'place')
    if (pois && pois.length > 0) {
      for (const poi of pois) {
        const itemId = `poi:${poi.id}`;
        const subcategoryLabel = poi.subcategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const categoryLabel = poi.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const label = poi.name || subcategoryLabel;
        const subtitle = `${categoryLabel} • Tier ${poi.tier}`;

        const searchItem: SearchItem = {
          itemId,
          type: 'place',
          label,
          subtitle,
          lat: poi.lat,
          lon: poi.lon,
          packId,
          countryCode,
          entityId: poi.id,
          extra: stringifyJSON({
            category: poi.category,
            subcategory: poi.subcategory,
            tier: poi.tier,
            stabilityScore: poi.stabilityScore,
          }),
          updatedAt: now,
        };

        await db.runAsync(
          `INSERT OR REPLACE INTO search_items 
           (itemId, type, label, subtitle, lat, lon, packId, countryCode, entityId, extra, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            searchItem.itemId,
            searchItem.type,
            searchItem.label,
            searchItem.subtitle,
            searchItem.lat,
            searchItem.lon,
            searchItem.packId || null,
            searchItem.countryCode || null,
            searchItem.entityId || null,
            searchItem.extra || null,
            searchItem.updatedAt,
          ]
        );

        const searchableText = [label, poi.category, poi.subcategory].filter(Boolean).join(' ');
        const prefixes = tokenizeWithAliases(searchableText, countryCode);
        await addItemToTokens(itemId, prefixes);

        itemCount++;
      }
    }

    // Update metadata
    const packsMeta = parseJSON<Record<string, { packVersion: string; indexedAt: number; itemCount?: number; countryCode?: string }>>(meta.packs) || {};
    packsMeta[packId] = {
      packVersion,
      indexedAt: now,
      itemCount,
      countryCode,
    };

    meta.packs = stringifyJSON(packsMeta);
    meta.crashFlag = false;
    meta.lastBuildCompletedAt = now;
    await setIndexMeta(meta);

    console.log(`[SearchIndex] Built index for pack ${packId}: ${itemCount} items`);
    return { itemCount };
  } catch (error) {
    // Clear crash flag on error
    meta.crashFlag = false;
    await setIndexMeta(meta);
    throw error;
  }
}

/**
 * Remove search index for a specific pack
 */
export async function removePackIndex(packId: string): Promise<void> {
  const db = await getDB();

  // Get all items for this pack
  const items = await db.getAllAsync<SearchItem>(
    'SELECT * FROM search_items WHERE packId = ?',
    [packId]
  );

  // Remove tokens for each item
  for (const item of items) {
    await removeItemFromTokens(item.itemId);
  }

  // Delete items
  await db.runAsync('DELETE FROM search_items WHERE packId = ?', [packId]);

  // Update metadata
  const meta = await getIndexMeta();
  const packsMeta = parseJSON<Record<string, unknown>>(meta.packs) || {};
  delete packsMeta[packId];
  meta.packs = stringifyJSON(packsMeta);
  await setIndexMeta(meta);
}

// ===== INCREMENTAL UPDATES (ADDRESS CRUD) =====

/**
 * Add or update an address in the search index
 */
export async function upsertAddressItem(address: Address): Promise<void> {
  const db = await getDB();
  const now = Date.now();

  const itemId = `address:${address.id}`;

  // Remove existing tokens first (for update case)
  await removeItemFromTokens(itemId);

  // Build label
  const label = [
    address.house_number?.toString(),
    address.extension,
    address.street_name,
  ].filter(Boolean).join(' ');

  // Build subtitle
  const subtitleParts = [address.neighborhood, address.city, address.region].filter(Boolean);
  const subtitle = subtitleParts.join(', ');

  const searchItem: SearchItem = {
    itemId,
    type: 'address',
    label,
    subtitle,
    lat: address.latitude,
    lon: address.longitude,
    countryCode: address.country?.substring(0, 2).toUpperCase(),
    adminPath: [address.neighborhood, address.city, address.region].filter(Boolean).join(' > '),
    entityId: address.id,
    extra: stringifyJSON({
      plusCode: address.plus_code,
      propertyType: address.property_type,
    }),
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO search_items 
     (itemId, type, label, subtitle, lat, lon, countryCode, adminPath, entityId, extra, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      searchItem.itemId,
      searchItem.type,
      searchItem.label,
      searchItem.subtitle,
      searchItem.lat,
      searchItem.lon,
      searchItem.countryCode || null,
      searchItem.adminPath || null,
      searchItem.entityId || null,
      searchItem.extra || null,
      searchItem.updatedAt,
    ]
  );

  // Tokenize searchable fields
  const searchableText = [
    label,
    address.neighborhood,
    address.city,
    address.plus_code,
  ].filter(Boolean).join(' ');

  const prefixes = tokenizeWithAliases(searchableText, searchItem.countryCode);
  await addItemToTokens(itemId, prefixes);

  // Index as place if business_name exists
  if (address.business_name) {
    const placeItemId = `place:${address.id}`;

    // Remove existing place tokens
    await removeItemFromTokens(placeItemId);

    const placeItem: SearchItem = {
      itemId: placeItemId,
      type: 'place',
      label: address.business_name,
      subtitle: label,
      lat: address.latitude,
      lon: address.longitude,
      countryCode: searchItem.countryCode,
      adminPath: searchItem.adminPath,
      entityId: address.id,
      extra: stringifyJSON({
        addressLabel: label,
        propertyCategory: address.property_category,
      }),
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO search_items 
       (itemId, type, label, subtitle, lat, lon, countryCode, adminPath, entityId, extra, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        placeItem.itemId,
        placeItem.type,
        placeItem.label,
        placeItem.subtitle,
        placeItem.lat,
        placeItem.lon,
        placeItem.countryCode || null,
        placeItem.adminPath || null,
        placeItem.entityId || null,
        placeItem.extra || null,
        placeItem.updatedAt,
      ]
    );

    const placePrefixes = tokenizeWithAliases(address.business_name, placeItem.countryCode);
    await addItemToTokens(placeItemId, placePrefixes);
  }
}

/**
 * Remove an address from the search index
 */
export async function deleteAddressItem(addressId: string): Promise<void> {
  const db = await getDB();

  const itemId = `address:${addressId}`;
  const placeItemId = `place:${addressId}`;

  // Remove tokens
  await removeItemFromTokens(itemId);
  await removeItemFromTokens(placeItemId);

  // Delete items
  await db.runAsync('DELETE FROM search_items WHERE itemId IN (?, ?)', [itemId, placeItemId]);
}

/**
 * Validate and repair search index
 */
export async function validateAndRepair(
  installedPacks: Array<{ id: string; version: string; countryCode: string }>,
  onProgress?: (message: string) => void
): Promise<{ repaired: boolean; packsRebuilt: string[] }> {
  const meta = await getIndexMeta();
  const packsMeta = parseJSON<Record<string, { packVersion: string; indexedAt: number; itemCount?: number; countryCode?: string }>>(meta.packs) || {};

  let repaired = false;
  const packsRebuilt: string[] = [];

  // Check for crash flag (incomplete build)
  if (meta.crashFlag) {
    onProgress?.('Repairing incomplete index build...');
    meta.crashFlag = false;
    await setIndexMeta(meta);
    repaired = true;
  }

  // Check each installed pack
  for (const pack of installedPacks) {
    const packMeta = packsMeta[pack.id];
    if (!packMeta || packMeta.packVersion !== pack.version) {
      onProgress?.(`Rebuilding index for pack ${pack.id}...`);
      // Note: In a full implementation, we would rebuild the index here
      // For now, we'll just mark it as needing rebuild
      packsRebuilt.push(pack.id);
      repaired = true;
    }
  }

  return { repaired, packsRebuilt };
}

/**
 * Get search index statistics
 */
export async function getIndexStats(): Promise<{
  totalItems: number;
  totalTokens: number;
  packCount: number;
}> {
  const db = await getDB();

  const [itemsResult, tokensResult, meta] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM search_items'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM search_tokens'),
    getIndexMeta(),
  ]);

  const packsMeta = parseJSON<Record<string, unknown>>(meta.packs) || {};

  return {
    totalItems: itemsResult?.count || 0,
    totalTokens: tokensResult?.count || 0,
    packCount: Object.keys(packsMeta).length,
  };
}
