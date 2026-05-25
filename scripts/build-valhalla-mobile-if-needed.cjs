/**
 * Build @jansoft/mbukanji-valhalla-mobile if it has src/ but no dist/.
 * The npm package ships source only; Metro needs dist/ to resolve the main entry.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const rootNodeModules = path.join(appDir, '..', '..', '..', 'node_modules');
const pkgDir = path.join(rootNodeModules, '@jansoft', 'mbukanji-valhalla-mobile');

if (!fs.existsSync(pkgDir)) return;

const hasSrc = fs.existsSync(path.join(pkgDir, 'src'));
const hasDist = fs.existsSync(path.join(pkgDir, 'dist'));

if (hasSrc && !hasDist) {
  console.log('[postinstall] Building @jansoft/mbukanji-valhalla-mobile (dist missing)...');
  execSync('npx tsc', { cwd: pkgDir, stdio: 'inherit' });
}
