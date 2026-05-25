# Mobile DB & Auth — Detailed Task Implementation Plan

**Goals (recap):**

1. **Identical mobile DB to web** — SQLite schema matches web’s IndexedDB (v14) in tables, columns, enums, and indexes. Same field names and CHECK constraints so sync and behaviour align.
2. **Full auth flow parity** — Session lifecycle, login, signup, token storage, refresh, logout, roles, protected routes, and profile/account behaviour match web.
3. **Architecture and behaviour** — Mobile app architecture and behaviour match the web app end-to-end for auth, data, addressing, and navigation.

**Reference:**  
- Parity overview: `MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md` (§1.2 Full authentication flow, §1.3 Database migration, §1.4 Things you may have missed).  
- Web schema: `apps/core/mbukanji-maps/src/lib/db.ts`.  
- Mobile schema: `apps/core/address-maker-glopams/lib/db/sqlite-schema.ts`, `lib/db/migrations.ts`, `lib/db/indexes.ts`.  
- **Supabase auth parity (recommended):** `docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md` — make mobile auth and roles identical to web (Supabase Auth + Supabase `user_roles`).

---

## Part A — Database: Identical schema to web

### A.1 — Schema audit: web IndexedDB vs mobile SQLite

| Field | Detail |
|-------|--------|
| **Description** | Produce a single audit document or checklist that lists every web IndexedDB store (from `mbukanji-maps/src/lib/db.ts` v14) and for each: keyPath, indexes, and every field with type. Then compare to mobile `lib/db/sqlite-schema.ts`: table name, columns, types, CHECK enums. Flag any missing table, missing column, type mismatch, or enum difference. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: JanPAMSDB interface and all `createObjectStore` / `createIndex` in `upgrade()`. |
| **Acceptance criteria** | (1) List of all web stores: addresses, streets, sync_queue, tiles, street_segments, admin_boundaries, settlement_places, street_suggestions, data_packs, location_captures, street_number_reservations, search_*, street_direction_locks, local_user_roles, direction_audit_log, street_name_suggestions, neighborhood_name_suggestions, suggestion_votes, name_alias_groups, pois, route_cache, pack_state, *_stg, pack_staging; plus Valhalla if stored in IDB. (2) For each store: keyPath → PRIMARY KEY; indexes → SQLite index; value shape → column list with types. (3) Gap list: missing tables/columns, wrong enums (e.g. local_user_roles.role), wrong types. (4) Doc lives in `docs/` (e.g. `DB_SCHEMA_AUDIT_WEB_VS_MOBILE.md`) or as a section in this plan. |
| **Files to create/update** | New `docs/DB_SCHEMA_AUDIT_WEB_VS_MOBILE.md` (or add audit table to this doc); optionally a script that reads web db.ts and emits a schema summary. |
| **Dependencies** | None. |
| **Estimated effort** | Small–Medium. |

---

### A.2 — local_user_roles: AppRole only + data migration

| Field | Detail |
|-------|--------|
| **Description** | Change `local_user_roles.role` to store only **AppRole** (`basic_user`, `advanced_agent`, `org_admin`, `system_admin`). Add a migration that updates existing rows from legacy enum (`user` → `basic_user`, `field_agent` → `advanced_agent`, `municipality_admin` → `org_admin`, `system_admin` → `system_admin`). Ensure no code path writes the old enum. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: `AppRole`, `LocalUserRole` (role: AppRole, userId, grantedAt, syncStatus). |
| **Acceptance criteria** | (1) `lib/db/sqlite-schema.ts`: `local_user_roles.role` CHECK constraint allows only `'basic_user' | 'advanced_agent' | 'org_admin' | 'system_admin'`. (2) New migration in `lib/db/migrations.ts` (e.g. migrateToVersion13): `UPDATE local_user_roles SET role = CASE role WHEN 'user' THEN 'basic_user' WHEN 'field_agent' THEN 'advanced_agent' WHEN 'municipality_admin' THEN 'org_admin' WHEN 'system_admin' THEN 'system_admin' ELSE role END WHERE role IN ('user','field_agent','municipality_admin','system_admin');`. (3) Bump `SQLITE_SCHEMA_VERSION` to 13 (or next). (4) `lib/db/schemas.ts`: ensure TypeScript type for role in local_user_roles is AppRole only. (5) Grep codebase for any remaining writes of 'user'|'field_agent'|'municipality_admin' into local_user_roles and remove or replace with AppRole. |
| **Files to create/update** | `lib/db/sqlite-schema.ts` (CHECK for role), `lib/db/migrations.ts` (new migration + version), `lib/db/schemas.ts` (type). |
| **Dependencies** | A.1 (audit confirms current column definition). |
| **Estimated effort** | Small. |

