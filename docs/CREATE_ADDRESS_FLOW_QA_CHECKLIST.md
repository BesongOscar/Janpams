# Create Address Flow - QA / Testing Checklist

## Objective
Validate end-to-end Create Address behavior in web app, with emphasis on offline-first logic, FOUND/NOT_FOUND decisions, and local persistence/sync.

## Scope
- Address mode entry
- Location checking
- Sidebar/card status behavior
- `/create-address` map-click branching
- Form submission (offline and online)
- Sync queue behavior

## Prerequisites
- App: `apps/core/mbukanji-maps`
- Test account available
- Ability to toggle network online/offline
- At least one region data pack installed for offline geocoding tests
- Optional: one known plus-code already saved in local JanGo DB

---

## A. Address Mode Entry

- [ ] Enter Address mode from map UI.
- [ ] Verify app mode becomes `address`.
- [ ] Verify grid becomes visible.
- [ ] If GPS available:
  - [ ] `activeLocation` is set.
  - [ ] source is marked as `gps`.
- [ ] If GPS unavailable:
  - [ ] map selection mode is enabled.
  - [ ] user sees tap-map fallback prompt.

Expected:
- No crash.
- Location check runs after location is set.

---

## B. Location Check - FOUND / NOT_FOUND

## B1. Local match case (FOUND)
- [ ] Tap/select a location whose plus code exists in local `addresses`.
- [ ] Verify `locationCheckResult.status === FOUND`.
- [ ] Verify UI shows found/existing address context.

Expected:
- Source indicates local/JanGo where applicable.
- Existing address details render.

## B2. No local record + offline only
- [ ] Go offline.
- [ ] Tap/select a location with no local plus-code record.
- [ ] Verify status is `NOT_FOUND` in usual path.
- [ ] Verify "Location Has No Address" experience appears.

Expected:
- User is guided to create address instead of falsely "found".

## B3. No region data installed
- [ ] Remove/disable relevant region pack.
- [ ] Select location in that region.
- [ ] Verify offline data prompt panel appears.

Expected:
- User is asked to download region data.

---

## C. Create Page Initialization (`/create-address`)

- [ ] Navigate to `/create-address?lat=...&lon=...`.
- [ ] Verify map centers on selected point.
- [ ] Verify reverse geocode runs and fills:
  - [ ] street
  - [ ] neighborhood/city/region/country
  - [ ] house number suggestion
  - [ ] nearby streets (if available)

Expected:
- Form initializes without manual reload.
- Fallback defaults appear if geocode fails.

---

## D. Create Page Map Click Branching

## D1. Existing address branch
- [ ] Click a location with known local plus-code match.
- [ ] Verify page enters view mode (existing address display).

Expected:
- "Address Found" toast/indicator.
- Existing fields populated from stored record.

## D2. Not found branch
- [ ] Click location with no local match.
- [ ] Verify page enters create mode.
- [ ] Verify geocode-driven fields refresh for clicked point.

Expected:
- New calculated address context is shown.
- No stale data from previous click.

---

## E. Form Validation

- [ ] Try submit with missing required fields.
- [ ] Validate required errors for:
  - [ ] location
  - [ ] property type
  - [ ] connection
  - [ ] photo or upload link
  - [ ] street name

Expected:
- Submit blocked until required fields are provided.

---

## F. Address Submission

## F1. Standard create
- [ ] Submit valid form without editing API-provided names.
- [ ] Verify one address record is created.
- [ ] Verify success confirmation appears.

## F2. Dual create (edited names)
- [ ] Edit street and/or neighborhood when API values exist.
- [ ] Submit.
- [ ] Verify:
  - [ ] official record created (`api_official`)
  - [ ] user-suggested record created (`user_suggested`)
  - [ ] records linked bidirectionally
  - [ ] suggestion records created

Expected:
- User sees suggested-name messaging.

---

## G. Offline Persistence & Sync

## G1. Create while offline
- [ ] Turn network offline.
- [ ] Submit valid address.
- [ ] Verify local save succeeds immediately.
- [ ] Verify record has `sync_status = pending`.
- [ ] Verify sync queue receives a CREATE item.

Expected:
- No network required to complete create.

## G2. Reconnect and sync
- [ ] Return online.
- [ ] Wait for sync cycle.
- [ ] Verify queued items processed.
- [ ] Verify address sync status transitions to `synced` (if backend path active/simulated).

---

## H. House Number / Street Logic Checks

- [ ] Validate number changes when street selection changes.
- [ ] Validate side-of-street/parity behavior.
- [ ] Validate non-street-facing threshold handling (>30m) and suffix behavior.
- [ ] Validate fallback to alternate nearby street when projection invalid.

Expected:
- Deterministic, stable behavior for same grid cell.

---

## I. Regression / UX Checks

- [ ] URL query params (`lat`, `lon`) update on map click.
- [ ] Back/forward navigation preserves location context.
- [ ] Create page does not require full page refresh between clicks.
- [ ] No crashes in offline mode.
- [ ] Toasts/messages match actual branch taken.

---

## J. Known Current Behavior to Confirm

- [ ] Offline check path intentionally sets external `houseNumber` null in service wiring.
- [ ] Existing-address detection in create-page view branch relies on local `jangoMatch`.
- [ ] OSM/admin context still used for form population even when NOT_FOUND.

---

## Pass Criteria

- All critical flows pass in both online and offline conditions.
- No false "existing address found" when only weak street context exists.
- Offline create reliably saves locally and queues sync.
