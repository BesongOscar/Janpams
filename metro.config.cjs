/* eslint-disable no-undef */
/* eslint-env node */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');

const projectRoot = __dirname;

/**
 * Find monorepo root (pnpm-workspace or packages/core), not a fixed "../.." depth.
 */
function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const ws = path.join(dir, 'pnpm-workspace.yaml');
    const corePkg = path.join(dir, 'packages', 'core', 'package.json');
    if (fs.existsSync(ws) || fs.existsSync(corePkg)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir, '../../..');
}

const workspaceRoot = findMonorepoRoot(projectRoot);
const corePkgRoot = path.join(workspaceRoot, 'packages', 'core');
const coreSrc = path.join(corePkgRoot, 'src');
const coreDist = path.join(corePkgRoot, 'dist');
const typesSrc = path.join(workspaceRoot, 'packages', 'types', 'src');

const config = getDefaultConfig(projectRoot);
const upstreamResolveRequest = config.resolver.resolveRequest;

// Force a single copy of React / React Native in the bundle.
// In pnpm monorepos it's easy for Metro to accidentally pull multiple instances,
// which can break the bridge (e.g. "Registered callable JavaScript modules (n = 0)").
const reactNativeRoot = path.dirname(require.resolve('react-native/package.json', { paths: [projectRoot] }));
const reactRoot = path.dirname(require.resolve('react/package.json', { paths: [projectRoot] }));

// Watch shared core + all hoisted deps. (Full repo root was too big for Windows
// FallbackWatcher; `node_modules` alone is smaller than apps/docs/git combined.)
// Without workspace `node_modules`, Metro resolves `expo-router` to
// `<repo>/node_modules/...` and fails SHA-1: "file is not watched".
// Override Expo's default watch list (workspace `node_modules` + every workspace package). On Windows
// without Watchman that forces FallbackWatcher and often times out. The app `projectRoot` is always
// watched; we only add the shared core package. Hoisted deps under `.pnpm` are reached via junctions
// from the app's `node_modules`.
config.watchFolders = [corePkgRoot];

function resolveAxiosBrowser(moduleName) {
  if (moduleName !== 'axios' && !moduleName.startsWith('axios/')) return null;
  const axiosBrowser = path.join(workspaceRoot, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs');
  if (fs.existsSync(axiosBrowser)) {
    return { type: 'sourceFile', filePath: axiosBrowser };
  }
  const axiosBrowserApp = path.join(projectRoot, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs');
  if (fs.existsSync(axiosBrowserApp)) {
    return { type: 'sourceFile', filePath: axiosBrowserApp };
  }
  return null;
}

/**
 * Resolve @janpams/core and @janpams/core/<subpath> to src (preferred) or built dist.
 */
function resolveJanpamsCore(moduleName) {
  if (moduleName !== '@janpams/core' && !moduleName.startsWith('@janpams/core/')) {
    return null;
  }
  const subpath = moduleName === '@janpams/core' ? 'index' : moduleName.replace('@janpams/core/', '');

  const tryFiles = (baseDir, exts) => {
    const dir = path.join(baseDir, subpath);
    for (const ext of exts) {
      const filePath = path.join(dir, `index${ext}`);
      if (fs.existsSync(filePath)) {
        return { type: 'sourceFile', filePath };
      }
    }
    return null;
  };

  const fromSrc = tryFiles(coreSrc, ['.ts', '.tsx', '.js']);
  if (fromSrc) return fromSrc;

  const fromDist = tryFiles(coreDist, ['.js']);
  if (fromDist) return fromDist;

  return null;
}

function resolveJanpamsTypes(moduleName) {
  if (moduleName === '@janpams/types' || moduleName.startsWith('@janpams/types/')) {
    const filePath = path.join(typesSrc, 'index.ts');
    if (fs.existsSync(filePath)) {
      return { type: 'sourceFile', filePath };
    }
  }
  return null;
}

function resolveRequest(context, moduleName, platform) {
  const axiosRes = resolveAxiosBrowser(moduleName);
  if (axiosRes) return axiosRes;

  const coreRes = resolveJanpamsCore(moduleName);
  if (coreRes) return coreRes;

  const typesRes = resolveJanpamsTypes(moduleName);
  if (typesRes) return typesRes;

  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
}

config.resolver = {
  ...config.resolver,
  // Single graph for react-native (avoids duplicate BatchedBridge / broken HMR callable modules in monorepos).
  disableHierarchicalLookup: true,
  // Without this, Metro ignores package.json "exports" and looks for e.g. packages/core/streets (missing).
  unstable_enablePackageExports: true,
  useWatchman: false,
  unstable_conditionNames: ['react-native', 'browser', 'require', 'import'],
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  resolveRequest,
  // Point at `src` so subpaths like `@janpams/core/streets` resolve to `src/streets`, not `packages/core/streets`.
  extraNodeModules: {
    react: reactRoot,
    'react-native': reactNativeRoot,
    '@janpams/core': coreSrc,
    '@janpams/types': fs.existsSync(typesSrc) ? path.dirname(typesSrc) : path.join(workspaceRoot, 'packages', 'types'),
  },
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.watcher = {
  ...config.watcher,
  // Fewer SHA-1 hashes during crawl; helps large monorepos / Windows FallbackWatcher.
  unstable_lazySha1: true,
};

module.exports = config;
