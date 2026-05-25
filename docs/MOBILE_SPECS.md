# Mobile Application - Technical Specifications

**Version:** 1.0  
**Date:** 2025-01-21  
**Target:** Expo SDK 52+ with Dev Client

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo React Native)               │
├─────────────────────────────────────────────────────────────────┤
│  Screens          │  Components       │  Navigation             │
│  - MapScreen      │  - AddressCard    │  - Stack Navigator      │
│  - CreateAddress  │  - GPSIndicator   │  - Tab Navigator        │
│  - AddressList    │  - StreetPicker   │  - Deep Link Handler    │
│  - Profile        │  - PhotoCapture   │                         │
│  - VerifyCapture  │  - SyncBadge      │                         │
├─────────────────────────────────────────────────────────────────┤
│                         SHARED LOGIC LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  @janpams/core    │  @janpams/types   │  Platform Adapters      │
│  - pluscode/*     │  - Address        │  - SQLiteAdapter        │
│  - address/*      │  - Location       │  - LocationAdapter      │
│  - geolocation/*  │  - Offline        │  - CameraAdapter        │
│  (pure TS logic)  │  (interfaces)     │  (expo-* wrappers)      │
├─────────────────────────────────────────────────────────────────┤
│                         NATIVE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  expo-location    │  expo-sqlite      │  expo-camera            │
│  expo-file-system │  expo-secure-store│  react-native-maps      │
│  expo-background  │  expo-notifications│  expo-image-picker     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Lovable Cloud)                       │
│  - Supabase Auth  - Cloud Storage  - Edge Functions             │
│  - Database       - Realtime       - Same as Web                │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Package Dependencies

```json
{
  "dependencies": {
    // Shared from monorepo (must be built for RN)
    "@janpams/types": "workspace:*",
    "@janpams/core": "workspace:*",
    
    // Expo SDK
    "expo": "~52.0.0",
    "expo-location": "~17.0.0",
    "expo-camera": "~15.0.0",
    "expo-sqlite": "~14.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-file-system": "~17.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-background-fetch": "~12.0.0",
    "expo-task-manager": "~12.0.0",
    
    // Navigation
    "@react-navigation/native": "^6.0.0",
    "@react-navigation/native-stack": "^6.0.0",
    "@react-navigation/bottom-tabs": "^6.0.0",
    
    // Maps
    "react-native-maps": "^1.8.0",
    
    // State & Data
    "@supabase/supabase-js": "^2.90.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.0.0",
    
    // UI
    "react-native-safe-area-context": "^4.0.0",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-reanimated": "~3.6.0"
  }
}
```

---

## 2. Shared Logic Integration

### 2.1 Direct Imports (No Changes Needed)

These packages are pure TypeScript and work in React Native:

```typescript
// Types - direct import
import type { Address, Street, AddressData } from '@janpams/types';
import type { GeoPosition, TrustLevel, LocationCapture } from '@janpams/types';

// Plus Code - pure math, no DOM
import { encode, decode, getGridBounds, getNeighborGrids } from '@janpams/core/pluscode';

// Address algorithms - pure TypeScript
import { 
  formatAddress, 
  calculateHouseNumber,
  getSideOfStreet 
} from '@janpams/core/address';
```

### 2.2 Adapter Pattern (Platform Replacement)

Create adapters that implement the same interface but use native APIs:

```typescript
// src/adapters/LocationAdapter.ts
import * as Location from 'expo-location';
import type { GeoPosition, TrustLevel } from '@janpams/types';
import { GEOLOCATION_THRESHOLDS } from '@janpams/core/geolocation';

export async function getCurrentPosition(): Promise<GeoPosition> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }
  
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
  
  return {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    timestamp: location.timestamp,
  };
}

export function determineTrustLevel(accuracy: number): TrustLevel {
  // Use shared thresholds from @janpams/core
  if (accuracy <= GEOLOCATION_THRESHOLDS.L1_ACCURACY_MOBILE) return 'L1';
  if (accuracy <= GEOLOCATION_THRESHOLDS.L2_ACCURACY_MOBILE) return 'L2';
  return 'FAIL';
}
```

### 2.3 Storage Adapter (SQLite)

Replace IndexedDB with expo-sqlite while maintaining the same schema:

```typescript
// src/adapters/SQLiteAdapter.ts
import * as SQLite from 'expo-sqlite';
import type { Address, SyncQueueItem, StreetSegment } from '@janpams/types';

const db = SQLite.openDatabaseSync('janpams.db');

export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL,
      house_number INTEGER,
      street_name TEXT,
      neighborhood TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      plus_code TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      data JSON
    );
    
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT,
      data JSON,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS street_segments (
      id TEXT PRIMARY KEY,
      name TEXT,
      geometry JSON,
      bbox JSON,
      region_id TEXT,
      cached_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_addresses_plus_code ON addresses(plus_code);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);
}

export async function saveAddress(address: Address): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO addresses 
     (id, local_id, house_number, street_name, latitude, longitude, plus_code, sync_status, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      address.id,
      address.local_id,
      address.house_number,
      address.street_name,
      address.latitude,
      address.longitude,
      address.plus_code,
      address.sync_status,
      JSON.stringify(address),
    ]
  );
}
```

---

## 3. Screen Specifications

### 3.1 MapScreen (Home)

**Purpose:** Primary navigation and address discovery

```typescript
// src/screens/MapScreen.tsx
interface MapScreenState {
  region: Region;
  userLocation: GeoPosition | null;
  showPlusCodeGrid: boolean;
  selectedAddress: Address | null;
  nearbyStreets: Street[];
}

// Features:
// - Full-screen map with user location
// - Plus Code grid overlay at zoom > 17
// - Bottom sheet with selected address
// - FAB for "Create Address" action
// - Nearby streets highlighting
```

**Key Components:**
- `MapView` (react-native-maps)
- `PlusCodeGridOverlay` (custom component)
- `BottomSheet` (address details)
- `GPSStatusIndicator` (top bar)

### 3.2 CreateAddressScreen

**Purpose:** Full address creation flow

```typescript
// src/screens/CreateAddressScreen.tsx
interface CreateAddressFlow {
  step: 'location' | 'details' | 'photo' | 'confirm';
  location: GeoPosition;
  plusCode: string;
  addressData: AddressData;
  photo: ImageResult | null;
  createUploadLink: boolean;
}

// Step 1: Location Capture
// - Show GPS accuracy indicator
// - "Capture Location" button
// - Manual map adjustment option

// Step 2: Address Details
// - Auto-filled street name (editable)
// - Auto-filled house number
// - Property type selector
// - Connection type selector

// Step 3: Photo Capture
// - Camera preview
// - "Create Upload Link" checkbox option
// - GPS metadata embedding

// Step 4: Confirmation
// - Summary card
// - "Save Address" button
// - Offline indicator if applicable
```

### 3.3 VerifyCaptureScreen (Deep Link)

**Purpose:** Handle `/verify/:token` deep links for image verification

```typescript
// src/screens/VerifyCaptureScreen.tsx
interface VerifyCaptureProps {
  token: string; // From deep link
}

// Flow:
// 1. Validate token (API call)
// 2. Request camera + location permissions
// 3. Show camera preview (NO gallery option)
// 4. Capture photo with embedded GPS
// 5. Upload with token
// 6. Show success/failure
```

### 3.4 AddressListScreen

**Purpose:** View and manage saved addresses

```typescript
// src/screens/AddressListScreen.tsx
interface AddressListState {
  addresses: Address[];
  filter: 'all' | 'pending' | 'synced';
  searchQuery: string;
}

// Features:
// - List of user's addresses
// - Sync status badges
// - Search/filter
// - Pull-to-refresh
// - Swipe actions (edit, delete)
```

---

## 4. Offline Data Management

### 4.1 Data Pack Structure

```typescript
// src/offline/DataPackManager.ts
interface DataPack {
  id: string;
  regionCode: string;
  regionName: string;
  version: string;
  streetCount: number;
  boundaryCount: number;
  fileSizeBytes: number;
  downloadedAt?: Date;
}

// Download flow:
// 1. Fetch pack metadata from API
// 2. Download compressed pack (gzip JSON)
// 3. Decompress and parse
// 4. Insert into SQLite in transaction
// 5. Update pack manifest
```

### 4.2 Offline Reverse Geocoding

```typescript
// src/offline/OfflineGeocoder.ts
import { findClosestStreet, getContainingBoundary } from './spatialQueries';
import type { Street, AdminBoundary } from '@janpams/types';

export async function reverseGeocode(lat: number, lon: number): Promise<{
  street: Street | null;
  neighborhood: AdminBoundary | null;
  city: AdminBoundary | null;
  region: AdminBoundary | null;
}> {
  // Use SQLite spatial queries (R-tree or bbox filtering)
  const street = await findClosestStreet(lat, lon, 60); // 60m radius
  const neighborhood = await getContainingBoundary(lat, lon, 'neighborhood');
  const city = await getContainingBoundary(lat, lon, 'city');
  const region = await getContainingBoundary(lat, lon, 'region');
  
  return { street, neighborhood, city, region };
}
```

### 4.3 Sync Queue

```typescript
// src/offline/SyncManager.ts
import NetInfo from '@react-native-community/netinfo';

export class SyncManager {
  private isRunning = false;
  
  async startBackgroundSync(): Promise<void> {
    // Register background task
    await BackgroundFetch.registerTaskAsync('SYNC_ADDRESSES', {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
  
  async processPendingSync(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      this.isRunning = false;
      return;
    }
    
    const pending = await getPendingSyncItems();
    
    for (const item of pending) {
      try {
        await this.processItem(item);
        await markSynced(item.id);
      } catch (error) {
        await incrementAttempts(item.id, error.message);
      }
    }
    
    this.isRunning = false;
  }
}
```

---

## 5. Navigation Structure

### 5.1 Navigation Tree

```
RootNavigator (Stack)
├── AuthStack (Stack)
│   ├── Login
│   ├── Signup
│   └── OTPVerify
│
├── MainTabs (Bottom Tab)
│   ├── MapStack (Stack)
│   │   ├── MapScreen
│   │   ├── CreateAddress
│   │   └── AddressDetail
│   │
│   ├── AddressesStack (Stack)
│   │   ├── AddressList
│   │   └── AddressDetail
│   │
│   ├── DataPacksScreen
│   │
│   └── ProfileStack (Stack)
│       ├── Profile
│       └── Settings
│
└── VerifyCapture (Modal - Deep Link)
```

### 5.2 Deep Linking

```typescript
// app.config.ts
export default {
  expo: {
    scheme: 'janpams',
    android: {
      intentFilters: [
        {
          action: 'VIEW',
          data: [{ scheme: 'https', host: '*.lovable.app', pathPrefix: '/verify' }],
        },
      ],
    },
    ios: {
      associatedDomains: ['applinks:*.lovable.app'],
    },
  },
};

// src/navigation/linking.ts
export const linking = {
  prefixes: ['janpams://', 'https://*.lovable.app'],
  config: {
    screens: {
      VerifyCapture: 'verify/:token',
    },
  },
};
```

---

## 6. State Management

### 6.1 Zustand Stores

```typescript
// src/stores/mapStore.ts
interface MapStore {
  userLocation: GeoPosition | null;
  activeLocation: GeoPosition | null;
  zoom: number;
  showPlusCodeGrid: boolean;
  nearbyStreets: Street[];
  
  setUserLocation: (loc: GeoPosition) => void;
  setActiveLocation: (loc: GeoPosition | null) => void;
  setZoom: (zoom: number) => void;
  togglePlusCodeGrid: () => void;
}

// src/stores/syncStore.ts
interface SyncStore {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  updatePendingCount: () => Promise<void>;
}
```

### 6.2 React Query Integration

```typescript
// src/queries/addresses.ts
export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      // First, get local addresses
      const local = await getLocalAddresses();
      
      // If online, fetch and merge remote
      if (await isOnline()) {
        const remote = await fetchRemoteAddresses();
        return mergeAddresses(local, remote);
      }
      
      return local;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

## 7. Security Specifications

### 7.1 Token Storage

```typescript
// src/auth/SecureStorage.ts
import * as SecureStore from 'expo-secure-store';

export async function storeTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', access, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync('refresh_token', refresh, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
```

### 7.2 SSL Pinning (Optional for Phase 2)

```typescript
// For production, consider using expo-certificate-transparency
// or a bare workflow with native SSL pinning
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Shared logic: Jest (runs in Node)
- Components: React Native Testing Library

### 8.2 E2E Tests

- Detox for full device testing
- Mock GPS locations for consistent tests

### 8.3 Test Coverage Targets

| Area | Target |
|------|--------|
| Shared logic (core) | 90% |
| SQLite adapters | 80% |
| UI components | 70% |
| E2E flows | 5 critical paths |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | JanPAMS Team | Initial version |
