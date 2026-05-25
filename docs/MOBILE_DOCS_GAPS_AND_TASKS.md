# Mobile Docs vs Codebase — Gaps and Tasks

Review of **MOBILE_IMPLEMENTATION_PLAN**, **MOBILE_MONOREPO_INTEGRATION**, **MOBILE_ROADMAP**, **MOBILE_SPECS**, and **MOBILE_SRD** against the current codebase. Gaps and recommended tasks to either align the codebase with the docs or update the docs to reflect reality.

---

## 1. Document Summary (What the Docs Specify)

### 1.1 Monorepo structure (MOBILE_MONOREPO_INTEGRATION, MOBILE_IMPLEMENTATION_PLAN)

- **Root:** `janpams-monorepo/` with `pnpm-workspace.yaml` and `turbo.json`.
- **Apps:** `apps/mobile/` (Expo), plus `apps/government/`, `apps/banking/*`, etc.
- **Packages:** `packages/core/`, `packages/types/`, optional `packages/mobile-adapters/`.
- **Mobile app:** Lives under `apps/mobile/`, name `@janpams/mobile`, depends on `@janpams/core` and `@janpams/types` via `workspace:*`.
- **Tooling:** pnpm 8+, Turborepo; Metro config resolves workspace packages from monorepo root.

### 1.2 Mobile app layout (MOBILE_IMPLEMENTATION_PLAN, MOBILE_SPECS)

- **Entry:** `apps/mobile/src/` with `App.tsx`, `screens/`, `components/`, `adapters/`, `stores/`, `offline/`, `navigation/`, `auth/`, `hooks/`, `queries/`, `utils/`, `constants/`.
- **Screens:** MapScreen, CreateAddressScreen, AddressListScreen, DataPacksScreen, ProfileScreen, VerifyCaptureScreen, auth (Login, Signup, OTP).
- **Adapters:** LocationAdapter, SQLiteAdapter, CameraAdapter, FileSystemAdapter (expo-* wrappers).
- **Shared logic:** Import from `@janpams/core` (pluscode, address, geolocation) and `@janpams/types`; platform-specific behavior behind adapters.

### 1.3 Naming and product (all docs)

- Product/monorepo name: **JanPAMS**. Package names: **@janpams/mobile**, **@janpams/core**, **@janpams/types**.

### 1.4 Phases (MOBILE_IMPLEMENTATION_PLAN, MOBILE_ROADMAP)

- Phase 1: Foundation (project in monorepo, adapters, GPS, SQLite).
- Phase 2: Map & location (react-native-maps, Plus Code grid).
- Phase 3: Address creation (form, house number from core, photo, save to SQLite).
- Phase 4: Offline data packs (download, OfflineGeocoder, spatial queries).
- Phase 5: Sync & auth (SyncManager, background task, Supabase auth).
- Phase 6: Verification deep links, polish, device testing.

---

## 2. Current Codebase Reality

### 2.1 Structure

- **No monorepo at repo root.** No `pnpm-workspace.yaml`, no `turbo.json`, no `apps/` or `packages/` at top level.
- **Single Expo app at root:** All app code lives in the repository root (e.g. `jango-app-v2.0/`), not under `apps/mobile/`.
- **No `src/`:** App code is at root: `app/`, `components/`, `lib/`, `hooks/`, `utils/`, `constants/`, `styles/`, etc. Screens are under `app/` (Expo Router), not `src/screens/`.
- **Shared packages:** `docs/packages/` contains `core`, `types`, `geospatial-data`, etc. (with names like `@janpams/core`, `@janpams/types` and `workspace:*` between them). The **root mobile app does not depend on these**; it has no `@janpams/core` or `@janpams/types` in its `package.json`.
- **Package manager:** Root uses **yarn** (`yarn.lock`) and **package.json name "jango"**, not pnpm or `@janpams/mobile`.
- **Shared logic:** Implemented **inside the app** in `lib/` (e.g. `lib/createLocationAddress.ts`, `lib/pluscode.ts`, `lib/db/`, `lib/offlineDataPacks.ts`, `lib/streetSelection.ts`, `lib/geocoding/`). Logic is duplicated/ported from web (docs/src) rather than consumed from workspace packages.
- **No adapters folder:** No dedicated `adapters/`; platform usage (expo-location, expo-sqlite, etc.) is spread across `lib/`, `hooks/`, and screens.
- **No dedicated `offline/` folder:** Offline behavior lives in `lib/` (e.g. offlineDataPacks, db, sync) and components (e.g. OfflineDataManager).
- **Web app:** Lives under `docs/src/` (and references docs packages where applicable). So “web” and “packages” are under `docs/`, not at repo root as in the doc diagrams.

