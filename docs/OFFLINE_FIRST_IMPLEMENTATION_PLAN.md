# Offline-First Mobile App Implementation Plan

**Version:** 1.0  
**Date:** 2025-01-21  
**Project:** JanGO Mobile App - Offline-First Architecture  
**Timeline:** 13 weeks (including Phase 0)

---

## Executive Summary

This document outlines the complete implementation plan for transforming the JanGO mobile app into an offline-first application that matches the web application's functionality. The plan includes migrating to OSM/MapLibre map SDK, implementing SQLite database matching web's IndexedDB schemas, porting business logic algorithms, implementing sync system, and adding offline data packs support.

### Key Objectives
- ✅ Implement offline-first architecture (7+ days offline capability)
- ✅ Match web application's database schemas exactly
- ✅ Port web's business logic algorithms
- ✅ Migrate to OSM/MapLibre for offline tile caching
- ✅ Maintain existing mobile UI (polish only)
- ✅ Achieve feature parity with web application

### Implementation Approach
- **Porting Strategy**: Create new mobile files implementing web's logic (not copying web files)
- **Reference Material**: Web files in `docs/src/` are reference only (not committed to git)
- **Incremental Migration**: Phase-by-phase implementation with testing at each stage
- **UI Preservation**: Keep existing mobile UI, minimal changes, polish only

---

## Phase Overview

| Phase | Duration | Focus Area | Dependencies |
|-------|----------|------------|--------------|
| **Phase 0** | Week 0 | Map SDK Migration | None |
| **Phase 1** | Weeks 1-2 | Database Layer | Phase 0 |
| **Phase 2** | Weeks 3-4 | Business Logic | Phase 1 |
| **Phase 3** | Weeks 5-6 | Sync System | Phase 1, Phase 2 |
| **Phase 4** | Weeks 7-8 | Data Packs & Offline Tiles | Phase 0, Phase 1, Phase 2 |
| **Phase 5** | Weeks 9-10 | UI Integration & Polish | Phase 1-4 |
| **Phase 6** | Weeks 11-12 | Testing & Optimization | All phases |

**Total Timeline:** 13 weeks

---

## Phase 0: Map SDK Migration (Week 0)

### Objective
Migrate from Google Maps (react-native-maps) to OSM/MapLibre to align with web application and enable offline tile caching.

### Rationale
- Web uses MapLibre GL JS with OSM tiles
- OSM tiles are free and can be cached offline
- Aligns mobile and web map implementations
- Enables offline tile caching in Phase 4

### Tasks

#### 1. Map SDK Evaluation & Selection
- **Evaluate Options:**
  - Option A: `react-native-maps` with custom OSM tile provider (easiest)
  - Option B: `@maplibre/maplibre-react-native` (official, aligns with web)
  - Option C: `react-native-mapbox-gl` (community MapLibre fork)
- **Decision Criteria:**
  - Expo compatibility
  - Feature completeness
  - Community support
  - Alignment with web
- **Recommendation:** Start with Option A, evaluate Option B if needed

#### 2. Map SDK Installation & Setup
- Install chosen map SDK
- Configure OSM tile URLs (same as web):
  ```
  https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png
  ```
- Set up map initialization
- Test basic map rendering
- Remove Google Maps API keys from config (if no longer needed)

#### 3. Map Component Migration
- **Study Existing Map Usage:**
  - `components/MapViewComponent.tsx`
  - `app/(tabs)/index.tsx` (map usage)
  - `app/new-create-address.tsx` (map usage)
  - `app/(tabs)/route-directions.tsx` (map usage)
- **Create New Map Component:**
  - Create `components/MapViewOSM.tsx` (new component)
  - Implement OSM tile configuration
  - Port all map features:
    - Markers (current location, addresses)
    - Polygons (Plus Code grid overlay)
    - Polylines (routes)
    - Map controls (zoom, center)
    - Region/zoom handling
    - Map press handlers
- **Migration Strategy:**
  - Keep old component temporarily
  - Migrate one screen at a time
  - Test each migration
  - Remove old component when complete

#### 4. Tile Configuration
- Configure OSM tile URLs (exact match to web)
- Test tile loading
- Verify tile rendering quality
- Prepare for offline tile caching (Phase 4)

#### 5. Map Features Migration
- **Plus Code Grid Overlay:**
  - Port Polygon rendering for grid cells
  - Maintain grid alignment logic
  - Test grid visibility at different zoom levels
- **Markers:**
  - Current location marker
  - Address markers
  - Custom marker styling
- **Routes:**
  - Route polylines
  - Route styling
- **Map Controls:**
  - Zoom controls
  - Center location button
  - Map type toggle (if needed)

#### 6. Testing & Validation
- Test map rendering on iOS and Android
- Test all map interactions
- Test performance (compare with Google Maps)
- Test Plus Code grid overlay
- Test markers and routes
- Fix any regressions
- Performance benchmarking

