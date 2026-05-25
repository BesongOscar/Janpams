# Implementation Plan: Mirror Web Addressing on Mobile (Monorepo Reuse First)

## 1) Goal

Deliver mobile Create Address behavior that matches the web app end-to-end, while maximizing shared logic and reducing drift through monorepo reuse.

Target parity areas:
- Address mode entry and location check
- FOUND / NOT_FOUND decision semantics
- Offline geocoding and street selection
- House-number generation and street-side/chainage logic
- Create Address submit behavior (including direction lock)
- Offline-first local persistence and deferred sync

---

## 2) Scope

## In scope
- Behavioral parity between:
  - Web: `apps/core/mbukanji-maps`
  - Mobile: `apps/core/address-maker-glopams`
- Shared code extraction for pure domain logic
- Platform adapter boundaries (web vs RN)
- Testing strategy for parity and regression prevention

## Out of scope (initial phase)
- Pixel-perfect UI parity
- New product features unrelated to address creation
- Full redesign of navigation patterns

---

## 3) Monorepo Reuse Principles (Non-Negotiable)

1. **Single source of truth for addressing domain logic**  
   No duplicate implementations for decision logic, geocoding orchestration rules, numbering formulas, street-key normalization, and direction-lock rules.

2. **Platform-specific code only at edges**  
   Keep differences in adapters:
   - storage adapter (IndexedDB vs SQLite)
   - geolocation adapter (browser vs Expo)
   - map interaction adapter (MapLibre web vs RN map)

3. **Parity-by-tests, not parity-by-docs**  
   Shared fixtures and golden scenarios must pass in both web and mobile pipelines.

4. **Backward compatible migration**  
   Extract incrementally. Maintain existing behavior while moving modules to shared package(s).

---

## 4) Current Baseline Summary

The repo already has strong overlap between web and mobile logic (offline packs, street selection, numbering, sync manager patterns), but behavior drift remains in integration details:

- Create flow wiring differences in how resolve/check outputs are consumed.
- Existing-address branch gates differ by surface.
- Some logic is duplicated in app-local `lib/*` trees rather than imported from a shared package.

---

## 5) Target Architecture

## 5.1 Shared domain package (new or expanded)

Create/expand a shared package (recommended: `packages/addressing-core` or extend `packages/core`) containing pure, platform-agnostic modules:

- `checkLocationAddress` decision engine
- plus code utility wrappers used by addressing flow
- address formatting and normalization
- street key and neighborhood key normalization
- house-number calculation (projection/chainage/parity)
- direction lock business rules (not persistence I/O)
- flow contracts/types (`AddressCheckResult`, `NumberingContext`, etc.)

## 5.2 Adapter contracts (per platform app)

Each app provides adapters implementing interfaces consumed by shared logic:

- `offlineReverseGeocode(lat,lng)`
- `onlineReverseGeocode(lat,lng)` (optional policy-driven)
- `findLocalAddressByPlusCode(plusCode10)`
- `getTakenHouseNumbers`, `reserveHouseNumber`
- `persistAddress`, `queueSync`

This keeps behavior uniform while allowing platform-native storage/network implementations.

---

## 6) File Reuse / Migration Map

## Web-origin logic to centralize

- `apps/core/mbukanji-maps/src/lib/checkLocationAddress.ts`
- `apps/core/mbukanji-maps/src/lib/createLocationAddress.ts`
- `apps/core/mbukanji-maps/src/lib/addressFormat.ts`
- `apps/core/mbukanji-maps/src/lib/streetDirectionService.ts` (pure logic only)
- `apps/core/mbukanji-maps/src/lib/pluscode.ts` (addressing-used helpers)

## Mobile integrations that should consume shared modules

- `apps/core/address-maker-glopams/lib/addressServices.ts`
- `apps/core/address-maker-glopams/lib/checkLocationAddress.ts` (replace local copy/import shared)
- `apps/core/address-maker-glopams/lib/createLocationAddress.ts` (replace local copy/import shared)
- `apps/core/address-maker-glopams/app/new-create-address.tsx`
- `apps/core/address-maker-glopams/hooks/useAddressModeEntry.ts`

## Keep app-local (adapter layer)

- Web: IndexedDB + browser geolocation specifics
- Mobile: SQLite + Expo geolocation specifics
- UI components/page routing specifics in each app

---

## 7) Implementation Workstreams

## Workstream A: Define parity contract and freeze expected behavior

Deliverables:
- Parity contract doc section (decision matrix + create flow steps)
- Shared fixture set for scenarios:
  - local plus-code match
  - no local + offline street-only
  - low-quality external candidate
  - street re-selection and non-street-facing

Acceptance:
- Product + web + mobile leads sign off exact FOUND/NOT_FOUND semantics.

---

## Workstream B: Extract shared addressing kernel

Tasks:
1. Create shared package folder and exports.
2. Move/copy pure logic modules from web origin.
3. Replace app-local imports in both apps with shared package imports.
4. Keep legacy app-local modules as thin wrappers temporarily (deprecation path).

