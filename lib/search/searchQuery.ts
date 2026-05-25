/**
 * Offline Search Query Engine (mobile)
 *
 * Two-phase approach:
 * 1. Retrieve candidates from SQLite (search_tokens → search_items)
 * 2. Delegate ranking/grouping to @janpams/core pure logic
 *
 * Also surfaces empty-state context (no packs, no results, etc.).
 */

import { getDB, parseJSON, stringifyJSON } from '../db';
import type { SearchItem } from '../db/schemas';
import {
  isQueryLongEnough,
  getSearchQueryTokens,
  rankAndGroupSearchResults,
  type SearchQueryContext,
  type SearchCandidate,
  type SearchItemType,
  type GroupedResults,
  type SearchResult,
} from '@janpams/core/search';

export type { SearchQueryContext, SearchCandidate, SearchItemType, GroupedResults, SearchResult };

const CANDIDATE_CAP = 500;

export interface OfflineGroupedResults extends GroupedResults {
  emptyReason?: 'no_query' | 'no_results' | 'no_packs' | 'filtered_out';
  suggestions?: string[];
}

async function generateSuggestions(): Promise<string[]> {
  const suggestions: string[] = [];
  const db = await getDB();

  const packRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM data_packs');
  if (!packRow || packRow.count === 0) {
    suggestions.push('Download a region data pack to enable offline search');
    return suggestions;
  }

  const addrRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM addresses');
  if (addrRow && addrRow.count > 0) {
    suggestions.push('Search your saved addresses by street name or plus code');
  } else {
    suggestions.push('Create an address to make it searchable');
  }

  return suggestions;
}

function dbItemToCandidate(row: SearchItem & { extra?: string }): SearchCandidate {
  return {
    itemId: row.itemId,
    type: row.type as SearchItemType,
    label: row.label,
    subtitle: row.subtitle,
    lat: row.lat,
    lon: row.lon,
    packId: row.packId,
    countryCode: row.countryCode,
    adminPath: row.adminPath,
    entityId: row.entityId,
    extra: row.extra ? (parseJSON(row.extra) as Record<string, unknown>) ?? undefined : undefined,
    updatedAt: row.updatedAt,
  };
}

/**
 * Execute offline search against the local SQLite search index.
 */
export async function querySearch(context: SearchQueryContext): Promise<OfflineGroupedResults> {
  const { query, filterByPacks, filterByTypes } = context;

  if (!isQueryLongEnough(query)) {
    const suggestions = await generateSuggestions();
    return {
      addresses: [],
      streets: [],
      places: [],
      admins: [],
      totalCount: 0,
      emptyReason: 'no_query',
      suggestions,
    };
  }

  const db = await getDB();

  const packRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM data_packs');
  const addrRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM addresses');
  if ((!packRow || packRow.count === 0) && (!addrRow || addrRow.count === 0)) {
    return {
      addresses: [],
      streets: [],
      places: [],
      admins: [],
      totalCount: 0,
      emptyReason: 'no_packs',
      suggestions: ['Download a region data pack to search streets and places'],
    };
  }

  // Phase A: candidate retrieval from token store
  const queryTokens = getSearchQueryTokens(query, context.countryCode);
  if (queryTokens.length === 0) {
    return { addresses: [], streets: [], places: [], admins: [], totalCount: 0, emptyReason: 'no_query' };
  }

  const candidateIds = new Set<string>();

  for (const token of queryTokens) {
    const tokenRow = await db.getFirstAsync<{ itemIds: string }>(
      'SELECT itemIds FROM search_tokens WHERE tokenPrefix = ?',
      [token],
    );
    if (tokenRow) {
      const ids = parseJSON<string[]>(tokenRow.itemIds) || [];
      for (const id of ids) {
        candidateIds.add(id);
        if (candidateIds.size >= CANDIDATE_CAP) break;
      }
    }
    if (candidateIds.size >= CANDIDATE_CAP) break;
  }

  if (candidateIds.size === 0) {
    const suggestions = await generateSuggestions();
    return { addresses: [], streets: [], places: [], admins: [], totalCount: 0, emptyReason: 'no_results', suggestions };
  }

  // Fetch items in batches (SQLite max vars ~999)
  const idArray = Array.from(candidateIds);
  const filterPackSet = filterByPacks ? new Set(filterByPacks) : null;
  const filterTypeSet = filterByTypes ? new Set(filterByTypes) : null;
  const candidates: SearchCandidate[] = [];

  const BATCH = 200;
  for (let i = 0; i < idArray.length; i += BATCH) {
    const batch = idArray.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    const rows = await db.getAllAsync<SearchItem & { extra?: string }>(
      `SELECT * FROM search_items WHERE itemId IN (${placeholders})`,
      batch,
    );
    for (const row of rows) {
      if (filterPackSet && row.packId && !filterPackSet.has(row.packId)) continue;
      if (filterTypeSet && !filterTypeSet.has(row.type as SearchItemType)) continue;
      candidates.push(dbItemToCandidate(row));
    }
  }

  if (candidates.length === 0 && candidateIds.size > 0) {
    return {
      addresses: [],
      streets: [],
      places: [],
      admins: [],
      totalCount: 0,
      emptyReason: 'filtered_out',
      suggestions: ['Try removing filters to see more results'],
    };
  }

  // Phase B: delegate ranking & grouping to @janpams/core
  const grouped = rankAndGroupSearchResults(candidates, context);

  if (grouped.totalCount === 0) {
    const suggestions = await generateSuggestions();
    return { ...grouped, emptyReason: 'no_results', suggestions };
  }

  return grouped;
}

/**
 * Get recently updated search items (for empty-query state).
 */
export async function getRecentSearches(limit: number = 5): Promise<SearchCandidate[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<SearchItem & { extra?: string }>(
    'SELECT * FROM search_items ORDER BY updatedAt DESC LIMIT ?',
    [limit],
  );
  return rows.map(dbItemToCandidate);
}
