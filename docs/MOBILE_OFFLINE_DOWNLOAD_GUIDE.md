# Mobile Offline Data Download - Implementation Guide

**Version:** 1.0  
**Date:** 2025-01-28  
**Target:** Expo SDK 52+ / React Native  
**Audience:** Mobile Developers

---

## 1. Overview

This guide provides step-by-step instructions for implementing offline data download functionality in the JanPAMS mobile application. The offline data system enables:

- **Regional Data Packs**: Pre-packaged street segments, admin boundaries, settlements, and POIs
- **POIs**: Points of interest indexed for search and nearest-POI in reverse geocoding
- **Route Caching**: Pre-computed OSRM routes stored in `route_cache` for offline routing
- **JAPA pack lifecycle**: Pack state machine (NOT_INSTALLED → DOWNLOADING → STAGING → VALIDATING → INSTALLING → INSTALLED), staging tables, and cleanup on uninstall
- **Valhalla offline routing**: Optional Valhalla tile storage and routing when tiles are loaded (with fallback to cached routes and Dijkstra on street graph)
- **Navigation UI**: Route directions screen using `getRoute()` (Valhalla → cached route → Dijkstra → fallback), turn-by-turn steps, and "No routing data" / "Manage data packs" when no pack is installed
- **Map Tile Caching**: Offline map tile storage for rendering without network
- **Progressive Download**: Background downloads with progress tracking

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OFFLINE DATA ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │ DataPackManager │───▶│  Download Queue  │───▶│ SQLite Storage │  │
│  └────────┬────────┘    └──────────────────┘    └────────────────┘  │
│           │                                                           │
│           ▼                                                           │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  Pack Manifest  │    │  Progress State  │    │  expo-sqlite   │  │
│  │  (API/Cache)    │    │  (Zustand Store) │    │  Database      │  │
│  └─────────────────┘    └──────────────────┘    └────────────────┘  │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                         DATA STORES                                   │
├─────────────────────────────────────────────────────────────────────┤
│  street_segments  │  admin_boundaries  │  pois  │  route_cache      │
│  (geometries)     │  (neighborhoods)   │  (POI) │  (OSRM routes)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dependencies

Add to your `package.json`:

```json
{
  "dependencies": {
    "expo-sqlite": "~14.0.0",
    "expo-file-system": "~17.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "@supabase/supabase-js": "^2.90.0",
    "pako": "^2.1.0"
  },
  "devDependencies": {
    "@types/pako": "^2.0.0"
  }
}
```

---

## 4. SQLite Schema

### 4.1 Initialize Database

