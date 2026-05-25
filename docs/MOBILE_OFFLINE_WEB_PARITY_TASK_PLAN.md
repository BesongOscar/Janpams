# Mobile Offline Web Parity — Task Details & Implementation Plan

**Goal:** Implement all web (mbukanji-maps) offline features on mobile (address-maker-glopams) so that the same capabilities work on both platforms.

**Final goal:** Ensure the architecture and behaviour of the mobile app match the web app. This includes full authentication flow, local database schema identical to web’s IndexedDB, and the offline/addressing/navigation behaviour described in this plan.

**Out of scope:** Location Plan (corridor building, saved plans, PDF export). Do not implement Location Plan on mobile.

**Reference:** Web implementation lives in `apps/core/mbukanji-maps/` (IndexedDB, Valhalla, JAPA lifecycle, POIs, route cache, navigation). Mobile baseline: `apps/core/address-maker-glopams/` (SQLite, sync, data packs without POIs/Valhalla/JAPA).

**Detailed task plan for DB + Auth:** For step-by-step tasks (schema audit, local_user_roles migration, SecureStore, single logout, roles API → SQLite, etc.), see **`docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`**.

---

## Monorepo sharing principle (important)

**The monorepo exists so that mobile and web can share core logic.** Before adding new behavior:

1. **Prefer `packages/core`** — Types, POI classification, search normalization, routing helpers, and other domain logic should live in `@janpams/core` when they are needed by both apps. Use `packages/core` as the single source of truth for shared types and algorithms.
2. **App code = platform glue** — Each app (`mbukanji-maps`, `address-maker-glopams`) should contain only platform-specific glue: UI, storage adapters (IndexedDB vs SQLite), and app-specific config. Shared types and business rules belong in `packages/core`.
3. **When adding parity features** — First check if `packages/core` already exports the type or function (e.g. `poi/`, `search/`, `routing/`). If yes, import from `@janpams/core` instead of duplicating in the app. If it does not exist in core but is shared logic, add it to `packages/core` and then use it from both apps.

**Phase 1 note:** Some logic was implemented app-local in mobile (e.g. POI classification in `lib/poi/buildPOIFromOSM.ts`, POI/route types in `lib/db/schemas.ts`). Before or during further integration, refactor to use `@janpams/core` where it already exists (e.g. `packages/core/src/poi/`) and add any missing shared pieces to core so web and mobile stay in sync.

---

## 1. Gap Overview

| # | Gap | Web | Mobile | Phase |
|---|-----|-----|--------|-------|
| 1 | Data pack source | Prod VPS | ✅ Configurable (prod/staging) | 0 |
| 2 | POIs in packs | ✅ | ✅ | 1 |
| 3 | Route cache (OSRM) | ✅ | ✅ | 1 |
| 4 | Search index repair on startup | ✅ | ✅ | 1 |
| 5 | JAPA pack lifecycle (staging/validate/install) | ✅ | ✅ | 2 |
| 6 | Route path (Dijkstra + OSRM fallback) | ✅ | ✅ | 3 |
| 7 | Valhalla offline routing | ✅ | ✅ | 4 |
| 8 | Navigation UI (turn-by-turn, “no routing data”) | ✅ | ✅ | 5 |

---

## 1.1 Definition of done: Web–mobile gaps implementation

**Web–mobile gaps implementation is done** when all of the following are true:

1. **Scope** — Every capability listed in the Gap Overview (§1) that exists on **web** (mbukanji-maps) and is **in scope for mobile** is implemented on **mobile** (address-maker-glopams). The only differences between web and mobile are platform adapters (e.g. IndexedDB vs SQLite, Worker vs main thread), not missing features.

2. **Gap checklist** — All 8 gaps are closed on mobile:
   - Gap 1: Data pack source configurable (prod/staging VPS).
   - Gap 2: POIs in packs (schema, download, storage, search index).
   - Gap 3: Route cache (schema, download, storage, lookup).
   - Gap 4: Search index validate/repair on startup.
   - Gap 5: JAPA pack lifecycle (staging, state machine, cleanup).
   - Gap 6: Route path (cached route → Dijkstra → fallback; `getRoute`).
   - Gap 7: Valhalla offline routing (tiles, provider, init, use in `getRoute`).
   - Gap 8: Navigation UI (route directions, "no routing data", link to data packs, OfflineDataManager routing badge).

3. **Polish & testing** — Phase 6 is complete: search index status in UI, optional nearest POI in reverse geocode, integration tests for pack install / route path / search POI, and mobile offline docs updated (including routing steps and out-of-scope statement).

4. **Out of scope is not a gap** — **Location Plan is not implemented on mobile by design.** Corridor building, saved location plans, PDF export, CreateLocationPlanPage, LocationPlanInfoPanel, and PreviewLocationPlanPage are **out of scope** for mobile. Their absence on mobile does **not** count as a gap; parity is defined only over in-scope offline features (data packs, POIs, route cache, search, JAPA, route path, Valhalla, navigation).

**Summary:** Parity is achieved when mobile has the same offline capabilities as web for data packs, POIs, routes, search, JAPA, Valhalla, and navigation, with Location Plan explicitly excluded from mobile scope.

---

## 1.2 Full authentication flow (parity with web)

**Objective:** Mobile’s full authentication behaviour matches web: session lifecycle, login, signup, token storage, refresh, logout, roles, protected routes, and profile/account flows.

**Auth & session —** The following summarizes web vs mobile auth. For step-by-step implementation tasks (SecureStore, single logout, roles API → SQLite, lockout, session expiry, protected routes, profile/delete account) and the **runnable testing checklist**, see **`docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`** (Parts B, D, E).  
**Supabase parity (recommended):** To make mobile auth and roles **identical** to the web (same provider and same roles source), see **`docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`**. That task replaces Laravel auth with Supabase Auth and Laravel GET `/auth/roles` with Supabase `user_roles`; it is the recommended approach for full parity.

### Web auth (reference)

- **Provider:** Supabase Auth.
- **Session:** `supabase.auth.getSession()` on load; `onAuthStateChange` keeps `user` and `session` in sync; `session.expires_at` exposed as `sessionExpiresAt`.
- **Login:** Email or phone + password/pin; lockout after N failed attempts (e.g. 15 min); success → session via `onAuthStateChange`.
- **Signup:** Email or phone signup; OTP verification; optional profile data.
- **Profile:** Update profile; initiate/verify contact change (OTP); delete account (password).
- **Logout:** `supabase.auth.signOut()`; state cleared by `onAuthStateChange`.
- **Roles:** Fetched from Supabase `user_roles`; cached in localStorage.
- **Protected routes:** `ProtectedRoute` uses `isAuthenticated` / `isLoading`; unauthenticated → show auth modal or redirect.

