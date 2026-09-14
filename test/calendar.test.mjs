import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDateStr, parseDateStr, isDateStr, addDays, addMonths, monthOf, monthRange, monthGrid,
  formatMonthTitle, formatDayTitle, tasksOnDate, groupForList, companiesOf, isOverdue,
} from '../src/calendar.js';

test('toDateStr/parseDateStr round-trip and reject invalid', () => {
  assert.equal(toDateStr(new Date(2026, 8, 14)), '2026-09-14');
  assert.equal(parseDateStr('2026-09-14').getDate(), 14);
  assert.equal(parseDateStr('2026-02-30'), null);
  assert.equal(parseDateStr('2026-9-4'), null);
  assert.equal(isDateStr('2024-02-29'), true);
  assert.equal(isDateStr('2023-02-29'), false);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-03-01', -60), '2025-12-31');
});

test('addMonths, monthOf, monthRange', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(monthOf('2026-09-14'), { year: 2026, month: 9 });
  assert.deepEqual(monthRange({ year: 2026, month: 2 }), { first: '2026-02-01', last: '2026-02-28' });
  assert.deepEqual(monthRange({ year: 2024, month: 2 }), { first: '2024-02-01', last: '2024-02-29' });
});

test('monthGrid: 42 cells, Sunday start, inMonth flags', () => {
  const cells = monthGrid({ year: 2026, month: 9 }); // 2026-09-01 is a Tuesday
  assert.equal(cells.length, 42);
  assert.deepEqual(cells[0], { date: '2026-08-30', day: 30, dow: 0, inMonth: false });
  assert.deepEqual(cells[2], { date: '2026-09-01', day: 1, dow: 2, inMonth: true });
  assert.equal(cells[41].date, '2026-10-10');
  assert.equal(cells[41].inMonth, false);
});

test('formatters', () => {
  assert.equal(formatMonthTitle({ year: 2026, month: 9 }), '2026년 9월');
  assert.equal(formatDayTitle('2026-09-14'), '9월 14일 (월)');
  assert.equal(formatDayTitle('2026-09-13'), '9월 13일 (일)');
});

const T = (o) => ({
  id: 'x', title: 't', start: '2026-09-10', end: '2026-09-10', toCompany: 'A',
  status: 'open', doneAtMs: null, ...o,
});

test('tasksOnDate includes multi-day ranges inclusively', () => {
  const tasks = [
    T({ id: '1' }),
    T({ id: '2', start: '2026-09-08', end: '2026-09-12' }),
    T({ id: '3', start: '2026-09-11', end: '2026-09-11' }),
  ];
  assert.deepEqual(tasksOnDate(tasks, '2026-09-10').map((t) => t.id), ['1', '2']);
  assert.deepEqual(tasksOnDate(tasks, '2026-09-12').map((t) => t.id), ['2']);
  assert.deepEqual(tasksOnDate(tasks, '2026-09-13'), []);
});

test('groupForList: mine/others by company, sorted by end, recent done within 30 days newest first', () => {
  const today = '2026-09-14';
  const tasks = [
    T({ id: 'a', toCompany: 'A', start: '2026-09-20', end: '2026-09-20' }),
    T({ id: 'b', toCompany: 'A', start: '2026-09-15', end: '2026-09-15' }),
    T({ id: 'c', toCompany: 'B', start: '2026-09-01', end: '2026-09-01' }),
    T({ id: 'd', toCompany: 'A', status: 'done', doneAtMs: new Date(2026, 8, 10).getTime() }),
    T({ id: 'e', toCompany: 'B', status: 'done', doneAtMs: new Date(2026, 6, 1).getTime() }),
    T({ id: 'f', toCompany: 'B', status: 'done', doneAtMs: new Date(2026, 8, 12).getTime() }),
  ];
  const g = groupForList(tasks, today, 'A');
  assert.deepEqual(g.mine.map((t) => t.id), ['b', 'a']);
  assert.deepEqual(g.others.map((t) => t.id), ['c']);
  assert.deepEqual(g.recentDone.map((t) => t.id), ['f', 'd']);
  const g2 = groupForList(tasks, today, null);
  assert.deepEqual(g2.mine, []);
  assert.deepEqual(g2.others.map((t) => t.id), ['c', 'b', 'a']);
});

test('companiesOf distinct + sorted; isOverdue only for open tasks past end', () => {
  assert.deepEqual(companiesOf([T({ toCompany: '나' }), T({ toCompany: '가' }), T({ toCompany: '나' })]), ['가', '나']);
  assert.equal(isOverdue(T({ end: '2026-09-13' }), '2026-09-14'), true);
  assert.equal(isOverdue(T({ end: '2026-09-14' }), '2026-09-14'), false);
  assert.equal(isOverdue(T({ end: '2026-09-13', status: 'done' }), '2026-09-14'), false);
});
