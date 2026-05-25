
# Complete Addressing & Street Selection System - File Reference + React Native Implementation Guide

## 1. Complete File Reference

### 1.1 Core Addressing Logic Files

| File Path | Purpose | Key Functions |
|-----------|---------|---------------|
| `src/lib/createLocationAddress.ts` | **Main address calculation engine** | `calculateHouseNumberSync()`, `adaptiveProjection()`, `computeChainage()`, `determineSideOfStreet()`, `getActivePlusCodeCentroid()`, `calculateStreetOrientation()` |
| `src/lib/streetSelection.ts` | **Active/Alternate street selection algorithm** | `selectStreets()`, `findInterveningStreets()`, `findStreetIntersection()`, `calculateDistanceScore()`, `calculateEnclosureScore()` |
| `src/lib/streetDirectionService.ts` | **Street direction lock management** | `getDirectionLock()`, `setDirectionLock()`, `autoLockOnFirstAddress()`, `getMergeAnchorFromLock()`, `normalizeStreetKey()` |
| `src/lib/streetGeometry.ts` | **Geometry resolution after direction lock** | `resolveStreetGeometry()`, `createStreetKey()` |
| `src/lib/streetValidation.ts` | Street name validation utilities | Validation helpers |
| `src/lib/pluscode.ts` | Plus Code encoding/decoding | `encode()`, `decode()`, `isSameGridCell()` |
| `src/lib/addressFormat.ts` | Address display formatting | `formatDisplayAddress()`, `formatAddressLinesFromRecord()` |
| `src/lib/addressServices.ts` | Address CRUD operations | Save/load address operations |
| `src/lib/checkLocationAddress.ts` | Check if location has existing address | `checkLocationAddress()` |

### 1.2 Geocoding & Reverse Geocoding Files

| File Path | Purpose | Key Functions |
|-----------|---------|---------------|
| `src/lib/geocoding/reverseGeocode.ts` | **Offline reverse geocoding** | `offlineReverseGeocode()` |
| `src/lib/geocoding/getAddressComponents.ts` | Extract address components | `getAddressComponentsSync()` |
| `src/lib/geocoding/adminResolver.ts` | Admin boundary resolution | Resolve city/region from boundaries |
| `src/lib/geocoding/settlementResolver.ts` | Settlement/neighborhood resolution | Resolve neighborhood/suburb |
| `src/lib/geocoding/normalization.ts` | Address normalization | Text normalization utilities |
| `src/lib/geocoding/index.ts` | Barrel exports | Exports all geocoding functions |

### 1.3 Offline Data Management Files

| File Path | Purpose |
|-----------|---------|
| `src/lib/offlineDataPacks.ts` | Data pack download, street segment merging, `findConnectedStreetSegments()`, `mergeSegmentGeometries()`, `getStreetDisplayName()` |
| `src/lib/cloudDataPacks.ts` | Cloud storage API for data packs |
| `src/lib/db.ts` | IndexedDB schema & CRUD - Contains all type definitions: `Street`, `StreetSegment`, `AdminBoundary`, `SettlementPlace`, `POIRecord`, `StreetDirectionLock` |
| `src/lib/syncManager.ts` | Offline-to-cloud sync queue |

### 1.4 Map Visualization Components

| File Path | Purpose |
|-----------|---------|
| `src/components/map/ActiveStreetLayer.tsx` | Renders active street with marching ants animation, start/end markers, lock status badge |
| `src/components/map/NearbyStreetsLayer.tsx` | Renders alternate/corner streets |
| `src/components/map/SearchHighlightLayer.tsx` | Street search result highlighting |
| `src/components/map/StreetSelectionDebugOverlay.tsx` | Dev mode visualization of selection algorithm |
| `src/components/map/StreetSelectionDebugPanel.tsx` | Debug panel showing candidate scores |
| `src/components/map/GPSLocationLayer.tsx` | GPS marker rendering |
| `src/components/map/NeighborBoxesLayer.tsx` | Plus Code grid neighbor boxes |
| `src/components/map/MapView.tsx` | Main map container |

### 1.5 Street Direction Components