### Mobile auth (current — Laravel-based)

- **Provider:** Custom backend (`/auth/login`, `/auth/refresh`, `/auth/logout`).
- **Storage:** SecureStore (expo-secure-store) for `userId` and `refresh_token` when available; AsyncStorage fallback. Access token in memory only (axios header). See `utils/secureAuthStorage.ts`.
- **Session restore:** On app load (`app/index.tsx`), `getAuthTokens()` → if present, `/auth/refresh` → `updateAuthHeader(access_token)`, `setAuthTokens` if new refresh_token → fetch user → `setUser`. Session expiry from JWT `exp` exposed as `sessionExpiresAt` in context.
- **Token refresh:** On 401 and on app resume after 15+ min; single refresh at a time; on failure → `performLogout()` + logout callback → replace to login.
- **Logout:** Single path: `performLogout()` (clear tokens, clear header, optional backend logout) then `triggerLogoutNavigation()` (clear user, `router.replace('/(auth)/login')`). Used from Drawer and from 401 handler.
- **Login lockout:** After 5 failed attempts, lock 15 minutes; count and lockout stored in AsyncStorage; reset on success. See `utils/loginAttempts.ts` and login screen.
- **Roles:** Fetched from GET `/auth/roles` after login and upserted into SQLite `local_user_roles` (AppRole only). Offline: read from SQLite. See `lib/rolesSync.ts`, `lib/db/userRoles.ts`. *(Note: Laravel route may not exist; for identical behaviour to web use Supabase — see below.)*
- **Protected routes:** (tabs) layout checks `user` and `isAuthLoading`; if !user && !isAuthLoading → replace to login.
- **Profile / delete account:** Update profile screen with API and errors; delete account with password/pin confirmation, then `performLogout()` + `triggerLogoutNavigation()`.

### Mobile auth (target — Supabase parity, identical to web)

- **Provider:** Supabase Auth (same as web). **Task:** See **`docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`**.
- **Session:** `supabase.auth.getSession()` on load; `onAuthStateChange` keeps `user` and `session` in sync; `session.expires_at` → `sessionExpiresAt`.
- **Login:** Supabase `signInWithPassword` (email/password) and same phone/OTP flows as web; lockout (5 attempts, 15 min) retained on mobile.
- **Logout:** `supabase.auth.signOut()`; then clear context and `router.replace('/(auth)/login')`.
- **Roles:** Fetched from Supabase `user_roles` (`supabase.from('user_roles').select('role').eq('user_id', user.id)`), same as web; upserted into SQLite `local_user_roles` for offline. No GET `/auth/roles`.
- **Token storage:** Supabase client uses React Native–compatible storage (e.g. AsyncStorage adapter) for session; no Laravel refresh_token/userId for primary auth.
- **Protected routes / profile / delete account:** Unchanged in behaviour; user comes from Supabase session.

### Target: full auth behaviour parity checklist

1. **Session lifecycle** — Startup: restore session from storage; if valid set user/session; if invalid/expired clear and show login. In-session: access token in memory; on 401 → one-at-a-time refresh → retry; on refresh failure → full logout (clear storage, header, navigate to login). Logout: clear all auth state, clear header, call backend logout, navigate to login, prevent back-stack to authenticated screens.
2. **Login** — Same identifiers as web where possible (email, phone). After success: persist `userId` + `refresh_token`; set access token in header; set user in context; optionally fetch and store roles. Optional: login attempt lockout (e.g. N failed → lock 15 min; reset on success).
3. **Signup** — If web has signup + OTP, mobile has equivalent (signup → verify OTP → treated as logged in). Same profile fields where applicable.
4. **Token storage** — Prefer **SecureStore** (e.g. `expo-secure-store`) for `refresh_token` and optionally `userId` on mobile instead of AsyncStorage; access token in memory only. Document if AsyncStorage is kept as a known gap.
5. **Session expiry and proactive refresh** — Keep proactive refresh on app resume (e.g. 15+ min). Optionally refresh shortly before access-token expiry when app is foregrounded.
6. **Logout** — Single implementation: clear tokens (and any auth keys), clear auth header, call backend `/auth/logout`, set user/session to null, navigate to login; use from both user-initiated and 401 refresh failure.
7. **Roles** — Prefer roles from backend API (like web’s Supabase `user_roles`) with local cache in SQLite. Store **AppRole** in SQLite (`basic_user`, `advanced_agent`, `org_admin`, `system_admin`). After login (and optionally on restore), fetch roles from API and upsert into `local_user_roles`; when offline use last synced roles from SQLite. Remove legacy role enum from DB and from `useEffectiveRole` mapping.
8. **Protected routes** — All authenticated screens behind a gate (has valid user/session); if not (and not loading), redirect to login; single `isAuthenticated` and `isLoading` from context.
9. **Profile and account** — If web has update profile, change contact (OTP), delete account, implement equivalent on mobile with same success/error behaviour.
10. **Error and edge cases** — Clear messages for network errors during login/signup/refresh; no half-logged-in state. Refresh in progress: block duplicate refresh; queue requests and retry with new token. On refresh failure always clear local state and redirect to login.

---

## 1.3 Database migration (SQLite identical to web IndexedDB)

**Objective:** Mobile SQLite schema and enums match web’s IndexedDB (v14) so architecture and sync behaviour align.

### Schema alignment

- **Tables/stores:** Ensure every web IndexedDB store has a corresponding SQLite table with same logical fields and types (TEXT/INTEGER/REAL/BLOB, JSON where needed). CHECK constraints for enums must match web (status, role, state, etc.).
- **Critical:** In `local_user_roles`, store **AppRole** only: `'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin'`. Add a migration (e.g. schema version bump) that migrates existing rows from legacy enum (`user`, `field_agent`, `municipality_admin`, `system_admin`) to AppRole. No code path should write the old enum.
- **data_packs / pack_state / staging:** Add any missing columns to `data_packs` (e.g. `valhalla_tile_count`, `poi_count`, `settlement_place_count` if present on web’s manifest). Ensure `pack_state`, `pack_staging`, and staging tables match web structure and state enums.
- **Indexes:** Every IndexedDB index has an equivalent SQLite index (by-sync-status, by-packId, by-user-id, etc.).

### Roles and auth

- After login (and on session restore if roles API exists), fetch roles from backend and upsert into `local_user_roles` with AppRole so offline behaviour and DB content match web.
- Update `lib/db/userRoles.ts` and `useEffectiveRole` to use AppRole directly from DB (remove LocalAppRole mapping).

### Addressing, navigation, data packs

