# Offline-First: Login → Find Address → Create Address — Evaluation & Gap Analysis

**Purpose:** Evaluate web and mobile implementation of the full flow from **login** through **finding an address** and **creating an address**, all **offline-first** where applicable. Provide a single reference for what is required and where gaps remain. No code—process and gap analysis only.

**Reference apps:**
- **Web:** `apps/core/mbukanji-maps` (Supabase Auth, IndexedDB, offline data packs)
- **Mobile:** `apps/core/address-maker-glopams` (Supabase Auth post-migration, SQLite, offline data packs)

---

## 1. What Is Required End-to-End (Login → Find → Create)

### 1.1 Login and session (required before find/create)

| Step | Requirement | Notes |
|------|-------------|--------|
| **Session restore** | On load, restore session from persistent storage so returning users stay logged in. | Web: Supabase `getSession()` + `onAuthStateChange`. Mobile: same (Supabase client with AsyncStorage adapter). |
| **Login** | Email or phone + password/pin; optional lockout after N failed attempts. | Both support email/phone; lockout (e.g. 5 attempts, 15 min) on mobile. |
| **Signup** | Email or phone signup; OTP verification; then treated as logged in. | Web: Supabase signUp + Edge Functions (send-otp, verify-otp). Mobile: same flow; Edge Functions must be deployed (e.g. self-hosted). |
| **Roles** | After login/restore, fetch roles (e.g. from Supabase `user_roles`) and cache locally for offline. | Web: Supabase `user_roles`; mobile: same + SQLite `local_user_roles` for offline. |
| **Protected access** | Find and create flows only available when authenticated; otherwise show login. | Web: ProtectedRoute / auth modal. Mobile: (tabs) guard + redirect to auth. |
| **Logout** | Single path: clear session, clear header, navigate to login; used from UI and on token-refresh failure. | Both: single logout implementation; replace navigation so back stack is cleared. |

### 1.2 Find address (offline-first)

| Step | Requirement | Notes |
|------|-------------|--------|
| **Location source** | Obtain a location: GPS (“use my location”) or map tap (grid cell). | Web: `useAddressModeEntry` + GPS or map click. Mobile: map tab “use current location” or tap Plus Code cell. |
| **Active location** | Store `userLocation` (GPS only) and `activeLocation` (selected cell); track source (gps vs map_click). | Both use map store; mobile snaps to cell center for consistency. |
| **Location check** | Decide FOUND vs NOT_FOUND at that location using **offline-first** logic. | See next row. |
| **Check pipeline** | Run canonical check: local JanGo by plus code, then offline reverse geocode (resolveStreetAddress), then optional online. FOUND = local JanGo match or high/medium external candidate; NOT_FOUND otherwise. | Web: `checkLocation` → `checkLocationAddress` with `resolveStreetAddress` as offline path. Mobile: same when packs installed; when no packs, local check only (no Laravel check-mobile API). |
| **Offline reverse geocode** | `resolveStreetAddress(lat, lon, maxDist)` using local data packs: street segments, admin boundaries, selectStreets, merge geometry, direction lock, house number. | Shared logic (packages/core + app-specific DB). Both use SQLite/IndexedDB for segments, direction locks, addresses. |
| **Store update** | After check/resolve: update map store (locationCheckResult / addressFound, activeStreetData, resolvedStreetGeometry, calculatedAddress, nearbyStreets). | Web: setLocationCheckResult, setBothAddresses, etc. Mobile: syncMapStoreFromResolveResult + local addressFound/addressNotFound state. |
| **UI** | Show FOUND (existing address details) or NOT_FOUND (prompt to create); show marching ants on selected street when resolved. | Web: AddressInfoPanel / AddressCard. Mobile: bottom sheet, AddressFoundCard / AddressNotFoundCard; MarchingAntsStreetOverlay on create screen. |
| **No packs** | When no region pack installed: graceful message (download data) or limited fallback; no silent failure. | Both: prompt or fallback; mobile can show “no address” and still allow create with minimal context. |

### 1.3 Create address (offline-first)

