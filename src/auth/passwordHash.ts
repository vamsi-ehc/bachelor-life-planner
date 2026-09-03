// Password hashing for the local (offline) auth provider. Uses PBKDF2 via
// the browser's built-in SubtleCrypto, so no extra crypto dependency and no
// network call is involved.
const ITERATIONS = 150_000;
const HASH_ALGO = 'SHA-256';
const KEY_LENGTH_BITS = 256;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt.buffer);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex).slice().buffer, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return toHex(derived);
}

export async function verifyPassword(password: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  if (actual.length !== expectedHashHex.length) return false;
  // Constant-time comparison to avoid leaking hash contents via timing.
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) {
    mismatch |= actual.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }
  return mismatch === 0;
}