- Addressing, navigation, and data pack flows already use the same logical schema; verify all reads/writes use the aligned schema and enums. Sync queue and backend contract should assume same field names and enums as web.

---

## 1.4 Things you may have missed (advice)

1. **Auth provider split** — Web uses Supabase; mobile uses custom backend. For behaviour parity you don’t have to move mobile to Supabase; ensure same flows (login, signup, OTP, logout, session restore, refresh), same semantics (lockout, session expiry, single logout), and same role semantics. **Recommended:** Make mobile identical to web by moving mobile to Supabase Auth and Supabase `user_roles`; see **`docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`**. That gives the same provider, same roles source, and same semantics (lockout, session expiry, single logout) as web.
2. **Secure storage for tokens** — Docs mention SecureStore; code uses AsyncStorage. For parity in “how securely we store credentials,” move refresh token (and optionally userId) to SecureStore and document in the plan.
3. **Single logout implementation** — Ensure both user-initiated logout (e.g. Drawer) and interceptor-triggered logout (refresh failure) call the same routine: clear tokens, clear header, call backend logout, set user to null, navigate to login.
4. **Back stack after logout** — Use `router.replace('/(auth)/login')` (or equivalent) so the user cannot go back to tabs after logout.
5. **Session expiry in UI** — Web exposes `sessionExpiresAt`. If desired, store access_token (or refresh_token) expiry when receiving tokens and expose in context; optionally show a warning or force re-login when expired.
6. **Roles sync timing** — Decide when to write to `local_user_roles`: (1) right after login when API returns roles, or (2) after a dedicated “get my roles” call. Ensure offline reads from SQLite.
7. **Deep links / password reset** — If web supports reset password or magic links that open the app, mobile should handle the same links (e.g. expo linking) and complete the same flow.
8. **Consent and privacy** — If web shows consent or terms on first login/signup, mobile should mirror that.
9. **Testing checklist** — (1) Fresh install → login → close app → reopen → still logged in. (2) Login → wait for access token expiry → trigger API call → refresh then success. (3) Login → force refresh failure → redirect to login and no token in storage. (4) Logout from Drawer → tokens cleared, backend called, cannot go back. (5) basic_user role from API → stored in SQLite as `basic_user` → map tap restriction applies.
10. **Documentation** — Keep one “Auth & session” section in the parity doc: web auth (Supabase, session, roles, lockout, logout); mobile auth (API, tokens, SecureStore vs AsyncStorage, refresh, logout); and the full auth checklist above.

---

## 2. Phase 0 — Configuration & Pack Source

**Objective:** Use the same data pack source as web in production so pack format (POIs, Valhalla, routes) and manifest fields align.

### Task 0.1 — Add configurable VPS URL

| Field | Detail |
|-------|--------|
| **Description** | Add an environment or config value for the data pack base URL. Production should use the same URL as web; staging can keep current URL for dev. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts`: `VPS_DATA_URL = 'https://datapack.janpams.com/osm-data'` |
| **Mobile reference** | `lib/dataPacks/downloader.ts`: `VPS_DATA_URL = 'https://openstreetmap-data.staging.mbukanji.org/osm-data'` |
| **Acceptance criteria** | (1) `VPS_DATA_URL` is read from config/env (e.g. `process.env.EXPO_PUBLIC_VPS_DATA_URL` or app config). (2) Default or prod build points to `https://datapack.janpams.com/osm-data`. (3) Staging/dev can override to current staging URL. (4) `getAvailableDataPacks` and pack download use this base for `manifest.json` and pack URLs. |
| **Files to create/update** | `lib/dataPacks/downloader.ts` (use config); optionally `app.config.js` or `.env` and docs. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

---

## 3. Phase 1 — Data & Search Parity (No Routing Yet)

**Objective:** Add POIs, route cache, and search index validate/repair so mobile has the same data model and search behavior as web.

### Task 1.1 — Add POI schema and DB layer

| Field | Detail |
|-------|--------|
| **Description** | Add `pois` table to SQLite and a small DB module for CRUD. Schema must match web’s `POIRecord`. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: `POIRecord` (id, osm_id, osm_type, lat, lon, name, name_en, name_fr, brand, operator, category, subcategory, tier, tags, stabilityScore, packId, countryCode, searchTokens?, cached_at). Object store `pois` with indexes by-packId, by-tier, by-category. |
| **Acceptance criteria** | (1) `lib/db/sqlite-schema.ts`: new `pois` table with columns matching web (JSON for tags/geometry if needed). (2) `lib/db/schemas.ts`: add `POIRecord`, `POICategory`, `POITier`, `POIOSMTags` types matching web. (3) `lib/db/indexes.ts`: indexes for packId, tier, category. (4) New `lib/db/pois.ts`: `batchCreate`, `deleteByPack`, `getByPackId`, optional `getNearest(lat, lon, limit)`. (5) Bump `SQLITE_SCHEMA_VERSION` and add migration in `lib/db/migrations.ts`. (6) `lib/db/index.ts`: export new module. |
| **Files to create/update** | `lib/db/sqlite-schema.ts`, `lib/db/schemas.ts`, `lib/db/indexes.ts`, `lib/db/migrations.ts`, **create** `lib/db/pois.ts`, `lib/db/index.ts`. |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

### Task 1.2 — Parse and store POIs in data pack download