Acceptance:
- Web and mobile build/typecheck pass.
- No behavior changes in existing tests.

---

## Workstream C: Adapter standardization

Tasks:
1. Define TypeScript interfaces for storage/geocoding adapters.
2. Implement web adapter (IndexedDB + existing reverse geocode wiring).
3. Implement mobile adapter (SQLite + mobile geocode wiring).
4. Inject adapters into shared decision and allocation functions.

Acceptance:
- Same shared function calls produce equivalent outputs under fixture-mocked adapters.

---

## Workstream D: Mobile create-flow parity integration

Tasks:
1. Ensure create screen always uses canonical resolve pipeline at screen coordinates.
2. Align map-to-create data handoff with web behavior.
3. Align existing-address branch semantics with approved parity contract.
4. Ensure create submit includes:
   - normalized street key
   - direction lock auto-lock-on-first-address sequence
5. Align fallback/error behavior and user messaging at branch points.

Acceptance:
- Mobile reproduces web outcomes for all parity fixtures and manual scenarios.

---

## Workstream E: Sync and persistence parity

Tasks:
1. Verify local save payload parity (core fields + metadata fields).
2. Verify sync queue contract parity (`pending`, retry semantics, error handling).
3. Verify search/index side effects (if applicable) for mobile.

Acceptance:
- Offline create then reconnect sync behaves consistently on both platforms.

---

## Workstream F: Test suite and CI gates

Tasks:
1. Add shared unit tests in package for:
   - status decision
   - numbering formulas
   - street key normalization
2. Add cross-platform fixture runner (web + mobile adapters).
3. Add parity checklist integration test on mobile create flow.
4. Add CI gate: shared tests must pass before app tests.

Acceptance:
- CI prevents logic drift between platforms.

---

## 8) Phased Delivery Plan

## Phase 0 - Prep (1-2 days)
- Finalize parity contract and scenario fixtures.
- Confirm package destination and ownership.

## Phase 1 - Shared core extraction (3-5 days)
- Extract/import pure logic modules.
- Wire both apps to shared modules with wrappers.

## Phase 2 - Mobile flow alignment (3-4 days)
- Implement create-screen parity behavior and branch alignment.
- Verify direction lock and submit payload parity.

## Phase 3 - Tests and hardening (2-3 days)
- Add shared tests + mobile integration checks.
- Resolve edge cases and docs.

## Phase 4 - Rollout (1-2 days)
- Enable by default.
- Monitor QA scenarios and fix regressions.

---

## 9) Acceptance Criteria (Definition of Done)

1. **Behavioral parity**
   - Same inputs produce same FOUND/NOT_FOUND status and create-branch behavior.
   - Same geocode/street inputs produce same house number/side/chainage outputs.

2. **Code reuse**
   - Core decision + numbering logic imported from shared package in both apps.
   - No duplicate business-logic forks left in app-local libs.

3. **Mobile create flow parity**
   - Map selection -> create screen -> submit path mirrors web outcomes.
   - Direction auto-lock on first address is applied consistently.

4. **Offline-first parity**
   - Offline create persists locally and queues sync in both apps.
   - Reconnect behavior is consistent and observable.

5. **Quality gates**
   - Shared unit tests green.
   - Mobile parity integration tests green.
   - QA checklist completed without critical deviations.

---

## 10) Risks and Mitigation

## Risk: Hidden behavior differences in app wrappers
Mitigation:
- Keep wrappers thin and temporary.
- Add fixture-based snapshot tests around wrappers.

## Risk: Platform adapter divergence over time
Mitigation:
- Version adapter interface.
- Add CI contract tests for adapter outputs.

## Risk: Migration introduces regressions in create flow
Mitigation:
- Migrate behind feature flag if needed.
- Execute side-by-side logging in staging for branch decisions.

---

## 11) Execution Checklist for Mobile Developer

- [ ] Use shared addressing modules (not local duplicates) for check + number logic.
- [ ] Ensure create screen resolves canonical address data at screen coordinates.
- [ ] Ensure FOUND/NOT_FOUND branching matches approved parity contract.
- [ ] Ensure submit payload includes parity fields (street/number/side/chainage/admin/plus code).
- [ ] Ensure `autoLockOnFirstAddress(streetKey)` runs after create.
- [ ] Ensure offline save + queued sync works with same statuses.
- [ ] Pass parity fixtures and QA checklist.

---

## 12) Related Docs

- `docs/CREATE_ADDRESS_FLOW_END_TO_END.md`
- `docs/CREATE_ADDRESS_FLOW_QA_CHECKLIST.md`
- `docs/CREATE_ADDRESS_FLOW_TECH_ARCH.md`
- `apps/core/address-maker-glopams/docs/WEB_TO_MOBILE_ALIGNMENT.md`
- `apps/core/address-maker-glopams/docs/MOBILE_CREATE_ADDRESS_PLAN.md`