### 2.2 What exists and works

- Expo app with Expo Router (`app/`), map (MapLibre), Plus Code grid, address creation (`new-create-address`), offline geocoding, SQLite, sync, auth, data pack download, street selection, house number calculation, verification flow, i18n, etc.
- Functionally, many SRD/SPECS/Implementation Plan items are implemented; the **layout and monorepo strategy** differ from the docs.

---

## 3. Gaps (Docs vs Codebase)

| Area | What docs say | Current state | Gap |
|------|----------------|---------------|-----|
| **Repo layout** | Monorepo root with `apps/`, `packages/`, pnpm, turbo | Single repo root; app at root; docs/packages and docs/src under `docs/` | No monorepo; mobile is not under `apps/mobile/`; no pnpm/turbo at root |
| **Mobile app location** | `apps/mobile/` with `src/` | App at repo root; entry via `app/` (Expo Router), no `src/` | Path and naming don’t match |
| **Shared packages** | Mobile uses `@janpams/core`, `@janpams/types` (workspace:*) | Root app has no such deps; logic in `lib/` (in-repo copy/port) | No use of workspace packages; duplication vs docs/core |
| **Package name** | `@janpams/mobile` | `jango` | Naming mismatch |
| **Package manager** | pnpm 8+ | yarn (yarn.lock) | Different tooling |
| **Directory layout** | `src/screens/`, `src/adapters/`, `src/offline/`, etc. | `app/`, `lib/`, `hooks/`, no `adapters/`, no `offline/` | Different structure; same concerns implemented elsewhere |
| **Adapter pattern** | Explicit adapters (LocationAdapter, SQLiteAdapter, etc.) in `src/adapters/` | No adapters folder; expo-* used directly in lib/hooks/screens | Pattern not formalized as in SPECS |
| **Navigation** | RootNavigator, AuthStack, MainTabs, linking config in `src/navigation/` | Expo Router file-based routing in `app/` | Different navigation model |
| **Naming (product)** | JanPAMS, @janpams/* | jango | Brand/package naming differs |

---

## 4. Tasks — Two Directions

You can either **move the codebase toward the docs** (monorepo, shared packages, layout) or **update the docs to match the codebase** (single app, lib-based shared logic, current naming). Below are tasks for both.

---

### Option A: Align codebase with docs (adopt monorepo + structure)

| # | Task | Notes |
|---|------|------|
| A1 | Introduce monorepo at repo root | Add `pnpm-workspace.yaml`, include `apps/mobile` and `packages/*` (or move `docs/packages` to `packages/`). |
| A2 | Move mobile app into `apps/mobile/` | Relocate current root app (app/, components/, lib/, hooks/, etc.) to `apps/mobile/`. Adjust entry (e.g. index → apps/mobile, or keep Expo root in apps/mobile). |
| A3 | Rename app package to `@janpams/mobile` | Update `apps/mobile/package.json` name; optional: rename repo/product to JanPAMS where appropriate. |
| A4 | Switch root to pnpm; add Turborepo | Replace yarn with pnpm at root; add `turbo.json` and mobile-related tasks (e.g. mobile:start, mobile:build) as in MOBILE_MONOREPO_INTEGRATION. |
| A5 | Wire mobile app to shared packages | Add `@janpams/core` and `@janpams/types` (workspace:*) to `apps/mobile/package.json`. Add Metro (and TS) config so `apps/mobile` resolves packages from monorepo root (see MOBILE_MONOREPO_INTEGRATION). |
| A6 | Migrate `lib/` logic into `@janpams/core` / types | Gradually move address, pluscode, geolocation, offline, etc. from `lib/` into `packages/core` and `packages/types` so mobile (and web) consume shared code. Remove or thin duplicated logic in app. |
| A7 | Introduce adapters layer | Add `src/adapters/` (or equivalent under `apps/mobile`) with LocationAdapter, SQLiteAdapter, etc., wrapping expo-* and matching SPECS; refactor call sites to use adapters. |
| A8 | Align directory layout with SPECS/Implementation Plan | Optionally introduce `src/screens/`, `src/offline/`, `src/navigation/`, etc., and migrate code from current layout; or keep Expo Router under `app/` but document that as the chosen structure. |
| A9 | Move `docs/packages` to repo root `packages/` | If monorepo is at root, `packages/` should live at root; move `docs/packages/*` to `packages/` and fix internal workspace references and any doc paths. |
| A10 | Update docs to match final structure | After moves, update MOBILE_MONOREPO_INTEGRATION, MOBILE_IMPLEMENTATION_PLAN, MOBILE_SPECS with actual paths and package names. |

---

### Option B: Align docs with current codebase (keep single app, document reality)

| # | Task | Notes |
|---|------|------|
| B1 | Update MOBILE_MONOREPO_INTEGRATION | State that the project is **not** a monorepo today: single Expo app at repo root; `docs/packages` and `docs/src` are under `docs/`. Describe current layout and when/if monorepo is planned. |
| B2 | Update MOBILE_IMPLEMENTATION_PLAN structure | Replace `apps/mobile/src/...` with actual layout: `app/` (Expo Router), `lib/`, `components/`, `hooks/`, etc. List key files (e.g. lib/createLocationAddress, lib/offlineDataPacks, app/(tabs), app/new-create-address) instead of the planned src/ tree. |
| B3 | Update MOBILE_SPECS (architecture and paths) | Diagram and text: shared logic in `lib/` (in-repo), not `@janpams/core`; no adapters layer; map/offline/sync implemented in current folders. Keep SPECS behavior and requirements; change paths and “shared package” wording to match `lib/` and root app. |
| B4 | Update MOBILE_SRD integration section | SRD “Shared Packages” and “Native Replacements”: note that currently shared logic is in `lib/` and native APIs are used directly (no formal adapter package). Optionally add a “Future: monorepo and @janpams/core” subsection. |
| B5 | Update MOBILE_ROADMAP | Keep phases and milestones; adjust “Project Setup” and “File Structure” to reflect root-level Expo app and existing implementation (e.g. “Map & Location” and “Address Creation” largely done). Mark completed items and remaining polish/verification work. |
| B6 | Add a “Current vs planned architecture” note | In one doc (e.g. MOBILE_IMPLEMENTATION_PLAN or a new MOBILE_CURRENT_STATE.md), add a short section: “Current: single app at root, lib-based shared logic, yarn. Planned (per other docs): monorepo, apps/mobile, @janpams/core, pnpm.” So readers know the delta. |
| B7 | Decide and document product/package naming | Decide whether the app stays “jango” or moves to “JanPAMS” / “@janpams/mobile”. Update all five docs to use the chosen name consistently. |

---

## 5. Recommended Order

- **If the goal is monorepo and shared packages soon:** Do Option A in order A1 → A2 → A4 → A9, then A5 and A6; A3 and A7–A10 as you go. Update docs (A10 / B1–B7) as the structure stabilizes.
- **If the goal is to ship and maintain the current app without a structural rewrite:** Do Option B (B1–B7) so the five docs accurately describe the current architecture and naming; optionally keep a “Future: monorepo” subsection in one place.
- **Hybrid:** Document current state (Option B) now, and add a small “Monorepo migration” section that references MOBILE_MONOREPO_INTEGRATION and the Option A task list for when you decide to adopt that structure.

---

## 6. Summary

| Doc | Main gap vs codebase |
|-----|----------------------|
| **MOBILE_IMPLEMENTATION_PLAN** | Assumes `apps/mobile/` and `src/`; shared imports from `@janpams/core`. Reality: app at root, `app/` + `lib/`, no workspace packages. |
| **MOBILE_MONOREPO_INTEGRATION** | Assumes monorepo root, pnpm, turbo, `apps/mobile`. Reality: no monorepo, yarn, app at root; packages only under `docs/packages`. |
| **MOBILE_ROADMAP** | Phases and content are usable; “Project Setup” and file structure refer to the planned layout, not current root app. |
| **MOBILE_SPECS** | Assumes `@janpams/core` / `@janpams/types` and adapters in `src/adapters/`. Reality: logic in `lib/`, no formal adapters. |
| **MOBILE_SRD** | Requirements and principles still apply; “Shared Packages” and “Native Replacements” describe the intended design, not current `lib/`-based integration. |

**Core gap:** The docs describe a **pnpm/Turborepo monorepo** with the mobile app in **apps/mobile** consuming **@janpams/core** and **@janpams/types**. The codebase is a **single Expo app at repo root** (yarn, name “jango”) with **shared logic implemented in lib/** and **no workspace package dependency**. Closing the gap requires either migrating to the documented structure (Option A) or updating all five documents to reflect the current structure and naming (Option B).
