/**
 * JSC on Android can treat `fn.displayName` as non-writable; Expo's withDevTools assigns it in dev.
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
let pkgRoot;
try {
  pkgRoot = path.dirname(require.resolve('expo/package.json', { paths: [appRoot] }));
} catch {
  console.warn('[patch-expo-withdevtools-jsc] expo not found, skip');
  process.exit(0);
}

const target = path.join(pkgRoot, 'src', 'launch', 'withDevTools.tsx');
if (!fs.existsSync(target)) {
  console.warn('[patch-expo-withdevtools-jsc] withDevTools.tsx missing, skip');
  process.exit(0);
}

const marker = '/* patched-jsc-displayName */';
let s = fs.readFileSync(target, 'utf8');
if (s.includes(marker)) process.exit(0);

const oldBlock = `  if (process.env.NODE_ENV !== 'production') {
    const name = AppRootComponent.displayName || AppRootComponent.name || 'Anonymous';
    WithDevTools.displayName = \`withDevTools(\${name})\`;
  }`;

if (!s.includes(oldBlock)) {
  console.warn('[patch-expo-withdevtools-jsc] pattern not found, skip');
  process.exit(0);
}

const newBlock = `  if (process.env.NODE_ENV !== 'production') {
    ${marker}
    try {
      const name = AppRootComponent.displayName || AppRootComponent.name || 'Anonymous';
      WithDevTools.displayName = \`withDevTools(\${name})\`;
    } catch {
      // Android JSC: displayName may be read-only on the function object.
    }
  }`;

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(target, s);
console.log('[patch-expo-withdevtools-jsc] patched', target);
