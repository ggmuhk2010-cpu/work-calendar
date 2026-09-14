const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const KEY_RE = /^[a-z0-9]{20,64}$/;

export function generateKey(length = 24) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isValidKey(k) { return typeof k === 'string' && KEY_RE.test(k); }

export function keyFromHash(hash) {
  const m = /^#r=([a-z0-9]+)$/.exec(hash ?? '');
  return m && isValidKey(m[1]) ? m[1] : null;
}

export function hashForKey(k) { return `#r=${k}`; }