| File Path | Purpose |
|-----------|---------|
| `src/components/street/DirectionOverrideModal.tsx` | Authority override UI for street direction |
| `src/components/street/StreetDirectionInfo.tsx` | Display current direction lock status |
| `src/components/street/index.ts` | Barrel exports |

### 1.6 State Management

| File Path | Purpose |
|-----------|---------|
| `src/store/mapStore.ts` | Global map state: `activeStreetData`, `resolvedStreetGeometry`, `activeStreetDirectionLock`, `nearbyStreets`, `streetSelectionDebug` |
| `src/store/devModeStore.ts` | Developer mode toggles |

### 1.7 Hooks

| File Path | Purpose |
|-----------|---------|
| `src/hooks/useActiveStreet.ts` | Hook for setting active street with geometry resolution and direction lock integration |
| `src/hooks/useAddresses.ts` | Address list management |
| `src/hooks/useAddressModeEntry.ts` | Address mode entry point logic |

### 1.8 Type Definitions

| File Path | Purpose |
|-----------|---------|
| `packages/types/src/address.ts` | Core address interfaces: `Address`, `AddressData`, `Street`, `StreetSegment` |
| `packages/types/src/street.ts` | Street direction lock types: `DirectionState`, `LockedDirection`, `StreetDirectionLock` |
| `packages/types/src/location.ts` | Location/GPS types |
| `packages/types/src/geospatial.ts` | Geospatial types |

### 1.9 Specification Documents

| Document Path | Content |
|---------------|---------|
| `docs/HOUSE_NUMBERING_FORMULA.md` | **Core formula**: `houseNumber = chainageIndex × 2 + (1 if LEFT else 2)` |
| `docs/SPECS_AutoNumbering.md` | Technical specs with implementation status |
| `docs/SPEC_Street_Orientation_Detection.md` | Orientation detection algorithm & adaptive projection |
| `docs/SRD_Street_Direction_Numbering.md` | Street direction policy (OSM default, auto-lock on first address) |
| `docs/IMPL_Active_Alternate_Streets.md` | Access-reality-first street selection algorithm |
| `docs/SRD_SPEC_Active_Alternate_Streets.md` | Detailed alternate street specifications |
| `docs/IMPL_Street_Direction_Policy.md` | Implementation guide for direction locking |
| `docs/RULES_AutoNumbering.md` | Business rules for auto-numbering |
| `docs/SPECS_Non_Street_Facing_AutoNumbering.md` | Compound/non-street-facing property specs |
| `docs/SRD_Non_Street_Facing_AutoNumbering.md` | SRD for compound properties |
| `docs/IMPL_Non_Street_Facing_AutoNumbering.md` | Implementation guide for compounds |

---

## 2. Algorithm Flow Summary

### 2.1 House Number Calculation Pipeline

```text
GPS/Tap Coordinates
        │
        ▼
┌───────────────────────────────────────────┐
│  1. Get Active Plus Code Centroid         │
│     - Floor to 14m grid cell              │
│     - Return center of grid cell          │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  2. Street Selection (selectStreets)      │
│     - Collect candidates within 60m/100m  │
│     - Access-reality filter (intervening) │
│     - Score & rank candidates             │
│     - Select active + corner alternates   │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  3. Street Orientation Detection          │
│     - aspectRatio = Δlon / Δlat           │
│     - <0.9 = vertical, >1.1 = horizontal  │
│     - 0.9-1.1 = diagonal                  │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  4. Adaptive Projection                   │
│     - Vertical → Horizontal ray (E-W)     │
│     - Horizontal → Vertical ray (N-S)     │
│     - Diagonal → Perpendicular (nearest)  │
│     - Returns: snapPoint, segmentIndex    │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  5. Compute Chainage                      │
│     - Sum distances from start to snap    │
│     - plusCodeOrdinal = floor(chainage/14)│
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  6. Determine Side of Street              │
│     - Cross product: streetDir × (I→C)    │
│     - Positive = LEFT, Negative = RIGHT   │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│  7. Calculate House Number                │
│     - LEFT: ordinal × 2 + 1 (odd)         │
│     - RIGHT: ordinal × 2 + 2 (even)       │
│     - Result: 1, 2, 3, 4, 5, 6...         │
└───────────────────────────────────────────┘
```

---

