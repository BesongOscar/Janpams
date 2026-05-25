# Valhalla on React Native (Phase 4)

## Decision: Main thread (no Worker)

- **Web** uses a Web Worker so the main thread never blocks during routing.
- **React Native** has no standard Web Worker API. Options:
  - **Main thread:** Run `createRouter()` and `route()` on the JS thread. Use `setTimeout(..., 0)` or `InteractionManager.runAfterInteractions` to avoid blocking UI when triggering a route.
  - **expo-task-manager / JSI:** Could run Valhalla in a background task; requires extra wiring and may not support WASM the same way. Deferred.

**Choice:** Run Valhalla on the main thread. Route requests are wrapped so they don’t block the UI (e.g. run after interactions). If init or route fails (e.g. stub package), we fall back to `generateRoutePath` (Dijkstra + cache).

## Dependency

- **@jansoft/mbukanji-valhalla-mobile** (npm, `^0.1.0`) is used for Valhalla on React Native. The app’s `ValhallaProvider` adapts the package API: `createValhallaMobileRouter()` → `init()`, `loadPack(packPath)`, `routeWithManeuvers(requestId, request)`. Tiles are still stored as ArrayBuffer in SQLite; the provider writes each buffer to a temp file (expo-file-system) and calls `loadPack(path)` so the native engine can load the pack.

## Glue URLs on mobile

- Web uses Vite `?url` imports for WASM and glue JS. On Expo we don’t have that.
- Options: (1) Bundle WASM as asset and resolve via `Asset.fromModule(require(...)).uri`, (2) Use a fixed URL (e.g. from app config), (3) Omit glue URLs so Valhalla stays “not ready” and we always use route path fallback.
- **Current:** The mobile package has no WASM; `init()` takes no arguments. The provider ignores glue URLs. Tiles are loaded via `loadTiles(buffer, { regionCode })` which writes the buffer to a cache file and calls `loadPack(filePath)`.

## Minimal test

- **Stub:** Call `getRoute(start, end)` → should return a route via `generateRoutePath` (no Valhalla).
- **With real mobile Valhalla:** After tiles are loaded, `getRoute` should prefer Valhalla when `isValhallaReady(regionCode)` and fall back to `generateRoutePath` on error or null.

## Files

- `lib/valhalla/tileStorage.ts` — SQLite staging/prod tile storage.
- `lib/valhalla/ValhallaProvider.ts` — Provider: init, loadTiles, route (main thread).
- `lib/valhalla/initValhalla.ts` — Init with japaState + provider; load tiles for installed packs.
- `lib/routing/index.ts` — `getRoute` tries Valhalla then `generateRoutePath`.