---

### A.3 — data_packs: add missing columns to match web DataPackManifest

| Field | Detail |
|-------|--------|
| **Description** | Web `DataPackManifest` includes optional counts: `settlement_count`, `settlement_place_count`, `poi_count`, `valhalla_tile_count`. Ensure mobile `data_packs` table has columns for these so manifest shape is identical. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: `DataPackManifest` (settlement_count?, settlement_place_count?, poi_count?, valhalla_tile_count?, size_bytes, sha256, created_at, downloaded_at?). |
| **Acceptance criteria** | (1) Compare `lib/db/sqlite-schema.ts` data_packs CREATE TABLE to web DataPackManifest. (2) Add any missing columns (e.g. settlement_place_count INTEGER, poi_count INTEGER, valhalla_tile_count INTEGER) with nullable/default as appropriate. (3) Add migration to ALTER TABLE data_packs ADD COLUMN ... for existing installs. (4) Downloader and any code that writes manifest must set these fields when available. |
| **Files to create/update** | `lib/db/sqlite-schema.ts`, `lib/db/migrations.ts`, `lib/dataPacks/downloader.ts` (or manifest type usage). |
| **Dependencies** | A.1. |
| **Estimated effort** | Small. |

---

### A.4 — Indexes: ensure every web index has SQLite equivalent

| Field | Detail |
|-------|--------|
| **Description** | For each IndexedDB index in web’s upgrade(), ensure mobile has an equivalent CREATE INDEX in `lib/db/indexes.ts` (same key columns and intent). |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: all `createIndex(name, keyPath)` calls. |
| **Acceptance criteria** | (1) List of web indexes per store (e.g. addresses: by-plus-code, by-sync-status; local_user_roles: by-user-id; street_direction_locks: by-sync-status; etc.). (2) For each, verify `lib/db/indexes.ts` has a corresponding CREATE INDEX IF NOT EXISTS with correct table and column(s). (3) Add any missing indexes. (4) New indexes can be added in the same migration as A.2 or a separate one. |
| **Files to create/update** | `lib/db/indexes.ts`, `lib/db/migrations.ts` if new indexes require migration. |
| **Dependencies** | A.1. |
| **Estimated effort** | Small. |

---

### A.5 — Types and helpers: AppRole everywhere, remove LocalAppRole mapping

| Field | Detail |
|-------|--------|
| **Description** | Use **AppRole** as the single role type in DB layer and UI. Remove **LocalAppRole** and the mapping in `useEffectiveRole`. |
| **Web reference** | `apps/core/mbukanji-maps/src/lib/db.ts`: `AppRole`; `apps/core/mbukanji-maps/src/hooks/useUserRole.ts`: roles as AppRole[]. |
| **Acceptance criteria** | (1) `lib/db/userRoles.ts`: change return type to AppRole[]; query remains `SELECT role FROM local_user_roles WHERE userId = ?`; cast result to AppRole[]. (2) Remove type `LocalAppRole` from codebase (or deprecate and alias to AppRole). (3) `hooks/useEffectiveRole.ts`: remove LOCAL_TO_APP mapping; read roles from getLocalUserRoles (now AppRole[]); effectiveRole = highest role in ROLE_ORDER; isLocationRestricted = (effectiveRole === 'basic_user'). (4) Any other callers of getLocalUserRoles or local_user_roles use AppRole. |
| **Files to create/update** | `lib/db/userRoles.ts`, `hooks/useEffectiveRole.ts`; grep for LocalAppRole and update. |
| **Dependencies** | A.2 (DB stores AppRole). |
| **Estimated effort** | Small. |

---

### A.6 — Verification: schema version and smoke test

| Field | Detail |
|-------|--------|
| **Description** | After all DB changes, verify new installs get correct schema and upgraded installs run migrations without data loss. |
| **Acceptance criteria** | (1) New install: initDB() creates all tables with latest CREATE_TABLES; local_user_roles.role CHECK only allows AppRole. (2) Upgrade path: run migrations from current version to new version; existing local_user_roles rows have role migrated to AppRole; data_packs has new columns if added. (3) Smoke: open app, init DB, insert/read address and local_user_roles row; no errors. (4) Optional: small test that asserts SQLITE_SCHEMA_VERSION and that key tables exist. |
| **Files to create/update** | Manual verification or `__tests__/db/schema.test.ts` (optional). |
| **Dependencies** | A.2, A.3, A.4, A.5. |
| **Estimated effort** | Small. |

