// Must be imported before `expo-router/entry`.
// On some Android emulator/device combinations, `global.crypto` exists but is read-only/frozen.
// Some deps attempt to assign `crypto.getRandomValues` which then throws and prevents React Native
// from booting (black screen with `HMRClient.setup()` errors).

(() => {
  const g = globalThis;

  const safeJson = (v) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const describeProp = (obj, key) => {
    try {
      const d = Object.getOwnPropertyDescriptor(obj, key);
      if (!d) return 'missing';
      const base = {
        configurable: !!d.configurable,
        enumerable: !!d.enumerable,
      };
      if ('writable' in d) {
        return safeJson({ ...base, writable: !!d.writable, hasValue: 'value' in d });
      }
      return safeJson({ ...base, accessor: true, hasGet: typeof d.get === 'function', hasSet: typeof d.set === 'function' });
    } catch (e) {
      return `error:${String(e?.message || e)}`;
    }
  };

  const ensureWritableCryptoObject = () => {
    // Diagnostics: this is the earliest place we can see why `crypto` ends up read-only.
    // (Printed to logcat as ReactNativeJS once JS runtime is alive.)
    try {
      // eslint-disable-next-line no-console
      console.log('[crypto-polyfill] before globalThis.crypto desc:', describeProp(g, 'crypto'));
    } catch {}

    try {
      const desc = Object.getOwnPropertyDescriptor(g, 'crypto');
      // If `crypto` is an accessor or non-writable value, replace it.
      if (desc && ('writable' in desc ? !desc.writable : true)) {
        Object.defineProperty(g, 'crypto', {
          value: {},
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    } catch {}

    if (typeof g.crypto !== 'object' || g.crypto == null) {
      try {
        g.crypto = {};
      } catch {}
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[crypto-polyfill] after globalThis.crypto desc:', describeProp(g, 'crypto'));
      // eslint-disable-next-line no-console
      console.log('[crypto-polyfill] after globalThis.crypto type:', typeof g.crypto);
    } catch {}
  };

  const insecureGetRandomValues = (arr) => {
    // Minimal compatible implementation for typed arrays.
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (Math.random() * 256) | 0;
    }
    return arr;
  };

  ensureWritableCryptoObject();

  try {
    if (typeof g.crypto?.getRandomValues !== 'function') {
      Object.defineProperty(g.crypto, 'getRandomValues', {
        value: insecureGetRandomValues,
        writable: true,
        configurable: true,
      });
    }
  } catch {
    // Last resort: replace crypto object entirely.
    try {
      Object.defineProperty(g, 'crypto', {
        value: { getRandomValues: insecureGetRandomValues },
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {}
  }

  try {
    // eslint-disable-next-line no-console
    console.log('[crypto-polyfill] final globalThis.crypto desc:', describeProp(g, 'crypto'));
    // eslint-disable-next-line no-console
    console.log('[crypto-polyfill] final has getRandomValues:', typeof g.crypto?.getRandomValues);
  } catch {}
})();

