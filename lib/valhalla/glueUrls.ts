/**
 * Valhalla WASM + glue JS URLs (Phase 4).
 * On React Native we don't have Vite ?url imports; return empty so provider stays "not ready"
 * until you provide real asset URLs (e.g. from bundle or app config).
 */
export function getGlueUrls(): { wasmUrl: string; jsGlueUrl: string } {
  return { wasmUrl: '', jsGlueUrl: '' };
}