## 3. React Native Implementation Guide

### 3.1 Required Dependencies

```json
{
  "dependencies": {
    "expo-sqlite": "~14.0.0",
    "expo-location": "~17.0.0",
    "expo-file-system": "~17.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-native-maps": "^1.10.0",
    "zustand": "^4.5.0",
    "pako": "^2.1.0"
  }
}
```

### 3.2 SQLite Schema for Mobile

```typescript
// src/adapters/SQLiteAdapter.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('janpams.db');

export async function initSchema(): Promise<void> {
  await db.execAsync(`
    -- Street segments with geometry
    CREATE TABLE IF NOT EXISTS street_segments (
      id TEXT PRIMARY KEY,
      osm_id INTEGER,
      name TEXT,
      name_en TEXT,
      street_type TEXT NOT NULL,
      geometry TEXT NOT NULL,  -- JSON: [[lon,lat], ...]
      bbox TEXT NOT NULL,      -- JSON: {minLat, maxLat, minLon, maxLon}
      spacing_constant REAL DEFAULT 8,
      numbering_direction TEXT DEFAULT 'ascending',
      region_code TEXT,
      cached_at TEXT NOT NULL
    );

    -- Street direction locks
    CREATE TABLE IF NOT EXISTS street_direction_locks (
      street_key TEXT PRIMARY KEY,
      direction_state TEXT NOT NULL DEFAULT 'unlocked',
      locked_direction TEXT,
      locked_at TEXT,
      locked_by TEXT,
      lock_source TEXT,
      sync_status TEXT DEFAULT 'pending'
    );

    -- Admin boundaries
    CREATE TABLE IF NOT EXISTS admin_boundaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      admin_level INTEGER,
      level TEXT,
      polygon TEXT,
      bbox TEXT NOT NULL,
      region_code TEXT,
      cached_at TEXT
    );

    -- Settlement places (neighborhoods, villages)
    CREATE TABLE IF NOT EXISTS settlement_places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      place TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      polygon TEXT,
      region_code TEXT,
      cached_at TEXT
    );

    -- Spatial indexes
    CREATE INDEX IF NOT EXISTS idx_streets_bbox ON street_segments(bbox);
    CREATE INDEX IF NOT EXISTS idx_streets_name ON street_segments(name);
  `);
}
```

### 3.3 Core Address Calculation Module

