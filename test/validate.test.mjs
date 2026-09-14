import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, validateIdentity, validateRoomName, LIMITS } from '../src/validate.js';

const good = { title: ' 촬영 콘티 전달 ', toCompany: 'A사', assignee: '', start: '2026-09-14', end: '', memo: '' };

test('LIMITS values match the spec', () => {
  assert.deepEqual(LIMITS, { title: 120, company: 40, person: 40, memo: 2000, roomName: 60 });
});

test('validateTask: trims and defaults end to start', () => {
  const r = validateTask(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.equal(r.value.title, '촬영 콘티 전달');
  assert.equal(r.value.end, '2026-09-14');
});

test('validateTask: required fields', () => {
  const r = validateTask({ ...good, title: '  ', toCompany: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
  assert.ok(r.errors.toCompany);
});

test('validateTask: length limits', () => {
  assert.equal(validateTask({ ...good, title: '가'.repeat(120) }).ok, true);
  assert.ok(validateTask({ ...good, title: '가'.repeat(121) }).errors.title);
  assert.ok(validateTask({ ...good, toCompany: 'a'.repeat(41) }).errors.toCompany);
  assert.ok(validateTask({ ...good, assignee: 'a'.repeat(41) }).errors.assignee);
  assert.ok(validateTask({ ...good, memo: 'a'.repeat(2001) }).errors.memo);
});

test('validateTask: dates', () => {
  assert.ok(validateTask({ ...good, start: '' }).errors.start);
  assert.ok(validateTask({ ...good, start: '2026-02-30' }).errors.start);
  assert.ok(validateTask({ ...good, end: '2026-09-13' }).errors.end);
  assert.ok(validateTask({ ...good, end: 'abc' }).errors.end);
  assert.equal(validateTask({ ...good, end: '2026-09-20' }).ok, true);
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
