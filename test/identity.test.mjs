import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIdentity, saveIdentity } from '../src/identity.js';

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('save then load round-trips a trimmed identity', () => {
  const s = fakeStorage();
  const saved = saveIdentity({ name: ' 홍길동 ', company: '빅웨이브 ' }, s);
  assert.deepEqual(saved, { name: '홍길동', company: '빅웨이브' });
  assert.deepEqual(loadIdentity(s), { name: '홍길동', company: '빅웨이브' });
});

test('load returns null on missing, corrupt, or invalid data', () => {
  assert.equal(loadIdentity(fakeStorage()), null);
  assert.equal(loadIdentity(fakeStorage({ 'wc.identity': '{not json' })), null);
  assert.equal(loadIdentity(fakeStorage({ 'wc.identity': JSON.stringify({ name: '', company: 'x' }) })), null);
});

test('save throws on invalid identity and survives a throwing storage', () => {
  assert.throws(() => saveIdentity({ name: '', company: '' }, fakeStorage()));
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(saveIdentity({ name: 'a', company: 'b' }, broken), { name: 'a', company: 'b' });
  assert.equal(loadIdentity(broken), null);
});
