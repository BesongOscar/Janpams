/**
 * Geocoding Module
 * 
 * Ported from web's docs/src/lib/geocoding/index.ts
 * Nominatim-compatible offline reverse geocoding
 * with proper admin slot mapping and settlement normalization
 */

export {
  adminLevelToSlot,
  isBetterBoundary,
  findAdminBoundaries,
  getAdminLevelForStorage,
  type AdminSlot,
  type AdminResult,
} from './adminResolver';

export {
  findSettlements,
  getGeoCell,
  getRank,
  getDistanceThreshold,
  calculateScore,
  SETTLEMENT_RANKS,
  DISTANCE_THRESHOLDS,
  type SettlementCandidate,
  type SettlementResult,
  type SettlementResolverOptions,
} from './settlementResolver';

export {
  normalizeLocation,
  detectLocale,
  type NormalizedLocation,
  type NormalizationOptions,
} from './normalization';

export {
  offlineReverseGeocode,
  type OfflineGeocodeResult,
  type OfflineGeocodeOptions,
  type OSMStyleAddress,
  type ConfidenceInfo,
  type ConfidenceMethod,
} from './reverseGeocode';

export {
  getAddressComponents,
  getAddressComponentsSync,
  type AddressComponents,
  type GetAddressComponentsRequest,
} from './getAddressComponents';
