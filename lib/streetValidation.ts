/**
 * Street name validation — re-exported from @janpams/core/streets.
 * Policy-aware, shared with web.
 */

export {
  APPROVED_SUFFIXES,
  isNumericStreetName,
  hasApprovedSuffix,
  detectNamingMode,
  validateStreetName,
  getModeBadge,
  normalizeNeighborhoodName,
  type StreetNamingMode,
  type StreetNameValidation,
} from '@janpams/core/streets';
