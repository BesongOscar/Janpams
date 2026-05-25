/**
 * expo-router `build/fast-refresh.js` uses `Object.assign` on Metro's `__ReactRefresh`.
 * On Android + JavaScriptCore that object can be sealed/non-extensible, which throws
 * "Attempting to change value of a readonly property" and breaks the whole bundle
 * (HMRClient / ReactNative.render cascade).
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');

let target;
try {
  target = require.resolve('expo-router/build/fast-refresh', { paths: [appRoot] });
} catch {
  console.warn('[patch-expo-router-fast-refresh-jsc] expo-router fast-refresh not found, skip');
  process.exit(0);
}

const marker = '/* patched-jsc-wrap */';
let s = fs.readFileSync(target, 'utf8');
if (s.includes(marker)) {
  process.exit(0);
}

const needle = `        Object.assign(Refresh, {`;
const idx = s.indexOf(needle);
if (idx === -1) {
  console.warn('[patch-expo-router-fast-refresh-jsc] pattern not found, skip');
  process.exit(0);
}

const closeNeedle = `        });`;
const closeIdx = s.indexOf(closeNeedle, idx);
if (closeIdx === -1) {
  console.warn('[patch-expo-router-fast-refresh-jsc] close pattern not found, skip');
  process.exit(0);
}

const end = closeIdx + closeNeedle.length;
const inner = s.slice(idx, end);
const wrapped = `${marker}\n        try {\n${inner}\n        } catch {\n          // Sealed __ReactRefresh on Android JSC — skip expo-router Fast Refresh shim.\n        }\n`;

s = s.slice(0, idx) + wrapped + s.slice(end);
fs.writeFileSync(target, s);
console.log('[patch-expo-router-fast-refresh-jsc] patched', target);