---

## Part B — Authentication: Full flow parity

### B.1 — Single logout implementation

| Field | Detail |
|-------|--------|
| **Description** | One canonical logout routine used by both user-initiated logout (e.g. Drawer) and 401 refresh-failure path. It must clear tokens, clear auth header, call backend `/auth/logout`, set user/session to null, and navigate to login (replace so back stack is cleared). |
| **Web reference** | Web: `supabase.auth.signOut()`; state cleared by onAuthStateChange. |
| **Acceptance criteria** | (1) **Create** or refactor to a single async function e.g. `performLogout()` in `utils/auth.ts`: (a) clear all auth keys from storage (AsyncStorage or SecureStore: @userId, @refreshToken; if using SecureStore, clear those keys too); (b) `updateAuthHeader('')`; (c) optionally call backend POST `/auth/logout` (with lang); (d) do not navigate—return. (2) A “logout and navigate” helper or callback: calls `performLogout()`, then sets context user to null and `router.replace('/(auth)/login')`. (3) Drawer (or wherever user taps Logout): call the “logout and navigate” helper. (4) Interceptor 401 refresh failure: call `performLogout()` then invoke the same callback used in _layout (setUser(undefined), setIsLoggedIn(false), router.replace('/(auth)/login')). (5) No duplicate clear logic in two places; both paths use the same performLogout. |
| **Files to create/update** | `utils/auth.ts` (performLogout, possibly logoutAndNavigate); `utils/interceptor.ts` (call performLogout + existing callback); `app/_layout.tsx` (setLogoutCallback to use same performLogout + replace); `components/Drawer.tsx` (call shared logout + navigate). |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

---

### B.2 — Token storage: SecureStore for refresh_token and userId

| Field | Detail |
|-------|--------|
| **Description** | Store refresh_token and userId in SecureStore (expo-secure-store) instead of AsyncStorage so credentials are in keychain/Keystore. Access token remains in memory only. Provide a small abstraction so read/write of auth keys goes through one module. |
| **Web reference** | Web uses Supabase session (tokens managed by Supabase client; browser storage). For parity we want “secure” storage on mobile. |
| **Acceptance criteria** | (1) **Create** `utils/secureAuthStorage.ts` (or extend existing): `setAuthTokens({ userId, refreshToken })`, `getAuthTokens(): Promise<{ userId, refreshToken } | null>`, `clearAuthTokens()`. Implementation uses SecureStore when available (expo-secure-store). (2) Keys: e.g. `auth_user_id`, `auth_refresh_token` (or keep @userId, @refreshToken as key names). (3) Login success path: after receiving userId and refresh_token from API, call setAuthTokens instead of storeData('@userId') / storeData('@refreshToken'). (4) Session restore (e.g. app index): call getAuthTokens() instead of readData('@userId') and readData('@refreshToken'). (5) Refresh success: store new refresh_token via setAuthTokens. (6) Logout: call clearAuthTokens (and ensure performLogout uses this). (7) Interceptor and any other code that reads/writes these two keys use the new module. (8) Document in MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md or this plan that auth tokens are stored in SecureStore. (9) Optional: fallback to AsyncStorage if SecureStore fails (document fallback). |
| **Files to create/update** | **Create** `utils/secureAuthStorage.ts`; `app/(auth)/login.tsx`; `app/index.tsx` (splash/session restore); `utils/interceptor.ts`; `utils/auth.ts` (performLogout); any other file that reads/writes @userId or @refreshToken. |
| **Dependencies** | B.1 (logout clears via same abstraction). |
| **Estimated effort** | Medium. |

---

### B.3 — Session restore and 401 handling (verify and document)

