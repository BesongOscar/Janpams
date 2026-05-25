# Create Address Flow - Technical Architecture (Web)

## 1. Purpose

Define how Create Address is implemented end-to-end in `apps/core/mbukanji-maps`, including:
- mode entry and state transitions
- location check semantics
- offline geocoding and numbering
- create-page branching
- persistence and sync contract

---

## 2. Core Components and Responsibilities

## 2.1 UI / Page Layer
- `MapPage.tsx`
  - Handles map interaction in address mode
  - Calls address check hook/service
  - Maintains active location context
- `CreateAddressPage.tsx`
  - Coordinate-locked creation workflow
  - Map-click re-evaluation and branch switching
  - Form validation and submit orchestration

## 2.2 Hook Layer
- `useAddressModeEntry.ts`
  - Address mode entry orchestration
  - GPS acquisition / map fallback
  - Triggers location check

## 2.3 Domain Service Layer
- `addressServices.ts`
  - Wires `checkLocationAddress` with concrete adapters:
    - offline reverse geocode
    - local plus-code lookup
    - online reverse geocode (currently disabled in this path)

## 2.4 Decision Engine
- `checkLocationAddress.ts`
  - Canonical FOUND/NOT_FOUND decision
  - candidate quality scoring
  - plus-code keying
  - numbering context synthesis

## 2.5 Geocode / Spatial Layer
- `offlineDataPacks.ts`
  - `resolveStreetAddress`
  - nearest/active/nearby street resolution
  - admin context extraction
  - OSM-style address context transport

- `createLocationAddress.ts`
  - projection + chainage + side determination
  - house-number generation
  - non-street-facing detection
  - fallback street reselection

## 2.6 Persistence / Sync Layer
- `db.ts`
  - IndexedDB schema, indexes, helper APIs
- `syncManager.ts`
  - local writes (`addresses`)
  - queueing (`sync_queue`)
  - online sync attempts / retries

## 2.7 Global State
- `mapStore.ts`
  - active location and source
  - check result and address context
  - app mode/view mode/sidebar coordination

---

## 3. Data Flow Overview

1. User enters address mode.
2. Location selected/acquired.
3. `performLocationCheck` -> `checkLocation` -> `checkLocationAddress`.
4. UI renders found/not-found state.
5. User navigates to `/create-address?lat&lon`.
6. Create page resolves geocode + street + number context.
7. On map click, create page reruns check and branches:
   - existing view mode (local match)
   - create mode (new address)
8. Submit writes locally and queues sync.

---

## 4. State Model

## 4.1 Key runtime state (`mapStore`)
- `appMode`: `navigation | address | location_plan`
- `activeLocation`, `activeLocationSource`
- `locationCheckResult` (`AddressCheckResult`)
- `activeLocationAddress` (legacy/back-compat display payload)
- `nearbyStreets`, `activeStreetData`

## 4.2 Create-page local state
- `addressData`, `streetName`, `neighborhood`
- `viewMode`: `create | view`
- `addressCheckResult`
- form fields + media + suggestion metadata

---

## 5. Decision Semantics

## 5.1 Canonical status
`checkLocationAddress` returns:
- `FOUND` when `jangoMatch` exists OR non-LOW external candidate exists
- `NOT_FOUND` otherwise

## 5.2 Offline service policy
In `addressServices.checkLocation`, offline adapter deliberately supplies:
- street/admin context
- `houseNumber: null`

Rationale:
- avoid asserting "existing address" from weak context
- separate "can compute/create" from "already exists"

Consequence:
- offline external candidate often LOW in this check path
- local plus-code match is primary FOUND signal offline

## 5.3 Create-page existing-address gate
Create page currently uses:
- `FOUND && jangoMatch` for existing/view branch
- all other cases go to create branch with fresh geocode

This tightens existing detection to local authoritative data.

---

## 6. Spatial / Numbering Pipeline

