/**
 * UUID v4 for React Native / Hermes. Do not rely on `global.crypto.randomUUID`:
 * Hermes may expose a non-extensible `crypto` object (throws "property is not writable").
 */
export function randomUUID(): string {
  // RFC4122 v4-ish UUID using Math.random (not cryptographically secure).
  // We use this to avoid touching `global.crypto` which can be read-only on Hermes/Android.
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  // Version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Variant 10xx
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const b = bytes.map(hex).join('');
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
}
