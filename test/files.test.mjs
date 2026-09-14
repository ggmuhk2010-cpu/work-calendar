import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipBase64, gunzipBase64, bytesToBase64, base64ToBytes } from '../src/files.js';

test('base64 helpers round-trip binary data', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
});

test('gzipBase64 shrinks repetitive text and gunzipBase64 restores it exactly', async () => {
  const text = '<html><body>' + '<p>촬영 구성안 본문 내용</p>'.repeat(4000) + '</body></html>';
  const bytes = new TextEncoder().encode(text);
  const { data, storedSize } = await gzipBase64(bytes);
  assert.ok(storedSize < bytes.length / 5, `stored ${storedSize} vs ${bytes.length}`);
  assert.ok(data.length <= Math.ceil(storedSize / 3) * 4);
  const back = await gunzipBase64(data);
  assert.equal(new TextDecoder().decode(back), text);
});