| Field | Detail |
|-------|--------|
| **Description** | Ensure session restore on app load and 401 handling match the full auth behaviour: restore from storage → refresh → set user; on 401 → one-at-a-time refresh → retry; on refresh failure → full logout. Document the flow. |
| **Acceptance criteria** | (1) Session restore (e.g. in app index or _layout): get auth tokens from storage (SecureStore or AsyncStorage); if present, call /auth/refresh; on success update header and store new refresh_token, then fetch user and setUser; on failure clear tokens and do not set user (user sees login). (2) 401 handling: interceptor already triggers refresh and retry; on refresh failure calls performLogout and logout callback. Verify no half-logged-in state (e.g. user set but tokens cleared). (3) Proactive refresh on app resume (e.g. after 15+ min) remains; uses same refresh path. (4) Add a short “Session restore & 401” subsection to docs (this plan or parity doc) describing the flow. |
| **Files to create/update** | `app/index.tsx` or session-restore hook; `utils/interceptor.ts` (review only); `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md` or parity doc. |
| **Dependencies** | B.1, B.2. |
| **Estimated effort** | Small. |

---

### B.4 — Roles: fetch from backend and upsert into local_user_roles (AppRole)

| Field | Detail |
|-------|--------|
| **Description** | After successful login (and optionally on session restore), fetch the current user’s roles from the backend (e.g. GET /user_roles or /me/roles) and upsert into SQLite `local_user_roles` with **AppRole** values. When offline, use roles from SQLite only. |
| **Web reference** | Web: Supabase `user_roles` table; useUserRole fetches and caches in localStorage. |
| **Acceptance criteria** | (1) Backend exposes an endpoint that returns roles for the current user (e.g. list of { role: AppRole } or role names). If backend uses different names, map to AppRole in mobile. (2) After login success (in login callback or right after setUser): call roles API; for each role, upsert into local_user_roles (id, userId, role, grantedAt, syncStatus). Use INSERT OR REPLACE or delete-by-userId then insert. (3) Optional: on session restore, after refresh success, call roles API and upsert again so roles are fresh when online. (4) useEffectiveRole (and any other consumer) reads from getLocalUserRoles only; no duplicate fetch in hook unless you want “refetch roles” button. (5) Offline: getLocalUserRoles returns last synced roles from SQLite; effectiveRole and isLocationRestricted work correctly. |
| **Files to create/update** | New API hook or function for “get my roles” (e.g. in `hooks/users.hooks.ts` or `lib/api/roles.ts`); `app/(auth)/login.tsx` (after login, fetch roles and upsert); optionally app index (after session restore, fetch roles and upsert); `lib/db/userRoles.ts` (upsert function if not exists). |
| **Dependencies** | A.2, A.5 (DB has AppRole; userRoles returns AppRole[]). Backend role API. |
| **Estimated effort** | Medium. |

---

### B.5 — Login attempt lockout (optional)

| Field | Detail |
|-------|--------|
| **Description** | Match web behaviour: after N failed login attempts, lock out for a period (e.g. 15 minutes). Store attempt count and lockout end in memory or secure storage; reset on successful login. |
| **Web reference** | `apps/core/mbukanji-maps/src/contexts/AuthContext.tsx`: getLoginAttempts, saveLoginAttempts, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS. |
| **Acceptance criteria** | (1) Constants: e.g. MAX_ATTEMPTS = 5, LOCKOUT_MS = 15 * 60 * 1000. (2) On failed login: increment count; if count >= MAX_ATTEMPTS set lockedUntil = now + LOCKOUT_MS; persist (e.g. SecureStore or AsyncStorage key auth_login_attempts). (3) On login screen load: read attempts; if lockedUntil and now < lockedUntil, show “Try again in X minutes” and disable submit. (4) On successful login: clear attempts (count 0, lockedUntil null). (5) Show remaining attempts on failure when not locked (e.g. “Invalid credentials. 3 attempts remaining.”). |
| **Files to create/update** | `utils/auth.ts` or new `utils/loginAttempts.ts`; `app/(auth)/login.tsx`. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

---

### B.6 — Session expiry in context (optional)

| Field | Detail |
|-------|--------|
| **Description** | If backend returns access_token expiry (or refresh_token expiry), store it and expose in app context so UI can show “session expires at” or warn before expiry. |
| **Web reference** | Web: sessionExpiresAt from Supabase session. |
| **Acceptance criteria** | (1) When storing tokens after login or refresh, if API returns expires_at (or similar), store it (e.g. in context or SecureStore). (2) Expose sessionExpiresAt (or expiresInSeconds) from auth context. (3) Optional: show a warning or force re-login when expired; or rely on 401 + refresh. |
| **Files to create/update** | Context (e.g. _layout or AuthContext); login and refresh success paths. |
| **Dependencies** | Backend returns expiry. |
| **Estimated effort** | Small. |

