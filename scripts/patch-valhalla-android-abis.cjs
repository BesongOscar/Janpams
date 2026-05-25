const fs = require('fs');
const path = require('path');

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

const appRoot = path.resolve(__dirname, '..');
const monorepoRoot = findMonorepoRoot(appRoot);

const gradlePath = path.join(
  monorepoRoot,
  'node_modules',
  '@jansoft',
  'mbukanji-valhalla-mobile',
  'android',
  'build.gradle'
);

if (!fs.existsSync(gradlePath)) {
  console.warn(`[valhalla-abis] Missing: ${gradlePath}`);
  process.exit(0);
}

const before = fs.readFileSync(gradlePath, 'utf8');
const needle = 'abiFilters "arm64-v8a"';
const replacement = 'abiFilters "arm64-v8a", "x86_64"';

if (!before.includes(needle)) {
  // Already patched or upstream changed.
  process.exit(0);
}

const after = before.replace(needle, replacement);
fs.writeFileSync(gradlePath, after, 'utf8');
console.log('[valhalla-abis] Patched Valhalla to build x86_64 + arm64-v8a');

