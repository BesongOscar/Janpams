# Supabase Auth Parity — Implementation Task (Mobile = Web)

**Objective:** Make mobile auth and roles **identical** to the web by using the same provider (Supabase Auth) and the same roles source (Supabase `user_roles` table). No Laravel auth or GET `/auth/roles` on mobile for primary auth/roles.

**Reference:**  
- Web auth: `apps/core/mbukanji-maps/src/contexts/AuthContext.tsx`, `src/hooks/useUserRole.ts`, `src/integrations/supabase/client.ts`.  
- Web roles: `supabase.from('user_roles').select('role').eq('user_id', user.id)`; cached in localStorage.  
- This plan: implement the same on mobile (address-maker-glopams), with SQLite as the **offline cache** for roles only.

**Prerequisites:**  
- Same Supabase project as web (same URL and anon key).  
- Mobile app will use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (values aligned with web’s `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`).  
- **Edge Functions** used by signup/verify/forgot/reset (`send-otp`, `verify-otp`, `reset-password-with-otp`) must be **deployed** to that Supabase project (from `apps/core/mbukanji-maps`). See **AUTH_SUPABASE_FULL_PARITY_IMPLEMENTATION_PLAN.md** for full auth flows and deployment steps.

---

## Summary of changes

| Area | Current (mobile) | Target (identical to web) |
|------|------------------|---------------------------|
| Auth provider | Laravel (`/auth/login`, `/auth/refresh`, `/auth/logout`) | Supabase Auth (`signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`) |
| Session restore | `getAuthTokens()` → Laravel `/auth/refresh` → set user | `supabase.auth.getSession()` / `onAuthStateChange` → set user from Supabase session |
| Roles source | GET `/auth/roles` (Laravel; currently 404) | `supabase.from('user_roles').select('role').eq('user_id', user.id)` |
| Roles cache | SQLite `local_user_roles` (after fetch from Laravel) | SQLite `local_user_roles` (after fetch from Supabase) — same table, different source |
| Token storage | SecureStore/AsyncStorage for `userId` + `refresh_token` (Laravel) | Supabase client uses React Native–compatible storage (e.g. AsyncStorage or custom adapter) for session |
| Logout | `performLogout()` (clear tokens, Laravel logout, navigate) | `supabase.auth.signOut()` then clear context and navigate to login |

---

## Part 1 — Add Supabase to the mobile app

### 1.1 — Dependency and env

| Field | Detail |
|-------|--------|
| **Description** | Add `@supabase/supabase-js` to address-maker-glopams. Add environment variables for Supabase URL and anon key so they match the web app’s Supabase project. |
| **Acceptance criteria** | (1) `package.json`: add `@supabase/supabase-js`. (2) Env: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same values as web’s `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`). (3) Document in `.env.example` and in this doc. (4) If app uses `app.config.ts` / `extra`, expose these so the client can read them at runtime. |
| **Files to create/update** | `apps/core/address-maker-glopams/package.json`, `.env`, `.env.example`, `app.config.ts` (if needed for extra). |
| **Dependencies** | None. |
| **Estimated effort** | Small. |

### 1.2 — Supabase client module (React Native–compatible storage)

| Field | Detail |
|-------|--------|
| **Description** | Create a Supabase client instance that uses the same URL and anon key as the web. Supabase Auth needs a storage adapter; on React Native use a custom storage that implements the same interface as `localStorage` (e.g. AsyncStorage wrapper or `@react-native-async-storage/async-storage`). |
| **Web reference** | `apps/core/mbukanji-maps/src/integrations/supabase/client.ts`: `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true } })`. |
| **Acceptance criteria** | (1) New file e.g. `lib/supabase/client.ts` or `integrations/supabase/client.ts`: `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: <AsyncStorage adapter>, persistSession: true, autoRefreshToken: true } })`. (2) Export typed client; optionally use same `Database` type as web if types are shared/copied. (3) Storage adapter must be compatible with `@supabase/supabase-js` auth persistence (getItem, setItem, removeItem). (4) No use of `localStorage` (not available in RN). |
| **Files to create/update** | **Create** `lib/supabase/client.ts` (or `integrations/supabase/client.ts`); optionally copy or share `Database` type from web (`integrations/supabase/types.ts`). |
| **Dependencies** | 1.1. |
| **Estimated effort** | Small–Medium. |