---

### B.7 — Protected routes gate

| Field | Detail |
|-------|--------|
| **Description** | Ensure all authenticated screens are behind a gate: if not authenticated (and not loading), redirect to login. Use single isAuthenticated and isLoading from context. |
| **Web reference** | `apps/core/mbukanji-maps/src/components/auth/ProtectedRoute.tsx`: isAuthenticated, isLoading, redirect or auth modal. |
| **Acceptance criteria** | (1) Define isAuthenticated = (user != null) and isLoading from context (or from session-restore state). (2) For each route or stack that requires auth (e.g. (tabs), profile, my-addresses, new-create-address): wrap with a guard that checks isAuthenticated; when false and !isLoading, redirect to `/(auth)/login` (replace). (3) Auth screens (login, signup, forgot-pin) are not behind the guard. (4) No duplicate “if (!user) router.replace(...)” in many screens; one guard or layout. |
| **Files to create/update** | `app/_layout.tsx` or route group layout (e.g. (tabs)/_layout.tsx); optionally a small `<RequireAuth>` component; ensure root or tab layout uses it. |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

---

### B.8 — Profile and account flows (update, contact change, delete)

| Field | Detail |
|-------|--------|
| **Description** | If web has update profile, initiate/verify contact change (OTP), and delete account, implement equivalent on mobile with same success/error behaviour. |
| **Web reference** | `apps/core/mbukanji-maps/src/contexts/AuthContext.tsx`: updateProfile, initiateContactChange, verifyContactChange, deleteAccount. |
| **Acceptance criteria** | (1) Update profile: mobile already has update-profile screen; ensure fields and API match web contract and errors are shown consistently. (2) Contact change (e.g. email or phone): if web has “initiate change → OTP → verify”, mobile has same flow and same API or Supabase calls if applicable. (3) Delete account: if web requires password and calls delete endpoint, mobile has same step and call; after success, performLogout and navigate to login. (4) Document any gaps (e.g. “contact change not yet on mobile”) in this plan. |
| **Files to create/update** | `app/update-profile.tsx`, `app/settings.tsx` or profile/settings screens; any new screens for contact change or delete account; API hooks. |
| **Dependencies** | B.1 (logout after delete). |
| **Estimated effort** | Medium (depends on existing screens). |

**Implemented:** Update profile: `app/update-profile.tsx` with useUpdateProfile, validation, and error display. Contact change: mobile uses the same update-profile flow (change email/phone in form, submit); backend may send OTP and redirect to email-verification or phone-number-verification screens—no separate "initiate contact change" API unless backend exposes one. **Gap:** Dedicated initiate/verify contact-change APIs (separate from update profile) are not implemented on mobile; if backend adds them, add equivalent screens/hooks. Delete account: Settings has two-step modal (confirm → enter password or pin) and calls DELETE `user/delete` with optional body `{ password?, pincode? }`; on success `performLogout()` and `triggerLogoutNavigation()`.

---

### B.9 — Back stack: replace on logout

| Field | Detail |
|-------|--------|
| **Description** | When navigating to login after logout (user-initiated or 401), use replace so the user cannot go back to authenticated screens. |
| **Acceptance criteria** | (1) After performLogout and navigation to login, use `router.replace('/(auth)/login')` (or equivalent so login is the only route in stack). (2) Verify: logout from Drawer → tap back → should not return to tabs. (3) Verify: 401 refresh failure → redirect to login → tap back → should not return. |
| **Files to create/update** | `app/_layout.tsx` (logout callback); `components/Drawer.tsx` (logout handler). |
| **Dependencies** | B.1. |
| **Estimated effort** | Trivial (verify only). |

---

### B.10 — Auth testing checklist and documentation

| Field | Detail |
|-------|--------|
| **Description** | Add a runnable testing checklist and update docs so future changes don’t break auth parity. |
| **Acceptance criteria** | (1) Checklist in this doc or parity doc: (a) Fresh install → login → close app → reopen → still logged in. (b) Login → wait for access token expiry → trigger API call → refresh then success. (c) Login → force refresh failure (e.g. invalidate refresh token) → redirect to login and no token in storage. (d) Logout from Drawer → tokens cleared, backend called, cannot go back. (e) basic_user role from API → stored in SQLite as basic_user → map tap restriction applies. (2) “Auth & session” subsection in parity doc: web auth (Supabase, session, roles, lockout, logout); mobile auth (API, tokens, SecureStore, refresh, logout); link to this implementation plan. |
| **Files to create/update** | `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md` (this file: add “Testing checklist” section); `docs/MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md` (§1.2 or §1.4). |
| **Dependencies** | B.1–B.9. |
| **Estimated effort** | Small. |

