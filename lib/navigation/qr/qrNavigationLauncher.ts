/**
 * QR Navigation Launcher
 *
 * Thin adapter that converts QR payloads into NavigationIntents
 * and delegates to NavigationCore.
 */

import type {
  NavigationIntent,
  QrDestinationPayload,
  QrVerificationPayload,
} from '@janpams/core/navigation';
import type { NavigationCore } from '../core';

/**
 * Build and start navigation from a QR destination payload.
 */
export async function launchQrNavigation(
  payload: QrDestinationPayload,
  core: NavigationCore,
): Promise<void> {
  const intent: NavigationIntent = {
    mode: 'QR',
    start: { type: 'MY_LOCATION' },
    destination: {
      lat: payload.lat,
      lon: payload.lon,
      label: payload.label,
      qrId: payload.qr_id,
    },
    routingProfile: 'car',
    packHint: payload.pack_hint,
  };

  await core.start(intent);
}

/**
 * Build and start navigation from a QR verification payload.
 * Includes the verification envelope for downstream signature checking.
 */
export async function launchQrVerificationNavigation(
  payload: QrVerificationPayload,
  core: NavigationCore,
): Promise<void> {
  const intent: NavigationIntent = {
    mode: 'QR',
    start: { type: 'MY_LOCATION' },
    destination: {
      lat: payload.dest.lat,
      lon: payload.dest.lon,
      label: payload.dest.label,
      qrId: payload.dest.qr_id,
    },
    routingProfile: 'car',
    verify: {
      payload: payload.payload,
      sig: payload.sig,
      kid: payload.kid,
    },
  };

  await core.start(intent);
}
