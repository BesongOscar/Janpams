/**
 * Search Module Exports
 * 
 * Central export for search functionality
 */

// Normalization & tokenization
export {
  normalizeText,
  expandAliases,
  tokenizeToPrefixes,
  tokenizeWithAliases,
  getQueryTokens,
  isNumericLeading,
} from './searchNormalize';

// Index building & maintenance
export {
  buildPackIndex,
  removePackIndex,
  upsertAddressItem,
  deleteAddressItem,
  validateAndRepair,
  getIndexStats,
} from './searchIndex';

// Query engine (offline search)
export {
  querySearch,
  getRecentSearches,
  type OfflineGroupedResults,
  type SearchQueryContext,
  type SearchResult,
  type GroupedResults,
} from './searchQuery';

// Spatial queries
export {
  haversineDistance,
  distanceToSegment,
  isPointInBbox,
  calculateBbox,
  isPointInPolygon,
  findNearestStreets,
  findContainingBoundaries,
  findStreetsInBbox,
  findBoundariesInBbox,
} from './spatialQueries';