---

## Part C — Dependency graph and order

**Recommended order:**

1. **DB first (so auth can rely on it)**  
   - A.1 (audit) → A.2 (local_user_roles AppRole + migration) → A.3 (data_packs columns) → A.4 (indexes) → A.5 (types, remove LocalAppRole) → A.6 (verify).

2. **Auth**  
   - B.1 (single logout) → B.2 (SecureStore) → B.3 (session restore / 401 doc) → B.4 (roles API → SQLite).  
   - Then: B.5 (lockout), B.6 (session expiry), B.7 (protected routes), B.8 (profile/account), B.9 (back stack), B.10 (testing & docs).  
   - B.4 depends on A.2 and A.5.

**Summary diagram:**

```
A.1 (audit)
  → A.2 (local_user_roles AppRole + migration)
  → A.3 (data_packs)   A.4 (indexes)
  → A.5 (types, remove LocalAppRole)
  → A.6 (verify)

B.1 (single logout) → B.2 (SecureStore) → B.3 (session/401)
                          ↓
B.4 (roles API → SQLite)  ← uses A.2, A.5
B.5, B.6, B.7, B.8, B.9, B.10 (optional and polish)
```

---

## Part D — Testing checklist (auth)

Use this as a **runnable, step-by-step** checklist to verify full auth flow parity. Run each scenario and confirm the expected result.

### D.1 — Persisted session

1. Fresh install (or clear app data).
2. Open app → should show login/splash.
3. Log in with valid credentials.
4. Confirm you are on the main (tabs) screen.
5. Force close the app (swipe away from recents).
6. Reopen the app.

**Expected:** Still logged in; user and data visible; no login screen.

---

### D.2 — Token refresh

1. Log in.
2. Wait until the access token has expired (e.g. 1 hour, or use a short-lived token in dev).
3. Trigger any API call (e.g. open profile, fetch addresses).

**Expected:** Request succeeds; new token is used; no redirect to login.

---

### D.3 — Refresh failure → logout

1. Log in.
2. Invalidate the refresh token on the server (or clear only the refresh token in storage and trigger a 401).
3. Trigger an API call that returns 401 so the interceptor attempts refresh.

**Expected:** App redirects to login; storage has no auth tokens; back button does not return to authenticated screens.

---

### D.4 — User logout

1. Log in.
2. Open the Drawer (or menu where Logout is).
3. Tap Logout.

**Expected:** Tokens cleared; backend logout called; navigated to login; back does not return to tabs.

---

### D.5 — Roles and basic_user

1. Log in as a user whose backend returns role `basic_user` (e.g. GET `/auth/roles` returns `["basic_user"]`).
2. Check SQLite `local_user_roles`: role should be `basic_user`.
3. On the map, tap outside the center + 8 neighbors.

**Expected:** Map tap restriction applies (e.g. restricted or message) for basic_user.

---

### D.6 — SecureStore

1. After B.2 implementation: log in.
2. On device/simulator, confirm `refresh_token` and `userId` are stored in SecureStore (keychain/Keystore), not in plain AsyncStorage.

**Expected:** Credentials in secure storage where available.

---

### D.7 — Protected routes

1. Log out (or clear app storage so no tokens).
2. Try to navigate to a tab or screen that requires auth (e.g. (tabs) home).

**Expected:** Redirect to login; cannot reach authenticated content.

---

### D.8 — Login attempt lockout

1. On the login screen, enter wrong credentials.
2. Repeat 5 times (or MAX_LOGIN_ATTEMPTS).

**Expected:** Message like “Too many failed attempts. Account locked for 15 minutes.” or “Try again in X minute(s).”; submit button disabled; after 15 minutes (or when lockout expires) login is allowed again.
3. Log in successfully with correct credentials.

**Expected:** Lockout count resets; next failed attempts start from 0.

---

### D.9 — Session expiry in context

1. Log in (with a JWT that includes `exp`).
2. In app context/state, confirm `sessionExpiresAt` is set (e.g. from JWT decode).
3. Optional: when system time passes expiry, app forces re-login or clears session.