| Step | Requirement | Notes |
|------|-------------|--------|
| **Entry** | User opens create screen at **fixed coordinates** (from map: FOUND view or NOT_FOUND “Create address”). | Web: CreateAddressPage with lat/lon params. Mobile: new-create-address with route params (latitude, longitude, optional plusCode, etc.). |
| **Data source** | Prefill form from **same offline pipeline** as find: resolveStreetAddress at those coordinates, then store (calculatedAddress, activeStreet, resolvedStreetGeometry) or passed params. | Web: useEffect on lat/lon runs resolveStreetAddress; form uses addressData from that result. Mobile: fetch effect runs resolveStreetAddress and syncMapStoreFromResolveResult; form reads from store and resolve result (house number, street, neighborhood, city, region, country). |
| **Street / numbering** | Use resolved street, direction lock, and computed house number (chainage, side, formula); show marching ants on create page. | Both: resolveStreetGeometry(street, directionLock); house number from calculateHouseNumberSync; marching ants from resolvedStreetGeometry (web: CSS SVG; mobile: MarchingAntsStreetOverlay with correct [lon,lat] for getPointInView). |
| **Validation** | Require location, property type, connection, photo/upload, street name; optional business name, unit. | Same semantics; mobile form mirrors web required fields. |
| **Save** | Write address to **local DB** first (offline-first); set sync_status = pending; enqueue for sync. | Web: SyncManager.createAddress → IndexedDB. Mobile: SyncManager.createAddress → SQLite; same contract. |
| **Direction lock** | After first address creation at that street, call **autoLockOnFirstAddress(streetKey)** so numbering direction is locked. | Web: after create, autoLockOnFirstAddress. Mobile: same; streetKey from store or resolve result. |
| **Sync** | When online, sync manager pushes pending addresses; on failure retry later. No network required to create. | Both: queue-based sync; addresses created and editable offline. |
| **Existing address** | If location already has a JanGo address (local plus-code match), show view-only mode or prompt. | Web: CreateAddressPage view mode. Mobile: new-create-address view mode banner. |

---

## 2. Web Implementation Summary (Reference)

- **Auth:** Supabase Auth; getSession + onAuthStateChange; login (email/phone + password/pin); signup + OTP via Edge Functions; roles from Supabase `user_roles`; ProtectedRoute; logout clears state and can show auth modal or redirect.
- **Find:** MapPage + useAddressModeEntry; GPS or map click → activeLocation; performLocationCheck → checkLocation → checkLocationAddress with resolveStreetAddress (offline) and findLocalJanGoByPlusCode10; FOUND/NOT_FOUND; AddressInfoPanel / AddressCard; marching ants via ActiveStreetLayer (resolvedStreetGeometry from store).
- **Create:** CreateAddressPage with lat/lon; useEffect runs resolveStreetAddress and populates form from result; SyncManager.createAddress (IndexedDB) then autoLockOnFirstAddress; sync queue for when online.
- **Offline:** All of check and create use local IndexedDB + data packs; no network required after pack download.

---

## 3. Mobile Implementation Summary (Current)

- **Auth:** Supabase Auth (post-migration); getSession + onAuthStateChange; session in AsyncStorage; login/signup/verify/forgot password/pin use Supabase + Edge Functions (send-otp, verify-otp, reset-password-with-otp); roles from Supabase `user_roles` and SQLite `local_user_roles`; (tabs) guarded by user; logout single path; auth layout redirects to tabs when session restored late.
- **Find:** Map tab (index); “use current location” or tap grid cell; when packs: checkLocation (addressServices) → same checkLocationAddress/resolveStreetAddress pipeline; syncMapStoreFromResolveResult; AddressFoundCard / AddressNotFoundCard; when no packs: local check only (no check-mobile API). Snap to cell center for activeLocation.
- **Create:** new-create-address with params; fetch effect runs resolveStreetAddress and syncMapStoreFromResolveResult; form prefilled from store and resolve result; SyncManager.createAddress (SQLite) and autoLockOnFirstAddress; MarchingAntsStreetOverlay with geometry converted to [lon,lat] for getPointInView.
- **Offline:** Check and create use SQLite + data packs; address check no longer calls Laravel; sync queue when online.

---

## 4. Implementation Gap Analysis (Web vs Mobile)

### 4.1 Auth and session

| Gap | Web | Mobile | Severity / notes |
|-----|-----|--------|------------------|
| **Provider** | Supabase | Supabase | Closed (mobile migrated). |
| **Session storage** | Supabase client (browser storage) | AsyncStorage adapter | Minor: mobile could use SecureStore for session keys for parity with “most secure” guidance; not required for correctness. |
| **Roles source** | Supabase `user_roles` | Supabase `user_roles` + SQLite cache | Closed. |
| **Pin reset by phone** | Backend may support phone in reset-password-with-otp | Mobile calls with phone; edge function may be email-only | Minor: backend/edge function gap; mobile flow is in place. |
| **Session restore on refresh** | getSession then apply | getSession + timeout only stops blocking (no clear session); auth layout redirects if user appears on auth screen | Closed (timeout no longer clears session; redirect when session restored). |

### 4.2 Find address (offline-first)