## 6.1 Street resolution
`resolveStreetAddress`:
- geocodes admin + settlement context
- identifies active and nearby streets
- returns confidence and metadata
- supports optional access-reality algorithm toggle

## 6.2 Numbering algorithm
`calculateHouseNumberSync`:
- uses plus-code grid centroid (stability)
- adaptive projection by street orientation
- computes chainage along oriented geometry
- side-of-street -> odd/even parity
- outputs derived house number and chainage

## 6.3 Non-street-facing
If distance to street > threshold (30m), compound/non-frontage behavior is flagged and suffix logic can apply.

---

## 7. Persistence and Sync Contract

## 7.1 Local write path
`SyncManager.createAddress`:
- writes address into IndexedDB (`addresses`)
- marks `sync_status='pending'`
- pushes CREATE event to `sync_queue`

## 7.2 Deferred sync
If online:
- sync cycle processes queue and updates statuses.

If offline:
- record remains locally usable
- sync attempted on reconnection/interval.

---

## 8. Dual Address Creation (Name Governance)

When user edits API-populated street/neighborhood:
- create official record (`name_source='api_official'`)
- create user suggestion record (`name_source='user_suggested'`)
- link records mutually
- create suggestion entries for community workflow

This enables preserving official baseline while capturing local naming input.

---

## 9. Contracts / Types

## 9.1 `AddressCheckResult` (decision output)
Contains:
- `status`
- `plusCode10`
- optional `jangoMatch`
- optional `externalCandidate`
- `rawGeoContext`
- `numberingContext`

## 9.2 `OfflineReverseGeocodeResult` (geocode output)
Contains:
- street/activeStreet/nearbyStreets
- admin hierarchy
- `osmHouseNumber` (official OSM address-point source when available)
- `houseNumber` (may become calculated suggestion)
- confidence/debug metadata

## 9.3 `Address` (storage object)
Contains:
- location hierarchy and coordinates
- house/street components
- metadata (chainage, side, distance)
- source/linkage fields
- sync and verification statuses

---

## 10. Error Handling Strategy

- GPS failure -> map selection fallback.
- check-location failures -> controlled error state + user feedback.
- create-page geocode failure -> safe defaults, no hard block.
- sync failure -> retry with attempts, preserve pending local data.

---

## 11. Operational Characteristics

- Offline-first by design.
- Plus-code indexing provides deterministic local lookup.
- UI keeps URL lat/lon synchronized for reproducibility.
- State separation:
  - detection stage (found/not-found)
  - creation stage (compute/edit/save)

---

## 12. Known Gaps / Risks

1. FOUND semantics differ slightly between generic checker and create-page branch gate (`jangoMatch` requirement).
2. Offline check path currently suppresses external house-number-driven FOUND by policy.
3. Online/fallback geocode route is structurally supported but not actively used in current `addressServices` path.

---

## 13. Recommended Future Enhancements

1. Unify "FOUND means existing record" semantics across all surfaces.
2. Introduce explicit policy flag for whether trusted offline OSM house numbers can trigger FOUND.
3. Add structured telemetry for branch decisions and false-positive/false-negative analysis.
4. Provide diagnostic UI indicating whether number is OSM-official or locally computed.

---

## 14. Sequence Diagram (Text)

1. User -> Address Mode
2. Hook acquires/selects location
3. Hook -> `checkLocation`
4. `checkLocation` -> `checkLocationAddress`
5. Checker:
   - local plus-code lookup
   - external candidates + quality
   - status emit
6. UI renders found/not-found panel
7. User -> `/create-address`
8. Create page -> `resolveStreetAddress`
9. User map click -> re-check + branch
10. Submit -> `SyncManager.createAddress`
11. IndexedDB write + sync queue
12. Online sync later updates status

---

## 15. Summary

The implementation is intentionally conservative offline:
- local plus-code matches are authoritative for "existing address"
- offline geocode provides strong creation context without over-claiming existence
- address creation completes locally and syncs asynchronously
- spatial numbering is deterministic and designed for repeatability