---

## Part 2 — Replace Laravel auth with Supabase auth

### 2.1 — Login with Supabase

| Field | Detail |
|-------|--------|
| **Description** | Replace Laravel POST `/auth/login` with Supabase Auth. Web uses `supabase.auth.signInWithPassword({ email, password })` or equivalent for phone (OTP). Mobile must use the same Supabase methods so the same user can log in on web and mobile. |
| **Web reference** | `AuthContext.tsx`: `signInWithPassword` for email/phone + password; OTP flows for signup/verify. |
| **Acceptance criteria** | (1) Login screen: for email/password use `supabase.auth.signInWithPassword({ email, password })`. (2) For phone/pin: align with web (e.g. phone + OTP or password equivalent via Supabase). (3) On success: Supabase `onAuthStateChange` will fire; no need to manually call Laravel “get user” for session user. (4) Remove or refactor `useLogin` (Laravel) so that primary auth path is Supabase. (5) Keep login lockout (5 attempts, 15 min) on mobile; apply to Supabase login failures. |
| **Files to create/update** | `app/(auth)/login.tsx`, `hooks/users.hooks.ts` (refactor or add Supabase login path). |
| **Dependencies** | 1.2. |
| **Estimated effort** | Medium. |

### 2.2 — Session restore (app load)

| Field | Detail |
|-------|--------|
| **Description** | On app load, restore session from Supabase instead of Laravel. Use `supabase.auth.getSession()` and subscribe to `supabase.auth.onAuthStateChange` so user/session stay in sync. |
| **Web reference** | `AuthContext.tsx`: `onAuthStateChange` first; then `getSession()` to set initial state. |
| **Acceptance criteria** | (1) In `app/index.tsx` (or root _layout): call `supabase.auth.getSession()` on init; if session exists, set user from `session.user` (map to app User shape). (2) Subscribe to `onAuthStateChange` and update context user/session on sign in/out/token refresh. (3) Remove Laravel session restore path: no `getAuthTokens()` → `/auth/refresh` → setUser for primary auth. (4) Expose `sessionExpiresAt` from `session.expires_at` (same as web). (5) When no session or session expired, set user to null and show login (splash/index redirect). |
| **Files to create/update** | `app/index.tsx`, `app/_layout.tsx` (context: user from Supabase session, not Laravel). |
| **Dependencies** | 2.1. |
| **Estimated effort** | Medium. |

### 2.3 — Logout

| Field | Detail |
|-------|--------|
| **Description** | Logout must call `supabase.auth.signOut()` and then clear local state and navigate to login. Remove dependency on Laravel POST `/auth/logout` for the main auth flow. |
| **Web reference** | `AuthContext`: `logout` calls `supabase.auth.signOut()`; state clears via `onAuthStateChange`. |
| **Acceptance criteria** | (1) Single logout path: call `supabase.auth.signOut()`; `onAuthStateChange` will set session/user to null. (2) Then clear any mobile-only state (e.g. clear Supabase session from storage is handled by client), set context user to null, `sessionExpiresAt` to null, and `router.replace('/(auth)/login')`. (3) Drawer logout and any 401/refresh-failure path use this same flow. (4) No call to Laravel `/auth/logout` for Supabase-auth users unless backend still requires it for side effects (document if kept). |
| **Files to create/update** | `utils/auth.ts` (performLogout: Supabase signOut + clear context; remove Laravel logout as primary), `app/_layout.tsx` (logout callback), `components/Drawer.tsx`. |
| **Dependencies** | 2.2. |
| **Estimated effort** | Small. |

### 2.4 — Token refresh and 401 handling

