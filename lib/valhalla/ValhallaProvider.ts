/**
 * Valhalla route provider for mobile (Phase 4).
 * Uses @jansoft/mbukanji-valhalla-mobile (native init, loadPack, routeWithManeuvers).
 * Adapts loadTiles(ArrayBuffer) to loadPack(filePath) by writing buffer to a temp file.
 * On Android the native module is not yet linked (JNI Phase 1); init is skipped and routing uses Dijkstra fallback.
 */

import { Platform } from 'react-native';
import {
  createValhallaMobileRouter,
  type ValhallaMobileRouter,
  type RouteRequest,
  type ValhallaRouteResult as PackageRouteResult,
} from '@jansoft/mbukanji-valhalla-mobile';

export interface ValhallaRouteRequest {
  locations: Array<{ lat: number; lon: number }>;
  costing: string;
  directions_type?: string;
  costing_options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ValhallaManeuver {
  type?: string;
  instruction?: string;
  distance?: number;
  duration?: number;
  location?: { lat: number; lon: number };
}

export interface ValhallaRouteResult {
  path: [number, number][];
  distance: number;
  duration?: number;
  maneuvers?: ValhallaManeuver[];
}

/** Optional second argument for loadTiles so the adapter can write a named pack file for loadPack. */
export type LoadTilesOptions = { regionCode?: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class ValhallaProvider {
  private router: ValhallaMobileRouter | null = null;
  private initPromise: Promise<void> | null = null;
  private requestIdCounter = 0;

  async init(_glueUrls?: { wasmUrl: string; jsGlueUrl: string }): Promise<void> {
    if (this.router) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (Platform.OS === 'android') {
        this.initPromise = null;
        return;
      }
      try {
        const r = createValhallaMobileRouter();
        await r.init();
        this.router = r;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isNativeNotLinked = /Native module not linked|JNI bridge|Phase 1/i.test(msg);
        if (!isNativeNotLinked) {
          console.warn('[Valhalla] Init failed (routing will use fallback):', err);
        }
        this.initPromise = null;
        throw err;
      }
      this.initPromise = null;
    })();
    return this.initPromise;
  }

  /**
   * Load tiles from buffer. On mobile we write the buffer to a temp file and call loadPack(path).
   * regionCode is used for the file name when provided (for multiple packs).
   */
  async loadTiles(buffer: ArrayBuffer, options?: LoadTilesOptions): Promise<void> {
    if (!this.router) await this.init();
    if (!this.router) return;

    const regionCode = options?.regionCode ?? `pack_${Date.now()}`;
    const safeRegion = regionCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `valhalla_${safeRegion}.tar`;

    try {
      const FileSystem = await import('expo-file-system');
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) {
        console.warn('[Valhalla] No cache/document directory for pack file');
        return;
      }
      const filePath = `${dir}${fileName}`;
      const base64 = arrayBufferToBase64(buffer);
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await this.router.loadPack(filePath);
    } catch (err) {
      console.warn('[Valhalla] loadTiles/loadPack failed:', err);
      throw err;
    }
  }

  async route(request: ValhallaRouteRequest): Promise<ValhallaRouteResult | null> {
    if (!this.router) await this.init();
    if (!this.router) return null;

    const requestId = `route_${++this.requestIdCounter}_${Date.now()}`;
    const req: RouteRequest = {
      locations: request.locations,
      costing: request.costing ?? 'auto',
      directions_type: 'maneuvers',
      ...(request.costing_options && { costing_options: request.costing_options }),
    };

    try {
      const result: PackageRouteResult | null = await this.router.routeWithManeuvers(requestId, req);
      if (!result) return null;
      return {
        path: result.path,
        distance: result.distance,
        duration: result.duration,
        maneuvers: result.maneuvers,
      };
    } catch (err) {
      console.warn('[Valhalla] route failed:', err);
      return null;
    }
  }

  isReady(): boolean {
    return !!this.router;
  }
}

export const valhallaProvider = new ValhallaProvider();