**Expected:** Session expiry is available in context; optional expiry enforcement works.

---

### D.10 — Delete account

1. Log in.
2. Go to Settings → Delete account.
3. Confirm → enter password (or pin for phone-only user) → Delete.

**Expected:** API called with password/pin; on success: performLogout, redirect to login; tokens cleared; back does not return to app.

---

### Summary table

| # | Scenario        | Expected |
|---|-----------------|----------|
| 1 | Persisted session | Still logged in after reopen. |
| 2 | Token refresh   | API succeeds after expiry via refresh. |
| 3 | Refresh failure | Redirect to login; no tokens; no back. |
| 4 | User logout     | Tokens cleared; backend called; replace to login. |
| 5 | basic_user role | In SQLite; map restriction applies. |
| 6 | SecureStore     | Credentials in keychain. |
| 7 | Protected routes| Unauthenticated → redirect to login. |
| 8 | Login lockout   | 5 fails → 15 min lock; success resets. |
| 9 | Session expiry  | sessionExpiresAt in context. |
| 10| Delete account  | Password/pin → API → logout + replace. |

---

## Session restore & 401 (B.3)

**Session restore:** On app load (e.g. `app/index.tsx`), `getAuthTokens()` reads from SecureStore (or AsyncStorage fallback). If tokens exist, `/auth/refresh` is called; on success the new refresh token is stored via `setAuthTokens` and the access token is set on the axios header; user is then fetched and set in context. If no tokens or refresh fails, the user is not set and the app shows the login screen.

**401 handling:** The axios response interceptor detects 401. If the request is not already the refresh request, it calls `refreshAccessToken()` (which uses `getAuthTokens()`). On success it updates the header and stores the new refresh token via `setAuthTokens`, then retries the original request. On failure it calls `performLogout()` and then the registered `logoutCallback` (set in `_layout`: clear user, `router.replace('/(auth)/login')`). Only one refresh runs at a time; concurrent 401s queue and retry with the new token.

**Proactive refresh:** When the app returns from background after 15+ minutes, `proactivelyRefreshToken()` runs (uses `getAuthTokens()` and the same refresh path).

---

## Part E — File map (quick reference)

| Area | Files to touch |
|------|-----------------|
| **DB schema** | `lib/db/sqlite-schema.ts`, `lib/db/migrations.ts`, `lib/db/indexes.ts`, `lib/db/schemas.ts` |
| **DB roles** | `lib/db/userRoles.ts`; `hooks/useEffectiveRole.ts` |
| **Auth storage** | `utils/secureAuthStorage.ts` (new), `utils/auth.ts`, `utils/interceptor.ts` |
| **Auth flow** | `app/(auth)/login.tsx`, `app/index.tsx`, `app/_layout.tsx`, `components/Drawer.tsx` |
| **Roles API** | New hook or `lib/api/roles.ts`; login success path; optional session-restore path |
| **Docs** | `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`, `docs/MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md`, optional `docs/DB_SCHEMA_AUDIT_WEB_VS_MOBILE.md` |

This plan can be used as a task list: implement in the order of Part C and check off each task's acceptance criteria before moving on.

---

## Part F — Supabase auth parity (mobile = web)

**Objective:** Make mobile auth and roles **identical** to the web by using Supabase Auth and Supabase `user_roles` instead of Laravel auth and GET `/auth/roles`. This is the recommended approach for full parity.

**Reference:** Full task breakdown, acceptance criteria, file map, and implementation order are in **`docs/SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`**. Summary:

| Part | Description |
|------|-------------|
| **1** | Add Supabase to mobile: dependency, `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, Supabase client with React Native–compatible storage. |
| **2** | Replace Laravel auth with Supabase: login via `signInWithPassword`, session restore via `getSession` / `onAuthStateChange`, logout via `signOut`, remove Laravel refresh flow. |
| **3** | Roles from Supabase: fetch with `supabase.from('user_roles').select('role').eq('user_id', user.id)`; sync into SQLite `local_user_roles` after login and optionally on session restore. |
| **4** | Cleanup: remove or refactor Laravel-only auth code; align user shape/context with Supabase session. |
| **5** | Docs and testing: update parity and implementation plan; run Supabase parity testing checklist. |

Once Part F is implemented, B.4 (roles from Laravel GET `/auth/roles`) is superseded: roles come from Supabase `user_roles` only.