| Field | Detail |
|-------|--------|
| **Description** | Supabase client handles access token refresh automatically. Remove or refactor Laravel refresh logic (interceptor 401 → POST `/auth/refresh`). If some API calls still go to Laravel with a Bearer token, define how that token is obtained (e.g. Supabase session access_token if Laravel validates it, or a separate flow). |
| **Web reference** | Web uses only Supabase; no Laravel API for auth. |
| **Acceptance criteria** | (1) Supabase client: `autoRefreshToken: true` so refresh is automatic. (2) Interceptor: for requests to Laravel API, if still used, set `Authorization: Bearer <supabase_session.access_token>` when available; on 401 from Laravel, either treat as logout or document that Laravel endpoints are deprecated for auth. (3) Remove or refactor: refresh queue, `refreshAccessToken()` for Laravel, and storage of Laravel `refresh_token`/`userId` for primary auth. (4) Session expiry: continue to expose `sessionExpiresAt` from Supabase session for UI. |
| **Files to create/update** | `utils/interceptor.ts`, `utils/secureAuthStorage.ts` (usage for Laravel tokens may be removed or limited to non-auth APIs). |
| **Dependencies** | 2.2, 2.3. |
| **Estimated effort** | Medium. |

---

## Part 3 — Roles from Supabase (identical to web)

### 3.1 — Fetch roles from Supabase `user_roles`

| Field | Detail |
|-------|--------|
| **Description** | Replace GET `/auth/roles` (Laravel) with the same query the web uses: `supabase.from('user_roles').select('role').eq('user_id', user.id)`. User id is the Supabase auth user id (`session.user.id`). |
| **Web reference** | `apps/core/mbukanji-maps/src/hooks/useUserRole.ts`: `supabase.from('user_roles').select('role').eq('user_id', user.id)`. |
| **Acceptance criteria** | (1) New or refactored `lib/rolesSync.ts`: `fetchRolesFromBackend(userId: string)` uses `supabase.from('user_roles').select('role').eq('user_id', userId)` (no `lang` query param; web doesn’t use it for this query). (2) Map raw `role` to AppRole; filter invalid values same as current. (3) Remove all use of Laravel GET `/auth/roles`. (4) Ensure RLS or Supabase project allows authenticated users to read their own rows in `user_roles`. |
| **Files to create/update** | `lib/rolesSync.ts` (replace axios GET with Supabase client query). |
| **Dependencies** | 1.2. |
| **Estimated effort** | Small. |

### 3.2 — Sync roles into SQLite after login / session restore

| Field | Detail |
|-------|--------|
| **Description** | After Supabase login (or session restore), fetch roles from Supabase `user_roles` and upsert into SQLite `local_user_roles` so offline role checks work. Same as current behaviour; only the source of roles changes from Laravel to Supabase. |
| **Web reference** | Web caches roles in localStorage; mobile caches in SQLite for offline. |
| **Acceptance criteria** | (1) On login success (or when `onAuthStateChange` sets user): call `syncRolesFromBackend(session.user.id)` which (a) fetches from Supabase `user_roles`, (b) upserts into `local_user_roles` via `upsertLocalUserRoles(userId, roles)`. (2) Optionally on session restore when app loads with existing session: call sync again so roles are fresh. (3) `useEffectiveRole` and all consumers continue to read from `getLocalUserRoles(userId)` (SQLite); no change to downstream role semantics. (4) AppRole set remains `basic_user` | `advanced_agent` | `org_admin` | `system_admin`. |
| **Files to create/update** | `lib/rolesSync.ts`, `app/(auth)/login.tsx` (after Supabase login success), `app/index.tsx` or _layout (after session restore). |
| **Dependencies** | 3.1, 2.1, 2.2. |
| **Estimated effort** | Small. |

---

## Part 4 — Cleanup and compatibility

### 4.1 — Remove or refactor Laravel-only auth code