| Field | Detail |
|-------|--------|
| **Description** | When downloading a pack, parse `pois` (or GeoJSON POI layer) from the pack payload and insert into `pois` table. Normalize to `POIRecord` (category, subcategory, tier from OSM tags). |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts`: POI loop, `buildPOIFromOSM`, `storePOIs`; web uses staging then commit — for Phase 1 can write directly to prod; Phase 2 will move to staging. |
| **Acceptance criteria** | (1) In `lib/dataPacks/downloader.ts`, after parsing streets/boundaries/settlements, if pack has `pois` array (or equivalent GeoJSON), iterate and normalize each to `POIRecord`. (2) Use same category/subcategory/tier mapping as web (or shared helper). (3) Call `batchCreate` (or equivalent) in `lib/db/pois.ts` to insert. (4) If pack has no POIs, skip without error. (5) Manifest/stats may include `poi_count` for UI; optional in Phase 1. |
| **Files to create/update** | `lib/dataPacks/downloader.ts`; optionally a small `lib/poi/` or shared normalization (can copy from web `buildPOIFromOSM` logic). |
| **Dependencies** | Task 1.1. |
| **Estimated effort** | Medium. |

### Task 1.3 — Add route_cache schema and DB layer

| Field | Detail |
|-------|--------|
| **Description** | Add `route_cache` table and a route-cache module matching web’s API so pre-computed routes can be stored and looked up. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: `CachedRoute` (id, startCoord, endCoord, startPOIId?, endPOIId?, path, distance, duration?, source, quality, packId, cachedAt, expiresAt?). `RouteSource`, `RouteQuality`. Store indexes by-packId, by-quality. `apps/core/mbukanji-maps/src/lib/routing/routeCache.ts`: routeCoordHash, cacheRoute, findCachedRoute, findCachedRouteReverse, findAndTrimCachedRoute, getRoutesForPack, clearRoutesForPack, getRouteCacheStats. |
| **Acceptance criteria** | (1) `lib/db/sqlite-schema.ts`: new `route_cache` table; coords/path stored as JSON text. (2) `lib/db/schemas.ts`: add `CachedRoute`, `RouteSource`, `RouteQuality`. (3) **Create** `lib/routing/routeCache.ts` (or `lib/db/routeCache.ts`): implement `routeCoordHash`, `cacheRoute`, `findCachedRoute`, `findCachedRouteReverse`, `findAndTrimCachedRoute`, `getRoutesForPack`, `clearRoutesForPack`, `getRouteCacheStats` using SQLite. (4) Bump schema version and add migration. (5) Export from `lib/db/index.ts` or `lib/routing/index.ts` as appropriate. |
| **Files to create/update** | `lib/db/sqlite-schema.ts`, `lib/db/schemas.ts`, `lib/db/indexes.ts`, `lib/db/migrations.ts`, **create** `lib/routing/routeCache.ts` (and `lib/routing/index.ts` if new). |
| **Dependencies** | None. |
| **Estimated effort** | Medium. |

### Task 1.4 — Store pre-computed routes from pack download

| Field | Detail |
|-------|--------|
| **Description** | If the pack JSON contains a `routes` array (pre-computed OSRM segments), persist each route into `route_cache`. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts`: `DataPackContent.routes` (id, start_poi_id, start_coord, end_coord, path, distance, duration); web stores during pack processing. |
| **Acceptance criteria** | (1) In `lib/dataPacks/downloader.ts`, when processing pack content, if `routes` array exists, for each route call `cacheRoute` with startCoord, endCoord, path, distance, duration, source (e.g. 'osrm_vps'), quality 1, packId. (2) Use same hash as web for `id` (routeCoordHash(startCoord, endCoord)). (3) On pack delete, call `clearRoutesForPack(regionCode)`. (4) No failure if pack has no routes. |
| **Files to create/update** | `lib/dataPacks/downloader.ts`, `lib/dataPacks/manager.ts` (uninstall calls clearRoutesForPack). |
| **Dependencies** | Task 1.3. |
| **Estimated effort** | Small. |

### Task 1.5 — Include POIs in search index

| Field | Detail |
|-------|--------|
| **Description** | Extend the search index builder to index POIs from the `pois` table so POI names/categories appear in search results. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/search/searchIndex.ts`: `buildPackIndex` accepts POIs; web indexes streets, admins, addresses, and POIs. |
| **Acceptance criteria** | (1) In `lib/search/searchIndex.ts`, extend `buildPackIndex` to accept an optional `pois` array (or load by packId from DB). (2) For each POI, build search tokens (name, category, subcategory) and add to search_items and search_tokens. (3) `removePackIndex` removes POI-derived items for that pack. (4) Search query returns POIs where relevant; type/subtitle distinguish POI vs address vs street. |
| **Files to create/update** | `lib/search/searchIndex.ts` (and any search query layer that filters by type). |
| **Dependencies** | Task 1.1. |
| **Estimated effort** | Medium. |

### Task 1.6 — Search index validate/repair on startup

| Field | Detail |
|-------|--------|
| **Description** | On app startup, after DB is ready, run search index validate/repair (schema version, crash flag, missing/version-mismatch packs, orphaned indexes) so search is reliable after upgrades or interrupted installs. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/syncManager.ts`: `validateSearchIndex()` in init; calls `validateAndRepair(installedPacks, log)` from search; sets searchIndexStatus; `waitForSearchIndex()`. |
| **Acceptance criteria** | (1) In `lib/syncManager.ts` `init()`, after `checkAndRepairDB()`, get list of installed packs (from `data_packs` table; or later from pack_state where state = INSTALLED). (2) Call `validateAndRepair(installedPacks, (msg) => console.log(...))` from `lib/search`. (3) Optionally expose `searchIndexStatus` and `waitForSearchIndex()` on SyncManager for UI. (4) Do not block app if validateAndRepair throws; log and set status to error. |
| **Files to create/update** | `lib/syncManager.ts`; ensure `lib/search/searchIndex.ts` exports `validateAndRepair` and it works with SQLite (already present on mobile). |
| **Dependencies** | Task 1.5 (so POIs are part of index and repair). |
| **Estimated effort** | Small. |

---

## 4. Phase 2 — JAPA Pack Lifecycle

**Objective:** Introduce staging tables and a strict state machine (DOWNLOADING → STAGING → VALIDATING → INSTALLING → INSTALLED | FAILED) so installs are atomic and validated.

### Task 2.1 — Add pack_state and staging tables to schema

| Field | Detail |
|-------|--------|
| **Description** | Add SQLite tables: `pack_state`, `street_segments_stg`, `admin_boundaries_stg`, `settlement_places_stg`, `pois_stg`, `pack_staging`. Match web schema. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: pack_state (regionCode, state, updatedAt); *_stg stores with same shape as prod; pack_staging (id = regionCode). |
| **Acceptance criteria** | (1) `lib/db/sqlite-schema.ts`: add all six tables with columns/indexes matching web. (2) `lib/db/schemas.ts`: add `PackStateRecord`, `PackState` type. (3) Migrations and schema version bump. (4) No data in staging by default. |
| **Files to create/update** | `lib/db/sqlite-schema.ts`, `lib/db/schemas.ts`, `lib/db/indexes.ts`, `lib/db/migrations.ts`. |
| **Dependencies** | Task 1.1 (pois already exist; pois_stg is new). |
| **Estimated effort** | Medium. |

### Task 2.2 — Implement japaState helpers