```typescript
// src/core/addressCalculation.ts

// Types (from packages/types/src/address.ts)
export interface Street {
  id: string;
  name: string;
  osm_id?: number;
  geometry: [number, number][]; // [lat, lon] pairs
  direction_locked?: boolean;
}

export interface AddressData {
  houseNumber: number;
  street: string;
  chainage: string;
  chainageIndex: number;
  side: 'L' | 'R';
  spacing: number;
  displayAddress: string;
  orientation: 'vertical' | 'horizontal' | 'diagonal';
  projectionType: 'horizontal' | 'vertical' | 'perpendicular';
  distanceToStreet: number;
  isNonStreetFacing: boolean;
}

// Constants
const PLUS_CODE_GRID_SIZE = 0.000125; // ~14m at equator
const PLUS_CODE_GRID_SIZE_METERS = 14;
const NON_STREET_FACING_THRESHOLD = 30; // meters

// 1. Haversine distance calculation
export function haversineDistance(
  point1: [number, number], 
  point2: [number, number]
): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2. Get Plus Code grid cell centroid
export function getActivePlusCodeCentroid(lat: number, lon: number): [number, number] {
  const gridLat = Math.floor(lat / PLUS_CODE_GRID_SIZE) * PLUS_CODE_GRID_SIZE;
  const gridLon = Math.floor(lon / PLUS_CODE_GRID_SIZE) * PLUS_CODE_GRID_SIZE;
  
  return [
    gridLat + (PLUS_CODE_GRID_SIZE / 2),
    gridLon + (PLUS_CODE_GRID_SIZE / 2)
  ];
}

// 3. Street orientation detection
export type StreetOrientation = 'vertical' | 'horizontal' | 'diagonal';

export function calculateStreetOrientation(
  geometry: [number, number][]
): { orientation: StreetOrientation; aspectRatio: number } {
  const lats = geometry.map(p => p[0]);
  const lons = geometry.map(p => p[1]);
  
  const deltaLat = Math.max(...lats) - Math.min(...lats);
  const deltaLon = Math.max(...lons) - Math.min(...lons);
  
  const aspectRatio = deltaLat > 0.000001 
    ? deltaLon / deltaLat 
    : (deltaLon > 0 ? Infinity : 1);
  
  let orientation: StreetOrientation;
  if (aspectRatio < 0.9) {
    orientation = 'vertical';
  } else if (aspectRatio > 1.1) {
    orientation = 'horizontal';
  } else {
    orientation = 'diagonal';
  }
  
  return { orientation, aspectRatio };
}

// 4. Horizontal intersection (for vertical streets)
function horizontalIntersection(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } | null {
  const [centroidLat, _centroidLon] = centroid;
  let bestSnapPoint: [number, number] | null = null;
  let bestSegmentIndex = -1;
  let bestDistance = Infinity;
  
  for (let i = 0; i < geometry.length - 1; i++) {
    const [lat1, lon1] = geometry[i];
    const [lat2, lon2] = geometry[i + 1];
    
    const minLat = Math.min(lat1, lat2);
    const maxLat = Math.max(lat1, lat2);
    
    if (centroidLat >= minLat && centroidLat <= maxLat) {
      if (Math.abs(lat2 - lat1) < 1e-10) continue;
      
      const t = (centroidLat - lat1) / (lat2 - lat1);
      const intersectLon = lon1 + t * (lon2 - lon1);
      const snapPoint: [number, number] = [centroidLat, intersectLon];
      const dist = haversineDistance(centroid, snapPoint);
      
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSnapPoint = snapPoint;
        bestSegmentIndex = i;
      }
    }
  }
  
  return bestSnapPoint 
    ? { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance }
    : null;
}

// 5. Vertical intersection (for horizontal streets)
function verticalIntersection(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } | null {
  const [_centroidLat, centroidLon] = centroid;
  let bestSnapPoint: [number, number] | null = null;
  let bestSegmentIndex = -1;
  let bestDistance = Infinity;
  
  for (let i = 0; i < geometry.length - 1; i++) {
    const [lat1, lon1] = geometry[i];
    const [lat2, lon2] = geometry[i + 1];
    
    const minLon = Math.min(lon1, lon2);
    const maxLon = Math.max(lon1, lon2);
    
    if (centroidLon >= minLon && centroidLon <= maxLon) {
      if (Math.abs(lon2 - lon1) < 1e-10) continue;
      
      const t = (centroidLon - lon1) / (lon2 - lon1);
      const intersectLat = lat1 + t * (lat2 - lat1);
      const snapPoint: [number, number] = [intersectLat, centroidLon];
      const dist = haversineDistance(centroid, snapPoint);
      
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSnapPoint = snapPoint;
        bestSegmentIndex = i;
      }
    }
  }
  
  return bestSnapPoint
    ? { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance }
    : null;
}

// 6. Perpendicular projection (for diagonal streets)
function perpendicularProjection(
  centroid: [number, number],
  geometry: [number, number][]
): { snapPoint: [number, number]; segmentIndex: number; distance: number } {
  let bestSnapPoint: [number, number] = geometry[0];
  let bestSegmentIndex = 0;
  let bestDistance = Infinity;
  
  for (let i = 0; i < geometry.length - 1; i++) {
    const [x1, y1] = geometry[i];
    const [x2, y2] = geometry[i + 1];
    const [px, py] = centroid;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    if (dx === 0 && dy === 0) continue;
    
    const t = Math.max(0, Math.min(1,
      ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    ));
    
    const projected: [number, number] = [x1 + t * dx, y1 + t * dy];
    const dist = haversineDistance(centroid, projected);
    
    if (dist < bestDistance) {
      bestDistance = dist;
      bestSnapPoint = projected;
      bestSegmentIndex = i;
    }
  }
  
  return { snapPoint: bestSnapPoint, segmentIndex: bestSegmentIndex, distance: bestDistance };
}

// 7. Adaptive projection (unified)
export type ProjectionType = 'horizontal' | 'vertical' | 'perpendicular';

export function adaptiveProjection(
  centroid: [number, number],
  geometry: [number, number][]
): {
  snapPoint: [number, number];
  segmentIndex: number;
  distance: number;
  orientation: StreetOrientation;
  projectionType: ProjectionType;
  noValidProjection: boolean;
} {
  const { orientation } = calculateStreetOrientation(geometry);
  
  let result: { snapPoint: [number, number]; segmentIndex: number; distance: number } | null = null;
  let projectionType: ProjectionType;
  
  switch (orientation) {
    case 'vertical':
      projectionType = 'horizontal';
      result = horizontalIntersection(centroid, geometry);
      break;
    case 'horizontal':
      projectionType = 'vertical';
      result = verticalIntersection(centroid, geometry);
      break;
    case 'diagonal':
      projectionType = 'perpendicular';
      result = perpendicularProjection(centroid, geometry);
      break;
  }
  
  if (!result) {
    // Fallback to perpendicular
    result = perpendicularProjection(centroid, geometry);
    return { ...result, orientation, projectionType, noValidProjection: true };
  }
  
  return { ...result, orientation, projectionType, noValidProjection: false };
}

// 8. Compute chainage along street
export function computeChainage(
  centroid: [number, number],
  geometry: [number, number][]
): {
  chainage: number;
  totalLength: number;
  snapPoint: [number, number];
  segmentIndex: number;
  plusCodeOrdinal: number;
  orientation: StreetOrientation;
  projectionType: ProjectionType;
} {
  const projection = adaptiveProjection(centroid, geometry);
  
  if (projection.noValidProjection) {
    return {
      chainage: 0,
      totalLength: 0,
      snapPoint: projection.snapPoint,
      segmentIndex: 0,
      plusCodeOrdinal: 0,
      orientation: projection.orientation,
      projectionType: projection.projectionType
    };
  }
  
  // Sum distances from start to snap segment
  let chainage = 0;
  for (let i = 0; i < projection.segmentIndex; i++) {
    chainage += haversineDistance(geometry[i], geometry[i + 1]);
  }
  
  // Add distance to snap point
  chainage += haversineDistance(geometry[projection.segmentIndex], projection.snapPoint);
  
  // Calculate total length
  let totalLength = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    totalLength += haversineDistance(geometry[i], geometry[i + 1]);
  }
  
  // Chainage-based ordinal
  const plusCodeOrdinal = Math.floor(chainage / PLUS_CODE_GRID_SIZE_METERS);
  
  return {
    chainage,
    totalLength,
    snapPoint: projection.snapPoint,
    segmentIndex: projection.segmentIndex,
    plusCodeOrdinal,
    orientation: projection.orientation,
    projectionType: projection.projectionType
  };
}

// 9. Determine side of street
export function determineSideOfStreet(
  centroid: [number, number],
  snapPoint: [number, number],
  geometry: [number, number][],
  segmentIndex: number
): 'L' | 'R' {
  const segStart = geometry[segmentIndex];
  const segEnd = geometry[segmentIndex + 1];
  
  // Direction vector of segment
  const dirLat = segEnd[0] - segStart[0];
  const dirLon = segEnd[1] - segStart[1];
  
  // Vector from snap point to centroid
  const toCentroidLat = centroid[0] - snapPoint[0];
  const toCentroidLon = centroid[1] - snapPoint[1];
  
  // Cross product
  const cross = dirLon * toCentroidLat - dirLat * toCentroidLon;
  
  return cross > 0 ? 'L' : 'R';
}

// 10. Main house number calculation
export function calculateHouseNumber(
  lat: number,
  lon: number,
  street: Street
): AddressData | null {
  // Use Plus Code centroid
  const centroid = getActivePlusCodeCentroid(lat, lon);
  
  const chainageResult = computeChainage(centroid, street.geometry);
  const side = determineSideOfStreet(
    centroid,
    chainageResult.snapPoint,
    street.geometry,
    chainageResult.segmentIndex
  );
  
  // Distance for non-street-facing check
  const distanceToStreet = haversineDistance(centroid, chainageResult.snapPoint);
  const isNonStreetFacing = distanceToStreet > NON_STREET_FACING_THRESHOLD;
  
  // House number formula
  let houseNumber: number;
  if (side === 'L') {
    houseNumber = chainageResult.plusCodeOrdinal * 2 + 1; // Odd
  } else {
    houseNumber = chainageResult.plusCodeOrdinal * 2 + 2; // Even
  }
  
  houseNumber = Math.max(1, houseNumber);
  
  return {
    houseNumber,
    street: street.name,
    chainage: chainageResult.chainage.toFixed(1),
    chainageIndex: chainageResult.plusCodeOrdinal,
    side,
    spacing: PLUS_CODE_GRID_SIZE_METERS,
    displayAddress: `${houseNumber} ${street.name}`,
    orientation: chainageResult.orientation,
    projectionType: chainageResult.projectionType,
    distanceToStreet,
    isNonStreetFacing
  };
}
```