### Deliverables
- ✅ Map SDK migrated to OSM/MapLibre
- ✅ All map features working
- ✅ OSM tiles configured correctly
- ✅ Map component ready for offline tile caching
- ✅ Old Google Maps code removed

### Success Criteria
- Map renders correctly with OSM tiles
- All existing map features work identically
- Performance is acceptable (no degradation)
- Plus Code grid overlay works correctly
- Ready for offline tile caching integration

### Risks & Mitigation
- **Risk:** Map SDK compatibility issues
  - **Mitigation:** Test early, have fallback plan, evaluate multiple SDKs
- **Risk:** Performance differences
  - **Mitigation:** Benchmark before/after, optimize if needed
- **Risk:** Feature gaps
  - **Mitigation:** Identify gaps early, find alternatives or workarounds

---

## Phase 1: Database Layer Foundation (Weeks 1-2)

### Objective
Create SQLite database foundation matching web's IndexedDB schemas exactly.

### Rationale
- Web uses IndexedDB with specific schemas
- Mobile needs SQLite with identical schemas
- Database is foundation for all offline functionality
- Must match web exactly for data compatibility

### Week 1: Schema Analysis & Design

#### 1. Study Web Schemas (Reference)
- **Analyze:** `docs/src/lib/db.ts` (reference only)
- **Document All Interfaces:**
  - `Address` - Main address records
  - `StreetSegment` - Street geometry data
  - `AdminBoundary` - Administrative boundaries
  - `SettlementPlace` - Cities/towns/villages
  - `SyncQueueItem` - Pending sync operations
  - `DataPackManifest` - Downloaded data pack metadata
  - `TileCache` - Cached map tiles
  - `StreetSuggestion` - Street name suggestions
  - `LocationCapture` - GPS capture records
- **Map IndexedDB to SQLite:**
  - IndexedDB object stores → SQLite tables
  - IndexedDB indexes → SQLite indexes
  - IndexedDB keys → SQLite primary keys
  - Relationships and foreign keys

#### 2. Create Mobile Database Schemas
- **Create `lib/db/schemas.ts`:**
  - TypeScript interfaces (exact match to web)
  - Export all schema types
  - Document field purposes
- **Create `lib/db/sqlite-schema.ts`:**
  - SQLite CREATE TABLE statements
  - Match web field names exactly
  - Match web data types (with SQLite equivalents)
  - Create indexes matching web
- **Create `lib/db/indexes.ts`:**
  - SQLite index definitions
  - Match web indexes exactly
  - Performance optimization indexes
- **Document Schema Mapping:**
  - IndexedDB → SQLite conversion guide
  - Field name mapping
  - Data type mapping
  - Relationship mapping