| Field | Detail |
|-------|--------|
| **Description** | Remove or clearly isolate code that exists only for Laravel auth (e.g. refresh token storage for Laravel, Laravel “get user” API, GET `/auth/roles`). Keep any Laravel API calls that are still required for non-auth features (e.g. address APIs) and document how they are authenticated (e.g. Supabase JWT in header if Laravel validates it). |
| **Acceptance criteria** | (1) No code path calls Laravel POST `/auth/login` for primary login. (2) No code path calls Laravel GET `/auth/roles`. (3) SecureStore/AsyncStorage for Laravel `userId` + `refresh_token` can be removed or repurposed; document if any key is still used. (4) If Laravel APIs (e.g. address, user profile) are still used: document that they expect Supabase JWT or other token; implement sending that token in requests. (5) Update FORENSIC_CHECK and MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN to state that B.4 (roles from backend) is superseded by Supabase parity (roles from Supabase `user_roles`). |
| **Files to create/update** | `utils/secureAuthStorage.ts`, `utils/interceptor.ts`, `hooks/users.hooks.ts`, `app/(auth)/login.tsx`; docs: `FORENSIC_CHECK_AUTH_DB_IMPLEMENTATION.md`, `MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`. |
| **Dependencies** | Parts 2 and 3. |
| **Estimated effort** | Small–Medium. |

### 4.2 — User shape and context

| Field | Detail |
|-------|--------|
| **Description** | Ensure the app’s User type and context user match what Supabase provides (id, email, phone, metadata for name, etc.). Web maps Supabase user via `mapSupabaseUser`. Mobile should do the same so that the same fields are available across the app. |
| **Web reference** | `AuthContext.tsx`: `mapSupabaseUser(supabaseUser)` → `User` with id, email, phone, firstName, lastName, etc. from metadata. |
| **Acceptance criteria** | (1) Define or reuse a `mapSupabaseUser(supabaseUser)` that returns the app’s User shape. (2) Context `user` is set from `session.user` via this mapper. (3) Any screen or hook that reads `user.id`, `user.email`, etc. continues to work. (4) If Laravel APIs expect a different user id format, document and handle (e.g. use Supabase user id everywhere). |
| **Files to create/update** | `app/_layout.tsx` (context), possibly a small `utils/supabaseUserMap.ts` or inline in layout. |
| **Dependencies** | 2.2. |
| **Estimated effort** | Small. |

---

## Part 5 — Documentation and testing

### 5.1 — Update parity and implementation plan docs

| Field | Detail |
|-------|--------|
| **Description** | Update the main parity doc and the DB & Auth implementation plan to state that mobile auth and roles are now Supabase-based (identical to web), and to point to this task document for the migration steps. |
| **Acceptance criteria** | (1) `MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md` §1.2: update “Mobile auth (current)” to “Mobile auth (after Supabase parity)” and describe Supabase auth + Supabase `user_roles`; add a pointer to this doc. (2) `MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`: add a section (e.g. “Part F — Supabase auth parity”) that references this task and lists the parts above. (3) `FORENSIC_CHECK_AUTH_DB_IMPLEMENTATION.md`: note that B.4 (Laravel GET /auth/roles) is superseded by Supabase roles; add a short “Supabase parity” verification once done. |
| **Files to create/update** | `docs/MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md`, `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md`, `docs/FORENSIC_CHECK_AUTH_DB_IMPLEMENTATION.md`. |
| **Dependencies** | None (can be done in parallel or after implementation). |
| **Estimated effort** | Small. |

### 5.2 — Testing checklist (Supabase parity)

| Field | Detail |
|-------|--------|
| **Description** | Verify login, session restore, logout, roles, and offline behaviour with Supabase as the only auth and roles source. |
| **Acceptance criteria** | (1) Login with email/password (Supabase) → success; user and session in context; roles synced from `user_roles` into SQLite. (2) Close app, reopen → still logged in (session from Supabase storage). (3) Logout → `signOut()`; user null; navigate to login; cannot go back to tabs. (4) Role-based behaviour (e.g. basic_user restriction) works from SQLite after sync. (5) No 404 to GET `/auth/roles`. (6) Same Supabase user can log in on web and mobile and see same roles. |
| **Files to create/update** | Optional: add to `docs/MANUAL_TESTING_CHECKLIST.md` or Part D of implementation plan. |
| **Dependencies** | Parts 1–4. |
| **Estimated effort** | Small. |

---

## File map (summary)

