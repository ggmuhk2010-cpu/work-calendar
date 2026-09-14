import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, validateIdentity, validateRoomName, validateLink, LIMITS, KINDS } from '../src/validate.js';

const good = { title: ' 촬영 콘티 전달 ', toCompany: 'A사', assignee: '', start: '2026-09-14', end: '', memo: '' };

test('LIMITS and KINDS match the spec', () => {
  assert.deepEqual(LIMITS, { title: 120, company: 40, person: 40, memo: 5000, roomName: 60, attachmentName: 200, url: 2000, fileStored: 716800, fileOriginal: 20971520, attachmentsPerTask: 10 });
  assert.deepEqual(KINDS, ['request', 'event']);
});

test('validateTask: trims, defaults end to start, kind defaults to request, time empty', () => {
  const r = validateTask(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.equal(r.value.title, '촬영 콘티 전달');
  assert.equal(r.value.end, '2026-09-14');
  assert.equal(r.value.kind, 'request');
  assert.equal(r.value.time, '');
});

test('validateTask: required fields for request; event allows empty company', () => {
  const r = validateTask({ ...good, title: '  ', toCompany: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
  assert.ok(r.errors.toCompany);
  const ev = validateTask({ ...good, kind: 'event', toCompany: '' });
  assert.equal(ev.ok, true);
  assert.equal(ev.value.kind, 'event');
  assert.equal(validateTask({ ...good, kind: 'bogus' }).value.kind, 'request');
});

test('validateTask: length limits', () => {
  assert.equal(validateTask({ ...good, title: '가'.repeat(120) }).ok, true);
  assert.ok(validateTask({ ...good, title: '가'.repeat(121) }).errors.title);
  assert.ok(validateTask({ ...good, toCompany: 'a'.repeat(41) }).errors.toCompany);
  assert.ok(validateTask({ ...good, assignee: 'a'.repeat(41) }).errors.assignee);
  assert.equal(validateTask({ ...good, memo: 'a'.repeat(5000) }).ok, true);
  assert.ok(validateTask({ ...good, memo: 'a'.repeat(5001) }).errors.memo);
});

test('validateTask: dates and time', () => {
  assert.ok(validateTask({ ...good, start: '' }).errors.start);
  assert.ok(validateTask({ ...good, start: '2026-02-30' }).errors.start);
  assert.ok(validateTask({ ...good, end: '2026-09-13' }).errors.end);
  assert.ok(validateTask({ ...good, end: 'abc' }).errors.end);
  assert.equal(validateTask({ ...good, end: '2026-09-20' }).ok, true);
  assert.equal(validateTask({ ...good, time: '09:30' }).value.time, '09:30');
  assert.equal(validateTask({ ...good, time: ' 23:59 ' }).ok, true);
  assert.ok(validateTask({ ...good, time: '25:00' }).errors.time);
  assert.ok(validateTask({ ...good, time: '9:30' }).errors.time);
});

test('validateLink', () => {
  assert.deepEqual(validateLink({ name: ' 참고 ', url: 'https://youtu.be/dQw4w9WgXcQ' }), { ok: true, errors: {}, value: { name: '참고', url: 'https://youtu.be/dQw4w9WgXcQ' } });
  assert.ok(validateLink({ name: '', url: 'javascript:alert(1)' }).errors.url);
  assert.ok(validateLink({ name: '', url: 'ftp://x.com/a' }).errors.url);
  assert.ok(validateLink({ name: '', url: '' }).errors.url);
  assert.ok(validateLink({ name: 'a'.repeat(201), url: 'https://x.com' }).errors.name);
  assert.ok(validateLink({ name: '', url: 'https://x.com/' + 'a'.repeat(2000) }).errors.url);
});

test('validateIdentity', () => {
  const r = validateIdentity({ name: ' 홍길동 ', company: '빅웨이브' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: '홍길동', company: '빅웨이브' });
  assert.ok(validateIdentity({ name: '', company: 'x' }).errors.name);
  assert.ok(validateIdentity({ name: 'x', company: 'a'.repeat(41) }).errors.company);
  assert.ok(validateIdentity({}).errors.name);
});

test('validateRoomName', () => {
  assert.deepEqual(validateRoomName(' 프로젝트 '), { ok: true, error: null, value: '프로젝트' });
  assert.equal(validateRoomName('').ok, false);
  assert.equal(validateRoomName('a'.repeat(61)).ok, false);
  assert.equal(validateRoomName('a'.repeat(60)).ok, true);
});
