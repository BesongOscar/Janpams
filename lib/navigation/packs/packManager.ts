/**
 * PackManager — resolves and loads offline navigation packs.
 *
 * Maps a NavigationIntent's destination coordinate to the correct regional
 * pack, verifies it's installed and has tiles, then loads it into the engine.
 */

import type {
  PackManager as IPackManager,
  NavigationIntent,
  PackResolutionResult,
  ResolvedPack,
} from '@janpams/core/navigation';
import { getInstalledPacks, getPackState } from '../../japaState';
import {
  hasProdTilesForRegion,
  getTilesArrayBufferForRegion,
} from '../../valhalla/tileStorage';
import { findAdminBoundariesContainingPoint } from '../../db/adminBoundaries';
import type { ValhallaAdapter } from '../engine/valhallaAdapter';

export class MobilePackManager implements IPackManager {
  private loadedRegionCodes = new Set<string>();
  private engine: ValhallaAdapter;

  constructor(engine: ValhallaAdapter) {
    this.engine = engine;
  }

  /**
   * Determine which installed pack (if any) covers the intent's destination.
   *
   * Resolution order:
   * 1. If packHint is provided and that pack is installed with tiles → use it
   * 2. Query admin_boundaries (region level) for the destination coordinate
   * 3. Fall back to first installed pack that has tiles
   * 4. Return MISSING if nothing works
   */
  async resolvePackForIntent(
    intent: NavigationIntent,
  ): Promise<PackResolutionResult> {
    const { lat, lon } = intent.destination;
    const installedPacks = await getInstalledPacks();

    if (installedPacks.length === 0) {
      return {
        status: 'MISSING',
        reason: 'No offline packs installed.',
      };
    }

    const installedIds = new Set(installedPacks.map((p) => p.id));

    // 1. Try packHint first
    if (intent.packHint && installedIds.has(intent.packHint)) {
      const resolved = await this.tryResolvePack(intent.packHint);
      if (resolved) return resolved;
    }

    // 2. Try admin boundary containment (region level)
    try {
      const boundaries = await findAdminBoundariesContainingPoint(lat, lon);
      const regionBounds = boundaries.filter(
        (b) => b.level === 'region' && installedIds.has(b.packId ?? ''),
      );
      for (const bound of regionBounds) {
        if (!bound.packId) continue;
        const resolved = await this.tryResolvePack(bound.packId);
        if (resolved) return resolved;
      }
    } catch {
      // Admin boundary query may fail if table is empty — continue to fallback
    }

    // 3. Fall back to first installed pack with tiles
    for (const pack of installedPacks) {
      const resolved = await this.tryResolvePack(pack.id);
      if (resolved) return resolved;
    }

    return {
      status: 'MISSING',
      reason: 'No installed pack has routing tiles for this destination.',
    };
  }

  /**
   * Ensure the pack's tiles are loaded into the engine.
   * No-op if already loaded.
   */
  async ensurePackLoaded(resolvedPack: ResolvedPack): Promise<void> {
    const regionCode = resolvedPack.packId;
    if (this.loadedRegionCodes.has(regionCode)) return;

    await this.engine.loadPack(regionCode);
    this.loadedRegionCodes.add(regionCode);
  }

  /** Clear the loaded packs set (e.g. on engine re-init). */
  clearLoadedPacks(): void {
    this.loadedRegionCodes.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async tryResolvePack(
    regionCode: string,
  ): Promise<PackResolutionResult | null> {
    const state = await getPackState(regionCode);
    if (state !== 'INSTALLED') return null;

    const hasTiles = await hasProdTilesForRegion(regionCode);
    if (!hasTiles) return null;

    return {
      status: 'RESOLVED',
      packId: regionCode,
      resolvedPack: {
        packId: regionCode,
        packPath: regionCode,
      },
    };
  }
}