| Field | Detail |
|-------|--------|
| **Description** | Implement pack lifecycle helpers: setPackState, getPackState, getInstalledPacks (only INSTALLED), purgeTmpAndStagingForRegion, cleanupStagingOnRestart. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/japaState.ts` (web); `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts` (setPackState, getPackState, purgeTmpAndStagingForRegion usage). |
| **Acceptance criteria** | (1) **Create** `lib/japaState.ts`: `setPackState(regionCode, state)`, `getPackState(regionCode)` (default NOT_INSTALLED), `getInstalledPacks()` (only rows where state = INSTALLED; fallback to all data_packs if pack_state empty for backward compat). (2) `purgeTmpAndStagingForRegion(regionCode)`: delete from all _stg tables and pack_staging for that region; if state ≠ INSTALLED set state to NOT_INSTALLED. (3) `cleanupStagingOnRestart()`: for every pack_state row where state ≠ INSTALLED, call purgeTmpAndStagingForRegion and set NOT_INSTALLED. (4) No Valhalla yet; Valhalla staging purge can be added in Phase 4. |
| **Files to create/update** | **Create** `lib/japaState.ts`; ensure DB has getDB and table access. |
| **Dependencies** | Task 2.1. |
| **Estimated effort** | Small. |

### Task 2.3 — Refactor downloader to use staging and state machine

| Field | Detail |
|-------|--------|
| **Description** | Refactor pack download so data is written to staging tables and committed to prod only after validation. States: DOWNLOADING → STAGING → VALIDATING → INSTALLING → INSTALLED (or FAILED). |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts`: setPackState at each step; write to _stg; validate counts vs manifest; single transaction copy STG → prod; then purge staging. |
| **Acceptance criteria** | (1) At start of download: setPackState(regionCode, DOWNLOADING). (2) Fetch pack; parse into staging tables (street_segments_stg, admin_boundaries_stg, settlement_places_stg, pois_stg); write manifest to pack_staging; setPackState(STAGING) then VALIDATING. (3) Validation: compare counts (streets, boundaries, settlements, POIs) to manifest; if mismatch or missing required data, call purgeTmpAndStagingForRegion, setPackState(FAILED), throw clear error. (4) setPackState(INSTALLING). (5) Single transaction: copy from _stg to prod tables, insert into data_packs; setPackState(INSTALLED). (6) Call purgeTmpAndStagingForRegion(regionCode). (7) On any error after DOWNLOADING: setPackState(FAILED), purge staging, rethrow. (8) Build search index after commit (buildPackIndex for this pack). (9) clearRoutesForPack on rollback if applicable. |
| **Files to create/update** | `lib/dataPacks/downloader.ts` (major refactor); use `lib/japaState.ts`. |
| **Dependencies** | Task 2.2, Task 1.3 (clearRoutesForPack), Task 1.5 (buildPackIndex with POIs). |
| **Estimated effort** | Large. |

### Task 2.4 — Call cleanupStagingOnRestart on app init

| Field | Detail |
|-------|--------|
| **Description** | Once per app launch, after DB init, run cleanupStagingOnRestart so any interrupted install leaves no orphaned staging data. |
| **Web reference** | Web runs this in worker/app init. |
| **Acceptance criteria** | (1) Call `cleanupStagingOnRestart()` from SyncManager.init() (or from root layout effect, or from a single “DB ready” hook). (2) Only once per cold start. (3) Do not block UI; can be fire-and-forget with log. |
| **Files to create/update** | `lib/syncManager.ts` or `app/_layout.tsx` (or equivalent). |
| **Dependencies** | Task 2.2. |
| **Estimated effort** | Small. |

### Task 2.5 — OfflineDataManager shows pack state

| Field | Detail |
|-------|--------|
| **Description** | Show current pack state (Downloading, Validating, Installing, Failed) in Offline Data Manager and disable conflicting actions. |
| **Web reference** | Web OfflineDataManager shows state and progress. |
| **Acceptance criteria** | (1) Use getPackState(regionCode) per region; show badge or label: Not installed, Downloading, Validating, Installing, Installed, Failed. (2) While state is not NOT_INSTALLED or INSTALLED, disable uninstall for that pack; show progress or spinner for DOWNLOADING/VALIDATING/INSTALLING. (3) On Failed, show short message and allow retry (e.g. uninstall then download again). |
| **Files to create/update** | `components/OfflineDataManager/index.tsx`, `components/OfflineDataManager/RegionItem.tsx`, `components/OfflineDataManager/DownloadedPackItem.tsx`. |
| **Dependencies** | Task 2.2. |
| **Estimated effort** | Small. |

---

## 5. Phase 3 — Route Path (Dijkstra + OSRM Fallback)

**Objective:** Implement path computation between two points using cached OSRM routes first, then Dijkstra on street graph, then perpendicular access fallback.

### Task 3.1 — Port route path algorithm

