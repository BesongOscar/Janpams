# Create Address Flow - End-to-End Implementation (Web App)

## Scope

This document describes the full implementation flow for address creation in the web app (`apps/core/mbukanji-maps`) from mode entry, location checking, FOUND/NOT_FOUND decisions, offline behavior, address computation, save/sync, and UI state transitions.

It covers:
- Address mode entry from map
- Location check pipeline
- Offline reverse geocoding and street resolution
- Existing-address detection vs new-address creation
- Create page interactions and submit behavior
- IndexedDB persistence and deferred sync
- Known caveats and design choices

---

## Primary Files

- `apps/core/mbukanji-maps/src/pages/MapPage.tsx`
- `apps/core/mbukanji-maps/src/hooks/useAddressModeEntry.ts`
- `apps/core/mbukanji-maps/src/lib/addressServices.ts`
- `apps/core/mbukanji-maps/src/lib/checkLocationAddress.ts`
- `apps/core/mbukanji-maps/src/lib/offlineDataPacks.ts`
- `apps/core/mbukanji-maps/src/lib/createLocationAddress.ts`
- `apps/core/mbukanji-maps/src/pages/CreateAddressPage.tsx`
- `apps/core/mbukanji-maps/src/lib/syncManager.ts`
- `apps/core/mbukanji-maps/src/lib/db.ts`
- `apps/core/mbukanji-maps/src/components/layout/AddressInfoPanel.tsx`
- `apps/core/mbukanji-maps/src/components/layout/AddressCard.tsx`

Reference spec:
- `apps/core/mbukanji-maps/docs/SPEC_CreateAddress_MapClick_Flow.md`

---

## High-Level Architecture

The implementation is split into two stages:

1. **Location Check Stage (Map/Sidebar)**  
   Determines whether a selected location already has an address (`FOUND`) or not (`NOT_FOUND`), and provides context.

2. **Creation Stage (`/create-address`)**  
   Allows creation/editing at fixed coordinates; performs offline geocode + street/house-number computation, then writes locally and queues sync.

---

## End-to-End Flow

## 1) Enter Address Mode

### Entry point
`useAddressModeEntry.enterAddressMode()` is called when user switches to address flow.

### Behavior
1. Set app mode to address and show grid.
2. Try using cached `userLocation`; otherwise acquire GPS (`getCurrentPosition`).
3. If GPS fails, enable map selection mode and ask user to tap map.
4. On location selected:
   - Set `activeLocation`
   - Mark source (`gps` or `map_click`)
   - Run `performLocationCheck(lat, lng)`

Key state store: `useMapStore` (`mapStore.ts`).

---

## 2) Location Check Pipeline (FOUND/NOT_FOUND)

## 2.1 Service wiring
`performLocationCheck` calls `checkLocation(lat, lng, isOnline)` from `addressServices.ts`.

`checkLocation` delegates to `checkLocationAddress(...)` and injects dependencies:
- `offlineReverseGeocode` (from `resolveStreetAddress`)
- `onlineReverseGeocode` (currently returns `null` in this app path)
- `findLocalJanGoByPlusCode10` (local IndexedDB lookup)

## 2.2 Plus Code canonical key
`checkLocationAddress` computes Plus Code 10 and uses it as the canonical location key.

## 2.3 Source checks
`checkLocationAddress` evaluates:
1. **Local JanGo match** (`jango_local`) by plus code
2. **Offline external candidate** (`offline_osm`)
3. **Online candidate** (if online and wired)
4. **Fallback services** (optional)

## 2.4 FOUND/NOT_FOUND decision rule
`status = FOUND` if:
- local JanGo match exists, or
- selected external candidate quality is not LOW

Else:
- `status = NOT_FOUND`

---

## 3) Important Offline Design Choice: `houseNumber: null` in check service

In `addressServices.checkLocation`, offline reverse geocode intentionally returns street/admin context but sets:
- `houseNumber: null`

### Why
To avoid treating "street context available" as "address already exists."

### Effect
For `offline_osm`, quality is HIGH/MEDIUM only when both road and houseNumber exist. Since houseNumber is forced null in this check path, offline external candidate tends to LOW.  
So at map-check stage, existing-address detection is effectively anchored on local JanGo plus-code match.

---

## 4) Map/Panel UI Outcomes

`AddressInfoPanel.tsx` consumes `locationCheckResult` and shows:

- `FOUND`:
  - Existing address details
  - Source badge (JanGo DB / Offline Data / etc.)

- `NOT_FOUND` + region data available:
  - "Location Has No Address"
  - Show location context
  - Offer "Create Location Address"

- No usable regional data:
  - Show `OfflineDataInfoPanel` prompting pack download.

`AddressCard.tsx` also routes to `/create-address?lat=...&lon=...`.

---

## 5) Create Page Initialization (`/create-address`)

`CreateAddressPage.tsx` reads `lat/lon` from URL and runs `resolveStreetAddress(...)` for offline geocoding.

