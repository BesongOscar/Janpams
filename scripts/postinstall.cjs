const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir, '../../..');
}

function runNode(scriptAbsPath) {
  execFileSync(process.execPath, [scriptAbsPath], { stdio: 'inherit' });
}

const appRoot = path.resolve(__dirname, '..');
const monorepoRoot = findMonorepoRoot(appRoot);
const patchDirAbs = path.join(appRoot, 'patches');

// Run patch-package from monorepo root so it can see hoisted `node_modules/`.
// Avoid spawning the Windows .cmd shim directly (can throw EINVAL in spawnSync).
const patchPackageEntrypoint = path.join(monorepoRoot, 'node_modules', 'patch-package', 'index.js');
if (!fs.existsSync(patchPackageEntrypoint)) {
  console.warn(`[postinstall] patch-package entrypoint not found at ${patchPackageEntrypoint}`);
} else {
  // patch-package@8+ requires --patch-dir be relative to the process cwd.
  // We intentionally run patch-package with cwd=monorepoRoot (Docker: /app).
  const patchDir = path.relative(monorepoRoot, patchDirAbs);
  execFileSync(process.execPath, [patchPackageEntrypoint, '--patch-dir', patchDir], {
    cwd: monorepoRoot,
    stdio: 'inherit',
  });
}

runNode(path.join(appRoot, 'scripts', 'patch-expo-localization-swift.cjs'));
runNode(path.join(appRoot, 'scripts', 'ensure-rct-third-party-fabric-provider.cjs'));
runNode(path.join(appRoot, 'scripts', 'patch-valhalla-android-abis.cjs'));
runNode(path.join(appRoot, 'scripts', 'patch-expo-router-fast-refresh-jsc.cjs'));
runNode(path.join(appRoot, 'scripts', 'patch-expo-withdevtools-jsc.cjs'));
runNode(path.join(appRoot, 'scripts', 'build-valhalla-mobile-if-needed.cjs'));