| Field | Detail |
|-------|--------|
| **Description** | Port web’s `generateRoutePath(start, end, options)` to mobile: (1) try findCachedRoute/findAndTrimCachedRoute, (2) build graph from street_segments and run Dijkstra, (3) perpendicular access fallback. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/routePath.ts` (and shared `packages/core` routePath if any); `apps/core/mbukanji-maps/src/lib/routing/routeCache.ts`. |
| **Acceptance criteria** | (1) **Create** `lib/routePath.ts` (or under `lib/routing/`): `generateRoutePath(startLonLat, endLonLat, options?)` returns path (coordinates), distance, success, debug (algorithm, routeQuality). (2) Use mobile DB for street_segments and mobile route_cache module. (3) Spatial helpers: bbox, distanceToSegment, graph construction, Dijkstra; port or reuse from web/package. (4) Options may include packId filter, maxDistance. (5) Unit or integration tests for cached hit, Dijkstra path, fallback. |
| **Files to create/update** | **Create** `lib/routePath.ts`; optionally `lib/routing/index.ts`; reuse `lib/search/spatialQueries.ts` or add geometry helpers. |
| **Dependencies** | Task 1.3 (route cache), Task 1.1 (street_segments; already present). |
| **Estimated effort** | Large. |

### Task 3.2 — Expose route path for navigation

| Field | Detail |
|-------|--------|
| **Description** | Expose a single “get route from A to B” API that uses route path (Phase 3) and will later use Valhalla when available (Phase 4). |
| **Acceptance criteria** | (1) Single function or hook, e.g. `getRoute(start, end)` that for now returns result of `generateRoutePath`. (2) Later (Phase 4) this can call Valhalla first and fall back to generateRoutePath. (3) Return type includes path, distance, and optional steps/maneuvers for UI. |
| **Files to create/update** | `lib/routing/index.ts` or `lib/navigation/routeResolver.ts` (thin wrapper). |
| **Dependencies** | Task 3.1. |
| **Estimated effort** | Small. |

---

## 6. Phase 4 — Valhalla Offline Routing

**Objective:** Run Valhalla WASM on device, store tiles in SQLite or file system, load tiles when pack is installed, and compute turn-by-turn routes.

### Task 4.1 — Valhalla WASM on React Native

| Field | Detail |
|-------|--------|
| **Description** | Determine how to run `@jansoft/mbujkanji-valhalla-wasm` on React Native (main thread or worker). Implement minimal init + route() test. |
| **Web reference** | Web uses a Web Worker and Cache API for tiles; mobile has no Worker/Cache API. |
| **Acceptance criteria** | (1) Add dependency `@jansoft/mbujkanji-valhalla-wasm` (or RN-compatible build if different). (2) If WASM runs on main thread: ensure it doesn’t block UI (e.g. route in requestIdleCallback or setTimeout). (3) If RN has a worker/thread API (e.g. expo-task-manager or JSI), consider running Valhalla there. (4) Document decision and any limitations. (5) Minimal test: init with glue URLs (bundled or file paths), loadTiles(small buffer), route(two points) returns path. |
| **Files to create/update** | New small test screen or dev menu; `package.json`; docs. |
| **Dependencies** | None (spike). |
| **Estimated effort** | Medium–Large (spike). |

### Task 4.2 — Valhalla tile storage on mobile

| Field | Detail |
|-------|--------|
| **Description** | Design and implement storage for Valhalla tile blobs (per region). Web uses Cache API; mobile uses SQLite BLOB table or expo-file-system files. |
| **Web reference** | `apps/core/mbukanji-maps/packages/core/src/routing/valhallaCache.ts`: hasProdTilesForRegion, getTilesArrayBufferForRegion, storeValhallaTilesForPack, commitValhallaStagingToProd, clearValhallaTilesForPack, hasStagingTilesForRegion. |
| **Acceptance criteria** | (1) **Create** `lib/valhalla/tileStorage.ts` (or similar): `storeValhallaTilesForPack(regionCode, tiles[])`, `getTilesArrayBufferForRegion(regionCode)`, `hasProdTilesForRegion(regionCode)`, `clearValhallaTilesForPack(regionCode)`. (2) Staging: either separate table/dir for staging and `commitValhallaStagingToProd(regionCode)` that moves/copies to prod. (3) Storage can be one BLOB per region (tar) or one row per tile; getTilesArrayBufferForRegion must return a single ArrayBuffer that Valhalla loadTiles() accepts. (4) Integrate with JAPA: on pack install, after committing prod tables, commit Valhalla staging to prod; on purge staging, clear Valhalla staging for that region. |
| **Files to create/update** | **Create** `lib/valhalla/tileStorage.ts`; possibly new SQLite table `valhalla_tiles` (regionCode, blob) or use file system under expo-file-system. |
| **Dependencies** | Task 2.3 (JAPA install flow). |
| **Estimated effort** | Medium. |

### Task 4.3 — Pack download extracts and stores Valhalla tiles

| Field | Detail |
|-------|--------|
| **Description** | When processing a pack, detect Valhalla tile archive (e.g. valhalla_tiles.tar or *valhalla*.tar); extract and pass to Valhalla tile storage (staging then commit). Validate manifest valhalla_tile_count if present. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/cloudDataPacks.ts`: valhallaTiles from tar; storeValhallaTilesForPack(regionCode, valhallaTiles); commitValhallaStagingToProd in INSTALLING; validation fails if valhalla_tile_count > 0 but no tiles in staging. |
| **Acceptance criteria** | (1) In downloader, when unpacking tar/tar.gz, if a file matches *valhalla*tiles*.tar (or pack manifest says valhalla_tile_count > 0), treat as Valhalla tile archive. (2) Store blobs via storeValhallaTilesForPack(regionCode, [{ id, blob }]). (3) During VALIDATING, if manifest.valhalla_tile_count > 0 and no Valhalla tiles in staging, fail validation and purge. (4) During INSTALLING, call commitValhallaStagingToProd(regionCode). (5) On purge staging, call clearValhallaStagingForPack(regionCode). |
| **Files to create/update** | `lib/dataPacks/downloader.ts`, `lib/japaState.ts` (purge Valhalla staging). |
| **Dependencies** | Task 4.2, Task 2.3. |
| **Estimated effort** | Medium. |

### Task 4.4 — Valhalla route provider adapter (mobile)

