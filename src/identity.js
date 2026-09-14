import { validateIdentity } from './validate.js';

const STORAGE_KEY = 'wc.identity';

export function loadIdentity(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const r = validateIdentity(JSON.parse(raw));
    return r.ok ? r.value : null;
  } catch {
    return null; // 사생활 보호 모드·차단·손상: 없는 것으로 취급
  }
}

export function saveIdentity(identity, storage = globalThis.localStorage) {
  const r = validateIdentity(identity);
  if (!r.ok) throw new Error('invalid identity');
  try { storage.setItem(STORAGE_KEY, JSON.stringify(r.value)); } catch { /* 저장 못 해도 이번 세션은 진행 */ }
  return r.value;
}