It initializes:
- street + side + chainage
- admin hierarchy (neighborhood/city/region/country)
- suggested house number
- active street geometry + nearby streets
- debug metadata (dev mode)

If geocoding fails, it falls back to minimal defaults so form remains usable.

---

## 6) Map Clicks Inside Create Page

`handleMapClick(lat, lon)` in `CreateAddressPage`:

1. Update URL params to clicked coordinates.
2. Clear prior street selection context.
3. Run `checkLocationAddress(...)` with injected local lookup + offline geocode.
4. Branch:

### Branch A: Existing address found (view mode)
Condition used in page logic:
- `checkResult.status === 'FOUND' && checkResult.jangoMatch`

Then:
- `viewMode = 'view'`
- populate form/display from local existing record
- show "Address Found"

### Branch B: No existing address (create mode)
Else:
- `viewMode = 'create'`
- run `resolveStreetAddress` and populate creation form with computed data
- user edits and submits

### Note
Even if checker status is FOUND due to external candidate, create page uses `jangoMatch` requirement for view-mode existing record experience.

---

## 7) Street + House Number Computation

House numbering logic lives in `createLocationAddress.ts`.

Core features:
- Plus-code-cell centroid as stable reference
- Orientation-aware projection:
  - vertical street -> horizontal projection
  - horizontal street -> vertical projection
  - diagonal street -> perpendicular projection
- Chainage along street path
- Side-of-street via cross product
- House number formula from ordinal/parity
- Optional street reselection when no valid projection
- Non-street-facing detection (`distance > 30m`) with compound suffix support

This computation is used to suggest/generate address number for creation workflow.

---

## 8) Submit/Create Address

On submit (`CreateAddressPage.handleSubmit`):

1. Validate required fields:
   - location, property type, connection, photo/upload-link, street name
2. `SyncManager.init()`
3. Build payload with:
   - number + street + geo + plus code + metadata
4. Handle dual-address mode when user edits API-provided names:
   - create official (`api_official`)
   - create user-suggested (`user_suggested`)
   - link both records
   - create suggestion records for voting
5. Auto-lock street direction on first address creation (`autoLockOnFirstAddress`)
6. Optional verification link generation via Supabase function
7. Show success + confirmation modal

---

## 9) Offline Persistence and Sync

`SyncManager.createAddress(...)` behavior:

- Write address to IndexedDB `addresses`
- Mark `sync_status='pending'`
- Add queue item in `sync_queue`
- Update search index
- If online: attempt sync
- If offline: rely on deferred/background sync

This makes creation offline-first and resilient.

---

## 10) Data Model Essentials

From `db.ts` (`Address`):
- core fields: house/street/admin/coords/plus_code
- metadata: side_of_street, chainage, distance_from_street
- source fields: `name_source`, `linked_address_id`, suggestion ids
- status: verification state + sync state
- timestamps

Plus-code index (`by-plus-code`) supports fast existing-record lookup in location check.

---

## 11) FOUND/NOT_FOUND Matrix (Current Implementation)

| Scenario | Local JanGo match | External candidate quality | Result |
|---|---:|---:|---|
| Existing local address same plus code | Yes | Any | `FOUND` |
| No local, offline street context only (houseNumber null in check path) | No | LOW | `NOT_FOUND` |
| No local, high-quality external (if online/fallback wired with house number) | No | HIGH/MEDIUM | `FOUND` |
| No local and no useful external | No | LOW/None | `NOT_FOUND` |

Create-page "existing view mode" currently requires local `jangoMatch`.

---

## 12) Known Nuances / Caveats

1. **OSM house numbers in check path**  
   The check service intentionally passes `houseNumber: null` for offline candidate, so OSM house numbers are not currently driving FOUND in that path.

2. **Two number notions**
   - `osmHouseNumber`: official OSM point number (when available in geocoder)
   - `houseNumber`: may become computed/suggested in address creation flow

3. **Authoritative existing-address signal**
   Local JanGo plus-code record is treated as canonical for "already exists" UX in main offline flow.

4. **Offline region packs**
   Without relevant downloaded pack data, user cannot get rich location context and is prompted to download data.

---

## 13) Sequence (Condensed)

1. User enters address mode.
2. App acquires/uses location.
3. `performLocationCheck` -> `checkLocation` -> `checkLocationAddress`.
4. Sidebar/card shows FOUND/NOT_FOUND + context.
5. User opens create page at locked coordinates.
6. Create page geocodes offline and computes suggested address components.
7. User edits and submits.
8. Address saved in IndexedDB and queued for sync.
9. Sync manager pushes when connectivity is available.

---

## 14) Practical Summary

- The system is offline-first and designed to avoid false positives.
- Existing-address detection is primarily local-plus-code based in offline mode.
- Street/admin context still comes from offline packs for creation.
- New addresses are persisted locally immediately and synced later.
- House-number generation is geometry-driven and stable against raw GPS jitter via plus-code centroid anchoring.