| Field | Detail |
|-------|--------|
| **Description** | Implement the ValhallaRouteProvider interface (init, loadTiles, route) so that shared routing logic can call Valhalla on mobile. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/valhalla/ValhallaService.ts` and worker; `packages/core` valhallaRouter expects getRouteProvider(). |
| **Acceptance criteria** | (1) **Create** `lib/valhalla/ValhallaProvider.ts` (or similar): class or object with `init(glueUrls)`, `loadTiles(buffer)`, `route(request)` returning Promise<{ path, distance } | null>. (2) Uses WASM module from Task 4.1; getGlueUrls returns URLs or file paths to WASM + JS glue. (3) loadTiles is called with buffer from getTilesArrayBufferForRegion. (4) route(request) uses same request shape as web (locations, costing, etc.). (5) Export as singleton or factory so init runs once. |
| **Files to create/update** | **Create** `lib/valhalla/ValhallaProvider.ts` (or split init/worker if needed). |
| **Dependencies** | Task 4.1, Task 4.2. |
| **Estimated effort** | Large. |

### Task 4.5 — Init Valhalla routing on app start

| Field | Detail |
|-------|--------|
| **Description** | Call initValhallaRouting (or equivalent) with options: getInstalledPacks, getPackState, getGlueUrls, getRouteProvider. Load tiles for installed packs when ready. |
| **Web reference** | `apps/core/mbukanji-maps/src/main.tsx`: initValhallaRouting({ ... }); loadTilesForNewPacksIfReady. |
| **Acceptance criteria** | (1) After app and DB are ready, call init with getInstalledPacks from japaState, getPackState from japaState, getGlueUrls from Valhalla provider, getRouteProvider returning mobile provider. (2) Call loadTilesForNewPacksIfReady (or equivalent) so tiles for all INSTALLED packs are loaded into the provider. (3) If Valhalla init fails (e.g. no WASM), log and leave routing to route path fallback; do not crash app. (4) Optional: call loadTilesForNewPacksIfReady after each new pack install. |
| **Files to create/update** | App entry or layout; **create** thin `lib/valhalla/initValhalla.ts` that uses @janpams/core types and mobile japaState + provider. |
| **Dependencies** | Task 4.4, Task 2.2. |
| **Estimated effort** | Medium. |

### Task 4.6 — Use Valhalla in getRoute when available

| Field | Detail |
|-------|--------|
| **Description** | Route resolution should prefer Valhalla when ready and tiles are loaded; fall back to generateRoutePath. |
| **Acceptance criteria** | (1) `getRoute(start, end)` (or equivalent) first checks isValhallaReady(); if true, call getValhallaRoute(start, end). (2) If Valhalla returns null or errors, fall back to generateRoutePath. (3) Return type unified (path, distance, steps if available). |
| **Files to create/update** | `lib/routing/index.ts` or `lib/navigation/routeResolver.ts` (from Task 3.2). |
| **Dependencies** | Task 4.5, Task 3.1. |
| **Estimated effort** | Small. |

---

## 7. Phase 5 — Navigation UI

**Objective:** Add a navigation flow: choose destination, compute route, show turn-by-turn instructions and “no routing data” when needed.

### Task 5.1 — Navigation / route directions screen

| Field | Detail |
|-------|--------|
| **Description** | Add a screen (e.g. Route directions or Navigation) where user can set destination (search, POI, or map tap), start navigation, and see path on map and list of instructions. |
| **Web reference** | NavigationPanel, turn-by-turn list, map follow. |
| **Acceptance criteria** | (1) Screen has destination input (reuse search or POI picker). (2) “Start” or “Get route” calls getRoute(userLocation, destination). (3) Show route polyline on map. (4) Show list of turn-by-turn steps (e.g. “Turn left onto X”, “Continue for 200 m”). (5) Optional: highlight current step and auto-advance by user position. (6) Handle loading and errors (no route found, timeout). |
| **Files to create/update** | New screen under `app/` (e.g. `app/(tabs)/route-directions.tsx` or `app/navigation.tsx`); reuse map component and search; **create** step generator from path (port from web if needed). |
| **Dependencies** | Task 4.6, Task 3.1. |
| **Estimated effort** | Large. |

### Task 5.2 — “No routing data” and link to data packs

| Field | Detail |
|-------|--------|
| **Description** | When no route can be computed because of missing data (no pack, no Valhalla tiles), show a clear message and link to Offline Data Manager. |
| **Web reference** | “No routing data for this region. Install or re-install the area data pack…” with “Manage data packs”. |
| **Acceptance criteria** | (1) If getRoute fails because no installed pack for region or no Valhalla tiles (and no route path fallback), show message: e.g. “No routing data for this area. Download the region data pack for offline routing.” (2) Button or link: “Manage data packs” opens OfflineDataManager. (3) Optional: in OfflineDataManager, show which packs include routing (Valhalla tile count > 0). |
| **Files to create/update** | Navigation screen (Task 5.1); `components/OfflineDataManager` (optional copy or tooltip). |
| **Dependencies** | Task 5.1. |
| **Estimated effort** | Small. |

### Task 5.3 — OfflineDataManager shows routing info

| Field | Detail |
|-------|--------|
| **Description** | In pack list or pack detail, show that a pack includes routing data (Valhalla tile count) so users know why to download. |
| **Acceptance criteria** | (1) Pack stats or list item shows “Routing: Yes” or “Valhalla tiles: N” when pack has valhalla_tile_count > 0. (2) Optional: filter or badge “Includes routing”. |
| **Files to create/update** | `components/OfflineDataManager/DownloadedPackItem.tsx`, `components/OfflineDataManager/RegionItem.tsx`; use manifest or stats. |
| **Dependencies** | Task 4.3 (manifest/storage). |
| **Estimated effort** | Small. |

---

## 8. Phase 6 — Polish & Testing

### Task 6.1 — Optional: search index status in UI

| Field | Detail |
|-------|--------|
| **Description** | If SyncManager exposes searchIndexStatus, show “Search index: validating | ready | error” in OfflineIndicator or settings so users know when search is ready after install. |
| **Acceptance criteria** | (1) SyncManager exposes getSearchIndexStatus() and optionally waitForSearchIndex(). (2) OfflineIndicator or a small status line shows validating/ready/error. (3) Optional: disable search input until ready. |
| **Files to create/update** | `lib/syncManager.ts`, `components/OfflineIndicator.tsx` or settings. |
| **Dependencies** | Task 1.6. |
| **Estimated effort** | Small. |

### Task 6.2 — Optional: nearest POI in reverse geocode

| Field | Detail |
|-------|--------|
| **Description** | Add optional “nearest POI” to offline reverse geocode result for address display parity with web. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/geocoding/reverseGeocode.ts`: findNearestPOI, includePOI option. |
| **Acceptance criteria** | (1) In `lib/geocoding/reverseGeocode.ts`, add option includePOI; when true, query pois by pack and distance, return nearest POI name/category in result. (2) getAddressComponents or callers can use it for display. |
| **Files to create/update** | `lib/geocoding/reverseGeocode.ts`, `lib/db/pois.ts` (getNearest). |
| **Dependencies** | Task 1.1. |
| **Estimated effort** | Small. |

### Task 6.3 — Integration tests

| Field | Detail |
|-------|--------|
| **Description** | Add integration tests for: pack install with POIs and routes; search (with POIs); route path (cached + Dijkstra); and optionally Valhalla route. |
| **Acceptance criteria** | (1) Test: install pack (mock or small fixture) → verify pois and route_cache rows; search returns POI. (2) Test: generateRoutePath with cached route returns path. (3) Test: generateRoutePath without cache uses Dijkstra. (4) Optional: Valhalla route test with stub or small tile set. (5) Tests run in CI. |
| **Files to create/update** | `__tests__/integration/` (e.g. dataPackInstall.test.ts, routePath.test.ts, searchPoi.test.ts). |
| **Dependencies** | Phases 1–3 (and 4 if testing Valhalla). |
| **Estimated effort** | Medium. |

### Task 6.4 — Update mobile offline docs

| Field | Detail |
|-------|--------|
| **Description** | Update MOBILE_OFFLINE_DOWNLOAD_GUIDE and any other mobile offline docs to describe POIs, route cache, JAPA lifecycle, Valhalla, and navigation; explicitly state Location Plan is out of scope. |
| **Acceptance criteria** | (1) Doc lists all new features (POIs, route cache, JAPA, Valhalla, navigation). (2) Steps to download pack and use routing. (3) “Location Plan is not implemented on mobile.” |
| **Files to create/update** | `docs/MOBILE_OFFLINE_DOWNLOAD_GUIDE.md`, `docs/MOBILE_SPECS.md` or new OFFLINE_WEB_PARITY.md. |
| **Dependencies** | All phases. |
| **Estimated effort** | Small. |

---

## 9. Dependency Graph (Summary)

```
Phase 0: Task 0.1
    ↓
Phase 1: 1.1 → 1.2, 1.5  |  1.3 → 1.4
         1.5 → 1.6
    ↓
Phase 2: 2.1 → 2.2 → 2.3, 2.4, 2.5
    ↓
Phase 3: 3.1 → 3.2
    ↓
Phase 4: 4.1 (spike)  4.2 → 4.3
         4.1, 4.2 → 4.4 → 4.5 → 4.6
    ↓
Phase 5: 5.1 → 5.2;  5.3
    ↓
Phase 6: 6.1, 6.2, 6.3, 6.4
```

