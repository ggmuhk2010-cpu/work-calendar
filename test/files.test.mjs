import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipBase64, gunzipBase64, bytesToBase64, base64ToBytes } from '../src/files.js';
import { prepareFile, decodeAttachment, guessType } from '../src/files.js';

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

test('guessType falls back to extension for html/pdf/images', () => {
  assert.equal(guessType('a.html', ''), 'text/html');
  assert.equal(guessType('a.HTM', ''), 'text/html');
  assert.equal(guessType('a.pdf', ''), 'application/pdf');
  assert.equal(guessType('a.png', 'image/png'), 'image/png');
  assert.equal(guessType('a.bin', ''), 'application/octet-stream');
});

test('prepareFile compresses and decodeAttachment restores; oversize rejected', async () => {
  const html = '<h1>촬영구성안</h1>' + '<p>내용</p>'.repeat(3000);
  const file = new File([html], '촬영구성안.html', { type: '' });
  const p = await prepareFile(file);
  assert.equal(p.name, '촬영구성안.html');
  assert.equal(p.type, 'text/html');
  assert.equal(p.encoding, 'gzip');
  assert.equal(p.size, new TextEncoder().encode(html).length);
  assert.ok(p.storedSize < p.size);
  const back = await decodeAttachment({ encoding: 'gzip' }, p.data);
  assert.equal(new TextDecoder().decode(back), html);
  const big = new File([new Uint8Array(21 * 1024 * 1024)], 'big.bin');
  await assert.rejects(prepareFile(big), /20MB/);
  const noisy = new Uint8Array(900 * 1024);
  for (let i = 0; i < noisy.length; i++) noisy[i] = Math.floor(Math.random() * 256); // 압축이 안 되는 데이터
  await assert.rejects(prepareFile(new File([noisy], 'noise.bin')), /700KB/);
});