| Gap | Web | Mobile | Severity / notes |
|-----|-----|--------|------------------|
| **Location check pipeline** | checkLocation → checkLocationAddress; offline = resolveStreetAddress + local JanGo | Same when packs; when no packs no API (local check only) | Closed; mobile no longer calls Laravel check-mobile. |
| **Snap to grid** | Raw click for activeLocation | Snap to cell center | Intentional difference; mobile more deterministic; doc recommends keeping mobile snap. |
| **GPS result cache** | Cached in gpsLocationCheckResult on initial load; restored when re-clicking GPS cell | lastGpsCheckResult set on first “use my location” and when tapping GPS cell; restored when tap-back | **Closed:** mobile sets lastGpsCheckResult in handleUseCurrentLocation (FOUND and NOT FOUND branches and no-packs error path). |
| **Restore locationCheckResult on GPS cell** | Cached in gpsLocationCheckResult; restored when re-clicking GPS cell | Mobile restores from lastGpsCheckResult | **Closed:** web now has gpsLocationCheckResult in store, set in initializeMapLocation and restored in handleMapClick when isClickingUserBox. |
| **Street resolution / store** | resolveStreetAddress; syncMapStoreFromResolveResult equivalent; resolvedStreetGeometry, activeStreet, etc. | Same: resolveStreetAddress, syncMapStoreFromResolveResult, mapStore | Closed. |
| **Marching ants on map tab** | ActiveStreetLayer with resolvedStreetGeometry | Map tab does not show street marching ants overlay (only on new-create-address) | Design/scope: mobile map tab shows grid/address card; street ants on create screen. Optional: add street ants to map tab if desired. |

### 4.3 Create address (offline-first)

| Gap | Web | Mobile | Severity / notes |
|-----|-----|--------|------------------|
| **Form data source** | resolveStreetAddress in CreateAddressPage; form from addressData / store | resolveStreetAddress in fetch effect; form from store + resolve result; guard requires user?.id and initializationComplete | Closed; mobile uses same pipeline. |
| **autoLockOnFirstAddress** | Called after create | Called after create | Closed. |
| **Marching ants on create screen** | SVG with CSS animation | MarchingAntsStreetOverlay; geometry passed as [lon,lat] for getPointInView | Closed (coordinate order fix applied). |
| **View mode (existing address)** | CreateAddressPage view mode when local JanGo at plus code | new-create-address view mode banner | Closed. |
| **Dual-address / user-suggested** | Web can create official + user_suggested when user edits names | Mobile implements same: originalApiStreetName/Neighborhood, createDualAddress, name_source, suggestions | **Closed:** new-create-address + lib/dualAddressCreation.ts; backend contract assumed aligned. |

### 4.4 Data and infrastructure

| Gap | Web | Mobile | Severity / notes |
|-----|-----|--------|------------------|
| **DB** | IndexedDB (v14) | SQLite (schema aligned) | Schema and enums aligned per MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN; ongoing audit for new stores/indexes. |
| **Data pack source** | Prod VPS (e.g. datapack.janpams.com) | Configurable (staging/prod) | Closed (Phase 0). |
| **POIs, route cache, JAPA, Valhalla, navigation** | Full pipeline | Per MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN phases 1–8; some phases done, others (e.g. Valhalla, navigation UI) in plan | Out of scope for “find + create address” only; required for full offline navigation/routing parity. |
| **Location Plan** | Web has CreateLocationPlanPage, corridor, PDF | Not on mobile by design | Out of scope; not a gap for find/create. |

### 4.5 Summary: gaps that affect “login → find → create” offline-first

- **Closed:** Auth; find (check pipeline, resolveStreetAddress, store); create (form, autoLockOnFirstAddress, marching ants, view mode, dual-address); **GPS result cache on first load (mobile)**; **restore locationCheckResult when re-clicking GPS cell (web)**.
- **Minor / optional:** SecureStore for session on mobile; pin reset by phone (backend/edge function).

---

## 5. Required Prerequisites (Operational)

- **Data packs:** User must have installed a region pack for the area where they find/create addresses for full offline street resolution and numbering. Without packs, find uses local JanGo only and create can still save with minimal context.
- **Edge Functions (Supabase):** Signup, verify OTP, reset password/pin rely on Edge Functions (send-otp, verify-otp, reset-password-with-otp). For self-hosted Supabase these must be deployed on the self-hosted Edge Runtime; for Supabase Cloud they are deployed via CLI.
- **Environment:** Mobile .env must have EXPO_PUBLIC_SUPABASE_URL and anon key (EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Same project as web for shared auth and roles.

---

## 6. Document References

- **Web create flow:** CREATE_ADDRESS_FLOW_END_TO_END.md, CREATE_ADDRESS_FLOW_TECH_ARCH.md
- **Web–mobile alignment:** WEB_TO_MOBILE_ALIGNMENT.md
- **Parity plan (offline + auth):** MOBILE_OFFLINE_WEB_PARITY_TASK_PLAN.md, MOBILE_DB_AND_AUTH_IMPLEMENTATION_PLAN.md
- **Supabase auth:** AUTH_SUPABASE_FULL_PARITY_IMPLEMENTATION_PLAN.md, AUTH_SUPABASE_CHECKLIST.md
- **Active location / cell click:** GAP_ANALYSIS_ACTIVE_LOCATION_AND_CELL_CLICK.md
- **Complete addressing (mobile):** IMPLEMENTATION_PLAN_Complete_Addressing_Offline_First.md
