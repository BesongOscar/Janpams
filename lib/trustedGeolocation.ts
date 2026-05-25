/**
 * Trusted Geolocation — spoofing detection and trust scoring.
 * Wraps @janpams/core geolocation thresholds with mobile-specific checks
 * (expo-location mocked flag on Android, speed plausibility, accuracy consistency).
 */

import { calculateTrustLevel, type TrustLevel, type GeoSample } from '@janpams/core/geolocation';
import { Platform } from 'react-native';

export type TrustScore = 'trusted' | 'suspicious' | 'untrusted';

export interface TrustResult {
  score: TrustScore;
  trustLevel: TrustLevel;
  reasons: string[];
}

const MAX_PLAUSIBLE_SPEED_MS = 50; // ~180 km/h
const MAX_ACCURACY_VARIANCE = 80;

export function calculateTrustScore(
  samples: GeoSample[],
  isMocked?: boolean,
): TrustResult {
  const reasons: string[] = [];

  // Check mocked flag (Android only, expo-location surfaces this)
  if (Platform.OS === 'android' && isMocked) {
    return {
      score: 'untrusted',
      trustLevel: 'L5',
      reasons: ['Mock/spoofed location detected'],
    };
  }

  if (samples.length === 0) {
    return { score: 'untrusted', trustLevel: 'L5', reasons: ['No samples'] };
  }

  // Average accuracy trust level
  const avgAccuracy =
    samples.reduce((sum, s) => sum + s.accuracyM, 0) / samples.length;
  const trustLevel = calculateTrustLevel(avgAccuracy);

  // Speed plausibility check between consecutive samples
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const dt = (curr.timestamp - prev.timestamp) / 1000;
    if (dt <= 0) continue;

    const dlat = curr.lat - prev.lat;
    const dlng = curr.lng - prev.lng;
    const distM = Math.sqrt(dlat * dlat + dlng * dlng) * 111_320;
    const speedMs = distM / dt;

    if (speedMs > MAX_PLAUSIBLE_SPEED_MS) {
      reasons.push(`Implausible speed: ${Math.round(speedMs)} m/s between samples`);
    }
  }

  // Accuracy consistency check
  if (samples.length >= 3) {
    const accuracies = samples.map(s => s.accuracyM);
    const maxAcc = Math.max(...accuracies);
    const minAcc = Math.min(...accuracies);
    if (maxAcc - minAcc > MAX_ACCURACY_VARIANCE) {
      reasons.push(`Accuracy variance too high: ${Math.round(maxAcc - minAcc)}m`);
    }
  }

  // Determine overall score
  let score: TrustScore = 'trusted';
  if (reasons.length > 0) score = 'suspicious';
  if (reasons.length >= 2 || trustLevel === 'L5') score = 'untrusted';

  return { score, trustLevel, reasons };
}