```typescript
// src/adapters/SQLiteAdapter.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('janpams.db');

export async function initOfflineSchema(): Promise<void> {
  await db.execAsync(`
    -- Data pack manifest (tracks downloaded regions)
    CREATE TABLE IF NOT EXISTS data_pack_manifest (
      region_code TEXT PRIMARY KEY,
      region_name TEXT NOT NULL,
      country_code TEXT DEFAULT 'CM',
      version TEXT NOT NULL,
      downloaded_at TEXT NOT NULL,
      file_size_bytes INTEGER,
      street_count INTEGER,
      boundary_count INTEGER,
      poi_count INTEGER,
      route_count INTEGER
    );

    -- Street segments (geometries for geocoding/routing)
    CREATE TABLE IF NOT EXISTS street_segments (
      id TEXT PRIMARY KEY,
      name TEXT,
      name_en TEXT,
      street_type TEXT,
      geometry TEXT NOT NULL,  -- JSON array of [lon, lat] pairs
      bbox TEXT NOT NULL,      -- JSON: {minLat, maxLat, minLon, maxLon}
      region_code TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- Admin boundaries (neighborhoods, cities, regions)
    CREATE TABLE IF NOT EXISTS admin_boundaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      admin_level INTEGER NOT NULL,
      boundary_type TEXT,
      geometry TEXT,           -- JSON GeoJSON polygon (optional for large boundaries)
      centroid_lat REAL,
      centroid_lon REAL,
      bbox TEXT NOT NULL,
      region_code TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- Settlement places (villages, towns)
    CREATE TABLE IF NOT EXISTS settlement_places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      place_type TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      population INTEGER,
      region_code TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- POIs (landmarks for Location Plans)
    CREATE TABLE IF NOT EXISTS pois (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      tier INTEGER DEFAULT 2,
      region_code TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- Pre-computed OSRM routes
    CREATE TABLE IF NOT EXISTS route_cache (
      id TEXT PRIMARY KEY,
      start_coord TEXT NOT NULL,  -- "lon,lat"
      end_coord TEXT NOT NULL,    -- "lon,lat"
      path TEXT NOT NULL,         -- JSON array of [lon, lat] pairs
      distance REAL NOT NULL,
      quality INTEGER DEFAULT 1,
      source TEXT DEFAULT 'osrm',
      region_code TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- Indexes for spatial queries
    CREATE INDEX IF NOT EXISTS idx_streets_region ON street_segments(region_code);
    CREATE INDEX IF NOT EXISTS idx_streets_bbox ON street_segments(bbox);
    CREATE INDEX IF NOT EXISTS idx_boundaries_region ON admin_boundaries(region_code);
    CREATE INDEX IF NOT EXISTS idx_boundaries_level ON admin_boundaries(admin_level);
    CREATE INDEX IF NOT EXISTS idx_pois_region ON pois(region_code);
    CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);
    CREATE INDEX IF NOT EXISTS idx_routes_start ON route_cache(start_coord);
    CREATE INDEX IF NOT EXISTS idx_routes_end ON route_cache(end_coord);
  `);
}
```

---

## 5. Data Pack Manager

### 5.1 Core Manager Class

```typescript
// src/offline/DataPackManager.ts
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import pako from 'pako';

export interface DataPack {
  regionCode: string;
  regionName: string;
  countryCode: string;
  version: string;
  fileSizeBytes: number;
  streetCount: number;
  boundaryCount: number;
  poiCount: number;
  routeCount: number;
  downloadUrl: string;
}

export interface DownloadProgress {
  regionCode: string;
  phase: 'downloading' | 'decompressing' | 'inserting' | 'complete' | 'error';
  progress: number; // 0-100
  bytesDownloaded?: number;
  totalBytes?: number;
  error?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

const db = SQLite.openDatabaseSync('janpams.db');
const STORAGE_BUCKET_URL = 'https://wlccinbcrddscduaohue.supabase.co/storage/v1/object/public/offline-data-packs';

export class DataPackManager {
  private downloadTasks: Map<string, FileSystem.DownloadResumable> = new Map();

  /**
   * Fetch available data packs from the API
   */
  async getAvailablePacks(): Promise<DataPack[]> {
    const response = await fetch(
      `https://wlccinbcrddscduaohue.supabase.co/rest/v1/data_packs?select=*`,
      {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch data packs');
    }
    
    const packs = await response.json();
    return packs.map((p: any) => ({
      regionCode: p.region_code,
      regionName: p.region_name,
      countryCode: p.country_code,
      version: p.version,
      fileSizeBytes: p.file_size_bytes,
      streetCount: p.street_count,
      boundaryCount: p.admin_boundary_count,
      poiCount: p.poi_count || 0,
      routeCount: p.route_count || 0,
      downloadUrl: `${STORAGE_BUCKET_URL}/${p.file_path}`,
    }));
  }

  /**
   * Get downloaded packs from local database
   */
  async getDownloadedPacks(): Promise<DataPack[]> {
    const result = db.getAllSync<any>(
      'SELECT * FROM data_pack_manifest'
    );
    
    return result.map((row) => ({
      regionCode: row.region_code,
      regionName: row.region_name,
      countryCode: row.country_code,
      version: row.version,
      fileSizeBytes: row.file_size_bytes,
      streetCount: row.street_count,
      boundaryCount: row.boundary_count,
      poiCount: row.poi_count,
      routeCount: row.route_count,
      downloadUrl: '',
    }));
  }

  /**
   * Check if a region is downloaded
   */
  async isRegionDownloaded(regionCode: string): Promise<boolean> {
    const result = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM data_pack_manifest WHERE region_code = ?',
      [regionCode]
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Download a data pack with progress tracking
   */
  async downloadPack(
    pack: DataPack,
    onProgress: ProgressCallback
  ): Promise<void> {
    const { regionCode, downloadUrl } = pack;
    
    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      throw new Error('No network connection');
    }
    
    try {
      // Phase 1: Download
      onProgress({ 
        regionCode, 
        phase: 'downloading', 
        progress: 0 
      });
      
      const tempPath = `${FileSystem.cacheDirectory}${regionCode}.json.gz`;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        tempPath,
        {},
        (downloadProgress) => {
          const percent = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
          onProgress({
            regionCode,
            phase: 'downloading',
            progress: Math.round(percent * 0.5), // 0-50% for download
            bytesDownloaded: downloadProgress.totalBytesWritten,
            totalBytes: downloadProgress.totalBytesExpectedToWrite,
          });
        }
      );
      
      this.downloadTasks.set(regionCode, downloadResumable);
      
      const result = await downloadResumable.downloadAsync();
      if (!result) {
        throw new Error('Download cancelled');
      }
      
      // Phase 2: Decompress
      onProgress({
        regionCode,
        phase: 'decompressing',
        progress: 55,
      });
      
      const compressedData = await FileSystem.readAsStringAsync(tempPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const compressedBytes = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
      const decompressedBytes = pako.ungzip(compressedBytes);
      const jsonString = new TextDecoder().decode(decompressedBytes);
      const packData = JSON.parse(jsonString);
      
      // Phase 3: Insert into database
      onProgress({
        regionCode,
        phase: 'inserting',
        progress: 60,
      });
      
      await this.insertPackData(regionCode, packData, (insertProgress) => {
        onProgress({
          regionCode,
          phase: 'inserting',
          progress: 60 + Math.round(insertProgress * 0.35), // 60-95%
        });
      });
      
      // Phase 4: Update manifest
      await this.updateManifest(pack);
      
      // Cleanup temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      
      // Complete
      onProgress({
        regionCode,
        phase: 'complete',
        progress: 100,
      });
      
    } catch (error) {
      onProgress({
        regionCode,
        phase: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Download failed',
      });
      throw error;
    } finally {
      this.downloadTasks.delete(regionCode);
    }
  }

  /**
   * Cancel an in-progress download
   */
  async cancelDownload(regionCode: string): Promise<void> {
    const task = this.downloadTasks.get(regionCode);
    if (task) {
      await task.pauseAsync();
      this.downloadTasks.delete(regionCode);
    }
  }

  /**
   * Delete a downloaded pack
   */
  async deletePack(regionCode: string): Promise<void> {
    await db.execAsync(`
      DELETE FROM street_segments WHERE region_code = '${regionCode}';
      DELETE FROM admin_boundaries WHERE region_code = '${regionCode}';
      DELETE FROM settlement_places WHERE region_code = '${regionCode}';
      DELETE FROM pois WHERE region_code = '${regionCode}';
      DELETE FROM route_cache WHERE region_code = '${regionCode}';
      DELETE FROM data_pack_manifest WHERE region_code = '${regionCode}';
    `);
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    await db.execAsync(`
      DELETE FROM street_segments;
      DELETE FROM admin_boundaries;
      DELETE FROM settlement_places;
      DELETE FROM pois;
      DELETE FROM route_cache;
      DELETE FROM data_pack_manifest;
    `);
  }

  // Private helpers

  private async insertPackData(
    regionCode: string,
    data: any,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    let processed = 0;
    const total = 
      (data.streets?.length || 0) +
      (data.admin_boundaries?.length || 0) +
      (data.settlement_places?.length || 0) +
      (data.pois?.length || 0) +
      (data.routes?.length || 0);
    
    const updateProgress = () => {
      processed++;
      if (processed % 100 === 0) {
        onProgress(processed / total);
      }
    };

    // Insert streets in batches
    if (data.streets?.length) {
      await this.batchInsert(
        'street_segments',
        data.streets,
        (street: any) => ({
          id: street.id,
          name: street.name,
          name_en: street.name_en,
          street_type: street.street_type,
          geometry: JSON.stringify(street.geometry),
          bbox: JSON.stringify(street.bbox),
          region_code: regionCode,
          cached_at: timestamp,
        }),
        updateProgress
      );
    }

    // Insert admin boundaries
    if (data.admin_boundaries?.length) {
      await this.batchInsert(
        'admin_boundaries',
        data.admin_boundaries,
        (boundary: any) => ({
          id: boundary.id,
          name: boundary.name,
          admin_level: boundary.admin_level,
          boundary_type: boundary.boundary_type,
          geometry: boundary.geometry ? JSON.stringify(boundary.geometry) : null,
          centroid_lat: boundary.centroid?.lat,
          centroid_lon: boundary.centroid?.lon,
          bbox: JSON.stringify(boundary.bbox),
          region_code: regionCode,
          cached_at: timestamp,
        }),
        updateProgress
      );
    }

    // Insert settlement places
    if (data.settlement_places?.length) {
      await this.batchInsert(
        'settlement_places',
        data.settlement_places,
        (place: any) => ({
          id: place.id,
          name: place.name,
          place_type: place.place_type,
          lat: place.lat,
          lon: place.lon,
          population: place.population,
          region_code: regionCode,
          cached_at: timestamp,
        }),
        updateProgress
      );
    }

    // Insert POIs
    if (data.pois?.length) {
      await this.batchInsert(
        'pois',
        data.pois,
        (poi: any) => ({
          id: poi.id,
          name: poi.name,
          category: poi.category,
          subcategory: poi.subcategory,
          lat: poi.lat,
          lon: poi.lon,
          tier: poi.tier,
          region_code: regionCode,
          cached_at: timestamp,
        }),
        updateProgress
      );
    }

    // Insert pre-computed routes
    if (data.routes?.length) {
      await this.batchInsert(
        'route_cache',
        data.routes,
        (route: any) => ({
          id: route.id || `${route.start_coord}-${route.end_coord}`,
          start_coord: route.start_coord,
          end_coord: route.end_coord,
          path: JSON.stringify(route.path),
          distance: route.distance,
          quality: route.quality || 1,
          source: route.source || 'osrm',
          region_code: regionCode,
          cached_at: timestamp,
        }),
        updateProgress
      );
    }

    onProgress(1);
  }

  private async batchInsert(
    table: string,
    items: any[],
    transform: (item: any) => Record<string, any>,
    onItemProcessed: () => void,
    batchSize: number = 100
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const values: any[] = [];
      const placeholders: string[] = [];
      
      for (const item of batch) {
        const transformed = transform(item);
        const keys = Object.keys(transformed);
        const vals = Object.values(transformed);
        
        if (i === 0 && placeholders.length === 0) {
          // First batch - determine structure
          const colPlaceholder = `(${keys.map(() => '?').join(', ')})`;
          placeholders.push(colPlaceholder);
        }
        
        values.push(...vals);
        onItemProcessed();
      }
      
      // Build INSERT statement
      const sample = transform(batch[0]);
      const columns = Object.keys(sample).join(', ');
      const placeholder = `(${Object.keys(sample).map(() => '?').join(', ')})`;
      const allPlaceholders = batch.map(() => placeholder).join(', ');
      
      const sql = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES ${allPlaceholders}`;
      await db.runAsync(sql, values);
    }
  }

  private async updateManifest(pack: DataPack): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO data_pack_manifest 
       (region_code, region_name, country_code, version, downloaded_at, 
        file_size_bytes, street_count, boundary_count, poi_count, route_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pack.regionCode,
        pack.regionName,
        pack.countryCode,
        pack.version,
        new Date().toISOString(),
        pack.fileSizeBytes,
        pack.streetCount,
        pack.boundaryCount,
        pack.poiCount,
        pack.routeCount,
      ]
    );
  }
}

// Export singleton
export const dataPackManager = new DataPackManager();
```

---

## 6. Download Progress Store

### 6.1 Zustand Store

```typescript
// src/stores/downloadStore.ts
import { create } from 'zustand';
import { DataPack, DownloadProgress, dataPackManager } from '../offline/DataPackManager';

interface DownloadStore {
  // Available packs from API
  availablePacks: DataPack[];
  // Downloaded packs
  downloadedPacks: DataPack[];
  // Active download progress
  activeDownloads: Map<string, DownloadProgress>;
  // Loading states
  isLoadingPacks: boolean;
  
  // Actions
  loadPacks: () => Promise<void>;
  downloadPack: (pack: DataPack) => Promise<void>;
  cancelDownload: (regionCode: string) => void;
  deletePack: (regionCode: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  availablePacks: [],
  downloadedPacks: [],
  activeDownloads: new Map(),
  isLoadingPacks: false,

  loadPacks: async () => {
    set({ isLoadingPacks: true });
    try {
      const [available, downloaded] = await Promise.all([
        dataPackManager.getAvailablePacks(),
        dataPackManager.getDownloadedPacks(),
      ]);
      set({ availablePacks: available, downloadedPacks: downloaded });
    } finally {
      set({ isLoadingPacks: false });
    }
  },

  downloadPack: async (pack: DataPack) => {
    const updateProgress = (progress: DownloadProgress) => {
      set((state) => {
        const newMap = new Map(state.activeDownloads);
        if (progress.phase === 'complete') {
          newMap.delete(pack.regionCode);
        } else {
          newMap.set(pack.regionCode, progress);
        }
        return { activeDownloads: newMap };
      });
    };

    try {
      await dataPackManager.downloadPack(pack, updateProgress);
      // Refresh downloaded packs list
      const downloaded = await dataPackManager.getDownloadedPacks();
      set({ downloadedPacks: downloaded });
    } catch (error) {
      console.log('Download failed:', error);
    }
  },

  cancelDownload: async (regionCode: string) => {
    await dataPackManager.cancelDownload(regionCode);
    set((state) => {
      const newMap = new Map(state.activeDownloads);
      newMap.delete(regionCode);
      return { activeDownloads: newMap };
    });
  },

  deletePack: async (regionCode: string) => {
    await dataPackManager.deletePack(regionCode);
    const downloaded = await dataPackManager.getDownloadedPacks();
    set({ downloadedPacks: downloaded });
  },

  clearAllData: async () => {
    await dataPackManager.clearAllData();
    set({ downloadedPacks: [] });
  },
}));
```

---

## 7. UI Components

### 7.1 Data Packs Screen

```typescript
// src/screens/DataPacksScreen.tsx
import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useDownloadStore } from '../stores/downloadStore';
import { DataPackCard } from '../components/DataPackCard';
import { DownloadProgressBar } from '../components/DownloadProgressBar';

export function DataPacksScreen() {
  const { 
    availablePacks, 
    downloadedPacks, 
    activeDownloads,
    isLoadingPacks,
    loadPacks,
    downloadPack,
    cancelDownload,
    deletePack,
  } = useDownloadStore();

  useEffect(() => {
    loadPacks();
  }, []);

  const downloadedCodes = new Set(downloadedPacks.map(p => p.regionCode));

  if (isLoadingPacks) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading available regions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Data Packs</Text>
      
      <FlatList
        data={availablePacks}
        keyExtractor={(item) => item.regionCode}
        renderItem={({ item }) => {
          const isDownloaded = downloadedCodes.has(item.regionCode);
          const activeProgress = activeDownloads.get(item.regionCode);
          
          return (
            <View style={styles.packContainer}>
              <DataPackCard
                pack={item}
                isDownloaded={isDownloaded}
                onDownload={() => downloadPack(item)}
                onDelete={() => deletePack(item.regionCode)}
                disabled={!!activeProgress}
              />
              
              {activeProgress && (
                <DownloadProgressBar
                  progress={activeProgress}
                  onCancel={() => cancelDownload(item.regionCode)}
                />
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 16 },
  loadingText: { marginTop: 12, color: '#666' },
  list: { padding: 16 },
  packContainer: { marginBottom: 12 },
});
```

### 7.2 Data Pack Card

```typescript
// src/components/DataPackCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DataPack } from '../offline/DataPackManager';

interface Props {
  pack: DataPack;
  isDownloaded: boolean;
  onDownload: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function DataPackCard({ pack, isDownloaded, onDownload, onDelete, disabled }: Props) {
  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.regionFlag}>
          <Text style={styles.countryCode}>{pack.countryCode}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.regionName}>{pack.regionName}</Text>
          <Text style={styles.stats}>
            {pack.streetCount.toLocaleString()} streets • {formatSize(pack.fileSizeBytes)}
          </Text>
        </View>
      </View>
      
      {isDownloaded ? (
        <View style={styles.downloadedRow}>
          <View style={styles.downloadedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={styles.downloadedText}>Downloaded</Text>
          </View>
          <TouchableOpacity 
            onPress={onDelete} 
            style={styles.deleteButton}
            disabled={disabled}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          onPress={onDownload} 
          style={[styles.downloadButton, disabled && styles.buttonDisabled]}
          disabled={disabled}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.downloadButtonText}>Download</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: { flexDirection: 'row', marginBottom: 12 },
  regionFlag: {
    width: 48,
    height: 48,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  countryCode: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  info: { flex: 1 },
  regionName: { fontSize: 18, fontWeight: '600', color: '#111' },
  stats: { fontSize: 13, color: '#666', marginTop: 4 },
  downloadedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  downloadedBadge: { flexDirection: 'row', alignItems: 'center' },
  downloadedText: { marginLeft: 6, color: '#22c55e', fontWeight: '500' },
  deleteButton: { padding: 8 },
  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  downloadButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
});
```

### 7.3 Download Progress Bar

```typescript
// src/components/DownloadProgressBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DownloadProgress } from '../offline/DataPackManager';

interface Props {
  progress: DownloadProgress;
  onCancel: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  downloading: 'Downloading...',
  decompressing: 'Decompressing...',
  inserting: 'Saving to database...',
  complete: 'Complete!',
  error: 'Error',
};

export function DownloadProgressBar({ progress, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.phaseLabel}>{PHASE_LABELS[progress.phase]}</Text>
        {progress.phase !== 'error' && progress.phase !== 'complete' && (
          <TouchableOpacity onPress={onCancel}>
            <Ionicons name="close-circle" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.progressTrack}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${progress.progress}%` },
            progress.phase === 'error' && styles.errorFill,
          ]} 
        />
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.percentText}>{progress.progress}%</Text>
        {progress.bytesDownloaded && progress.totalBytes && (
          <Text style={styles.bytesText}>
            {(progress.bytesDownloaded / (1024 * 1024)).toFixed(1)} / 
            {(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB
          </Text>
        )}
      </View>
      
      {progress.error && (
        <Text style={styles.errorText}>{progress.error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  progressTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  errorFill: { backgroundColor: '#ef4444' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  percentText: { fontSize: 12, color: '#6b7280' },
  bytesText: { fontSize: 12, color: '#6b7280' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 8 },
});
```

---

## 8. Offline Queries

### 8.1 Spatial Queries

```typescript
// src/offline/spatialQueries.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('janpams.db');

/**
 * Find the closest street to a point within a search radius
 */
export async function findClosestStreet(
  lat: number,
  lon: number,
  radiusMeters: number = 60
): Promise<any | null> {
  // Convert radius to approximate degree offset
  const latDelta = radiusMeters / 111320;
  const lonDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  
  const bboxFilter = JSON.stringify({
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  });
  
  // Get candidate streets
  const candidates = db.getAllSync<any>(
    `SELECT * FROM street_segments 
     WHERE json_extract(bbox, '$.minLat') <= ? 
       AND json_extract(bbox, '$.maxLat') >= ?
       AND json_extract(bbox, '$.minLon') <= ?
       AND json_extract(bbox, '$.maxLon') >= ?`,
    [lat + latDelta, lat - latDelta, lon + lonDelta, lon - lonDelta]
  );
  
  if (candidates.length === 0) return null;
  
  // Find the closest one
  let closestStreet = null;
  let minDistance = Infinity;
  
  for (const street of candidates) {
    const geometry = JSON.parse(street.geometry);
    
    for (let i = 0; i < geometry.length - 1; i++) {
      const [lon1, lat1] = geometry[i];
      const [lon2, lat2] = geometry[i + 1];
      
      const dist = pointToSegmentDistance(lat, lon, lat1, lon1, lat2, lon2);
      
      if (dist < minDistance) {
        minDistance = dist;
        closestStreet = { ...street, geometry, distance: dist };
      }
    }
  }
  
  return closestStreet;
}

/**
 * Get admin boundary containing a point at a specific level
 */
export async function getContainingBoundary(
  lat: number,
  lon: number,
  level: 'neighborhood' | 'city' | 'region'
): Promise<any | null> {
  const adminLevel = level === 'neighborhood' ? 9 : level === 'city' ? 6 : 4;
  
  const candidates = db.getAllSync<any>(
    `SELECT * FROM admin_boundaries 
     WHERE admin_level = ?
       AND json_extract(bbox, '$.minLat') <= ? 
       AND json_extract(bbox, '$.maxLat') >= ?
       AND json_extract(bbox, '$.minLon') <= ?
       AND json_extract(bbox, '$.maxLon') >= ?`,
    [adminLevel, lat, lat, lon, lon]
  );
  
  // For precise containment, would need point-in-polygon test
  // For now, return closest centroid
  if (candidates.length === 0) return null;
  
  let closest = candidates[0];
  let minDist = Infinity;
  
  for (const boundary of candidates) {
    const dist = haversineDistance(
      lat, lon, 
      boundary.centroid_lat, 
      boundary.centroid_lon
    );
    if (dist < minDist) {
      minDist = dist;
      closest = boundary;
    }
  }
  
  return closest;
}

/**
 * Find cached route between two coordinates
 */
export async function findCachedRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  toleranceMeters: number = 30
): Promise<any | null> {
  const startCoord = `${startLon.toFixed(5)},${startLat.toFixed(5)}`;
  const endCoord = `${endLon.toFixed(5)},${endLat.toFixed(5)}`;
  
  // Try exact match first
  let route = db.getFirstSync<any>(
    `SELECT * FROM route_cache 
     WHERE start_coord = ? AND end_coord = ?`,
    [startCoord, endCoord]
  );
  
  if (route) {
    return {
      ...route,
      path: JSON.parse(route.path),
    };
  }
  
  // Try fuzzy match within tolerance
  const latDelta = toleranceMeters / 111320;
  const lonDelta = toleranceMeters / (111320 * Math.cos(startLat * Math.PI / 180));
  
  const fuzzyMatch = db.getFirstSync<any>(
    `SELECT * FROM route_cache`,
    []
  );
  
  // Note: For production, implement proper spatial indexing
  return null;
}

// Helper functions
function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  
  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((py - y1) * dy + (px - x1) * dx) / lenSq));
  }
  
  const nearestLat = y1 + t * dy;
  const nearestLon = x1 + t * dx;
  
  return haversineDistance(px, py, nearestLat, nearestLon);
}

