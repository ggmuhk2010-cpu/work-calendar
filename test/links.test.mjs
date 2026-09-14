import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, hostOf, formatBytes } from '../src/links.js';

test('youtubeId recognizes watch, short, shorts, embed, live URLs and rejects others', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=short'), null);
  assert.equal(youtubeId('https://vimeo.com/123'), null);
  assert.equal(youtubeId('not a url'), null);
});

test('hostOf and formatBytes', () => {
  assert.equal(hostOf('https://www.notion.so/page'), 'notion.so');
  assert.equal(hostOf('nope'), '');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1572864), '1.5 MB');
});