### 3.4 Street Selection Module

```typescript
// src/core/streetSelection.ts
import * as SQLite from 'expo-sqlite';
import { haversineDistance, adaptiveProjection } from './addressCalculation';

const db = SQLite.openDatabaseSync('janpams.db');

interface StreetSegment {
  id: string;
  name: string | null;
  geometry: [number, number][];
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  street_type: string;
}

interface CandidateStreet {
  segment: StreetSegment;
  distance: number;
  projectionPoint: [number, number];
  distanceScore: number;
  side: 'L' | 'R';
}

const URBAN_RADIUS = 60;  // meters
const RURAL_RADIUS = 100; // meters

// Find streets near a location
export async function findNearbyStreets(
  lat: number,
  lon: number,
  radius: number = URBAN_RADIUS
): Promise<StreetSegment[]> {
  // Create search bbox
  const latDelta = radius / 111000; // ~111km per degree
  const lonDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
  
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLon = lon - lonDelta;
  const maxLon = lon + lonDelta;
  
  const rows = db.getAllSync<any>(`
    SELECT id, name, geometry, bbox, street_type
    FROM street_segments
  `);
  
  const nearby: StreetSegment[] = [];
  
  for (const row of rows) {
    const bbox = JSON.parse(row.bbox);
    
    // Quick bbox check
    if (bbox.maxLat < minLat || bbox.minLat > maxLat ||
        bbox.maxLon < minLon || bbox.minLon > maxLon) {
      continue;
    }
    
    nearby.push({
      id: row.id,
      name: row.name,
      geometry: JSON.parse(row.geometry),
      bbox,
      street_type: row.street_type
    });
  }
  
  return nearby;
}

// Select active street
export async function selectActiveStreet(
  lat: number,
  lon: number
): Promise<{ activeStreet: StreetSegment | null; candidates: CandidateStreet[] }> {
  const nearbyStreets = await findNearbyStreets(lat, lon, URBAN_RADIUS);
  const location: [number, number] = [lat, lon];
  
  const candidates: CandidateStreet[] = [];
  
  for (const segment of nearbyStreets) {
    // Convert geometry to [lat, lon] format if needed
    const geometry = segment.geometry;
    const projection = adaptiveProjection(location, geometry);
    
    if (projection.distance > URBAN_RADIUS) continue;
    
    // Calculate distance score
    const distanceScore = 1 - (projection.distance / URBAN_RADIUS);
    
    // Determine side
    const segStart = geometry[projection.segmentIndex];
    const segEnd = geometry[projection.segmentIndex + 1] || geometry[projection.segmentIndex];
    const cross = (segEnd[1] - segStart[1]) * (location[0] - projection.snapPoint[0]) -
                  (segEnd[0] - segStart[0]) * (location[1] - projection.snapPoint[1]);
    const side = cross > 0 ? 'L' : 'R';
    
    candidates.push({
      segment,
      distance: projection.distance,
      projectionPoint: projection.snapPoint,
      distanceScore,
      side
    });
  }
  
  // Sort by distance
  candidates.sort((a, b) => a.distance - b.distance);
  
  return {
    activeStreet: candidates[0]?.segment || null,
    candidates
  };
}
```

