# Mobile Application - Software Requirements Document (SRD)

**Version:** 1.0  
**Date:** 2025-01-21  
**Target Platform:** Expo (React Native) with Dev Client  
**Philosophy:** Treat mobile as a first-class product, not a port

---

## 1. Executive Summary

This document defines the requirements for building native mobile applications for JanPAMS using Expo React Native. The mobile app will share business logic with the web application while providing a native-first user experience optimized for touch, GPS hardware, and offline field work.

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Share Logic** | Reuse `@janpams/core`, `@janpams/types`, and business logic. Never rewrite Plus Code, house numbering, or sync algorithms. |
| **Rebuild Experience** | Build native UI from scratch using React Native components. Do NOT port web components. |
| **Lock Down Rules** | Enforce stricter geolocation policies on mobile (direct GPS access, no browser fallbacks). |
| **Offline-First** | Mobile is the primary offline use case. SQLite replaces IndexedDB. |

---

## 2. Stakeholder Requirements

### 2.1 Primary Users

| User Type | Use Case | Key Requirements |
|-----------|----------|------------------|
| **Field Agent** | Register addresses on-site | High-accuracy GPS, camera, offline capability |
| **Citizen** | Claim/verify personal address | Simple flow, photo upload, QR code scanning |
| **Municipality Admin** | Review submissions | Dashboard access (may be web-only initially) |

### 2.2 Business Requirements

- **BR-01:** Mobile app MUST work fully offline for 7+ days
- **BR-02:** GPS accuracy MUST meet L1/L2 trust thresholds (≤15m for L1, ≤50m for L2)
- **BR-03:** All locally-created addresses MUST sync when connectivity returns
- **BR-04:** Photo capture MUST embed GPS EXIF metadata
- **BR-05:** App MUST support Cameroon locale (French/English)

---

## 3. Functional Requirements

### 3.1 Address Creation (Core Feature)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | User can capture current GPS position | P0 |
| FR-02 | System calculates Plus Code from coordinates | P0 |
| FR-03 | System determines nearest street and house number | P0 |
| FR-04 | User can select property type and relationship | P0 |
| FR-05 | User can capture property photo with GPS metadata | P0 |
| FR-06 | User can edit suggested street name | P1 |
| FR-07 | System queues address for sync when offline | P0 |

### 3.2 Map & Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10 | Display interactive map with current location | P0 |
| FR-11 | Show Plus Code grid overlay at high zoom | P1 |
| FR-12 | Display cached map tiles when offline | P0 |
| FR-13 | Highlight nearby streets for selection | P1 |
| FR-14 | Show user's saved addresses on map | P1 |

### 3.3 Offline Data Packs

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | Download region data packs for offline use | P0 |
| FR-21 | Store street geometry locally | P0 |
| FR-22 | Store admin boundaries locally | P0 |
| FR-23 | Perform reverse geocoding offline | P0 |
| FR-24 | Show download progress and storage usage | P1 |

### 3.4 Sync & Conflict Resolution

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-30 | Background sync when online | P0 |
| FR-31 | Visual indicator for pending sync items | P0 |
| FR-32 | Handle server-side conflicts gracefully | P1 |
| FR-33 | Retry failed syncs with exponential backoff | P0 |

### 3.5 Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-40 | Login with phone number + PIN | P0 |
| FR-41 | Secure token storage (Keychain/Keystore) | P0 |
| FR-42 | Biometric authentication option | P2 |
| FR-43 | Session persistence across app restarts | P0 |

### 3.6 Address Image Verification

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-50 | Capture verification photos via deep link | P1 |
| FR-51 | Enforce camera-only (no gallery) | P1 |
| FR-52 | Embed GPS + timestamp in capture | P1 |
| FR-53 | Queue failed uploads for retry | P1 |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Cold start time | < 3 seconds |
| NFR-02 | GPS acquisition (first fix) | < 10 seconds |
| NFR-03 | Offline reverse geocode | < 200ms |
| NFR-04 | Map tile render | < 100ms per tile |

