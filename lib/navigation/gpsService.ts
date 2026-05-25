/**
 * GPS Service — accuracy gating, position smoothing, quality classification.
 * Uses expo-location for native position tracking.
 */

import * as Location from 'expo-location';
import type { GPSPosition, GPSQuality, Coords } from '@janpams/core/navigation';

export type { GPSPosition, GPSQuality };

export type GPSCallback = (position: GPSPosition) => void;

const ACCURACY_THRESHOLD = 100; // reject positions worse than 100m
const SMOOTHING_WINDOW = 3;

export class GPSService {
  private subscription: Location.LocationSubscription | null = null;
  private positions: GPSPosition[] = [];
  private callback: GPSCallback | null = null;

  async start(callback: GPSCallback): Promise<void> {
    this.callback = callback;
    this.positions = [];

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 2,
      },
      location => {
        const pos = this.locationToGPSPosition(location);
        if (pos.accuracy > ACCURACY_THRESHOLD) return;

        this.positions.push(pos);
        if (this.positions.length > SMOOTHING_WINDOW) {
          this.positions.shift();
        }

        const smoothed = this.getSmoothedPosition();
        this.callback?.(smoothed);
      },
    );
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.callback = null;
  }

  async getCurrentPosition(): Promise<GPSPosition> {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    return this.locationToGPSPosition(location);
  }

  getQuality(): GPSQuality {
    if (this.positions.length === 0) {
      return { isAccurate: false, level: 'poor' };
    }
    const latest = this.positions[this.positions.length - 1];
    return this.classifyAccuracy(latest.accuracy);
  }

  private classifyAccuracy(accuracy: number): GPSQuality {
    if (accuracy <= 5) return { isAccurate: true, level: 'excellent' };
    if (accuracy <= 15) return { isAccurate: true, level: 'good' };
    if (accuracy <= 30) return { isAccurate: true, level: 'fair' };
    return { isAccurate: false, level: 'poor' };
  }

  private getSmoothedPosition(): GPSPosition {
    if (this.positions.length === 1) return this.positions[0];

    let lat = 0;
    let lon = 0;
    let acc = 0;
    let speed = 0;
    let heading: number | null = null;
    let headingSum = 0;
    let headingCount = 0;

    for (const p of this.positions) {
      lat += p.coords.lat;
      lon += p.coords.lon;
      acc += p.accuracy;
      speed += p.speed ?? 0;
      if (p.heading != null) {
        headingSum += p.heading;
        headingCount++;
      }
    }

    const n = this.positions.length;
    if (headingCount > 0) heading = headingSum / headingCount;

    return {
      coords: { lat: lat / n, lon: lon / n },
      accuracy: acc / n,
      heading,
      speed: speed / n,
      timestamp: this.positions[n - 1].timestamp,
    };
  }

  private locationToGPSPosition(location: Location.LocationObject): GPSPosition {
    return {
      coords: {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      },
      accuracy: location.coords.accuracy ?? 999,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  }
}

export const gpsService = new GPSService();