### 3.5 Street Direction Lock Module

```typescript
// src/core/streetDirectionLock.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('janpams.db');

export type DirectionState = 'unlocked' | 'locked';
export type LockedDirection = 'as_is' | 'reversed';
export type LockSource = 'auto_on_first_address' | 'authority_override';

export interface StreetDirectionLock {
  streetKey: string;
  directionState: DirectionState;
  lockedDirection: LockedDirection | null;
  lockedAt: string | null;
  lockedBy: string | null;
  lockSource: LockSource | null;
  syncStatus: 'pending' | 'synced';
}

// Normalize street key for consistent lookups
export function normalizeStreetKey(
  streetName: string,
  city?: string,
  osmId?: number
): string {
  if (osmId) {
    return `osm:${osmId}`;
  }
  
  const normalizedName = streetName.trim().toLowerCase().replace(/\s+/g, '_');
  if (city) {
    return `name:${normalizedName}:${city.trim().toLowerCase().replace(/\s+/g, '_')}`;
  }
  return `name:${normalizedName}`;
}

// Get direction lock for a street
export function getDirectionLock(streetKey: string): StreetDirectionLock | null {
  const row = db.getFirstSync<any>(
    'SELECT * FROM street_direction_locks WHERE street_key = ?',
    [streetKey]
  );
  
  if (!row) return null;
  
  return {
    streetKey: row.street_key,
    directionState: row.direction_state,
    lockedDirection: row.locked_direction,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    lockSource: row.lock_source,
    syncStatus: row.sync_status
  };
}

// Check if street is locked
export function isStreetLocked(streetKey: string): boolean {
  const lock = getDirectionLock(streetKey);
  return lock?.directionState === 'locked';
}

// Auto-lock street on first address creation
export function autoLockOnFirstAddress(
  streetKey: string,
  lockedBy?: string
): StreetDirectionLock {
  if (isStreetLocked(streetKey)) {
    return getDirectionLock(streetKey)!;
  }
  
  const now = new Date().toISOString();
  
  db.runSync(`
    INSERT OR REPLACE INTO street_direction_locks 
    (street_key, direction_state, locked_direction, locked_at, locked_by, lock_source, sync_status)
    VALUES (?, 'locked', 'as_is', ?, ?, 'auto_on_first_address', 'pending')
  `, [streetKey, now, lockedBy || 'system']);
  
  return getDirectionLock(streetKey)!;
}

// Resolve street geometry based on direction lock
export function resolveStreetGeometry(
  geometry: [number, number][],
  streetKey: string
): {
  geometry: [number, number][];
  start: [number, number];
  end: [number, number];
  reversed: boolean;
} {
  const lock = getDirectionLock(streetKey);
  
  const shouldReverse = lock?.directionState === 'locked' && 
                        lock?.lockedDirection === 'reversed';
  
  const resolved = shouldReverse ? [...geometry].reverse() : geometry;
  
  return {
    geometry: resolved,
    start: resolved[0],
    end: resolved[resolved.length - 1],
    reversed: shouldReverse
  };
}
```