### 4.2 Storage

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-10 | Base app size | < 50MB |
| NFR-11 | Single region data pack | < 20MB |
| NFR-12 | Cached tiles per region | < 100MB |

### 4.3 Battery & Network

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-20 | GPS polling interval (active) | 2-5 seconds |
| NFR-21 | Background sync frequency | On network change + 15min interval |
| NFR-22 | Battery impact (1hr active use) | < 10% drain |

### 4.4 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-30 | SSL pinning for API calls | P0 |
| NFR-31 | Encrypted local database | P1 |
| NFR-32 | No sensitive data in logs | P0 |
| NFR-33 | Jailbreak/root detection | P2 |

---

## 5. Platform-Specific Requirements

### 5.1 iOS Requirements

- Minimum iOS version: 14.0
- Required capabilities:
  - Location (Always + When In Use)
  - Camera
  - Photo Library (read-only, for profile)
  - Background fetch
  - Push notifications

### 5.2 Android Requirements

- Minimum SDK: API 24 (Android 7.0)
- Required permissions:
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_BACKGROUND_LOCATION`
  - `CAMERA`
  - `READ_EXTERNAL_STORAGE`
  - `FOREGROUND_SERVICE`

---

## 6. Integration Requirements

### 6.1 Shared Packages (From Web Monorepo)

| Package | Usage | Adaptation Needed |
|---------|-------|-------------------|
| `@janpams/types` | TypeScript interfaces | None - direct import |
| `@janpams/core/pluscode` | Plus Code encode/decode | None - pure TypeScript |
| `@janpams/core/address` | House number algorithm | None - pure TypeScript |
| `@janpams/core/offline` | Sync queue logic | Replace IndexedDB with SQLite |
| `@janpams/core/geolocation` | Trust policy | Replace `navigator.geolocation` with `expo-location` |

### 6.2 Native Replacements

| Web Technology | Mobile Replacement |
|----------------|--------------------|
| MapLibre GL JS | `react-native-maps` or Mapbox RN SDK |
| IndexedDB (`idb`) | `expo-sqlite` |
| `navigator.geolocation` | `expo-location` |
| Browser Camera | `expo-camera` |
| Local Storage | `expo-secure-store` |

### 6.3 Backend Integration

- **API:** Same Supabase/Lovable Cloud backend
- **Auth:** Supabase Auth with token refresh
- **Storage:** Same Cloud Storage buckets
- **Edge Functions:** Same endpoints, no changes needed

---

## 7. Constraints & Assumptions

### 7.1 Constraints

| ID | Constraint |
|----|------------|
| C-01 | Must use Expo managed workflow initially (eject to bare if needed later) |
| C-02 | Cannot use web-only npm packages (MapLibre, idb) |
| C-03 | Must support devices with limited storage (< 2GB free) |

### 7.2 Assumptions

| ID | Assumption |
|----|------------|
| A-01 | Users have smartphones with GPS capability |
| A-02 | Intermittent network (3G minimum when available) |
| A-03 | Users may be in areas with no cell coverage for hours |
| A-04 | Backend APIs remain unchanged |

---

## 8. Success Criteria

| Metric | Target |
|--------|--------|
| Successful address creation (offline) | 100% |
| Sync success rate (when online) | > 99% |
| GPS L1 trust achievement | > 80% of captures |
| User task completion (create address) | < 60 seconds |
| App crash rate | < 0.1% |

---

## 9. Out of Scope (Phase 1)

- Admin review dashboard (web-only)
- Push notification triggers
- AR/VR features
- Apple Watch / WearOS companion
- Tablet-optimized layouts

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Plus Code** | Open Location Code - 10-character geocode |
| **L1 Trust** | High accuracy GPS (≤15m) |
| **L2 Trust** | Acceptable accuracy GPS (≤50m) |
| **Data Pack** | Downloadable bundle of streets/boundaries for a region |
| **Field Agent** | Municipal employee registering addresses |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | JanPAMS Team | Initial version |
