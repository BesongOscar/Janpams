const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64DecodeToUtf8(base64: string): string {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  let binary = '';
  for (let i = 0; i < normalized.length; i += 4) {
    const a = BASE64_CHARS.indexOf(normalized[i]);
    const b = BASE64_CHARS.indexOf(normalized[i + 1]);
    const c = BASE64_CHARS.indexOf(normalized[i + 2]);
    const d = BASE64_CHARS.indexOf(normalized[i + 3]);
    if (a < 0 || b < 0) break;
    binary += String.fromCharCode((a << 2) | (b >> 4));
    if (c >= 0) binary += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d >= 0) binary += String.fromCharCode(((c & 3) << 6) | d);
  }
  try {
    return decodeURIComponent(
      escape(binary.replace(/\s/g, '')),
    );
  } catch {
    return binary;
  }
}

/**
 * Decode JWT payload without verification (client-side only for expiry display).
 * Returns exp (seconds since epoch) as ms, or null if missing/invalid.
 */
export function getExpiresAtFromToken(accessToken: string): number | null {
  if (!accessToken || typeof accessToken !== 'string') return null;
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64DecodeToUtf8(parts[1]));
    const exp = payload?.exp;
    if (typeof exp !== 'number') return null;
    return exp * 1000;
  } catch {
    return null;
  }
}
