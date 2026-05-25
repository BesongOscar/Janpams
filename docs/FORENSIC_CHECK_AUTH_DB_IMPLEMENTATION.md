# Forensic Check: Task Implementation vs Codebase

**Date:** 2025-02-04  
**Reference:** `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`  
**Scope:** Part A (Database), Part B (Auth), Part D (Testing checklist), Part E (File map)

---

## Summary

| Part | Status | Gaps |
|------|--------|------|
| A.1 | ✅ Done | None |
| A.2 | ✅ Done | None |
| A.3 | ✅ Done | Fixed: DataPackManifest type, pack_staging schema + migration 14, insertPackStagingManifest, downloader manifest, createDataPackManifest |
| A.4 | ✅ Done | None |
| A.5 | ✅ Done | None |
| A.6 | ✅ Done | Manual verification only (no automated test) |
| B.1 | ✅ Done | None |
| B.2 | ✅ Done | None |
| B.3 | ✅ Done | Documented in plan |
| B.4 | ✅ Done | None |
| B.5 | ✅ Done | None |
| B.6 | ✅ Done | None |
| B.7 | ✅ Done | Guard only in (tabs); profile/my-addresses/new-create-address not individually guarded (acceptable unless deep-linked) |
| B.8 | ✅ Done | Contact change: gap documented (no dedicated initiate/verify API on mobile) |
| B.9 | ✅ Done | None |
| B.10 | ✅ Done | None |

---

## Part A — Database

### A.1 — Schema audit
- **Verified:** `docs/DB_SCHEMA_AUDIT_WEB_VS_MOBILE.md` exists with store/table mapping, keyPath/PK, gaps (local_user_roles, data_packs, indexes) and “Gaps addressed in implementation”.

### A.2 — local_user_roles AppRole + migration
- **Verified:** `lib/db/sqlite-schema.ts`: `local_user_roles.role` CHECK `IN ('basic_user', 'advanced_agent', 'org_admin', 'system_admin')`.
- **Verified:** `lib/db/migrations.ts`: `migrateToVersion13` runs `UPDATE local_user_roles SET role = CASE ...` for legacy values.
- **Verified:** `SQLITE_SCHEMA_VERSION` is 14 (bumped from 13 for migration 14; schema file).
- **Verified:** `lib/db/schemas.ts` and `lib/db/userRoles.ts` use AppRole; no remaining writes of legacy enum (only migration and unrelated `source IN ('osm','local','user')`).

### A.3 — data_packs: missing columns and write path
- **Verified:** `data_packs` table and migration 13 add `settlement_place_count`, `poi_count`, `valhalla_tile_count`.
- **Fixed:** (1) `DataPackManifest` in `lib/db/schemas.ts` now includes `settlement_place_count?`, `poi_count?`, `valhalla_tile_count?`. (2) `pack_staging` has the same columns (CREATE_TABLES + migration 14). (3) `insertPackStagingManifest` sets all three from manifest. (4) Downloader builds manifest with `settlement_place_count`, `poi_count`, `valhalla_tile_count` and calls `insertPackStagingManifest`; `copyStagingToProd` `SELECT * FROM pack_staging` now copies them into `data_packs`. (5) `createDataPackManifest` in `lib/db/dataPacks.ts` includes the three columns in INSERT.

### A.4 — Indexes
- **Verified:** `lib/db/indexes.ts` includes staging indexes: `admin_boundaries_stg` (by_level, by_parent, by_packId), `settlement_places_stg` (by_packId, by_place, by_geoCell), `pois_stg` (by_packId, by_tier, by_category). Other indexes aligned with web.

### A.5 — Types and AppRole
- **Verified:** `lib/db/userRoles.ts`: `getLocalUserRoles` returns `AppRole[]`, `upsertLocalUserRoles(userId, roles: AppRole[])`. No `LocalAppRole`. `hooks/useEffectiveRole.ts`: uses `getLocalUserRoles`, `ROLE_ORDER`, `effectiveRole` / `isLocationRestricted`; no LOCAL_TO_APP mapping.

### A.6 — Verification
- **Verified:** Schema version 13, migrations run on upgrade. No automated schema test; plan allows “Manual verification or optional test”.

---

## Part B — Authentication

### B.1 — Single logout
- **Verified:** `utils/auth.ts`: `performLogout()` clears tokens via `clearAuthTokens()`, `updateAuthHeader('')`; does not navigate. Drawer: calls backend logout (`useLogout`) then `performLogout()` then `triggerLogoutNavigation()`. Interceptor 401 path: calls `logout()` (alias of `performLogout`) then `logoutCallback`. `_layout`: `setLogoutCallback` sets callback that clears user, `setSessionExpiresAt(null)`, `router.replace('/(auth)/login')`.

### B.2 — SecureStore
- **Verified:** `utils/secureAuthStorage.ts`: `setAuthTokens`, `getAuthTokens`, `clearAuthTokens`; SecureStore with AsyncStorage fallback. Login, index (session restore), interceptor (refresh) use it. performLogout uses clearAuthTokens.

### B.3 — Session restore and 401
- **Verified:** Plan “Session restore & 401 (B.3)” section describes flow. index.tsx: getAuthTokens → refresh → setAuthTokens/updateAuthHeader → setUser. Interceptor: 401 → refresh → on failure performLogout + logoutCallback.