#### 3. Database Setup Infrastructure
- **Create `lib/db/database.ts`:**
  - SQLite database initialization
  - Database connection management
  - Database helper functions (like web's `getDB()`)
  - Error handling
- **Create `lib/db/migrations.ts`:**
  - Migration system
  - Version management
  - Schema evolution support
  - Rollback capability
- **Create `lib/db/helpers.ts`:**
  - Common database operations
  - Query builders
  - Transaction helpers
- **Test Database Creation:**
  - Test database initialization
  - Test basic operations
  - Test migrations

### Week 2: Database Implementation & Testing

#### 1. Implement Core Database Functions
- **Create `lib/db/addresses.ts`:**
  - Address CRUD operations
  - Query by Plus Code
  - Query by sync status
  - Batch operations
- **Create `lib/db/syncQueue.ts`:**
  - Sync queue operations
  - Add to queue
  - Process queue items
  - Retry logic helpers
- **Create `lib/db/streetSegments.ts`:**
  - Street segment operations
  - Query by region
  - Spatial queries
  - Geometry operations
- **Create `lib/db/adminBoundaries.ts`:**
  - Admin boundary operations
  - Query by level
  - Query by parent
  - Polygon containment checks
- **Create `lib/db/settlements.ts`:**
  - Settlement place operations
  - Query by geo-cell
  - Distance-based queries
  - Type-based queries
- **Create `lib/db/dataPacks.ts`:**
  - Data pack operations
  - Install/uninstall packs
  - Pack metadata
  - Version management

#### 2. Testing & Validation
- **Functional Testing:**
  - Test all CRUD operations
  - Test queries
  - Test indexes
  - Test relationships
- **Schema Validation:**
  - Verify schema matches web exactly
  - Verify field names match
  - Verify data types match
  - Verify indexes match
- **Migration Testing:**
  - Test migrations
  - Test rollbacks
  - Test version upgrades
- **Performance Testing:**
  - Test with sample data
  - Test with large datasets
  - Benchmark queries
  - Optimize slow operations

### Deliverables
- ✅ Complete SQLite database matching web schemas
- ✅ Database helper functions
- ✅ Migration system
- ✅ Test suite for database operations
- ✅ Schema documentation

### Success Criteria
- All web schemas implemented in SQLite
- Database operations working correctly
- Schema matches web exactly (field names, types, relationships)
- Migrations working correctly
- Performance acceptable

### Reference Files (Study Only)
- `docs/src/lib/db.ts` - Web database schemas

---

## Phase 2: Business Logic Port (Weeks 3-4)

### Objective
Port web's business logic algorithms to mobile (geocoding, house numbering, Plus Code).

### Rationale
- Web has proven algorithms for address calculation
- Must match web's results exactly
- Core functionality for address creation
- Pure TypeScript logic (easily portable)

### Week 3: Core Algorithms

#### 1. Plus Code Implementation
- **Study:** `docs/src/lib/pluscode.ts` (reference)
- **Create `lib/pluscode.ts`:**
  - Plus Code encoding function
  - Plus Code decoding function
  - Grid bounds calculation
  - Neighbor code calculation
  - Grid cell utilities
- **Port Logic:**
  - Copy algorithm logic exactly
  - Adapt imports/paths for mobile
  - Test against web implementation
- **Testing:**
  - Test encoding/decoding
  - Test grid bounds
  - Test neighbor codes
  - Compare results with web

#### 2. House Number Calculation
- **Study:** `docs/src/lib/createLocationAddress.ts` (reference)
- **Create `lib/createLocationAddress.ts`:**
  - `calculateHouseNumberSync()` - Synchronous calculation
  - `allocateHouseNumberAsync()` - Async with duplicate prevention
  - `computeChainage()` - Distance along street
  - `determineSideOfStreet()` - Left/right detection
  - `getActivePlusCodeCentroid()` - Grid cell center
- **Port Algorithms:**
  - Chainage calculation (linear distance)
  - House number formula: `ordinal × 2 + (1 if LEFT else 2)`
  - Adaptive projection (vertical/horizontal/diagonal)
  - Duplicate prevention logic
- **Adapt Database Calls:**
  - Replace `await getDB()` (IndexedDB) with `await getSQLiteDB()` (SQLite)
  - Adapt query patterns
  - Test algorithm parity with web

#### 3. Street Geometry Utilities
- **Study:** `docs/src/lib/streetGeometry.ts` (reference)
- **Create `lib/streetGeometry.ts`:**
  - Geometry resolution logic
  - Orientation detection
  - Geometry normalization
  - Street direction utilities
- **Port Logic:**
  - Copy geometry algorithms
  - Adapt for mobile
  - Test geometry operations

### Week 4: Geocoding System

#### 1. Geocoding Core Modules
- **Study:** `docs/src/lib/geocoding/` folder (reference)
- **Create `lib/geocoding/index.ts`:**
  - Module exports
  - Public API
- **Create `lib/geocoding/reverseGeocode.ts`:**
  - `offlineReverseGeocode()` - Main entry point
  - Admin boundary resolution
  - Settlement resolution
  - OSM-style address building
- **Create `lib/geocoding/adminResolver.ts`:**
  - `findAdminBoundaries()` - Boundary queries
  - Polygon containment checks
  - Admin level mapping
- **Create `lib/geocoding/settlementResolver.ts`:**
  - `findSettlements()` - Settlement queries
  - Distance-based scoring
  - Geo-cell indexing
  - Type-based filtering
- **Create `lib/geocoding/getAddressComponents.ts`:**
  - `getAddressComponentsSync()` - Component extraction
  - Priority logic for form fields
  - Field mapping
- **Create `lib/geocoding/normalization.ts`:**
  - Location normalization
  - Locale detection
  - Name normalization
- **Adapt Database Calls:**
  - Replace all IndexedDB calls with SQLite
  - Adapt spatial queries
  - Test geocoding accuracy

#### 2. Street Address Resolution
- **Study:** `docs/src/lib/offlineDataPacks.ts` (reference)
- **Create `lib/offlineDataPacks.ts`:**
  - `resolveStreetAddress()` - Main entry point
  - Street selection logic
  - House number calculation integration
  - Admin/settlement resolution
- **Port Logic:**
  - Street selection algorithm
  - Access-reality algorithm (if web uses it)
  - Distance calculations
  - Side-of-street detection
- **Adapt Spatial Queries:**
  - Implement SQLite spatial queries
  - Nearest street queries
  - Distance calculations
  - Test offline reverse geocoding

#### 3. Address Checking
- **Study:** `docs/src/lib/checkLocationAddress.ts` (reference)
- **Create `lib/checkLocationAddress.ts`:**
  - `checkLocationAddress()` - Main entry point
  - Local JanGo lookup
  - Offline OSM candidate
  - Online OSM candidate (if online)
  - Fallback services
- **Port Logic:**
  - Address matching logic
  - Candidate ranking
  - Source prioritization
- **Integration:**
  - Integrate with offline geocoding
  - Integrate with sync manager
  - Test address checking

### Deliverables
- ✅ All business logic algorithms ported
- ✅ Geocoding system working offline
- ✅ House number calculation matching web
- ✅ Plus Code implementation complete
- ✅ Address checking working

### Success Criteria
- Algorithms produce same results as web
- Offline geocoding works correctly
- House numbers calculated correctly
- Plus Code encoding/decoding accurate
- Address checking matches web behavior

### Reference Files (Study Only)
- `docs/src/lib/pluscode.ts`
- `docs/src/lib/createLocationAddress.ts`
- `docs/src/lib/geocoding/` (all files)
- `docs/src/lib/offlineDataPacks.ts`
- `docs/src/lib/checkLocationAddress.ts`

---

## Phase 3: Sync System (Weeks 5-6)

### Objective
Implement offline-first sync system matching web's sync manager.

### Rationale
- Core requirement for offline-first architecture
- Must queue operations when offline
- Must sync when network returns
- Must handle conflicts gracefully

### Week 5: Sync Manager Core

#### 1. Sync Manager Implementation
- **Study:** `docs/src/lib/syncManager.ts` (reference)
- **Create `lib/syncManager.ts`:**
  - `SyncManagerClass` - Main sync manager
  - `init()` - Initialize sync system
  - `syncPendingChanges()` - Process sync queue
  - `createAddress()` - Create with sync queue
  - `updateAddress()` - Update with sync queue
  - `deleteAddress()` - Delete with sync queue
  - Status management
  - Listener pattern for UI updates
- **Port Logic:**
  - Sync queue processing
  - Retry logic (exponential backoff)
  - Status tracking ('idle' | 'syncing' | 'error')
  - Network detection integration
- **Adapt for Mobile:**
  - Replace `navigator.onLine` with `NetInfo`
  - Replace IndexedDB with SQLite
  - Replace Service Worker with expo-background-fetch
  - Adapt event listeners

#### 2. Sync Queue Operations
- **Implement CREATE Operation:**
  - Queue address creation
  - Generate local_id
  - Set sync_status to 'pending'
  - Add to sync_queue
- **Implement UPDATE Operation:**
  - Queue address updates
  - Track changes
  - Add to sync_queue
- **Implement DELETE Operation:**
  - Queue address deletion
  - Soft delete or hard delete
  - Add to sync_queue
- **Implement Conflict Detection:**
  - Detect server-side conflicts
  - Handle conflict resolution
  - Update sync_status to 'conflict'

#### 3. Background Sync
- **Study Web's Background Sync** (reference)
- **Implement expo-background-fetch:**
  - Set up background fetch task
  - Configure fetch interval
  - Handle background sync triggers
- **Implement expo-task-manager:**
  - Define background tasks
  - Register task handlers
  - Test background execution
- **Test Background Sync:**
  - Test background triggers
  - Test sync execution
  - Test app state handling

### Week 6: Sync Integration & API

#### 1. API Integration
- **Study Mobile's Existing API Hooks:**
  - `hooks/addresses.hooks.ts`
  - Current API endpoints
  - Request/response formats
- **Create `lib/sync/apiClient.ts`:**
  - API client for sync operations
  - Map sync queue items to API requests
  - Handle API responses
  - Error handling
- **Implement API Calls:**
  - CREATE: `POST /address/create`
  - UPDATE: `PUT /address/:id` or `PATCH /address/:id`
  - DELETE: `DELETE /address/:id`
  - Batch sync endpoint (if available)
- **Implement Retry Logic:**
  - Exponential backoff
  - Max retry attempts
  - Error handling
- **Handle API Errors:**
  - Network errors
  - Server errors
  - Validation errors
  - Conflict errors
- **Test API Integration:**
  - Test successful sync
  - Test error handling
  - Test retry logic
  - Test conflict resolution

#### 2. Sync Hooks
- **Study:** `docs/src/hooks/useOffline.ts` (reference)
- **Create `hooks/useOffline.ts`:**
  - Offline status hook
  - Network state tracking
  - Sync status tracking
  - Pending count tracking
- **Create `hooks/useSync.ts`:**
  - Sync status hook
  - Manual sync trigger
  - Sync history
  - Error tracking
- **Integrate with Components:**
  - Update existing components to use hooks
  - Add sync status indicators
  - Test hook integration

#### 3. Sync Testing
- **Test Offline Address Creation:**
  - Create address offline
  - Verify queue item created
  - Verify sync_status is 'pending'
- **Test Sync When Coming Online:**
  - Go offline, create address
  - Come online
  - Verify sync triggers
  - Verify address synced
- **Test Conflict Resolution:**
  - Create conflicting addresses
  - Test conflict detection
  - Test conflict resolution UI
- **Test Retry Logic:**
  - Simulate API failures
  - Verify retry attempts
  - Verify exponential backoff
- **Test Background Sync:**
  - Test background triggers
  - Test sync in background
  - Test app state handling

### Deliverables
- ✅ Complete sync manager implementation
- ✅ Background sync working
- ✅ API integration complete
- ✅ Sync hooks for UI
- ✅ Conflict resolution working

### Success Criteria
- Addresses created offline queue correctly
- Sync works when network returns
- Conflicts handled gracefully
- Background sync triggers correctly
- Retry logic works correctly

### Reference Files (Study Only)
- `docs/src/lib/syncManager.ts`
- `docs/src/hooks/useOffline.ts`

---

## Phase 4: Data Packs & Offline Tiles (Weeks 7-8)

### Objective
Implement offline data packs system for offline geocoding and offline map tile caching.

### Rationale
- Required for offline reverse geocoding
- Required for offline map functionality
- Enables 7+ days offline capability
- Matches web's data pack system

### Week 7: Data Pack Download & Storage

#### 1. Data Pack Downloader
- **Study:** `docs/src/lib/cloudDataPacks.ts` (reference)
- **Create `lib/dataPacks/downloader.ts`:**
  - `getAvailableDataPacks()` - Fetch pack manifest
  - `downloadDataPack()` - Download pack data
  - Progress tracking
  - Error handling
- **Port Download Logic:**
  - VPS endpoint: `https://openstreetmap-data.staging.mbukanji.org/osm-data`
  - Manifest fetching
  - Pack JSON download
  - Progress callbacks
- **Store Downloaded Packs:**
  - Parse pack JSON
  - Store in SQLite tables
  - Update data pack manifest
  - Test data pack downloads

#### 2. Data Pack Processing
- **Port Street Segment Processing:**
  - Parse street segments from pack
  - Store in `street_segments` table
  - Create indexes
  - Test street segment storage
- **Port Admin Boundary Processing:**
  - Parse admin boundaries from pack
  - Store in `admin_boundaries` table
  - Create indexes
  - Test admin boundary storage
- **Port Settlement Place Processing:**
  - Parse settlement places from pack
  - Store in `settlement_places` table
  - Create geo-cell indexes
  - Test settlement storage
- **Test Data Pack Processing:**
  - Test with sample pack
  - Verify data integrity
  - Test query performance

#### 3. Data Pack Management
- **Create `lib/dataPacks/manager.ts`:**
  - `installPack()` - Install data pack
  - `uninstallPack()` - Remove data pack
  - `getInstalledPacks()` - List installed packs
  - `updatePack()` - Update existing pack
  - `getPackInfo()` - Get pack metadata
- **Implement Pack Operations:**
  - Installation workflow
  - Uninstallation workflow
  - Update workflow
  - Storage management
- **Test Pack Management:**
  - Test installation
  - Test uninstallation
  - Test updates
  - Test storage limits

### Week 8: Search Index & Spatial Queries

#### 1. Search Index
- **Study:** `docs/src/lib/search/` folder (reference)
- **Create `lib/search/index.ts`:**
  - Search index builder
  - Index maintenance
  - Index validation
- **Port Search Index Logic:**
  - Normalization logic
  - Tokenization
  - Index building per pack
  - Index updates
- **Implement SQLite FTS5 or Custom Indexing:**
  - Evaluate FTS5 vs custom
  - Implement chosen approach
  - Test search performance
- **Test Search Index:**
  - Test index building
  - Test search queries
  - Test index updates
  - Benchmark performance

#### 2. Spatial Queries
- **Implement Spatial Queries for SQLite:**
  - Nearest street queries
  - Boundary containment checks
  - Distance calculations
  - Bounding box queries
- **Port Geo-Cell Indexing:**
  - If web uses geo-cell indexing
  - Implement in SQLite
  - Test geo-cell queries
- **Implement Spatial Functions:**
  - Distance calculation
  - Point-in-polygon checks
  - Nearest point on line
  - Bounding box intersections
- **Test Spatial Queries:**
  - Test nearest street
  - Test boundary containment
  - Test distance calculations
  - Benchmark performance

#### 3. Offline Tile Caching
- **Integrate with Phase 0 Map SDK:**
  - Use OSM tile URLs from Phase 0
  - Implement tile download
  - Store tiles locally
- **Create `lib/tiles/cache.ts`:**
  - Tile download logic
  - Tile storage (file system or SQLite)
  - Tile retrieval
  - Cache management
- **Implement Tile Caching:**
  - Download tiles for region
  - Store tiles locally
  - Serve cached tiles when offline
  - Cache size management
- **Coordinate with Data Packs:**
  - Download tiles for installed packs
  - Manage tile storage
  - Test offline tile serving

#### 4. Offline Geocoding Integration
- **Integrate Data Packs with Geocoding:**
  - Use downloaded packs for geocoding
  - Test offline reverse geocoding
  - Test street address resolution
- **Test End-to-End:**
  - Download data pack
  - Go offline
  - Test reverse geocoding
  - Test address creation
  - Test map display with cached tiles
- **Performance Testing:**
  - Test geocoding performance
  - Test tile loading performance
  - Optimize slow operations

### Deliverables
- ✅ Data pack download system
- ✅ Search index working
- ✅ Spatial queries implemented
- ✅ Offline tile caching working
- ✅ Offline geocoding fully functional

### Success Criteria
- Data packs download and install correctly
- Offline geocoding works with downloaded packs
- Search index builds correctly
- Spatial queries perform well
- Offline tiles serve correctly
- 7+ days offline capability achieved

### Reference Files (Study Only)
- `docs/src/lib/cloudDataPacks.ts`
- `docs/src/lib/offlineDataPacks.ts`
- `docs/src/lib/search/` (all files)
- `docs/src/lib/tileCache.ts`

---

## Phase 5: UI Integration & Polish (Weeks 9-10)

### Objective
Integrate new backend with existing mobile UI and polish the interface.

### Rationale
- Connect new offline-first backend to existing UI
- Maintain existing mobile UX
- Add minimal sync indicators
- Polish and refine UI

### Week 9: Form Integration

#### 1. Address Creation Form
- **Update `app/create-address.tsx`:**
  - Replace direct API calls with `SyncManager.createAddress()`
  - Integrate new geocoding system
  - Integrate new house number calculation
  - Use new address checking logic
- **Test Address Creation:**
  - Test online creation
  - Test offline creation
  - Test sync after creation
  - Test error handling

#### 2. Address Editing
- **Update Address Editing:**
  - Use sync manager for updates
  - Queue updates when offline
  - Test offline editing
  - Test sync after editing

#### 3. Address List
- **Update `app/my-addresses.tsx`:**
  - Use new database for address listing
  - Show sync status indicators
  - Filter by sync status
  - Test address listing (online and offline)

#### 4. New Create Address Form
- **Update `app/new-create-address.tsx`:**
  - Integrate new geocoding
  - Integrate new house number calculation
  - Use new address checking
  - Test form functionality

### Week 10: UI Polish & Sync Indicators

#### 1. Sync Status UI
- **Add Sync Status Indicator:**
  - Minimal, non-intrusive design
  - Show pending sync count
  - Show last sync time
  - Show sync status ('idle' | 'syncing' | 'error')
- **Create Sync Status Component:**
  - `components/SyncStatusIndicator.tsx`
  - Use `useSync` hook
  - Display sync information
- **Test Sync Status Display:**
  - Test online/offline states
  - Test sync status updates
  - Test pending count display

#### 2. Offline Indicators
- **Add Offline Banner:**
  - Show when offline
  - Non-blocking design
  - Auto-dismiss when online
- **Create Offline Indicator Component:**
  - `components/OfflineIndicator.tsx`
  - Use `useOffline` hook
  - Display offline status
- **Test Offline Indicators:**
  - Test offline detection
  - Test online detection
  - Test banner display

#### 3. Data Pack Management UI
- **Create Data Pack Screen (if needed):**
  - List available packs
  - Show installed packs
  - Download/install packs
  - Show storage usage
  - Delete packs
- **Integrate with Settings:**
  - Add data pack section to settings
  - Show pack management options
- **Test Data Pack UI:**
  - Test pack listing
  - Test pack installation
  - Test pack deletion

#### 4. Polish Existing UI
- **Review All Forms:**
  - Consistency check
  - Error message improvements
  - Loading state improvements
  - Validation improvements
- **Improve Error Messages:**
  - Clear, user-friendly messages
  - Actionable error messages
  - Offline-specific messages
- **Improve Loading States:**
  - Better loading indicators
  - Progress indicators
  - Skeleton screens (if needed)
- **Test UI Polish:**
  - Test all forms
  - Test error handling
  - Test loading states
  - User experience review

### Deliverables
- ✅ All forms integrated with new backend
- ✅ Sync status indicators added
- ✅ Offline indicators added
- ✅ Data pack management UI (if needed)
- ✅ UI polished and consistent

### Success Criteria
- All forms work with new backend
- Sync status visible to users
- Offline mode clearly indicated
- UI polished and professional
- No regression in UX

---

## Phase 6: Testing & Optimization (Weeks 11-12)

### Objective
Comprehensive testing, optimization, and bug fixes.

### Rationale
- Ensure quality before production
- Optimize performance
- Fix any bugs
- Validate all requirements

### Week 11: Testing

#### 1. Functional Testing
- **Test All Address Creation Flows:**
  - Online creation
  - Offline creation
  - Creation with geocoding
  - Creation with house number calculation
- **Test Offline Functionality:**
  - 7+ days offline scenario
  - Multiple address creation offline
  - Data pack usage offline
  - Map tile caching offline
- **Test Sync Functionality:**
  - Sync when coming online
  - Background sync
  - Conflict resolution
  - Retry logic
- **Test Data Pack Downloads:**
  - Download packs
  - Install packs
  - Use packs for geocoding
  - Delete packs

#### 2. Edge Case Testing
- **Test Network Interruptions:**
  - Interrupt during sync
  - Interrupt during download
  - Interrupt during API call
- **Test Large Data Scenarios:**
  - Large data pack downloads
  - Many pending sync items
  - Large address lists
- **Test Conflict Scenarios:**
  - Concurrent edits
  - Server-side conflicts
  - Duplicate addresses
- **Test App State Handling:**
  - App restart during sync
  - Background/foreground transitions
  - App kill during operations

#### 3. Performance Testing
- **Test Database Performance:**
  - Large datasets
  - Complex queries
  - Index performance
- **Test Geocoding Performance:**
  - Reverse geocoding speed
  - Street address resolution speed
  - Spatial query performance
- **Test Sync Performance:**
  - Sync speed
  - Background sync efficiency
  - Queue processing speed
- **Optimize Slow Operations:**
  - Identify bottlenecks
  - Optimize queries
  - Optimize algorithms
  - Cache where appropriate

### Week 12: Bug Fixes & Final Polish

#### 1. Bug Fixes
- **Fix Discovered Bugs:**
  - Critical bugs first
  - High priority bugs
  - Medium priority bugs
  - Low priority bugs (if time permits)
- **Fix Performance Issues:**
  - Slow operations
  - Memory leaks
  - Battery drain issues
- **Fix Edge Cases:**
  - Unhandled scenarios
  - Error cases
  - Boundary conditions

#### 2. Documentation
- **Document Database Schema:**
  - Complete schema documentation
  - Field descriptions
  - Relationship diagrams
- **Document Sync System:**
  - Sync flow diagrams
  - API integration guide
  - Conflict resolution guide
- **Document API Integration:**
  - API endpoints
  - Request/response formats
  - Error handling
- **Update Code Comments:**
  - Add inline documentation
  - Document complex logic
  - Update README if needed

#### 3. Final Testing
- **End-to-End Testing:**
  - Complete user flows
  - Offline-to-online transitions
  - All features working together
- **User Acceptance Testing:**
  - Test with real users (if possible)
  - Gather feedback
  - Make final adjustments
- **Final Bug Fixes:**
  - Fix any remaining issues
  - Final polish
  - Prepare for production

### Deliverables
- ✅ Fully tested application
- ✅ All bugs fixed
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ Ready for production

### Success Criteria
- All tests passing
- No critical bugs
- Performance meets requirements
- Documentation complete
- Ready for production release

---

## File Structure (Final)

```
Your Mobile Codebase:
├── lib/
│   ├── db/
│   │   ├── database.ts          (SQLite setup)
│   │   ├── schemas.ts            (TypeScript interfaces - exact match to web)
│   │   ├── sqlite-schema.ts     (SQL CREATE statements)
│   │   ├── migrations.ts         (Migrations)
│   │   ├── indexes.ts            (Index definitions)
│   │   ├── helpers.ts            (Helper functions)
│   │   ├── addresses.ts          (Address operations)
│   │   ├── syncQueue.ts          (Sync queue operations)
│   │   ├── streetSegments.ts    (Street operations)
│   │   ├── adminBoundaries.ts    (Admin operations)
│   │   ├── settlements.ts        (Settlement operations)
│   │   └── dataPacks.ts          (Data pack operations)
│   ├── syncManager.ts            (Sync manager - ported from web)
│   ├── sync/
│   │   └── apiClient.ts          (API client for sync)
│   ├── createLocationAddress.ts  (House number calculation - ported from web)
│   ├── pluscode.ts               (Plus Code - ported from web)
│   ├── geocoding/
│   │   ├── index.ts
│   │   ├── reverseGeocode.ts     (Offline reverse geocoding)
│   │   ├── adminResolver.ts      (Admin boundary resolution)
│   │   ├── settlementResolver.ts  (Settlement resolution)
│   │   ├── getAddressComponents.ts (Address component extraction)
│   │   └── normalization.ts      (Location normalization)
│   ├── offlineDataPacks.ts       (Street address resolution - ported from web)
│   ├── checkLocationAddress.ts   (Address checking - ported from web)
│   ├── streetGeometry.ts         (Street geometry utilities)
│   ├── search/
│   │   └── index.ts              (Search index builder)
│   ├── dataPacks/
│   │   ├── downloader.ts         (Data pack downloader)
│   │   └── manager.ts            (Data pack manager)
│   └── tiles/
│       └── cache.ts              (Offline tile caching)
├── hooks/
│   ├── useOffline.ts             (Offline status hook)
│   └── useSync.ts                (Sync status hook)
├── components/
│   ├── MapViewOSM.tsx            (New OSM map component - Phase 0)
│   ├── SyncStatusIndicator.tsx   (Sync status UI - Phase 5)
│   └── OfflineIndicator.tsx      (Offline banner - Phase 5)
└── app/
    └── (existing UI files - polished in Phase 5)
```

---

## Implementation Principles

### 1. Exact Schema Matching
- Mobile SQLite schemas = Web IndexedDB schemas (exact match)
- Same field names, types, relationships
- Same data structures
- Same indexes

### 2. Algorithm Parity
- Same algorithms as web
- Same calculation formulas
- Same business rules
- Test for same results

### 3. Reference-Only Approach
- Web files in `docs/src/` are reference only
- Create new mobile files (don't copy web files)
- Remove `docs/src/` from git (keep locally if needed)
- Mobile codebase only has mobile files

### 4. Incremental Development
- One phase at a time
- Test after each phase
- Keep existing code working
- Gradual replacement

### 5. UI Preservation
- Keep existing mobile UI
- Minimal UI changes
- Polish only
- Mobile-native patterns

---

## Risk Mitigation

### Risk 1: Schema Mismatches
- **Mitigation:** Document web schemas first, validate with web team, test thoroughly
- **Timeline:** Week 1

### Risk 2: Algorithm Differences
- **Mitigation:** Test algorithms with same inputs, compare outputs, validate with web team
- **Timeline:** Weeks 3-4

### Risk 3: Map SDK Migration Issues
- **Mitigation:** Test early, have fallback plan, evaluate multiple SDKs
- **Timeline:** Week 0

### Risk 4: Performance Issues
- **Mitigation:** Test with realistic data, optimize queries, benchmark performance
- **Timeline:** Week 11

### Risk 5: Breaking Existing Features
- **Mitigation:** Incremental migration, extensive testing, feature flags if needed
- **Timeline:** Throughout

### Risk 6: Sync Conflicts
- **Mitigation:** Implement robust conflict resolution, test conflict scenarios
- **Timeline:** Week 6

---

## Success Metrics

### Functional Requirements
- ✅ Offline address creation works (7+ days offline)
- ✅ Sync works when network returns
- ✅ Offline geocoding works with data packs
- ✅ Offline map tiles work
- ✅ All web features replicated

### Quality Metrics
- ✅ Database schema matches web exactly
- ✅ Algorithms produce same results as web
- ✅ No regression in existing features
- ✅ Performance meets requirements
- ✅ No critical bugs

### User Experience
- ✅ Mobile UI polished and consistent
- ✅ Sync status clearly visible
- ✅ Offline mode clearly indicated
- ✅ Error messages user-friendly
- ✅ Loading states appropriate

---

## Dependencies & Prerequisites

### Technical Prerequisites
- Expo SDK 52+ (current)
- React Native 0.76+ (current)
- SQLite (expo-sqlite)
- NetInfo (@react-native-community/netinfo)
- Background Fetch (expo-background-fetch)
- Task Manager (expo-task-manager)
- Map SDK (to be determined in Phase 0)

### External Dependencies
- Backend API endpoints (same as current)
- VPS data pack endpoint (from web)
- Network connectivity (for sync)

### Team Dependencies
- Web team: Schema validation, algorithm verification
- Backend team: API endpoint documentation (if needed)

---

## Next Steps

### Immediate Actions (Week 0 Start)
1. **Phase 0 Kickoff:**
   - Evaluate map SDK options
   - Choose map SDK
   - Begin map SDK migration

2. **Preparation:**
   - Set up development environment
   - Review web schemas in `docs/src/lib/db.ts`
   - Prepare for Phase 1

3. **Team Alignment:**
   - Share implementation plan with team
   - Get feedback and approval
   - Set up communication channels

### Weekly Check-ins
- Review progress each week
- Address blockers immediately
- Adjust plan if needed
- Document learnings

### Phase Completion
- Test each phase thoroughly
- Get approval before next phase
- Document phase completion
- Celebrate milestones!

---

## Conclusion

This implementation plan provides a comprehensive roadmap for transforming the JanGO mobile app into an offline-first application that matches the web application's functionality. The plan is structured in 7 phases over 13 weeks, with clear objectives, tasks, deliverables, and success criteria for each phase.

The approach emphasizes:
- **Exact schema matching** with web
- **Algorithm parity** with web
- **Incremental development** with testing
- **UI preservation** (polish only)
- **Reference-only** use of web files

By following this plan, we will achieve:
- ✅ Offline-first architecture (7+ days offline)
- ✅ Feature parity with web
- ✅ Maintained mobile UI (polished)
- ✅ Production-ready application

**Let's begin with Phase 0!** 🚀
