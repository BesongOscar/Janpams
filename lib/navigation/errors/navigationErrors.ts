/**
 * Maps NavigationFailureCode → user-facing metadata for UI display.
 */

import type { NavigationFailureCode } from '@janpams/core/navigation';

export type ErrorSeverity = 'blocking' | 'recoverable' | 'informational';
export type SuggestedAction =
  | 'download_pack'
  | 'switch_profile'
  | 'enable_location'
  | 'retry'
  | 'none';

export interface NavigationErrorMeta {
  i18nKey: string;
  severity: ErrorSeverity;
  suggestedAction: SuggestedAction;
  icon: string;
}

const ERROR_MAP: Record<NavigationFailureCode, NavigationErrorMeta> = {
  PACK_MISSING: {
    i18nKey: '(tabs).navigation.error.packMissing',
    severity: 'blocking',
    suggestedAction: 'download_pack',
    icon: 'download',
  },
  PACK_CORRUPT: {
    i18nKey: '(tabs).navigation.error.packCorrupt',
    severity: 'blocking',
    suggestedAction: 'download_pack',
    icon: 'alert-circle',
  },
  PACK_INCOMPATIBLE: {
    i18nKey: '(tabs).navigation.error.packIncompatible',
    severity: 'blocking',
    suggestedAction: 'download_pack',
    icon: 'update',
  },
  ROUTE_NOT_FOUND: {
    i18nKey: '(tabs).navigation.error.routeNotFound',
    severity: 'recoverable',
    suggestedAction: 'switch_profile',
    icon: 'map-marker-off',
  },
  GPS_UNAVAILABLE: {
    i18nKey: '(tabs).navigation.error.gpsUnavailable',
    severity: 'blocking',
    suggestedAction: 'enable_location',
    icon: 'crosshairs-off',
  },
  ENGINE_INIT_FAILED: {
    i18nKey: '(tabs).navigation.error.engineFailed',
    severity: 'blocking',
    suggestedAction: 'retry',
    icon: 'engine-off',
  },
  TIMEOUT: {
    i18nKey: '(tabs).navigation.error.timeout',
    severity: 'recoverable',
    suggestedAction: 'retry',
    icon: 'timer-off',
  },
  CANCELLED: {
    i18nKey: '',
    severity: 'informational',
    suggestedAction: 'none',
    icon: 'close-circle-outline',
  },
  INVALID_REQUEST: {
    i18nKey: '(tabs).navigation.error.invalidRequest',
    severity: 'informational',
    suggestedAction: 'none',
    icon: 'alert',
  },
  QR_INVALID: {
    i18nKey: '(tabs).navigation.error.qrInvalid',
    severity: 'recoverable',
    suggestedAction: 'none',
    icon: 'qrcode-remove',
  },
  UNKNOWN: {
    i18nKey: '(tabs).navigation.error.unknown',
    severity: 'recoverable',
    suggestedAction: 'retry',
    icon: 'help-circle',
  },
};

export function getNavigationErrorMeta(
  code: NavigationFailureCode,
): NavigationErrorMeta {
  return ERROR_MAP[code] ?? ERROR_MAP.UNKNOWN;
}

const ACTION_I18N_KEY: Record<SuggestedAction, string> = {
  download_pack: '(tabs).navigation.error.downloadPack',
  switch_profile: '(tabs).navigation.error.switchProfile',
  enable_location: '(tabs).navigation.error.enableLocation',
  retry: '(tabs).navigation.error.retry',
  none: '',
};

export function getActionI18nKey(action: SuggestedAction): string {
  return ACTION_I18N_KEY[action] ?? '';
}