### B.4 — Roles from backend
- **Verified:** `lib/rolesSync.ts`: `fetchRolesFromBackend` GET `/auth/roles`, `syncRolesFromBackend` upserts via `upsertLocalUserRoles`. Login success in `app/(auth)/login.tsx` calls `syncRolesFromBackend(userId, lang)`.
- **Note:** B.4 will be **superseded** when **Part F (Supabase auth parity)** is implemented: roles will then come from Supabase `user_roles` (same as web), not Laravel GET `/auth/roles`. See `docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`.

### B.5 — Login lockout
- **Verified:** `utils/loginAttempts.ts`: MAX_LOGIN_ATTEMPTS 5, LOCKOUT_DURATION_MS 15 min, get/save/clear, getLockoutError, applyFailedAttempt. Login screen: load on mount, check lockout before submit, show “Try again in X minutes” and disable when locked, increment on credential error, clear on success, 1-min refresh when locked.

### B.6 — Session expiry in context
- **Verified:** `utils/jwt.ts`: `getExpiresAtFromToken`. Interceptor: `setSessionExpiryCallback`, `updateAuthHeader` calls it with decoded exp. _layout: context `sessionExpiresAt`, `setSessionExpiresAt`; callback clears it on logout; effect when expired and user set calls performLogout + triggerLogoutNavigation (interval 60s).

### B.7 — Protected routes
- **Verified:** Context has `isAuthLoading` (true until session restore done). index sets `setAuthLoading(false)` when done. `(tabs)/_layout.tsx`: if `!isAuthLoading && (user == null)` then `router.replace('/(auth)/login')`.  
- **Note:** Guard is only in (tabs) layout. profile, my-addresses, new-create-address are root Stack screens; they are not individually wrapped. Acceptable if those routes are only reached after (tabs); if they are deep-linkable without auth, consider adding a guard or RequireAuth wrapper for those screens.

### B.8 — Profile and account
- **Verified:** Update profile: update-profile screen, useUpdateProfile, errors. Delete account: Settings two-step modal (confirm → password/pin), DELETE `user/delete` with body, on success performLogout + triggerLogoutNavigation. Contact change gap documented in plan (no dedicated initiate/verify API on mobile).

### B.9 — Back stack replace
- **Verified:** Logout callback in _layout uses `router.replace('/(auth)/login')`. Drawer calls triggerLogoutNavigation after performLogout.

### B.10 — Testing checklist and docs
- **Verified:** Plan Part D: runnable steps D.1–D.10 and summary table. Parity doc §1.2: “Auth & session” text and link to implementation plan; mobile auth subsection updated.

---

## Part E — File map

- **Verified:** Listed files exist and are used as described (sqlite-schema, migrations, indexes, schemas, userRoles, useEffectiveRole, secureAuthStorage, auth, interceptor, login, index, _layout, Drawer, rolesSync; docs).

---

## A.3 fix applied

1. Added `settlement_place_count?`, `poi_count?`, `valhalla_tile_count?` to `DataPackManifest` in `lib/db/schemas.ts`.
2. Added the same columns to `pack_staging` in CREATE_TABLES and migration 14 (ALTER TABLE pack_staging ADD COLUMN …).
3. Updated `insertPackStagingManifest` to include the three columns and values from manifest.
4. In downloader, manifest now sets `settlement_place_count`, `poi_count`, and `valhalla_tile_count` (from metadata/counts).
5. `createDataPackManifest` in `lib/db/dataPacks.ts` INSERT now includes the three columns. `copyStagingToProd` continues to use `SELECT * FROM pack_staging`, which now matches `data_packs` column order.

---

## Last check (pre-test)

Re-verified before testing:

- **DB:** `SQLITE_SCHEMA_VERSION = 14`; migrations 13 and 14 registered; `data_packs` and `pack_staging` have same column order (so `INSERT INTO data_packs SELECT * FROM pack_staging` is correct).
- **Logout:** Drawer and settings (delete account) call `performLogout()` then `triggerLogoutNavigation()`; interceptor 401 path calls `logout()` (performLogout) then `logoutCallback`. _layout callback uses `router.replace('/(auth)/login')`.
- **Auth flow:** Login uses `setAuthTokens`, `clearLoginAttempts`, `syncRolesFromBackend`; index uses `getAuthTokens`/`setAuthTokens`, `setAuthLoading(false)`; interceptor uses `getAuthTokens`/`setAuthTokens`; `updateAuthHeader` triggers `sessionExpiryCallback`.
- **Context:** `sessionExpiresAt`, `isAuthLoading`, `setSessionExpiresAt`, `setAuthLoading` in _layout; (tabs) guard uses `user` and `isAuthLoading`.
- **Delete account:** `useDeleteAccount` accepts `DeleteAccountRequest` (password/pincode); settings passes body and on success calls performLogout + triggerLogoutNavigation.

**Conclusion:** All tasks match the implementation plan. Safe to run Part D (testing checklist). Optional: add guard or RequireAuth for profile/my-addresses/new-create-address if those routes can be opened without going through (tabs).

---

## Supabase auth parity (planned)

**Task:** Make mobile auth and roles identical to the web (Supabase Auth + Supabase `user_roles`). Full breakdown: **`docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`**. Implementation plan: **Part F** in `MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`. Once implemented, verify: (1) Login uses Supabase `signInWithPassword`; (2) Session restore uses `getSession` / `onAuthStateChange`; (3) Roles fetched from `supabase.from('user_roles')` and synced to SQLite; (4) No GET `/auth/roles` calls; (5) Logout uses `supabase.auth.signOut()`.
