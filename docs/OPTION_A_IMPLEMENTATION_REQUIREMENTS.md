# Option A Implementation — What You Need

What is required to implement **Option A** (align the codebase with the docs: adopt monorepo structure, shared packages, and documented layout). No code — prerequisites, decisions, effort, risks, and deliverables only.

---

## 1. Prerequisites

### 1.1 Tooling

- **pnpm 8+** installed and adopted as the single package manager at repo root (replacing yarn).
- **Turborepo** (or equivalent) for monorepo task orchestration (build, lint, typecheck, mobile:start, mobile:build).
- **Node.js 18+** (already typical for Expo).
- **Expo / EAS** unchanged; mobile app remains Expo with dev client.

### 1.2 Repo layout

- Willingness to **restructure the repo**: create `apps/` and `packages/` at root, move the current root app into `apps/mobile/`, and move `docs/packages/` to root `packages/`.
- **CI/CD and scripts** that assume “app at root” must be updated (paths, install command, build commands).

### 1.3 Decisions made upfront

- **Product/package naming:** Commit to **JanPAMS** and **@janpams/mobile** (and @janpams/core, @janpams/types), or explicitly document an exception (e.g. keep “jango” as app name but still use monorepo layout).
- **Web app placement:** Decide where the web app lives in the monorepo (e.g. `apps/web/` or keep under `docs/src/` with updated paths). Affects workspace and turbo config.
- **Other apps:** Docs mention `apps/government/`, `apps/banking/*`, etc. If those do not exist yet, workspace only needs `apps/mobile` and `packages/*` for now; add others when they exist.

---

## 2. What You Need to Do (Workstreams)

### 2.1 Monorepo foundation

- Add **pnpm-workspace.yaml** at repo root defining `apps/mobile` and `packages/*`.
- Add **turbo.json** (or equivalent) with tasks for build, dev, lint, typecheck, and mobile-specific tasks (e.g. mobile:start, mobile:build) as in MOBILE_MONOREPO_INTEGRATION.
- **Remove yarn** from root: delete yarn.lock, switch all install/run instructions to pnpm. Ensure CI and contributor docs use pnpm.

### 2.2 Move packages to root

- **Move** `docs/packages/*` to **`packages/`** at repo root (core, types, geospatial-data, and any other packages you keep).
- Fix **internal workspace references** inside those packages (e.g. `@janpams/core` → `@janpams/types`) so they resolve via workspace.
- Update **docs and scripts** that reference `docs/packages/` to use `packages/` instead.

### 2.3 Move mobile app under apps/mobile

- **Create** `apps/mobile/` and **move** all current app content into it: app/, components/, lib/, hooks/, utils/, constants/, styles/, assets/, app.config.ts, and any root-level config (babel, metro, tsconfig, etc.). The result is that the Expo app root is `apps/mobile/`, not the repo root.
- **Adjust entry point**: Expo/React Native entry must point at `apps/mobile` (e.g. index or expo entry in apps/mobile). Root `package.json` may become a thin wrapper that delegates to `apps/mobile` or is removed in favor of running from apps/mobile.
- **Update paths** in configs (Metro, Babel, TypeScript) so they work from `apps/mobile/` and can resolve workspace packages at repo root.

### 2.4 Wire mobile app to workspace packages