### 3.6 Zustand Store for Mobile

```typescript
// src/stores/addressStore.ts
import { create } from 'zustand';

interface StreetData {
  id: string;
  name: string;
  geometry: [number, number][];
  distance: number;
  side: 'L' | 'R';
}

interface AddressState {
  // User location
  userLocation: { lat: number; lon: number } | null;
  activeLocation: { lat: number; lon: number } | null;
  
  // Street data
  activeStreet: StreetData | null;
  nearbyStreets: StreetData[];
  
  // Calculated address
  calculatedAddress: {
    houseNumber: number;
    street: string;
    side: 'L' | 'R';
    chainage: string;
  } | null;
  
  // Actions
  setUserLocation: (loc: { lat: number; lon: number } | null) => void;
  setActiveLocation: (loc: { lat: number; lon: number } | null) => void;
  setActiveStreet: (street: StreetData | null) => void;
  setNearbyStreets: (streets: StreetData[]) => void;
  setCalculatedAddress: (address: any) => void;
  reset: () => void;
}

export const useAddressStore = create<AddressState>((set) => ({
  userLocation: null,
  activeLocation: null,
  activeStreet: null,
  nearbyStreets: [],
  calculatedAddress: null,
  
  setUserLocation: (loc) => set({ userLocation: loc }),
  setActiveLocation: (loc) => set({ activeLocation: loc }),
  setActiveStreet: (street) => set({ activeStreet: street }),
  setNearbyStreets: (streets) => set({ nearbyStreets: streets }),
  setCalculatedAddress: (address) => set({ calculatedAddress: address }),
  reset: () => set({
    userLocation: null,
    activeLocation: null,
    activeStreet: null,
    nearbyStreets: [],
    calculatedAddress: null
  })
}));
```