| File / area | Action |
|-------------|--------|
| `package.json` | Add `@supabase/supabase-js` |
| `.env` / `.env.example` / `app.config.ts` | Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `lib/supabase/client.ts` (or `integrations/supabase/client.ts`) | **Create** — Supabase client with RN storage adapter |
| `lib/rolesSync.ts` | **Refactor** — Fetch from Supabase `user_roles` instead of GET `/auth/roles` |
| `app/(auth)/login.tsx` | **Refactor** — Use Supabase signInWithPassword (and align phone/OTP with web); after success call syncRolesFromBackend(supabaseUserId) |
| `app/index.tsx` | **Refactor** — Session restore via supabase.auth.getSession() and onAuthStateChange; set user from session; optional sync roles on restore |
| `app/_layout.tsx` | **Update** — User/session from Supabase; logout callback calls supabase.auth.signOut() then clear and navigate |
| `utils/auth.ts` | **Update** — performLogout calls supabase.auth.signOut(); remove Laravel logout as primary |
| `utils/interceptor.ts` | **Update** — Use Supabase session access_token for Laravel API if needed; remove Laravel refresh flow for auth |
| `utils/secureAuthStorage.ts` | **Update** or **Remove** — No longer store Laravel refresh_token/userId for primary auth (or keep only for non-auth use if any) |
| `hooks/users.hooks.ts` | **Refactor** — Remove or bypass Laravel login for primary auth; keep only if still needed for other APIs |
| `components/Drawer.tsx` | **Update** — Logout uses same Supabase signOut + navigate path |
| `docs/MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md` | **Update** — §1.2 mobile auth = Supabase; reference this task |
| `docs/MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md` | **Update** — Add Part F (or section) Supabase parity, reference this task |
| `docs/FORENSIC_CHECK_AUTH_DB_IMPLEMENTATION.md` | **Update** — B.4 superseded by Supabase roles; add Supabase parity verification |

---

## Implementation order

1. **Part 1** — Add Supabase dependency, env, and client (1.1 → 1.2).  
2. **Part 3.1** — Implement roles fetch from Supabase in `lib/rolesSync.ts` (can be done early; no auth change yet).  
3. **Part 2** — Replace Laravel auth with Supabase auth (2.1 → 2.2 → 2.3 → 2.4).  
4. **Part 3.2** — Wire role sync after Supabase login and session restore.  
5. **Part 4** — Cleanup Laravel auth code and align user shape/context (4.1, 4.2).  
6. **Part 5** — Docs and testing (5.1, 5.2).

---

## Implementation status (mobile code)

| Part | Status | Notes |
|------|--------|--------|
| 1.1 Dependency + env | Done | `@supabase/supabase-js`; `EXPO_PUBLIC_SUPABASE_*` in `.env` / `.env.example` |
| 1.2 Supabase client | Done | `lib/supabase/client.ts` with AsyncStorage adapter |
| 2.1 Login | Done | `(auth)/login.tsx` — `signInWithPassword` (email/phone) |
| 2.2 Session restore | Done | `_layout.tsx` — `getSession()` + `onAuthStateChange` |
| 2.3 Logout | Done | `utils/auth.ts` — `signOut()`; layout logout callback |
| 2.4 Token / interceptor | Done | Interceptor uses Supabase session for API; no Laravel refresh |
| 3.1 Roles from Supabase | Done | `lib/rolesSync.ts` — `user_roles` table |
| 3.2 Role sync on login/restore | Done | Called from _layout (applySession) and login success |
| 4.1–4.2 Cleanup / user shape | Done | `mapSupabaseUser`; auth flows use Supabase only |
| 5.1–5.2 Docs / testing | Partial | This doc + AUTH_SUPABASE_FULL_PARITY_IMPLEMENTATION_PLAN updated |
| **Edge Functions deployed** | **Required** | Deploy `send-otp`, `verify-otp`, `reset-password-with-otp` from `mbukanji-maps` to the same Supabase project (see AUTH_SUPABASE_FULL_PARITY_IMPLEMENTATION_PLAN.md). |