---

## 10. Out of Scope (Explicit)

- **Location Plan:** Corridor building, saved location plans, PDF export, CreateLocationPlanPage, LocationPlanInfoPanel, PreviewLocationPlanPage. Do not implement on mobile.

---

## 11. Reference File Map (Web → Mobile)

| Web (mbukanji-maps) | Mobile (address-maker-glopams) |
|---------------------|------------------------------|
| **Auth:** `src/contexts/AuthContext.tsx`, `useUserRole.ts` (Supabase session, roles from API + localStorage) | **Auth:** `app/(auth)/login.tsx`, `utils/auth.ts`, `utils/interceptor.ts`, `hooks/users.hooks.ts`, `app/_layout.tsx` (logout callback); roles: `lib/db/userRoles.ts`, `hooks/useEffectiveRole.ts`. See §1.2 (full auth flow), §1.4 (advice). |
| **DB schema:** `src/lib/db.ts` (IndexedDB v14, all stores, AppRole in local_user_roles) | **DB schema:** `lib/db/sqlite-schema.ts`, `lib/db/migrations.ts`, `lib/db/userRoles.ts`. See §1.3 (DB migration: SQLite identical to web). |
| `src/lib/db.ts` (POIRecord, CachedRoute, route_cache, pois, pack_state, *_stg) | `lib/db/sqlite-schema.ts`, `lib/db/schemas.ts`, `lib/db/pois.ts`, `lib/routing/routeCache.ts`, `lib/japaState.ts` |
| `src/lib/cloudDataPacks.ts` (download, JAPA, POIs, Valhalla tiles, routes) | `lib/dataPacks/downloader.ts`, `lib/dataPacks/manager.ts`, `lib/japaState.ts`, `lib/valhalla/tileStorage.ts` |
| `src/lib/japaState.ts` | `lib/japaState.ts` (new) |
| `src/lib/search/searchIndex.ts` (buildPackIndex with POIs, validateAndRepair) | `lib/search/searchIndex.ts` (extend), `lib/syncManager.ts` |
| `src/lib/routing/routeCache.ts` | `lib/routing/routeCache.ts` (new) |
| `src/lib/routePath.ts` | `lib/routePath.ts` (new) |
| `packages/core` routing (valhallaRouter, valhallaCache, routePath) | `lib/valhalla/` (tileStorage, ValhallaProvider, initValhalla), `lib/routePath.ts` |
| `src/lib/valhalla/ValhallaService.ts` + worker | `lib/valhalla/ValhallaProvider.ts` (no Worker) |
| NavigationPanel, “no routing data” | New navigation screen, “Manage data packs” |
| OfflineDataManager (state, Valhalla count) | `components/OfflineDataManager/` (state, routing badge) |

---

## 12. How to run the mobile app and verify parity

### 12.1 Prerequisites

- **Node.js** (v18+)
- **pnpm** (monorepo uses pnpm)
- **iOS:** Xcode and iOS Simulator (or physical device)
- **Android:** Android Studio and emulator (or physical device)
- **Optional:** Expo Go app on a physical device for quick testing

### 12.2 Install and start

From the **monorepo root** (`JanPAMS/`):

```bash
pnpm install
cd apps/core/address-maker-glopams
pnpm start
```

Or from the app directory directly (after `pnpm install` at root once):

```bash
cd apps/core/address-maker-glopams
pnpm start
```

Then:

- Press **`i`** in the terminal to open the **iOS Simulator**, or
- Press **`a`** to open the **Android emulator**, or
- Scan the QR code with **Expo Go** on your phone (same network).

To open a specific platform without the dev menu:

```bash
pnpm ios      # iOS Simulator
pnpm android  # Android emulator
```

### 12.3 Environment (optional)

- Copy `.env.example` to `.env` and set:
  - `EXPO_PUBLIC_BASE_URL` — API base URL if needed
  - `EXPO_PUBLIC_MAP_QUERY_KEY` (or `EXPO_PUBLIC_IOS_MAP_QUERY_KEY` / `EXPO_PUBLIC_ANDROID_MAP_QUERY_KEY` in app.config) for map tiles
  - `EXPO_PUBLIC_VPS_DATA_URL` — leave unset for **prod** data packs (`https://datapack.janpams.com/osm-data`); set to staging URL for dev
- Without a map key, the app may still run; maps or some features might be limited.

### 12.4 Verification checklist (offline parity)

Use this to confirm each parity feature in the running app:

| # | Feature | Where to check | What to verify |
|---|---------|----------------|----------------|
| 1 | **Data pack source** | Pack download / network | Packs load from prod (or staging if `EXPO_PUBLIC_VPS_DATA_URL` set). |
| 2 | **POIs in packs** | After installing a pack | Search or pack details show POI count; search can return POIs. |
| 3 | **Route cache** | After installing a pack with routes | Route directions use cached routes when available. |
| 4 | **Search index repair** | App launch / Offline indicator | OfflineIndicator shows “Search index: validating” then “ready” (or “error”); no stuck “validating”. |
| 5 | **JAPA lifecycle** | Manage data packs | Pack states: Downloading → Validating → Installing → Installed (or Failed); no orphaned staging. |
| 6 | **Route path** | Route directions tab | Get route between two points; path on map and distance; works without Valhalla (cached or Dijkstra). |
| 7 | **Valhalla** | Route directions (if pack has tiles) | When tiles are loaded, routing uses Valhalla; fallback still works if Valhalla fails. |
| 8 | **Navigation UI** | **Tab: “Get directions” / Route directions** | Destination input, “Get route”, polyline and steps; if no data, “No routing data” + “Manage data packs” opens OfflineDataManager. |
| – | **OfflineDataManager** | From home or “Manage data packs” | Lists packs; shows “Routing: Yes” (or similar) for packs with routing data; install/uninstall works. |

**Suggested flow:**

1. Open the app → confirm **OfflineIndicator** (e.g. top or status area) shows search index status.
2. Go to **Manage data packs** (from home or settings) → install a region pack → watch state (Downloading → Installed); confirm “Routing: Yes” if the pack has routing.
3. Open **Route directions** tab → set destination (search or map) → tap **Get route** → confirm route line and steps; if no pack for region, confirm “No routing data” and that “Manage data packs” opens OfflineDataManager.
4. Use **search** (e.g. on home or in route directions) → confirm POIs can appear when a pack with POIs is installed.

This document can be used as a task list: each task is a single unit of work with clear acceptance criteria and file targets. Implement in phase order and respect the dependency graph.
