import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKey, isValidKey, keyFromHash, hashForKey } from '../src/key.js';

test('generateKey: 24 chars of [a-z0-9], not repeating', () => {
  const k = generateKey();
  assert.match(k, /^[a-z0-9]{24}$/);
  assert.notEqual(k, generateKey());
  assert.match(generateKey(30), /^[a-z0-9]{30}$/);
});

test('isValidKey', () => {
  assert.equal(isValidKey('a'.repeat(20)), true);
  assert.equal(isValidKey('a'.repeat(64)), true);
  assert.equal(isValidKey('a'.repeat(19)), false);
  assert.equal(isValidKey('a'.repeat(65)), false);
  assert.equal(isValidKey('A'.repeat(24)), false);
  assert.equal(isValidKey(null), false);
});

test('keyFromHash / hashForKey', () => {
  const k = 'b'.repeat(24);
  assert.equal(keyFromHash('#r=' + k), k);
  assert.equal(keyFromHash('#r=short'), null);
  assert.equal(keyFromHash(''), null);
  assert.equal(keyFromHash(undefined), null);
  assert.equal(keyFromHash('#other'), null);
  assert.equal(hashForKey(k), '#r=' + k);
});