- In **apps/mobile/package.json**, add dependencies on **@janpams/core** and **@janpams/types** with **workspace:\***.
- Add **Metro config** in apps/mobile so Metro resolves workspace packages from the monorepo root (watchFolders, nodeModulesPaths, extraNodeModules as in MOBILE_MONOREPO_INTEGRATION).
- Add **TypeScript path/baseUrl** (or equivalent) in apps/mobile so TS resolves @janpams/core and @janpams/types to the workspace packages.
- **Verify**: from apps/mobile, `pnpm install` and a dev run (e.g. expo start) resolve and run without “module not found” for @janpams/*.

### 2.5 Migrate lib/ logic into packages

- **Audit** `apps/mobile/lib/` (and any equivalent logic in docs/src for web): identify which modules are “shared” (pluscode, address calculation, geocoding, offline data, street selection, DB schema, etc.).
- **Move** shared logic into **packages/core** and **packages/types** so that:
  - **packages/types** holds interfaces and types used by both web and mobile.
  - **packages/core** holds pure or near-pure logic (pluscode, address, geolocation policy, etc.) and any shared code that depends only on types + Node-safe or adapter-based APIs.
- **Replace** usages in apps/mobile: remove or thin duplicated code in `lib/` and **import from @janpams/core and @janpams/types** instead.
- **Align web** (docs/src or apps/web): have it consume the same packages from `packages/` so web and mobile share one implementation. This may require moving or refactoring code currently only in docs/src.
- **Leave in apps/mobile** any code that is truly app-specific (e.g. React Native UI, Expo-specific glue, screen-level state).

### 2.6 Optional: Adapters and layout

- **Adapters:** Introduce an **adapters** layer (e.g. under apps/mobile: `src/adapters/` or `adapters/`) with LocationAdapter, SQLiteAdapter, CameraAdapter, FileSystemAdapter as in MOBILE_SPECS. Refactor app and lib code to call these adapters instead of using expo-* directly. This is optional for “Option A structure” but required if you want full SPECS alignment.
- **Layout:** Optionally align with the doc’s **src/screens/**, **src/offline/**, **src/navigation/** layout. Alternative: keep **Expo Router** and current `app/`-based routing, and document that as the chosen structure (still Option A for monorepo + packages).

### 2.7 Naming and docs

- **Rename** the mobile app package to **@janpams/mobile** in apps/mobile/package.json; update any references (e.g. EAS, app.json slug) if desired.
- **Update** MOBILE_MONOREPO_INTEGRATION, MOBILE_IMPLEMENTATION_PLAN, MOBILE_SPECS (and related) to reflect the **final** paths and package names after the move. Remove or revise any “planned” wording so it describes the current repo.

---

## 3. Order of Work (Recommended)

1. **Monorepo foundation** — pnpm workspace + turbo at root; no app move yet.
2. **Move packages** — docs/packages → packages/; fix workspace refs; ensure packages build.
3. **Move mobile app** — current root app → apps/mobile/; fix entry and configs so the app runs from apps/mobile with existing dependencies (still using local lib/ for now).
4. **Wire to workspace** — add @janpams/core and @janpams/types to apps/mobile; Metro + TS config; verify run and build.
5. **Migrate lib to packages** — move shared logic into core/types; switch apps/mobile (and web) to imports from packages; remove duplication.
6. **Naming and adapters/layout** — rename to @janpams/mobile; optionally add adapters and/or src/ layout.
7. **Docs and CI** — update all referenced docs and CI/CD to the new layout and commands.

---

## 4. Effort and Ownership

- **Monorepo + move (2.1–2.3):** One or two focused sessions; high impact; best done in a single PR or short sequence to avoid long-lived broken state.
- **Wire + migrate (2.4–2.5):** Most of the work. Migrating lib/ into packages and updating both mobile and web can span several days to a couple of weeks depending on test coverage and how much web currently shares with docs/packages.
- **Adapters/layout (2.6):** Optional; add 1–3 days if you want full SPECS alignment.
- **Docs/CI (2.7):** About half a day once structure is stable.

**Ownership:** One person who can touch repo layout, package manager, and both mobile and (if applicable) web code is ideal; otherwise clear handoff between “monorepo/move” and “migrate lib into packages” is needed.

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Broken mobile build or run** after move | Do the move in a branch; verify `expo start` and a dev build from apps/mobile before removing old root app. Keep a backup of current root layout until stable. |
| **Metro/TS not resolving @janpams/*** | Follow MOBILE_MONOREPO_INTEGRATION Metro and TS config exactly; test with a single import from @janpams/core before migrating whole lib. |
| **Web breaks** when packages move | Ensure docs/src (or apps/web) uses the same workspace packages and update its paths and build after moving packages to root. |
| **Duplicate or divergent logic** during migration | Migrate one domain at a time (e.g. pluscode first, then address, then geocoding); run tests and smoke checks after each. |
| **CI fails** (paths, install, build) | Update CI to use pnpm, run from repo root, and invoke mobile build/start from apps/mobile; test CI in the same branch as the structural change. |
| **Contributors still use yarn** | Document “use pnpm” in README and CONTRIBUTING; add an engine or script check if desired; remove yarn.lock so pnpm is the only option. |

---

## 6. Success Criteria (Option A Done)

- Repo root has **pnpm-workspace.yaml** and **turbo.json**; **no yarn.lock** at root; **pnpm install** and turbo tasks run from root.
- **packages/** at root contains **core** and **types** (and any other shared packages); they build and are consumed via **workspace:\***.
- **apps/mobile/** contains the full Expo app; **expo start** and **eas build** run from apps/mobile (or via turbo from root).
- **apps/mobile** depends on **@janpams/core** and **@janpams/types**; shared logic lives in packages, not duplicated in apps/mobile/lib/ for that code.
- **Web** (if present) consumes the same **packages/**; no duplicate implementation of shared logic.
- **Docs** (MOBILE_MONOREPO_INTEGRATION, MOBILE_IMPLEMENTATION_PLAN, MOBILE_SPECS) describe the current layout and package names.
- **CI** runs install and mobile (and web) build/lint/typecheck successfully with the new structure.

---

## 7. What You Do *Not* Need for Option A

- You do **not** need to add other apps (government, banking, etc.) unless they already exist or are part of the same initiative.
- You do **not** need to change Expo SDK or React Native version solely for Option A.
- You do **not** need to implement **Option B** (updating docs to current non-monorepo state) if you are fully committing to Option A; you will update docs to the **new** state instead (section 2.7).
- You do **not** need to introduce **packages/mobile-adapters** unless you want a separate package for adapters; adapters can live inside apps/mobile.

---

## 8. Summary Checklist

- [ ] pnpm 8+ at root; yarn removed; pnpm-workspace.yaml and turbo.json added.
- [ ] docs/packages moved to root packages/; workspace refs fixed.
- [ ] Current app moved to apps/mobile/; entry and configs work from apps/mobile.
- [ ] apps/mobile depends on @janpams/core and @janpams/types; Metro and TS resolve them.
- [ ] Shared logic from lib/ migrated into packages; mobile (and web) import from packages.
- [ ] Package name set to @janpams/mobile; optional adapters/layout done if desired.
- [ ] Docs and CI updated to new structure; success criteria above met.

This is what you need for **Option A** implementation — no code, only prerequisites, workstreams, order, effort, risks, and deliverables.