### 3.7 Usage Example in React Native Screen

```typescript
// src/screens/CreateAddressScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useAddressStore } from '../stores/addressStore';
import { selectActiveStreet } from '../core/streetSelection';
import { calculateHouseNumber } from '../core/addressCalculation';
import { autoLockOnFirstAddress, normalizeStreetKey } from '../core/streetDirectionLock';

export function CreateAddressScreen() {
  const {
    userLocation,
    activeStreet,
    calculatedAddress,
    setUserLocation,
    setActiveStreet,
    setCalculatedAddress
  } = useAddressStore();
  
  const [loading, setLoading] = useState(false);

  // Acquire GPS location
  const acquireLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission denied');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      });
      
      setUserLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude
      });
      
      // Select active street
      const { activeStreet: street } = await selectActiveStreet(
        location.coords.latitude,
        location.coords.longitude
      );
      
      if (street) {
        setActiveStreet({
          id: street.id,
          name: street.name || 'Unnamed Street',
          geometry: street.geometry,
          distance: 0,
          side: 'L'
        });
        
        // Calculate house number
        const address = calculateHouseNumber(
          location.coords.latitude,
          location.coords.longitude,
          {
            id: street.id,
            name: street.name || 'Unnamed Street',
            geometry: street.geometry
          }
        );
        
        if (address) {
          setCalculatedAddress(address);
        }
      }
    } catch (error) {
      console.log('Error acquiring location:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save address (with direction lock)
  const saveAddress = async () => {
    if (!activeStreet || !calculatedAddress) return;
    
    // Auto-lock street direction on first address
    const streetKey = normalizeStreetKey(activeStreet.name);
    autoLockOnFirstAddress(streetKey, 'user');
    
    // Save address to database
    // ... save logic here
    
    alert('Address saved!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Address</Text>
      
      <Button
        title={loading ? 'Acquiring GPS...' : 'Get Location'}
        onPress={acquireLocation}
        disabled={loading}
      />
      
      {userLocation && (
        <View style={styles.section}>
          <Text>Location: {userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}</Text>
        </View>
      )}
      
      {activeStreet && (
        <View style={styles.section}>
          <Text style={styles.label}>Street:</Text>
          <Text>{activeStreet.name}</Text>
        </View>
      )}
      
      {calculatedAddress && (
        <View style={styles.section}>
          <Text style={styles.label}>Calculated Address:</Text>
          <Text style={styles.address}>{calculatedAddress.displayAddress}</Text>
          <Text>Side: {calculatedAddress.side} | Chainage: {calculatedAddress.chainage}m</Text>
          <Text>Orientation: {calculatedAddress.orientation}</Text>
          <Text>Projection: {calculatedAddress.projectionType}</Text>
          
          <Button title="Save Address" onPress={saveAddress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section: { marginTop: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  address: { fontSize: 18, fontWeight: 'bold', color: '#2563eb' }
});
```

---

## 4. Technical Summary

### Key Algorithms:
1. **Plus Code Centroid**: Floor GPS to 14m grid, use center as reference
2. **Street Orientation**: aspectRatio = Δlon/Δlat (< 0.9 = vertical, > 1.1 = horizontal)
3. **Adaptive Projection**: H-ray for vertical, V-ray for horizontal, perpendicular for diagonal
4. **Chainage Ordinal**: floor(distance_along_street / 14m)
5. **House Number**: ordinal × 2 + parity (LEFT=1/odd, RIGHT=2/even)
6. **Direction Lock**: Auto-lock on first address, use geographic anchor for deterministic geometry

### File Count Summary:
- **Core Logic**: 10 files
- **Geocoding**: 6 files
- **Offline Data**: 4 files
- **Map Components**: 10 files
- **State/Hooks**: 5 files
- **Types**: 4 files
- **Documentation**: 12+ spec files
