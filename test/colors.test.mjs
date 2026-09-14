import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyColor, PALETTE } from '../src/colors.js';

test('companyColor is deterministic, ignores surrounding spaces, returns a palette entry', () => {
  assert.equal(companyColor('빅웨이브'), companyColor(' 빅웨이브 '));
  assert.ok(PALETTE.includes(companyColor('A사')));
  assert.equal(PALETTE.length, 8);
});