function haversineDistance(
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

## 9. Integration with Address Creation

### 9.1 Offline Reverse Geocoder

```typescript
// src/offline/OfflineGeocoder.ts
import { findClosestStreet, getContainingBoundary } from './spatialQueries';

export interface OfflineGeocodingResult {
  street: { name: string; id: string } | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
}

export async function offlineReverseGeocode(
  lat: number, 
  lon: number
): Promise<OfflineGeocodingResult> {
  const [street, neighborhood, city, region] = await Promise.all([
    findClosestStreet(lat, lon, 60),
    getContainingBoundary(lat, lon, 'neighborhood'),
    getContainingBoundary(lat, lon, 'city'),
    getContainingBoundary(lat, lon, 'region'),
  ]);
  
  return {
    street: street ? { name: street.name, id: street.id } : null,
    neighborhood: neighborhood?.name || null,
    city: city?.name || null,
    region: region?.name || null,
  };
}
```

---

## 10. Testing

### 10.1 Unit Tests

```typescript
// __tests__/offline/DataPackManager.test.ts
import { dataPackManager } from '../../src/offline/DataPackManager';

describe('DataPackManager', () => {
  beforeEach(async () => {
    await dataPackManager.clearAllData();
  });

  it('should fetch available packs', async () => {
    const packs = await dataPackManager.getAvailablePacks();
    expect(packs.length).toBeGreaterThan(0);
    expect(packs[0]).toHaveProperty('regionCode');
    expect(packs[0]).toHaveProperty('downloadUrl');
  });

  it('should track downloaded packs', async () => {
    const downloaded = await dataPackManager.getDownloadedPacks();
    expect(Array.isArray(downloaded)).toBe(true);
  });

  it('should correctly check if region is downloaded', async () => {
    const isDownloaded = await dataPackManager.isRegionDownloaded('CM-CE');
    expect(typeof isDownloaded).toBe('boolean');
  });
});
```

### 10.2 Manual Testing Checklist

- [ ] Download pack with WiFi connected
- [ ] Verify progress updates display correctly
- [ ] Cancel download mid-progress
- [ ] Resume after app backgrounding (if supported)
- [ ] Create address using offline data
- [ ] Verify street lookup works offline
- [ ] Delete downloaded pack
- [ ] Re-download same pack (update scenario)
- [ ] Clear all offline data

---

## 11. Performance Considerations

### 11.1 Memory Management

- Use batch inserts (100-500 records per batch)
- Release references to large JSON objects after parsing
- Use streaming decompression for very large packs (>50MB)

### 11.2 Storage Estimates

| Region | Streets | Boundaries | POIs | Routes | Total Size |
|--------|---------|------------|------|--------|------------|
| Centre | ~3,500  | ~250       | ~200 | ~400   | ~4.5 MB    |
| Littoral | ~5,000 | ~400     | ~350 | ~600   | ~6.2 MB    |
| Full Country | ~30,000 | ~2,000 | ~2,500 | ~4,000 | ~35 MB |

### 11.3 Background Download

For very large packs, consider implementing background downloads using `expo-background-fetch`:

```typescript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const DOWNLOAD_TASK = 'offline-pack-download';

TaskManager.defineTask(DOWNLOAD_TASK, async () => {
  // Resume pending downloads
  // Return BackgroundFetch.BackgroundFetchResult.NewData if data was fetched
});
```

---

## 12. Offline Web Parity & Routing

### 12.1 Features (aligned with web)

- **POIs**: Stored in `pois` table; included in search index (`buildPackIndex` with `pois`); reverse geocode can return nearest POI via `includePOI` option.
- **Route cache**: `route_cache` table; `cacheRoute` / `cacheRoutesBatch` during pack install; used by `getRoute()` and `generateRoutePath()` as first priority.
- **JAPA lifecycle**: Pack state (e.g. in `japaState` or `data_packs`); staging tables for safe install; cleanup of streets, admins, pois, route_cache, search index on uninstall.
- **Valhalla**: Optional; tile storage and downloader; `ValhallaProvider`; `initValhallaRouting` loads tiles for installed packs; `getRoute()` tries Valhalla when ready, then falls back to `generateRoutePath()` (cached route → Dijkstra → fallback).
- **Navigation**: Route directions screen; destination input; "Get route" calls `getRoute(userLocation, destination)`; polyline and turn-by-turn steps; "No routing data" card with "Manage data packs" linking to OfflineDataManager; OfflineDataManager shows "Routing: Yes" when pack has routing data.

### 12.2 Steps to download a pack and use routing

1. Open **Manage data packs** (OfflineDataManager).
2. Select a region and start download; wait until state is INSTALLED.
3. Search index is built/validated (see OfflineIndicator: "Search index: ready").
4. For **routing**: open the Route directions / Navigation screen, set destination (search or POI), tap "Get route". If the pack includes Valhalla tiles they are used; otherwise cached routes and street-graph Dijkstra are used.
5. If you see "No routing data for this area", install the region data pack for that area.

### 12.3 Out of scope on mobile

- **Location Plan** is not implemented on mobile. Corridor building, saved location plans, PDF export, CreateLocationPlanPage, LocationPlanInfoPanel, and PreviewLocationPlanPage are out of scope for the mobile app.

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-28 | JanPAMS Team | Initial version |
| 1.1 | 2026-02-04 | JanPAMS Team | §12 Offline web parity: POIs, route cache, JAPA, Valhalla, navigation; steps for routing; Location Plan out of scope |
