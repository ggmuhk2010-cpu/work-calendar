# work-calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서로 다른 회사의 2~5명이 로그인 없이 초대 링크만으로 한 달력에서 "작업 요청"을 올리고 "완료" 버튼을 누르는 웹앱을 만들어 GitHub Pages에 무료로 올린다.

**Architecture:** 빌드 도구 없는 순수 HTML/CSS/ES 모듈 정적 앱. 데이터는 Firebase Firestore(Spark 무료)에 `rooms/<비밀키>/tasks/*`로 저장하고, 비밀키는 URL 해시(`#r=키`)로만 전달된다. 순수 로직(날짜·검증·키)은 `node:test`로 단위 테스트하고, Firestore 규칙은 실제 프로젝트에 Node로 접속해 허용·거부를 확인한다. UI는 상태 객체 하나를 통째로 다시 그리는 단순 렌더 함수들과 `#app`의 클릭 위임 하나로 동작한다.

**Tech Stack:** Node 26 (`node --test`), Firebase JS SDK 12.19.0 (gstatic CDN ES 모듈, 테스트는 npm `firebase@^12.19.0`), firebase-tools 15 (`npx firebase-tools@15`), gh CLI 2.95 (계정 `ggmuhk2010-cpu`), GitHub Pages, Pretendard 웹폰트(jsDelivr).

Spec: `docs/superpowers/specs/2026-09-14-work-calendar-design.md`
Repo root (all paths below are relative to it): `/Users/park/Desktop/ai/work-calendar`

## Global Constraints

- 로그인·계정·권한 등급 없음. 쓰기(요청·완료·수정·삭제)는 `localStorage`의 이름·회사(신원)가 있어야 가능. 보기는 신원 없이 가능.
- 비밀키: `^[a-z0-9]{20,64}$`. 생성은 24자. 링크 형태 `…/work-calendar/#r=<키>`. 키는 코드·저장소에 절대 넣지 않는다.
- 문자열 길이 상한(클라이언트·규칙 동일): 제목 120, 회사 40, 사람 이름 40, 메모 2000, 캘린더 이름 60. 제목·담당 회사·요청자 이름·요청자 회사·updatedBy는 1자 이상.
- 날짜는 전부 `'YYYY-MM-DD'` 문자열(로컬 시간 기준). `end >= start`. 문자열 비교가 곧 날짜 비교.
- 상태는 `'open' | 'done'` 두 값뿐. `done`이면 `doneAt`은 timestamp, `open`이면 `doneAt`은 `null`.
- 서버 시각 강제: 문서의 `updatedAt`은 항상 `serverTimestamp()`(규칙 `updatedAt == request.time`). `createdAt`은 생성 시 서버 시각, 수정 시 불변.
- 실시간 리스너는 1개: `start >= 오늘−60일`, `orderBy('start')`. 더 과거 달은 `getDocs` 1회 조회 후 메모리 병합.
- 달력: 일요일 시작 6주 42칸. 칸당 칩 최대 3개 + `+N`. 기간 작업은 기간 내 모든 날에 칩, 첫날이 아니면 `↔` 표시.
- 전화기 폭(400px)에서 동작. 달력 탭의 날짜 패널은 데스크톱 오른쪽 사이드, 모바일 하단 시트.
- 룩앤필: Apple iOS/iPadOS 27 UI kit 기준. 시스템 색(Blue #007AFF, Green #34C759, Red #FF3B30 …), 배경 #F2F2F7·표면 #FFFFFF, 서체 `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", Pretendard, …`, 캡슐 버튼·세그먼트 컨트롤, inset grouped 카드(20px/14px), 시트형 패널·모달(28px, 모바일 하단 시트 + 그래버), Liquid Glass 상단 바·토스트(반투명 + backdrop blur). 기본 액션 블루 채움, "완료" 그린 채움, 삭제 레드 텍스트. 다크 모드 없음.
- 외부 의존: Firebase SDK `https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js`, `…/firebase-firestore.js`; 글꼴 `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`.
- 비용 0원. Firebase Spark 플랜, 결제 수단 등록 없음. GitHub 저장소는 public.
- 커밋 메시지는 한국어 요약 + 본문 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 사용자가 직접 해야 하는 단계는 오직 하나: `npx firebase-tools@15 login`(구글 OAuth). Task 6 시작 전에 `npx firebase-tools@15 login:list`로 확인하고, 안 되어 있으면 사용자에게 요청하고 기다린다.

---

## File Map

| Path | Responsibility |
|---|---|
| `index.html` | 뼈대: `#app`, `#modal-root`, `#toast-root`, 글꼴·스타일·`src/main.js` 로드 |
| `styles.css` | 전체 스타일(슬랙·flow 풍 카드 레이아웃, 모바일 규칙) |
| `firebase-config.js` | `export const firebaseConfig = {...}` 공개 웹 설정 (Task 6에서 생성) |
| `firestore.rules` | 보안 규칙 (Task 3) |
| `firebase.json`, `.firebaserc` | 규칙 배포 설정, 프로젝트 ID (Task 3, Task 6) |
| `src/calendar.js` | 순수: 날짜 문자열 연산, 월 격자, 날짜별 작업 판정, 할 일 탭 그룹화, 회사 목록, 마감 지남 |
| `src/colors.js` | 순수: 회사 이름 → 8색 팔레트 |
| `src/validate.js` | 순수: 작업 폼·신원·캘린더 이름 검증 + `LIMITS` |
| `src/key.js` | 순수: 비밀키 생성·검사, 해시 ↔ 키 |
| `src/identity.js` | `localStorage` 신원 저장·로드 (storage 주입 가능) |
| `src/store.js` | Firestore 호출만: room 생성·조회, 구독, 범위 조회, 작업 생성·수정·완료·삭제, 문서 정규화 |
| `src/ui/dom.js` | `esc()` HTML 이스케이프 |
| `src/ui/toast.js` | 토스트 |
| `src/ui/landing.js` | 시작 화면(캘린더 만들기, 없는 링크 안내) |
| `src/ui/topbar.js` | 상단 바(이름, 탭, 초대 링크, 신원 칩, 오프라인 배지) |
| `src/ui/month.js` | 월 달력 + 회사 필터 칩 + 작업 칩 |
| `src/ui/panel.js` | 날짜 패널 + 작업 카드 |
| `src/ui/list.js` | 할 일 탭 |
| `src/ui/modals.js` | 모달: 신원 폼, 작업 폼, 초대 링크, 삭제 확인 |
| `src/main.js` | 상태, 라우팅(해시), 이벤트 위임, 렌더 오케스트레이션, 스토어 연결 |
| `test/*.test.mjs` | `node:test` 단위 테스트, `test/rules.test.mjs`는 실제 Firestore 대상 |
| `.claude/launch.json` | 로컬 미리보기 서버(python http.server 8765) |

---

### Task 1: 스캐폴드 + 순수 날짜 로직(`calendar.js`) + 색상(`colors.js`)

**Files:**
- Create: `package.json`, `.gitignore`, `.nojekyll`, `.claude/launch.json`
- Create: `src/calendar.js`, `src/colors.js`
- Test: `test/calendar.test.mjs`, `test/colors.test.mjs`
- Modify: `docs/superpowers/specs/2026-09-14-work-calendar-design.md` (7장 파일 구조를 File Map과 일치시킴)

**Interfaces:**
- Produces (`src/calendar.js`):
  - `toDateStr(d: Date): string`, `parseDateStr(s: string): Date | null`, `isDateStr(s): boolean`, `todayStr(now?: Date): string`
  - `addDays(s: string, n: number): string`
  - `addMonths(m: {year, month}, n): {year, month}`, `monthOf(s): {year, month}`, `monthRange(m): {first, last}`
  - `monthGrid(m): Array<{date, day, dow, inMonth}>` (42칸, 일요일 시작)
  - `formatMonthTitle(m): '2026년 9월'`, `formatDayTitle(s): '9월 14일 (월)'`
  - `tasksOnDate(tasks, date): Task[]` (start ≤ date ≤ end)
  - `groupForList(tasks, today, myCompany|null): {mine, others, recentDone}`
  - `companiesOf(tasks): string[]` (중복 제거, 한국어 정렬), `isOverdue(task, today): boolean`
  - Task 객체 형태(store가 만든다): `{id, title, memo, start, end, toCompany, assignee, fromName, fromCompany, status, doneBy, doneAtMs: number|null, updatedAtMs: number|null, updatedBy}`
- Produces (`src/colors.js`): `PALETTE: Array<{bg, fg}>`, `companyColor(name): {bg, fg}`

- [ ] **Step 1: 스캐폴드 파일 작성**

`package.json`:
```json
{
  "name": "work-calendar",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/calendar.test.mjs test/colors.test.mjs test/validate.test.mjs test/key.test.mjs test/identity.test.mjs",
    "test:rules": "node --test test/rules.test.mjs"
  },
  "devDependencies": {
    "firebase": "^12.19.0"
  }
}
```

`.gitignore`:
```
node_modules/
.DS_Store
.firebase/
firebase-debug.log
*.log
```

`.nojekyll`: 빈 파일 (`touch .nojekyll`).

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "work-calendar",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8765", "--bind", "127.0.0.1"],
      "port": 8765
    }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`test/calendar.test.mjs`:
```js
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
```

`test/colors.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyColor, PALETTE } from '../src/colors.js';

test('companyColor is deterministic, ignores surrounding spaces, returns a palette entry', () => {
  assert.equal(companyColor('빅웨이브'), companyColor(' 빅웨이브 '));
  assert.ok(PALETTE.includes(companyColor('A사')));
  assert.equal(PALETTE.length, 8);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/calendar.js'` (colors도 동일).

- [ ] **Step 4: 구현**

`src/calendar.js`:
```js
// 날짜는 전부 'YYYY-MM-DD' 문자열(로컬 시간). 문자열 비교가 곧 날짜 비교다.
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) { return String(n).padStart(2, '0'); }

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateStr(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDateStr(d) === s ? d : null; // '2026-02-30' 같은 값은 거부
}

export function isDateStr(s) { return parseDateStr(s) !== null; }

export function todayStr(now = new Date()) { return toDateStr(now); }

export function addDays(s, n) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths({ year, month }, n) {
  const d = new Date(year, month - 1 + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthOf(s) {
  const d = parseDateStr(s);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthRange({ year, month }) {
  return { first: toDateStr(new Date(year, month - 1, 1)), last: toDateStr(new Date(year, month, 0)) };
}

/** 일요일 시작 6주(42칸) 격자 */
export function monthGrid({ year, month }) {
  const startOffset = new Date(year, month - 1, 1).getDay(); // 0 = 일요일
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month - 1, 1 - startOffset + i);
    cells.push({ date: toDateStr(d), day: d.getDate(), dow: d.getDay(), inMonth: d.getMonth() === month - 1 });
  }
  return cells;
}

export function formatMonthTitle({ year, month }) { return `${year}년 ${month}월`; }

export function formatDayTitle(s) {
  const d = parseDateStr(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;
}

export function tasksOnDate(tasks, date) {
  return tasks.filter((t) => t.start <= date && date <= t.end);
}

export function isOverdue(task, today) {
  return task.status === 'open' && task.end < today;
}

export function companiesOf(tasks) {
  return [...new Set(tasks.map((t) => t.toCompany))].sort((a, b) => a.localeCompare(b, 'ko'));
}

const byEnd = (a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.title.localeCompare(b.title, 'ko'));

/** 할 일 탭 그룹화. myCompany가 null이면 mine은 비고 전부 others로 간다. */
export function groupForList(tasks, today, myCompany) {
  const open = tasks.filter((t) => t.status === 'open');
  const isMine = (t) => Boolean(myCompany) && t.toCompany === myCompany;
  const mine = open.filter(isMine).sort(byEnd);
  const others = open.filter((t) => !isMine(t)).sort(byEnd);
  const cutoffMs = parseDateStr(addDays(today, -30)).getTime();
  const recentDone = tasks
    .filter((t) => t.status === 'done' && typeof t.doneAtMs === 'number' && t.doneAtMs >= cutoffMs)
    .sort((a, b) => b.doneAtMs - a.doneAtMs);
  return { mine, others, recentDone };
}
```

`src/colors.js`:
```js
// 회사 이름 → 파스텔 배경 + 진한 글자색. 저장하지 않고 이름 해시로 매번 계산한다.
export const PALETTE = [
  { bg: '#E3F2FD', fg: '#0D47A1' },
  { bg: '#E8F5E9', fg: '#1B5E20' },
  { bg: '#FFF3E0', fg: '#E65100' },
  { bg: '#F3E5F5', fg: '#4A148C' },
  { bg: '#FCE4EC', fg: '#880E4F' },
  { bg: '#E0F7FA', fg: '#006064' },
  { bg: '#FFFDE7', fg: '#F57F17' },
  { bg: '#EFEBE9', fg: '#3E2723' },
];

function hashString(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h;
}

export function companyColor(name) {
  return PALETTE[hashString(String(name ?? '').trim()) % PALETTE.length];
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: calendar 8개 + colors 1개 PASS. (validate/key/identity 파일은 아직 없어 "Cannot find module" 실패가 3건 나온다. Task 2에서 사라진다. 이 단계에서는 `node --test test/calendar.test.mjs test/colors.test.mjs`로 두 파일만 돌려 전부 PASS인지 본다.)

- [ ] **Step 6: 스펙 7장 파일 구조를 File Map과 일치시키기**

`docs/superpowers/specs/2026-09-14-work-calendar-design.md`의 7장 코드 블록에서 `    ui.js                 렌더링(상단 바, 달력, 패널, 할 일 탭, 모달, 토스트)` 한 줄을 아래로 바꾼다.
```
    colors.js             순수 로직: 회사 이름 → 색상
    ui/dom.js             HTML 이스케이프
    ui/toast.js           토스트
    ui/landing.js         시작 화면
    ui/topbar.js          상단 바
    ui/month.js           월 달력 + 회사 필터 + 작업 칩
    ui/panel.js           날짜 패널 + 작업 카드
    ui/list.js            할 일 탭
    ui/modals.js          신원 폼·작업 폼·초대 링크·삭제 확인
```
그리고 `test/` 목록에 `colors.test.mjs`, `key.test.mjs`, `identity.test.mjs`를 추가하고, `.claude/launch.json 로컬 미리보기 서버` 한 줄을 트리 끝에 추가한다.

- [ ] **Step 7: 커밋**

```bash
git add package.json .gitignore .nojekyll .claude/launch.json src/calendar.js src/colors.js test/calendar.test.mjs test/colors.test.mjs docs/superpowers/specs/2026-09-14-work-calendar-design.md
git commit -m "feat: 스캐폴드 + 날짜 로직·회사 색상 순수 모듈

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 검증(`validate.js`) + 비밀키(`key.js`) + 신원(`identity.js`)

**Files:**
- Create: `src/validate.js`, `src/key.js`, `src/identity.js`
- Test: `test/validate.test.mjs`, `test/key.test.mjs`, `test/identity.test.mjs`

**Interfaces:**
- Consumes: `isDateStr` from `src/calendar.js` (Task 1)
- Produces (`src/validate.js`):
  - `LIMITS = { title: 120, company: 40, person: 40, memo: 2000, roomName: 60 }`
  - `validateTask(input): { ok, errors: {field: msg}, value: {title, toCompany, assignee, start, end, memo} }` — 전부 trim, `end`가 비면 `start`로 채움
  - `validateIdentity(input): { ok, errors, value: {name, company} }`
  - `validateRoomName(input: string): { ok, error: string|null, value: string }`
- Produces (`src/key.js`): `generateKey(length = 24): string`, `isValidKey(k): boolean`, `keyFromHash(hash: string): string|null`, `hashForKey(k): '#r=' + k`
- Produces (`src/identity.js`): `loadIdentity(storage = localStorage): {name, company}|null`, `saveIdentity(identity, storage = localStorage): {name, company}` (invalid면 throw)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/validate.test.mjs`:
```js
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
```

`test/key.test.mjs`:
```js
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
```

`test/identity.test.mjs`:
```js
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: validate/key/identity 세 파일이 `Cannot find module` 로 FAIL. calendar/colors는 PASS.

- [ ] **Step 3: 구현**

`src/validate.js`:
```js
import { isDateStr } from './calendar.js';

export const LIMITS = { title: 120, company: 40, person: 40, memo: 2000, roomName: 60 };

function trimStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function checkLen(v, max, label, required) {
  if (required && !v) return `${label}을(를) 입력하세요.`;
  if (v.length > max) return `${label}은(는) ${max}자 이하로 입력하세요.`;
  return null;
}

export function validateTask(input = {}) {
  const v = {
    title: trimStr(input.title),
    toCompany: trimStr(input.toCompany),
    assignee: trimStr(input.assignee),
    start: trimStr(input.start),
    end: trimStr(input.end),
    memo: trimStr(input.memo),
  };
  const errors = {};
  const put = (field, msg) => { if (msg) errors[field] = msg; };
  put('title', checkLen(v.title, LIMITS.title, '제목', true));
  put('toCompany', checkLen(v.toCompany, LIMITS.company, '담당 회사', true));
  put('assignee', checkLen(v.assignee, LIMITS.person, '담당자', false));
  put('memo', checkLen(v.memo, LIMITS.memo, '메모', false));
  if (!isDateStr(v.start)) errors.start = '시작일을 선택하세요.';
  if (!v.end) v.end = v.start;
  if (!errors.start) {
    if (!isDateStr(v.end)) errors.end = '마감일 형식이 올바르지 않습니다.';
    else if (v.end < v.start) errors.end = '마감일은 시작일 이후여야 합니다.';
  }
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateIdentity(input = {}) {
  const v = { name: trimStr(input.name), company: trimStr(input.company) };
  const errors = {};
  const put = (field, msg) => { if (msg) errors[field] = msg; };
  put('name', checkLen(v.name, LIMITS.person, '이름', true));
  put('company', checkLen(v.company, LIMITS.company, '회사', true));
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateRoomName(input) {
  const value = trimStr(input);
  const error = checkLen(value, LIMITS.roomName, '캘린더 이름', true);
  return { ok: error === null, error, value };
}
```

`src/key.js`:
```js
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const KEY_RE = /^[a-z0-9]{20,64}$/;

export function generateKey(length = 24) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isValidKey(k) { return typeof k === 'string' && KEY_RE.test(k); }

export function keyFromHash(hash) {
  const m = /^#r=([a-z0-9]+)$/.exec(hash ?? '');
  return m && isValidKey(m[1]) ? m[1] : null;
}

export function hashForKey(k) { return `#r=${k}`; }
```

`src/identity.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 5개 파일 전부 PASS, fail 0.

- [ ] **Step 5: 커밋**

```bash
git add src/validate.js src/key.js src/identity.js test/validate.test.mjs test/key.test.mjs test/identity.test.mjs
git commit -m "feat: 폼 검증·비밀키·신원 저장 모듈

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Firestore 스토어(`store.js`) + 보안 규칙(`firestore.rules`) + 배포 설정

**Files:**
- Create: `src/store.js`, `firestore.rules`, `firebase.json`
- Test: 이 태스크는 문법 검사(`node --check`)와 규칙 컴파일 확인만. 실제 동작은 Task 7(규칙 테스트)·Task 8(브라우저)에서 검증한다.

**Interfaces:**
- Consumes: `generateKey` from `src/key.js`
- Produces (`src/store.js`):
  - `initStore(config): Firestore`
  - `createRoom(name: string): Promise<string /*key*/>`
  - `getRoom(key): Promise<{name}|null>`
  - `subscribeTasks(key, fromDate, onChange: (tasks: Task[]) => void, onError: (err) => void): () => void`
  - `fetchTasksInRange(key, from, to): Promise<Task[]>`
  - `addTask(key, value, identity): Promise<string /*id*/>` — `value`는 `validateTask().value`, `identity`는 `{name, company}`
  - `updateTask(key, id, value, identity): Promise<void>`
  - `setDone(key, id, done: boolean, identity): Promise<void>`
  - `deleteTask(key, id): Promise<void>`
  - Task 정규화 형태는 Task 1 Interfaces의 Task 객체와 같다.

- [ ] **Step 1: `src/store.js` 작성**

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { generateKey } from './key.js';

let db = null;

export function initStore(config) {
  db = getFirestore(initializeApp(config));
  return db;
}

const roomRef = (key) => doc(db, 'rooms', key);
const tasksRef = (key) => collection(db, 'rooms', key, 'tasks');

export async function createRoom(name) {
  const key = generateKey();
  await setDoc(roomRef(key), { name, createdAt: serverTimestamp() });
  return key;
}

export async function getRoom(key) {
  const snap = await getDoc(roomRef(key));
  return snap.exists() ? { name: snap.data().name } : null;
}

// 서버 시각이 아직 안 온 로컬 쓰기(pending)는 추정치를 쓴다. 안 그러면 updatedAt이 null로 온다.
function normalize(snap) {
  const d = snap.data({ serverTimestamps: 'estimate' });
  return {
    id: snap.id,
    title: d.title,
    memo: d.memo ?? '',
    start: d.start,
    end: d.end,
    toCompany: d.toCompany,
    assignee: d.assignee ?? '',
    fromName: d.fromName,
    fromCompany: d.fromCompany,
    status: d.status,
    doneBy: d.doneBy ?? '',
    doneAtMs: d.doneAt ? d.doneAt.toMillis() : null,
    updatedAtMs: d.updatedAt ? d.updatedAt.toMillis() : null,
    updatedBy: d.updatedBy ?? '',
  };
}

export function subscribeTasks(key, fromDate, onChange, onError) {
  const q = query(tasksRef(key), where('start', '>=', fromDate), orderBy('start'));
  return onSnapshot(q, (qs) => onChange(qs.docs.map(normalize)), onError);
}

export async function fetchTasksInRange(key, from, to) {
  const q = query(tasksRef(key), where('start', '>=', from), where('start', '<=', to), orderBy('start'));
  const qs = await getDocs(q);
  return qs.docs.map(normalize);
}

export async function addTask(key, value, identity) {
  const ref = await addDoc(tasksRef(key), {
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
    toCompany: value.toCompany,
    assignee: value.assignee,
    fromName: identity.name,
    fromCompany: identity.company,
    status: 'open',
    doneAt: null,
    doneBy: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: identity.name,
  });
  return ref.id;
}

export async function updateTask(key, id, value, identity) {
  await updateDoc(doc(tasksRef(key), id), {
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
    toCompany: value.toCompany,
    assignee: value.assignee,
    updatedAt: serverTimestamp(),
    updatedBy: identity.name,
  });
}

export async function setDone(key, id, done, identity) {
  const patch = done
    ? { status: 'done', doneAt: serverTimestamp(), doneBy: identity.name }
    : { status: 'open', doneAt: null, doneBy: '' };
  await updateDoc(doc(tasksRef(key), id), { ...patch, updatedAt: serverTimestamp(), updatedBy: identity.name });
}

export async function deleteTask(key, id) {
  await deleteDoc(doc(tasksRef(key), id));
}
```

- [ ] **Step 2: `firestore.rules` 작성**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function validKey(k) { return k.matches('^[a-z0-9]{20,64}$'); }
    function str(v, max) { return v is string && v.size() <= max; }
    function nonEmpty(v, max) { return str(v, max) && v.size() >= 1; }
    function dateStr(v) { return v is string && v.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$'); }

    function taskFields() {
      return ['title', 'memo', 'start', 'end', 'toCompany', 'assignee', 'fromName', 'fromCompany',
              'status', 'doneAt', 'doneBy', 'createdAt', 'updatedAt', 'updatedBy'];
    }

    function validTask(d) {
      return d.keys().hasOnly(taskFields()) && d.keys().hasAll(taskFields())
        && nonEmpty(d.title, 120)
        && str(d.memo, 2000)
        && dateStr(d.start) && dateStr(d.end) && d.start <= d.end
        && nonEmpty(d.toCompany, 40)
        && str(d.assignee, 40)
        && nonEmpty(d.fromName, 40)
        && nonEmpty(d.fromCompany, 40)
        && d.status in ['open', 'done']
        && ((d.status == 'done' && d.doneAt is timestamp) || (d.status == 'open' && d.doneAt == null))
        && str(d.doneBy, 40)
        && d.createdAt is timestamp
        && d.updatedAt == request.time
        && nonEmpty(d.updatedBy, 40);
    }

    match /rooms/{key} {
      allow read: if validKey(key);
      allow create: if validKey(key)
        && request.resource.data.keys().hasOnly(['name', 'createdAt'])
        && request.resource.data.keys().hasAll(['name', 'createdAt'])
        && nonEmpty(request.resource.data.name, 60)
        && request.resource.data.createdAt == request.time;
      allow update, delete: if false;

      match /tasks/{taskId} {
        allow read: if validKey(key);
        allow create: if validKey(key) && validTask(request.resource.data)
          && request.resource.data.createdAt == request.time;
        allow update: if validKey(key) && validTask(request.resource.data)
          && request.resource.data.createdAt == resource.data.createdAt;
        allow delete: if validKey(key);
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: `firebase.json` 작성**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

(`.firebaserc`는 프로젝트 ID가 생기는 Task 6에서 만든다.)

- [ ] **Step 4: 문법 검사**

Run: `node --check src/store.js && echo OK`
Expected: `OK` (URL import는 파싱만 되고 실행되지 않는다.)

규칙은 배포 시 컴파일되므로 여기서는 괄호 짝만 눈으로 확인한다. 실제 컴파일 검증은 Task 6 Step 6의 `deploy --only firestore:rules` 성공으로 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/store.js firestore.rules firebase.json
git commit -m "feat: Firestore 스토어와 보안 규칙

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 정적 UI 모듈 (`index.html`, `styles.css`, `src/ui/*`)

**Files:**
- Create: `index.html`, `styles.css`
- Create: `src/ui/dom.js`, `src/ui/toast.js`, `src/ui/landing.js`, `src/ui/topbar.js`, `src/ui/month.js`, `src/ui/panel.js`, `src/ui/list.js`, `src/ui/modals.js`
- Modify: `src/colors.js` (PALETTE 값만 iOS 시스템 색 틴트로 교체. 함수·export 이름은 그대로. `npm test`의 colors 테스트는 그대로 통과해야 한다)
- Test: `node --check` 각 파일 + `npm test`. 화면 확인은 Task 8.

**Interfaces:**
- Consumes: `monthGrid, formatMonthTitle, formatDayTitle, tasksOnDate, groupForList, isOverdue` (Task 1), `companyColor` (Task 1), `validateTask, validateIdentity, LIMITS` (Task 2)
- Produces:
  - `esc(s): string` (`ui/dom.js`)
  - `toast(message, kind = 'info' | 'error')` (`ui/toast.js`)
  - `renderLanding(root, { missing: boolean, onCreate: (rawName) => Promise<void> })` (`ui/landing.js`)
  - `renderTopbar(root, { roomName, view: 'calendar'|'list', identity, online })` — 버튼에 `data-view="calendar|list"`, `data-action="invite|identity"`
  - `renderMonth(root, { month, tasks, today, selectedDate, companies, filter: Set|null })` — 셀 `data-date`, 칩 `data-task` + `data-date`, 버튼 `data-action="prev|next|today"`, 필터 `data-filter="*|회사명"`
  - `companyFilterHtml(companies, filter): string` (`ui/month.js`, list도 사용)
  - `renderPanel(root, { date: string|null, tasks, today })` — `data-action="add-task|close-panel|complete|reopen|edit|delete"` + `data-task`
  - `renderList(root, { tasks, today, identity, companies, filter, showDone })` — 행의 제목 버튼 `data-open-date` + `data-task`; 완료 섹션 `<details data-section="done">`
  - `openIdentityForm({ identity, onSave(value), onCancel? })`, `openTaskForm({ task|null, date, identity, companies, onSubmit(value): Promise })`, `openInviteModal({ link })`, `confirmDialog(message): Promise<boolean>` (`ui/modals.js`)
- 모든 클릭 처리는 Task 5의 `main.js`가 `#app`에 건 위임 핸들러 하나로 한다. UI 모듈은 `data-*` 속성만 찍는다. 예외: 모달 내부 폼 submit과 복사 버튼은 모달 모듈이 직접 처리한다.

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Work Calendar</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <div id="modal-root"></div>
  <div id="toast-root"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `src/ui/dom.js`, `src/ui/toast.js`**

`src/ui/dom.js`:
```js
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]); }
```

`src/ui/toast.js`:
```js
export function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  const node = document.createElement('div');
  node.className = `toast toast-${kind}`;
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}
```

- [ ] **Step 3: `src/ui/landing.js`**

```js
export function renderLanding(root, { missing, onCreate }) {
  root.innerHTML = `
    <main class="landing">
      <div class="landing-card">
        <h1>Work Calendar</h1>
        <p class="lead">여러 회사가 한 달력에서 작업을 요청하고 완료를 확인하는 도구입니다.</p>
        ${missing ? '<p class="error-banner">존재하지 않는 캘린더 링크입니다. 링크를 다시 확인하거나 새 캘린더를 만드세요.</p>' : ''}
        <form id="create-form" novalidate>
          <label for="room-name">캘린더 이름</label>
          <input id="room-name" name="name" maxlength="60" placeholder="예: 빅웨이브 × A사 촬영 프로젝트" autocomplete="off">
          <p class="field-error" data-error-for="name"></p>
          <button type="submit" class="btn btn-primary btn-block">새 캘린더 만들기</button>
        </form>
        <p class="hint">초대 링크를 받았다면 그 링크로 접속하세요.</p>
      </div>
    </main>`;
  const form = root.querySelector('#create-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try { await onCreate(form.elements.name.value); } finally { btn.disabled = false; }
  });
  form.elements.name.focus();
}
```

- [ ] **Step 4: `src/ui/topbar.js`**

```js
import { esc } from './dom.js';

export function renderTopbar(root, { roomName, view, identity, online }) {
  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand">${esc(roomName)}</span>
        ${online ? '' : '<span class="badge badge-offline">오프라인</span>'}
      </div>
      <nav class="tabs" role="tablist">
        <button class="tab ${view === 'calendar' ? 'active' : ''}" data-view="calendar" role="tab">달력</button>
        <button class="tab ${view === 'list' ? 'active' : ''}" data-view="list" role="tab">할 일</button>
      </nav>
      <div class="topbar-right">
        <button class="btn btn-ghost" data-action="invite">초대 링크</button>
        <button class="identity-chip" data-action="identity">${identity ? `${esc(identity.name)} · ${esc(identity.company)}` : '이름 입력'}</button>
      </div>
    </header>`;
}
```

- [ ] **Step 5: `src/ui/month.js`**

```js
import { esc } from './dom.js';
import { monthGrid, formatMonthTitle, tasksOnDate } from '../calendar.js';
import { companyColor } from '../colors.js';

const MAX_CHIPS = 3;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function companyFilterHtml(companies, filter) {
  if (companies.length === 0) return '';
  const all = filter === null;
  return `<div class="filters">
    <button class="filter-chip ${all ? 'active' : ''}" data-filter="*">전체</button>
    ${companies.map((c) => {
      const col = companyColor(c);
      return `<button class="filter-chip ${!all && filter.has(c) ? 'active' : ''}" data-filter="${esc(c)}" style="--chip-bg:${col.bg};--chip-fg:${col.fg}">${esc(c)}</button>`;
    }).join('')}
  </div>`;
}

function chipHtml(task, date) {
  const c = companyColor(task.toCompany);
  const cont = task.start !== date ? '<span class="chip-cont">↔</span>' : '';
  const done = task.status === 'done';
  return `<button class="chip ${done ? 'chip-done' : ''}" data-task="${esc(task.id)}" data-date="${esc(date)}"
    style="--chip-bg:${c.bg};--chip-fg:${c.fg}" title="${esc(task.title)} · ${esc(task.toCompany)}">${cont}${done ? '✓ ' : ''}${esc(task.title)}</button>`;
}

function cellHtml(cell, dayTasks, today, selectedDate) {
  const shown = dayTasks.slice(0, MAX_CHIPS);
  const more = dayTasks.length - shown.length;
  const cls = ['cell', cell.inMonth ? '' : 'cell-out', cell.date === today ? 'cell-today' : '',
    cell.date === selectedDate ? 'cell-selected' : '', `dow-${cell.dow}`].join(' ');
  return `<div class="${cls}" data-date="${cell.date}" role="button" tabindex="0" aria-label="${cell.date}">
    <div class="cell-day">${cell.day}</div>
    <div class="cell-chips">${shown.map((t) => chipHtml(t, cell.date)).join('')}${more > 0 ? `<span class="chip-more">+${more}</span>` : ''}</div>
  </div>`;
}

export function renderMonth(root, { month, tasks, today, selectedDate, companies, filter }) {
  const cells = monthGrid(month);
  root.innerHTML = `
    <section class="calendar">
      <div class="month-nav">
        <button class="btn btn-ghost" data-action="prev" aria-label="이전 달">‹</button>
        <h2 class="month-title">${formatMonthTitle(month)}</h2>
        <button class="btn btn-ghost" data-action="next" aria-label="다음 달">›</button>
        <button class="btn" data-action="today">오늘</button>
      </div>
      ${companyFilterHtml(companies, filter)}
      <div class="grid-head">${DOW.map((d, i) => `<div class="dow dow-${i}">${d}</div>`).join('')}</div>
      <div class="grid">${cells.map((cell) => cellHtml(cell, tasksOnDate(tasks, cell.date), today, selectedDate)).join('')}</div>
    </section>`;
}
```

- [ ] **Step 6: `src/ui/panel.js`**

```js
import { esc } from './dom.js';
import { formatDayTitle, tasksOnDate, isOverdue } from '../calendar.js';
import { companyColor } from '../colors.js';

export function taskCardHtml(task, today) {
  const c = companyColor(task.toCompany);
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);
  const period = task.start === task.end ? task.start : `${task.start} ~ ${task.end}`;
  return `<article class="card ${done ? 'card-done' : ''}" data-task-card="${esc(task.id)}">
    <div class="card-head">
      <span class="tag" style="--chip-bg:${c.bg};--chip-fg:${c.fg}">${esc(task.toCompany)}</span>
      <span class="badge ${done ? 'badge-done' : 'badge-open'}">${done ? '완료' : '요청됨'}</span>
    </div>
    <h3 class="card-title">${esc(task.title)}</h3>
    <dl class="card-meta">
      ${task.assignee ? `<div><dt>담당자</dt><dd>${esc(task.assignee)}</dd></div>` : ''}
      <div><dt>요청</dt><dd>${esc(task.fromName)} · ${esc(task.fromCompany)}</dd></div>
      <div><dt>기간</dt><dd class="${overdue ? 'overdue' : ''}">${esc(period)}${overdue ? ' (마감 지남)' : ''}</dd></div>
      ${done && task.doneBy ? `<div><dt>완료</dt><dd>${esc(task.doneBy)}</dd></div>` : ''}
    </dl>
    ${task.memo ? `<p class="card-memo">${esc(task.memo)}</p>` : ''}
    <div class="card-actions">
      ${done
        ? `<button class="btn" data-action="reopen" data-task="${esc(task.id)}">완료 취소</button>`
        : `<button class="btn btn-primary btn-complete" data-action="complete" data-task="${esc(task.id)}">완료</button>`}
      <button class="btn btn-ghost" data-action="edit" data-task="${esc(task.id)}">수정</button>
      <button class="btn btn-ghost btn-danger-text" data-action="delete" data-task="${esc(task.id)}">삭제</button>
    </div>
  </article>`;
}

export function renderPanel(root, { date, tasks, today }) {
  if (!date) { root.innerHTML = ''; root.hidden = true; return; }
  root.hidden = false;
  const dayTasks = tasksOnDate(tasks, date);
  root.innerHTML = `
    <aside class="panel">
      <div class="grabber" aria-hidden="true"></div>
      <div class="panel-head">
        <h2>${formatDayTitle(date)}</h2>
        <div class="panel-head-actions">
          <button class="btn btn-primary" data-action="add-task">+ 작업 요청</button>
          <button class="btn btn-ghost" data-action="close-panel" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="panel-body">
        ${dayTasks.length ? dayTasks.map((t) => taskCardHtml(t, today)).join('') : '<p class="empty">이 날에는 작업이 없습니다.</p>'}
      </div>
    </aside>`;
}
```

- [ ] **Step 7: `src/ui/list.js`**

```js
import { esc } from './dom.js';
import { groupForList, isOverdue } from '../calendar.js';
import { companyColor } from '../colors.js';
import { companyFilterHtml } from './month.js';

function rowHtml(task, today) {
  const c = companyColor(task.toCompany);
  const done = task.status === 'done';
  return `<div class="row ${done ? 'row-done' : ''}" data-task-row="${esc(task.id)}">
    <span class="row-date ${isOverdue(task, today) ? 'overdue' : ''}">${esc(task.end)}</span>
    <button class="row-title" data-open-date="${esc(task.start)}" data-task="${esc(task.id)}">${esc(task.title)}</button>
    <span class="tag" style="--chip-bg:${c.bg};--chip-fg:${c.fg}">${esc(task.toCompany)}</span>
    <span class="row-people">${esc(task.assignee || '-')} · ${esc(task.fromName)}(${esc(task.fromCompany)})</span>
    ${done
      ? `<button class="btn btn-sm" data-action="reopen" data-task="${esc(task.id)}">완료 취소</button>`
      : `<button class="btn btn-sm btn-primary" data-action="complete" data-task="${esc(task.id)}">완료</button>`}
  </div>`;
}

function sectionHtml(title, rows, today, { open, emptyText, section }) {
  return `<details class="list-section" ${open ? 'open' : ''} ${section ? `data-section="${section}"` : ''}>
    <summary>${esc(title)} <span class="count">${rows.length}</span></summary>
    ${rows.length ? rows.map((t) => rowHtml(t, today)).join('') : `<p class="empty">${esc(emptyText)}</p>`}
  </details>`;
}

export function renderList(root, { tasks, today, identity, companies, filter, showDone }) {
  const g = groupForList(tasks, today, identity?.company ?? null);
  root.innerHTML = `<section class="list">
    ${companyFilterHtml(companies, filter)}
    ${identity
      ? sectionHtml(`${identity.company}에 온 요청`, g.mine, today, { open: true, emptyText: '우리 회사에 온 미완료 요청이 없습니다.' })
      : '<p class="hint">이름과 회사를 입력하면 우리 회사에 온 요청을 따로 보여 줍니다.</p>'}
    ${sectionHtml('전체 미완료', g.others, today, { open: true, emptyText: '미완료 작업이 없습니다.' })}
    ${sectionHtml('최근 완료 (30일)', g.recentDone, today, { open: showDone, emptyText: '최근 완료한 작업이 없습니다.', section: 'done' })}
  </section>`;
}
```

- [ ] **Step 8: `src/ui/modals.js`**

```js
import { esc } from './dom.js';
import { validateTask, validateIdentity, LIMITS } from '../validate.js';
import { toast } from './toast.js';

function openModal(html, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    if (root.firstElementChild === backdrop) root.innerHTML = '';
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el: backdrop.firstElementChild, close };
}

function showErrors(form, errors) {
  form.querySelectorAll('[data-error-for]').forEach((p) => { p.textContent = errors[p.dataset.errorFor] || ''; });
}

export function openIdentityForm({ identity, onSave, onCancel }) {
  let saved = false;
  const { el, close } = openModal(`
    <h2>${identity ? '내 정보 수정' : '이름과 회사를 알려주세요'}</h2>
    <p class="muted">작업 요청과 완료에 이 이름이 표시됩니다. 로그인이 아니라 이 브라우저에만 저장됩니다.</p>
    <form id="identity-form" novalidate>
      <label>이름<input name="name" maxlength="${LIMITS.person}" value="${esc(identity?.name)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="name"></p>
      <label>회사<input name="company" maxlength="${LIMITS.company}" value="${esc(identity?.company)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="company"></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>${identity ? '취소' : '나중에'}</button>
        <button type="submit" class="btn btn-primary">저장</button>
      </div>
    </form>`, { onClose: () => { if (!saved) onCancel?.(); } });
  const form = el.querySelector('form');
  form.elements.name.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = validateIdentity({ name: form.elements.name.value, company: form.elements.company.value });
    showErrors(form, r.errors);
    if (!r.ok) return;
    saved = true;
    onSave(r.value);
    close();
  });
}

export function openTaskForm({ task, date, identity, companies, onSubmit }) {
  const isEdit = Boolean(task);
  const v = task ?? { title: '', toCompany: '', assignee: '', start: date, end: date, memo: '' };
  const { el, close } = openModal(`
    <h2>${isEdit ? '작업 수정' : '작업 요청'}</h2>
    <form id="task-form" novalidate>
      <label>제목 <span class="req">*</span><input name="title" maxlength="${LIMITS.title}" value="${esc(v.title)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="title"></p>
      <label>담당 회사 <span class="req">*</span><input name="toCompany" list="company-list" maxlength="${LIMITS.company}" value="${esc(v.toCompany)}" autocomplete="off"></label>
      <datalist id="company-list">${companies.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <p class="field-error" data-error-for="toCompany"></p>
      <label>담당자<input name="assignee" maxlength="${LIMITS.person}" value="${esc(v.assignee)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="assignee"></p>
      <div class="row2">
        <div><label>시작일 <span class="req">*</span><input type="date" name="start" value="${esc(v.start)}"></label><p class="field-error" data-error-for="start"></p></div>
        <div><label>마감일<input type="date" name="end" value="${esc(v.end)}"></label><p class="field-error" data-error-for="end"></p></div>
      </div>
      <label>메모<textarea name="memo" rows="3" maxlength="${LIMITS.memo}">${esc(v.memo)}</textarea></label>
      <p class="field-error" data-error-for="memo"></p>
      <p class="muted">요청자: ${esc(identity.name)} · ${esc(identity.company)}</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '요청 보내기'}</button>
      </div>
    </form>`);
  const form = el.querySelector('form');
  form.elements.title.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const r = validateTask({ title: f.title.value, toCompany: f.toCompany.value, assignee: f.assignee.value, start: f.start.value, end: f.end.value, memo: f.memo.value });
    showErrors(form, r.errors);
    if (!r.ok) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await onSubmit(r.value);
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했습니다. 잠시 후 다시 시도하세요.', 'error');
      btn.disabled = false;
    }
  });
}

export function openInviteModal({ link }) {
  const { el } = openModal(`
    <h2>초대 링크</h2>
    <p class="muted">이 링크가 있는 사람은 누구나 보고 편집할 수 있습니다. 함께 일할 사람에게만 보내세요.</p>
    <div class="invite-box"><input id="invite-link" readonly value="${esc(link)}"><button type="button" class="btn btn-primary" id="copy-link">복사</button></div>
    <div class="modal-actions"><button type="button" class="btn" data-close>닫기</button></div>`);
  el.querySelector('#copy-link').addEventListener('click', async () => {
    el.querySelector('#invite-link').select();
    try { await navigator.clipboard.writeText(link); } catch { document.execCommand('copy'); }
    toast('초대 링크를 복사했습니다.');
  });
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    let answered = false;
    const { el, close } = openModal(`
      <p class="confirm-text">${esc(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn" id="confirm-no">취소</button>
        <button type="button" class="btn btn-danger" id="confirm-yes">삭제</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    el.querySelector('#confirm-no').addEventListener('click', () => { answered = true; close(); resolve(false); });
    el.querySelector('#confirm-yes').addEventListener('click', () => { answered = true; close(); resolve(true); });
  });
}
```

- [ ] **Step 9: `styles.css`** (iOS/iPadOS 27 UI kit 룩앤필)

```css
/* Apple iOS/iPadOS 27 UI kit의 시스템 색·서체·재질을 웹 토큰으로 옮긴 것. 라이트 모드만. */
:root {
  --bg: #F2F2F7;                 /* systemGroupedBackground */
  --surface: #FFFFFF;            /* secondarySystemGroupedBackground */
  --label: #000000;
  --label-2: rgba(60, 60, 67, 0.6);
  --label-3: rgba(60, 60, 67, 0.3);
  --separator: rgba(60, 60, 67, 0.29);
  --fill: rgba(120, 120, 128, 0.12);
  --fill-2: rgba(120, 120, 128, 0.2);
  --blue: #007AFF; --green: #34C759; --red: #FF3B30;
  --tint: var(--blue);
  --glass: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(0, 0, 0, 0.04);
  --r-card: 20px; --r-row: 14px; --r-pill: 999px;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Apple SD Gothic Neo", Pretendard, "Malgun Gothic", system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--label); font-family: var(--font); font-size: 15px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
button, input, textarea { font: inherit; color: inherit; }
h1, h2, h3 { margin: 0; font-weight: 700; letter-spacing: -0.01em; }
.muted { color: var(--label-2); }
.hint { color: var(--label-2); font-size: 13px; }
.empty { color: var(--label-2); padding: 16px 0; text-align: center; }
.req { color: var(--red); }

/* 컨트롤: 캡슐 버튼 */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 36px; padding: 6px 14px; border: 0; border-radius: var(--r-pill); background: var(--fill); color: var(--tint); font-weight: 600; font-size: 15px; cursor: pointer; white-space: nowrap; transition: background .15s, transform .1s; }
.btn:hover { background: var(--fill-2); }
.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: var(--tint); color: #fff; box-shadow: 0 2px 8px rgba(0, 122, 255, .25); }
.btn-primary:hover { background: #0A6FE6; }
.btn-ghost { background: transparent; }
.btn-ghost:hover { background: var(--fill); }
.btn-danger { background: var(--red); color: #fff; }
.btn-danger-text { color: var(--red); background: transparent; }
.btn-sm { min-height: 30px; padding: 4px 12px; font-size: 14px; }
.btn-block { width: 100%; margin-top: 16px; min-height: 48px; font-size: 17px; }
.btn-complete { min-width: 92px; background: var(--green); box-shadow: 0 2px 8px rgba(52, 199, 89, .25); }
.btn-complete:hover { background: #2DB24E; }

/* 상단 바: Liquid Glass 재질 + 세그먼트 컨트롤 */
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; position: sticky; top: 0; z-index: 5; background: var(--glass); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); border-bottom: 1px solid var(--separator); }
.brand { font-weight: 700; font-size: 20px; letter-spacing: -0.02em; }
.tabs { display: flex; gap: 2px; background: var(--fill); padding: 2px; border-radius: var(--r-pill); }
.tab { border: 0; background: transparent; min-height: 32px; padding: 4px 16px; border-radius: var(--r-pill); cursor: pointer; font-weight: 600; font-size: 14px; color: var(--label); }
.tab.active { background: var(--surface); box-shadow: 0 1px 3px rgba(0, 0, 0, .12), 0 0 0 .5px rgba(0, 0, 0, .04); }
.topbar-right { display: flex; align-items: center; gap: 8px; }
.identity-chip { border: 0; background: var(--fill); border-radius: var(--r-pill); min-height: 36px; padding: 6px 14px; cursor: pointer; font-weight: 600; font-size: 14px; color: var(--label); }
.badge { display: inline-block; padding: 3px 9px; border-radius: var(--r-pill); font-size: 12px; font-weight: 600; }
.badge-offline { background: rgba(255, 59, 48, .12); color: var(--red); margin-left: 8px; }
.badge-open { background: rgba(0, 122, 255, .12); color: var(--blue); }
.badge-done { background: rgba(52, 199, 89, .15); color: #248A3D; }
.error-banner { background: rgba(255, 59, 48, .12); color: var(--red); padding: 12px 16px; font-weight: 600; border-radius: var(--r-row); margin: 0 0 12px; }

/* 레이아웃 */
.main { display: grid; grid-template-columns: 1fr; gap: 16px; padding: 16px; max-width: 1280px; margin: 0 auto; }
.main.with-panel { grid-template-columns: minmax(0, 1fr) 380px; }

/* 달력: inset grouped 카드 */
.calendar { background: var(--surface); border-radius: var(--r-card); padding: 14px; box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
.month-nav { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
.month-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 0 8px; min-width: 130px; text-align: center; }
.month-nav .btn-ghost { width: 36px; padding: 0; font-size: 22px; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
.filter-chip { border: 0; background: var(--fill); border-radius: var(--r-pill); min-height: 30px; padding: 4px 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--label-2); }
.filter-chip.active { background: var(--chip-bg, var(--tint)); color: var(--chip-fg, #fff); }
.grid-head, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.dow { text-align: center; font-size: 12px; font-weight: 600; color: var(--label-2); padding: 4px 0 6px; }
.grid { gap: 2px; }
.cell { min-height: 96px; border-radius: 10px; padding: 6px 4px 4px; cursor: pointer; overflow: hidden; }
.cell:hover { background: var(--fill); }
.cell-out { color: var(--label-3); }
.cell-selected { background: var(--fill); box-shadow: inset 0 0 0 2px var(--tint); }
.cell-day { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.dow-0 .cell-day, .dow.dow-0 { color: var(--red); }
.dow-6 .cell-day, .dow.dow-6 { color: var(--blue); }
.cell-out .cell-day { color: var(--label-3); }
.cell-today .cell-day { background: var(--tint); color: #fff; }
.cell-chips { display: flex; flex-direction: column; gap: 3px; }
.chip { display: block; width: 100%; text-align: left; border: 0; border-radius: 6px; padding: 2px 7px; font-size: 12px; font-weight: 600; background: var(--chip-bg); color: var(--chip-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.chip-done { background: var(--fill); color: var(--label-3); text-decoration: line-through; }
.chip-cont { opacity: .6; margin-right: 2px; }
.chip-more { font-size: 11px; color: var(--label-2); padding-left: 7px; }

/* 날짜 패널: 시트 */
.panel { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--glass-shadow); display: flex; flex-direction: column; max-height: calc(100vh - 90px); position: sticky; top: 70px; overflow: hidden; }
.grabber { display: none; width: 36px; height: 5px; border-radius: 3px; background: var(--fill-2); margin: 8px auto 0; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px 10px; }
.panel-head h2 { font-size: 20px; letter-spacing: -0.02em; }
.panel-head-actions { display: flex; gap: 6px; }
.panel-body { overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
.card { border-radius: var(--r-row); padding: 12px 14px; background: var(--bg); }
.card-done { opacity: .65; }
.card-done .card-title { text-decoration: line-through; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tag { display: inline-block; padding: 3px 9px; border-radius: var(--r-pill); font-size: 12px; font-weight: 600; background: var(--chip-bg); color: var(--chip-fg); white-space: nowrap; }
.card-title { font-size: 17px; font-weight: 600; margin-bottom: 6px; overflow-wrap: anywhere; }
.card-meta { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 13px; }
.card-meta div { display: contents; }
.card-meta dt { color: var(--label-2); }
.card-meta dd { margin: 0; }
.overdue { color: var(--red); font-weight: 600; }
.card-memo { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface); border-radius: 10px; padding: 8px 10px; margin: 8px 0 0; font-size: 13px; }
.card-actions { display: flex; gap: 6px; margin-top: 10px; align-items: center; }

/* 할 일 탭: inset grouped list */
.list { display: flex; flex-direction: column; gap: 14px; }
.list .filters { margin: 0; }
.list-section { background: var(--surface); border-radius: var(--r-card); padding: 4px 16px; box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
.list-section summary { cursor: pointer; font-weight: 700; font-size: 17px; padding: 12px 0; list-style: none; display: flex; align-items: center; }
.list-section summary::-webkit-details-marker { display: none; }
.list-section summary::after { content: '›'; margin-left: auto; color: var(--label-3); font-size: 20px; transform: rotate(90deg); transition: transform .15s; }
.list-section:not([open]) summary::after { transform: none; }
.count { display: inline-block; background: var(--fill); border-radius: var(--r-pill); padding: 1px 9px; font-size: 13px; font-weight: 600; margin-left: 8px; color: var(--label-2); }
.row { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 0; border-top: .5px solid var(--separator); }
.row-done .row-title { text-decoration: line-through; color: var(--label-2); }
.row-date { font-variant-numeric: tabular-nums; color: var(--label-2); font-size: 14px; }
.row-title { border: 0; background: none; text-align: left; font-weight: 600; font-size: 15px; cursor: pointer; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-title:hover { color: var(--tint); }
.row-people { color: var(--label-2); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list .empty { padding: 12px 0 16px; }

/* 시작 화면 */
.landing { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
.landing-card { background: var(--surface); border-radius: 28px; padding: 32px 28px; max-width: 440px; width: 100%; box-shadow: var(--glass-shadow); }
.landing h1 { font-size: 34px; letter-spacing: -0.03em; margin-bottom: 8px; }
.lead { color: var(--label-2); margin: 0 0 20px; }

/* 폼 */
label { display: block; font-weight: 600; font-size: 13px; color: var(--label-2); margin-top: 14px; }
input, textarea { display: block; width: 100%; margin-top: 6px; padding: 11px 12px; border: 0; border-radius: 12px; background: var(--fill); color: var(--label); font-size: 16px; }
input:focus, textarea:focus { outline: 2px solid var(--tint); outline-offset: 0; }
input::placeholder { color: var(--label-3); }
.field-error { color: var(--red); font-size: 12px; margin: 4px 0 0; min-height: 14px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* 모달: 시트 */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, .3); display: grid; place-items: center; z-index: 20; padding: 16px; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.modal { background: var(--surface); border-radius: 28px; padding: 22px 22px 20px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0, 0, 0, .22); }
.modal h2 { font-size: 22px; letter-spacing: -0.02em; margin-bottom: 6px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.modal-actions .btn { min-height: 44px; padding: 8px 18px; font-size: 16px; }
.invite-box { display: flex; gap: 8px; margin-top: 12px; align-items: stretch; }
.invite-box input { margin: 0; }
.confirm-text { font-size: 17px; font-weight: 600; margin: 4px 0; text-align: center; }
.confirm-text + .modal-actions { justify-content: center; }

/* 토스트: 글라스 캡슐, 상단 */
#toast-root { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.toast { background: var(--glass); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); color: var(--label); padding: 10px 18px; border-radius: var(--r-pill); box-shadow: var(--glass-shadow); border: 1px solid var(--glass-border); font-weight: 600; font-size: 14px; animation: toast-in .25s cubic-bezier(.2, .8, .2, 1); }
.toast-error { color: var(--red); }
@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

/* 모바일: 하단 시트 */
@media (max-width: 800px) {
  .topbar { flex-wrap: wrap; padding: 8px 12px; }
  .brand { font-size: 17px; }
  .tabs { order: 3; width: 100%; }
  .tab { flex: 1; }
  .main { padding: 10px; gap: 10px; }
  .main.with-panel { grid-template-columns: 1fr; }
  .calendar { padding: 10px 6px; }
  .cell { min-height: 68px; padding: 3px 2px; border-radius: 8px; }
  .cell-day { width: 24px; height: 24px; font-size: 13px; }
  .chip { font-size: 10px; padding: 1px 5px; }
  .month-title { min-width: 0; font-size: 18px; }
  .panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; max-height: 72vh; border-radius: 24px 24px 0 0; z-index: 10; box-shadow: 0 -12px 40px rgba(0, 0, 0, .18); }
  .grabber { display: block; }
  .row { grid-template-columns: 70px minmax(0, 1fr) auto; }
  .row-people { display: none; }
  .modal-backdrop { align-items: end; padding: 0; }
  .modal { border-radius: 24px 24px 0 0; max-height: 92vh; max-width: none; }
}
```

- [ ] **Step 9b: `src/colors.js` 팔레트를 iOS 시스템 색 틴트로 교체**

`src/colors.js`의 `PALETTE` 배열을 아래로 바꾼다(함수·주석·export는 그대로).
```js
export const PALETTE = [
  { bg: 'rgba(0, 122, 255, 0.14)', fg: '#0060D0' },   // Blue
  { bg: 'rgba(52, 199, 89, 0.16)', fg: '#1F8F3E' },   // Green
  { bg: 'rgba(255, 149, 0, 0.16)', fg: '#B86A00' },   // Orange
  { bg: 'rgba(175, 82, 222, 0.14)', fg: '#8A3BB5' },  // Purple
  { bg: 'rgba(255, 45, 85, 0.14)', fg: '#C8213F' },   // Pink
  { bg: 'rgba(48, 176, 199, 0.16)', fg: '#1E8A9E' },  // Teal
  { bg: 'rgba(88, 86, 214, 0.14)', fg: '#4341A8' },   // Indigo
  { bg: 'rgba(255, 204, 0, 0.22)', fg: '#8A6D00' },   // Yellow
];
```

- [ ] **Step 10: 문법 검사 + 단위 테스트**

Run: `for f in src/ui/*.js src/colors.js; do node --check "$f" || echo "FAIL $f"; done; echo done && npm test`
Expected: `done`만 출력(FAIL 없음), `npm test` 5개 파일 전부 PASS (colors 테스트는 PALETTE 길이 8·결정성만 검사하므로 값 교체 후에도 통과).

- [ ] **Step 11: 커밋**

```bash
git add index.html styles.css src/ui src/colors.js
git commit -m "feat: 정적 UI 모듈(iOS 27 UI kit 룩앤필: 시작 화면·상단 바·달력·패널·할 일·모달·토스트)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 앱 오케스트레이션 (`src/main.js`)

**Files:**
- Create: `src/main.js`
- Test: `node --check src/main.js`. 동작 검증은 Task 8.

**Interfaces:**
- Consumes: 모든 이전 태스크의 export. `firebase-config.js`의 `export const firebaseConfig` (Task 6에서 생성. 그 전에는 파일이 없어 브라우저에서 import 오류가 나는 것이 정상.)
- Produces: 없음(진입점). 상태 형태:
  ```js
  state = { key, room: {name}|null, identity, view: 'calendar'|'list', month: {year, month}, selectedDate: string|null,
            filter: Set<string>|null, liveTasks: Task[], archiveTasks: Map<id, Task>, loadedArchiveMonths: Set<'YYYY-M'>,
            showDone: boolean, online: boolean, storeError: boolean }
  ```

- [ ] **Step 1: `src/main.js` 작성**

```js
import { firebaseConfig } from '../firebase-config.js';
import {
  initStore, createRoom, getRoom, subscribeTasks, fetchTasksInRange, addTask, updateTask, setDone, deleteTask,
} from './store.js';
import { keyFromHash, hashForKey } from './key.js';
import { loadIdentity, saveIdentity } from './identity.js';
import { todayStr, addDays, monthOf, addMonths, monthRange, companiesOf } from './calendar.js';
import { validateRoomName } from './validate.js';
import { renderLanding } from './ui/landing.js';
import { renderTopbar } from './ui/topbar.js';
import { renderMonth } from './ui/month.js';
import { renderPanel } from './ui/panel.js';
import { renderList } from './ui/list.js';
import { openIdentityForm, openTaskForm, openInviteModal, confirmDialog } from './ui/modals.js';
import { toast } from './ui/toast.js';

const LIVE_WINDOW_DAYS = 60;
const SAVE_FAIL = '저장하지 못했습니다. 잠시 후 다시 시도하세요.';
const app = document.getElementById('app');

const state = {
  key: null,
  room: null,
  identity: loadIdentity(),
  view: 'calendar',
  month: monthOf(todayStr()),
  selectedDate: null,
  filter: null,               // null = 전체, Set = 선택한 회사들
  liveTasks: [],              // 실시간 창(오늘-60일 이후)
  archiveTasks: new Map(),    // 과거 달 1회 조회 결과. id -> task
  loadedArchiveMonths: new Set(),
  showDone: false,
  online: navigator.onLine,
  storeError: false,
};
let unsubscribe = null;

// ---------- 파생 값 ----------
function allTasks() {
  const map = new Map(state.archiveTasks);
  for (const t of state.liveTasks) map.set(t.id, t);
  return [...map.values()];
}
function visibleTasks() {
  const all = allTasks();
  return state.filter ? all.filter((t) => state.filter.has(t.toCompany)) : all;
}
function findTask(id) { return allTasks().find((t) => t.id === id) ?? null; }
function inviteLink() { return `${location.origin}${location.pathname}${location.search}${hashForKey(state.key)}`; }

// ---------- 렌더 ----------
function render() {
  const today = todayStr();
  const companies = companiesOf(allTasks());
  if (state.filter) {
    for (const c of state.filter) if (!companies.includes(c)) state.filter.delete(c);
    if (state.filter.size === 0) state.filter = null;
  }
  const withPanel = state.view === 'calendar' && state.selectedDate;
  app.innerHTML = `
    <div id="topbar"></div>
    <div class="main ${withPanel ? 'with-panel' : ''}">
      ${state.storeError ? '<div class="error-banner" style="grid-column: 1 / -1">저장소에 연결할 수 없습니다. 새로고침해도 계속되면 관리자에게 알려 주세요.</div>' : ''}
      <div id="view"></div>
      <div id="panel" hidden></div>
    </div>`;
  renderTopbar(app.querySelector('#topbar'), { roomName: state.room.name, view: state.view, identity: state.identity, online: state.online });
  const view = app.querySelector('#view');
  const shown = visibleTasks();
  if (state.view === 'calendar') {
    renderMonth(view, { month: state.month, tasks: shown, today, selectedDate: state.selectedDate, companies, filter: state.filter });
    renderPanel(app.querySelector('#panel'), { date: state.selectedDate, tasks: shown, today });
  } else {
    renderList(view, { tasks: shown, today, identity: state.identity, companies, filter: state.filter, showDone: state.showDone });
  }
  if (state.storeError) {
    app.querySelectorAll('[data-action="add-task"],[data-action="complete"],[data-action="reopen"],[data-action="edit"],[data-action="delete"]')
      .forEach((b) => { b.disabled = true; });
  }
}

// ---------- 데이터 ----------
function startLive() {
  if (unsubscribe) unsubscribe();
  const from = addDays(todayStr(), -LIVE_WINDOW_DAYS);
  unsubscribe = subscribeTasks(
    state.key, from,
    (rows) => { state.liveTasks = rows; state.storeError = false; render(); },
    (err) => { console.error(err); state.storeError = true; render(); },
  );
}

async function ensureArchive(month) {
  const liveFrom = addDays(todayStr(), -LIVE_WINDOW_DAYS);
  const { first, last } = monthRange(month);
  if (last >= liveFrom) return; // 실시간 창이 덮는 달
  const tag = `${month.year}-${month.month}`;
  if (state.loadedArchiveMonths.has(tag)) return;
  state.loadedArchiveMonths.add(tag);
  try {
    const rows = await fetchTasksInRange(state.key, addDays(first, -LIVE_WINDOW_DAYS), last);
    for (const t of rows) state.archiveTasks.set(t.id, t);
    render();
  } catch (err) {
    console.error(err);
    state.loadedArchiveMonths.delete(tag);
    toast('이전 달 작업을 불러오지 못했습니다.', 'error');
  }
}

function requireIdentity() {
  if (state.identity) return Promise.resolve(state.identity);
  return new Promise((resolve) => openIdentityForm({
    identity: null,
    onSave: (v) => { state.identity = saveIdentity(v); render(); resolve(state.identity); },
    onCancel: () => resolve(null),
  }));
}

// ---------- 동작 ----------
function toggleFilter(c) {
  if (c === '*') { state.filter = null; return; }
  if (!state.filter) { state.filter = new Set([c]); return; }
  if (state.filter.has(c)) { state.filter.delete(c); if (state.filter.size === 0) state.filter = null; }
  else state.filter.add(c);
}

async function handleAction(action, taskId) {
  const today = todayStr();
  switch (action) {
    case 'prev': state.month = addMonths(state.month, -1); state.selectedDate = null; render(); ensureArchive(state.month); break;
    case 'next': state.month = addMonths(state.month, 1); state.selectedDate = null; render(); break;
    case 'today': state.month = monthOf(today); state.selectedDate = today; render(); break;
    case 'close-panel': state.selectedDate = null; render(); break;
    case 'invite': openInviteModal({ link: inviteLink() }); break;
    case 'identity':
      openIdentityForm({ identity: state.identity, onSave: (v) => { state.identity = saveIdentity(v); render(); } });
      break;
    case 'add-task': {
      const id = await requireIdentity();
      if (!id) break;
      openTaskForm({
        task: null, date: state.selectedDate ?? today, identity: id, companies: companiesOf(allTasks()),
        onSubmit: async (v) => { await addTask(state.key, v, id); toast('작업을 요청했습니다.'); },
      });
      break;
    }
    case 'edit': {
      const task = findTask(taskId);
      if (!task) break;
      const id = await requireIdentity();
      if (!id) break;
      openTaskForm({
        task, date: task.start, identity: id, companies: companiesOf(allTasks()),
        onSubmit: async (v) => { await updateTask(state.key, task.id, v, id); toast('저장했습니다.'); },
      });
      break;
    }
    case 'complete':
    case 'reopen': {
      const id = await requireIdentity();
      if (!id) break;
      try {
        await setDone(state.key, taskId, action === 'complete', id);
        toast(action === 'complete' ? '완료 처리했습니다.' : '완료를 취소했습니다.');
      } catch (err) { console.error(err); toast(SAVE_FAIL, 'error'); }
      break;
    }
    case 'delete': {
      const task = findTask(taskId);
      if (!task) break;
      const id = await requireIdentity();
      if (!id) break;
      if (!(await confirmDialog(`"${task.title}" 작업을 삭제할까요? 되돌릴 수 없습니다.`))) break;
      try {
        await deleteTask(state.key, task.id);
        state.archiveTasks.delete(task.id);
        toast('삭제했습니다.');
      } catch (err) { console.error(err); toast('삭제하지 못했습니다.', 'error'); }
      break;
    }
    default: break;
  }
}

app.addEventListener('click', (e) => {
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) { state.view = viewBtn.dataset.view; render(); return; }
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn) { toggleFilter(filterBtn.dataset.filter); render(); return; }
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) { handleAction(actionBtn.dataset.action, actionBtn.dataset.task); return; }
  const openDate = e.target.closest('[data-open-date]');
  if (openDate) {
    state.view = 'calendar';
    state.month = monthOf(openDate.dataset.openDate);
    state.selectedDate = openDate.dataset.openDate;
    render();
    ensureArchive(state.month);
    return;
  }
  const dated = e.target.closest('[data-date]'); // 달력 칸 또는 칩
  if (dated) { state.selectedDate = dated.dataset.date; render(); }
});

app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.cell')) { e.preventDefault(); e.target.click(); }
});

// <details>의 toggle은 버블링하지 않으므로 캡처 단계에서 받는다.
app.addEventListener('toggle', (e) => {
  if (e.target.matches('[data-section="done"]')) state.showDone = e.target.open;
}, true);

// ---------- 부트 ----------
async function handleCreate(rawName) {
  const errEl = app.querySelector('[data-error-for="name"]');
  const r = validateRoomName(rawName);
  if (!r.ok) { errEl.textContent = r.error; return; }
  try {
    const key = await createRoom(r.value);
    history.replaceState(null, '', hashForKey(key)); // replaceState는 hashchange를 안 일으킨다
    await boot();
    openInviteModal({ link: inviteLink() });
  } catch (err) {
    console.error(err);
    errEl.textContent = '캘린더를 만들지 못했습니다. 잠시 후 다시 시도하세요.';
  }
}

function resetRoomState() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  Object.assign(state, { key: null, room: null, selectedDate: null, filter: null, liveTasks: [], storeError: false });
  state.archiveTasks.clear();
  state.loadedArchiveMonths.clear();
}

async function boot() {
  resetRoomState();
  const key = keyFromHash(location.hash);
  if (!key) { renderLanding(app, { missing: false, onCreate: handleCreate }); return; }
  let room;
  try { room = await getRoom(key); }
  catch (err) {
    console.error(err);
    app.innerHTML = '<div class="error-banner" style="margin:16px">저장소에 연결할 수 없습니다. 잠시 후 새로고침하세요.</div>';
    return;
  }
  if (!room) { renderLanding(app, { missing: true, onCreate: handleCreate }); return; }
  state.key = key;
  state.room = room;
  render();
  startLive();
  if (!state.identity) {
    openIdentityForm({ identity: null, onSave: (v) => { state.identity = saveIdentity(v); render(); } });
  }
}

window.addEventListener('hashchange', boot);
window.addEventListener('online', () => { state.online = true; if (state.room) render(); });
window.addEventListener('offline', () => { state.online = false; if (state.room) render(); });

initStore(firebaseConfig);
boot();
```

- [ ] **Step 2: 문법 검사**

Run: `node --check src/main.js && echo OK`
Expected: `OK`

- [ ] **Step 3: 커밋**

```bash
git add src/main.js
git commit -m "feat: 앱 진입점(상태·라우팅·이벤트 위임·스토어 연결)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Firebase 프로젝트 생성 + 웹 설정 + Firestore DB + 규칙 배포

**Files:**
- Create: `.firebaserc`, `firebase-config.js`
- Test: `deploy --only firestore:rules` 성공 = 규칙 컴파일 통과. 동작 검증은 Task 7.

**Interfaces:**
- Produces: `firebase-config.js` — `export const firebaseConfig = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, ... }` (Task 5의 `main.js`와 Task 7의 규칙 테스트가 import). 이 값들은 공개용 웹 설정이며 비밀이 아니다. 공개 저장소에 커밋한다.

전제: 쉘 상태는 Bash 호출 사이에 남지 않는다. 변수를 다음 호출로 넘기지 말고 파일(`.firebaserc`, 출력 저장 파일)로 넘긴다. 출력 저장은 스크래치패드 디렉터리를 쓴다.

- [ ] **Step 1: 로그인 확인**

Run: `npx firebase-tools@15 login:list`
Expected: `Logged in as <이메일>` 한 줄.
`⚠ No authorized accounts` 이면 여기서 멈추고 사용자에게 아래를 실행해 달라고 요청한 뒤 기다린다. 다른 태스크로 넘어가지 않는다.
```bash
npx firebase-tools@15 login
```

- [ ] **Step 2: 프로젝트 생성 + `.firebaserc`**

Run:
```bash
PROJECT_ID="work-calendar-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
echo "PROJECT_ID=$PROJECT_ID"
npx firebase-tools@15 projects:create "$PROJECT_ID" --display-name "work-calendar" --non-interactive \
  && printf '{\n  "projects": {\n    "default": "%s"\n  }\n}\n' "$PROJECT_ID" > .firebaserc && cat .firebaserc
```
Expected: `✔ Your Firebase project is ready!` 와 `Project ID: work-calendar-xxxxxx`, 그리고 `.firebaserc` 내용 출력. 이후 명령은 저장소 루트에서 실행하면 `.firebaserc`의 프로젝트를 자동으로 쓴다.
실패 예: "project ID already exists" → 6자를 다시 뽑아 재실행. 조직 선택을 요구하면 개인 계정이 아니므로 사용자에게 알린다.

- [ ] **Step 3: 웹 앱 등록 + SDK 설정 추출 → `firebase-config.js`**

Run:
```bash
npx firebase-tools@15 apps:create WEB work-calendar --non-interactive 2>&1 | tee "$SCRATCH/apps-create.txt"
```
(`$SCRATCH`는 세션 스크래치패드 절대 경로를 그대로 적는다.)
Expected: 출력에 `App ID: 1:<숫자>:web:<hex>` 한 줄. 이어서:
```bash
APP_ID=$(grep -o '1:[0-9]*:web:[0-9a-f]*' "$SCRATCH/apps-create.txt" | head -1); echo "APP_ID=$APP_ID"
npx firebase-tools@15 apps:sdkconfig WEB "$APP_ID" --non-interactive > "$SCRATCH/sdkconfig.txt" 2>&1; cat "$SCRATCH/sdkconfig.txt"
```
Expected: `firebase.initializeApp({ "projectId": ..., "appId": ..., "apiKey": ..., ... });` 형태 출력. 그다음 파이썬으로 파일 생성:
```bash
python3 - "$SCRATCH/sdkconfig.txt" <<'PY'
import json, re, sys
raw = open(sys.argv[1], encoding='utf-8').read()
m = re.search(r'initializeApp\((\{.*?\})\)', raw, re.S)
assert m, 'sdkconfig 출력에서 설정 객체를 찾지 못함'
cfg = json.loads(m.group(1))
for k in ('apiKey', 'projectId', 'appId'):
    assert cfg.get(k), f'{k} 누락'
body = json.dumps(cfg, indent=2, ensure_ascii=False)
open('firebase-config.js', 'w', encoding='utf-8').write(
    '// Firebase 공개 웹 설정. 비밀이 아니며 보안은 firestore.rules가 담당한다.\n'
    f'export const firebaseConfig = {body};\n')
print(open('firebase-config.js', encoding='utf-8').read())
PY
node --check firebase-config.js && echo OK
```
Expected: 설정 객체가 찍히고 `OK`.

- [ ] **Step 4: Firestore 데이터베이스 생성 (서울 리전)**

Run: `npx firebase-tools@15 firestore:databases:create "(default)" --location asia-northeast3 --non-interactive`
Expected: `Successfully created ... (default)` 류의 성공 메시지.
실패 시(예: "Cloud Firestore API has not been used", "database already exists" 외의 오류): 사용자에게 콘솔 클릭을 요청한다. 정확한 안내문:
> 브라우저에서 `https://console.firebase.google.com/project/<PROJECT_ID>/firestore` 를 열고 "데이터베이스 만들기" → 위치 `asia-northeast3 (Seoul)` → "프로덕션 모드" → "만들기"를 눌러 주세요. 규칙은 제가 바로 덮어씁니다.
"already exists"는 성공으로 간주한다.

- [ ] **Step 5: 규칙 배포**

Run: `npx firebase-tools@15 deploy --only firestore:rules --non-interactive`
Expected: `✔ Deploy complete!`. 규칙 문법 오류가 있으면 여기서 줄 번호와 함께 실패한다 → `firestore.rules` 수정 후 재실행.

- [ ] **Step 6: 커밋**

```bash
git add .firebaserc firebase-config.js
git commit -m "chore: Firebase 프로젝트 설정(공개 웹 설정·프로젝트 ID)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 규칙 테스트 (실제 Firestore 대상, Node)

**Files:**
- Create: `test/rules.test.mjs`
- Modify: `package-lock.json` (npm install 결과, 커밋)

**Interfaces:**
- Consumes: `firebase-config.js` (Task 6), `generateKey` (Task 2), `firestore.rules` 배포 상태 (Task 6)

- [ ] **Step 1: 의존성 설치**

Run: `npm install`
Expected: `firebase@12.x` 설치, `package-lock.json` 생성, 오류 없음.

- [ ] **Step 2: 테스트 작성**

`test/rules.test.mjs`:
```js
// 실제 Firebase 프로젝트에 붙어 firestore.rules의 허용/거부를 확인한다. 실행: npm run test:rules
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, limit,
  serverTimestamp, terminate,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config.js';
import { generateKey } from '../src/key.js';

const db = getFirestore(initializeApp(firebaseConfig));
const key = generateKey();
const who = { name: '테스트', company: '테스트사' };
const tasksCol = () => collection(db, 'rooms', key, 'tasks');
const base = () => ({
  title: '규칙 테스트', memo: '', start: '2026-09-14', end: '2026-09-14', toCompany: 'A사', assignee: '',
  fromName: who.name, fromCompany: who.company, status: 'open', doneAt: null, doneBy: '',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: who.name,
});
const denied = (p) => assert.rejects(p, (e) => /permission-denied|PERMISSION_DENIED/i.test(`${e.code} ${e.message}`));
const created = [];

after(async () => {
  for (const ref of created) await deleteDoc(ref).catch(() => {});
  await terminate(db);
});

test('room: create allowed with a valid key; short key, extra field, delete denied', async () => {
  await setDoc(doc(db, 'rooms', key), { name: '규칙 테스트', createdAt: serverTimestamp() });
  assert.equal((await getDoc(doc(db, 'rooms', key))).data().name, '규칙 테스트');
  await denied(setDoc(doc(db, 'rooms', 'shortkey'), { name: 'x', createdAt: serverTimestamp() }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: 'x', createdAt: serverTimestamp(), extra: 1 }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: '', createdAt: serverTimestamp() }));
  await denied(deleteDoc(doc(db, 'rooms', key)));
});

test('task: valid create, 120-char Korean title, complete, reopen all allowed', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  const ref2 = await addDoc(tasksCol(), { ...base(), title: '가'.repeat(120) });
  created.push(ref2);
  await updateDoc(ref, { status: 'done', doneAt: serverTimestamp(), doneBy: who.name, updatedAt: serverTimestamp(), updatedBy: who.name });
  assert.equal((await getDoc(ref)).data().status, 'done');
  await updateDoc(ref, { status: 'open', doneAt: null, doneBy: '', updatedAt: serverTimestamp(), updatedBy: who.name });
  assert.equal((await getDoc(ref)).data().status, 'open');
});

test('task: invalid documents denied', async () => {
  await denied(addDoc(tasksCol(), { ...base(), title: '가'.repeat(121) }));
  await denied(addDoc(tasksCol(), { ...base(), title: '' }));
  await denied(addDoc(tasksCol(), { ...base(), status: 'wip' }));
  await denied(addDoc(tasksCol(), { ...base(), end: '2026-09-13' }));
  await denied(addDoc(tasksCol(), { ...base(), start: '2026/09/14' }));
  await denied(addDoc(tasksCol(), { ...base(), updatedAt: new Date() }));
  await denied(addDoc(tasksCol(), { ...base(), hacked: true }));
  await denied(addDoc(tasksCol(), { ...base(), status: 'done' })); // done인데 doneAt null
  await denied(addDoc(collection(db, 'rooms', 'shortkey', 'tasks'), base()));
});

test('task: update cannot change createdAt; reading a random room is allowed but empty', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  await denied(updateDoc(ref, { createdAt: new Date(), updatedAt: serverTimestamp() }));
  const other = await getDoc(doc(db, 'rooms', generateKey()));
  assert.equal(other.exists(), false);
});

test('secrecy: listing the rooms collection is denied (room IDs are the secret keys)', async () => {
  await denied(getDocs(collection(db, 'rooms')));
  await denied(getDocs(query(collection(db, 'rooms'), limit(5))));
});
```

- [ ] **Step 3: 실행**

Run: `npm run test:rules`
Expected: 5 pass, 0 fail. 실행 시간은 네트워크 때문에 5~20초.
- `120-char Korean title` 이 permission-denied로 실패하면 규칙의 `size()`가 바이트 단위로 센 것이다. 이 경우 `firestore.rules`의 상한을 전부 3배(제목 360, 회사·이름 120, 메모 6000, 캘린더 이름 180)로 올리고 함수 위에 `// size()는 UTF-8 바이트 기준이라 한글 1자=3바이트, 상한은 문자 상한×3` 주석을 단 뒤 Task 6 Step 5로 재배포하고 다시 실행한다. 클라이언트 `LIMITS`는 그대로 둔다.
- 첫 실행에서 `PERMISSION_DENIED` 가 전부에 뜨면 규칙 배포가 반영되기 전이다. 30초 뒤 재실행.

- [ ] **Step 4: 커밋**

```bash
git add test/rules.test.mjs package-lock.json firestore.rules
git commit -m "test: 실제 Firestore 대상 보안 규칙 테스트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 로컬 브라우저 검증 (실시간 2탭·모바일·오류 화면)

**Files:** 없음(검증만). 발견한 결함은 해당 모듈을 고치고 `fix:` 커밋.

- [ ] **Step 1: 미리보기 서버**

`preview_start { name: "work-calendar" }` → `http://localhost:8765/` 탭이 열린다. `read_console_messages`로 에러 0 확인(폰트·SDK 로드 실패가 있으면 여기서 보인다).

- [ ] **Step 2: 캘린더 만들기 + 초대 링크**

시작 화면에서 `캘린더 이름`에 `검증용 캘린더` 입력 → `새 캘린더 만들기`. 기대: 주소가 `#r=<24자>`로 바뀌고 "초대 링크" 모달이 뜬다. `find "invite-link"` 로 입력창 값을 읽어 링크를 기록한다. `닫기`.

- [ ] **Step 3: 신원 입력 + 작업 요청 (탭 A)**

상단 `이름 입력` 칩 → 이름 `홍길동`, 회사 `빅웨이브` → 저장. 오늘 칸 클릭 → 패널 `+ 작업 요청` → 제목 `촬영 콘티 전달`, 담당 회사 `A사`, 마감일 = 오늘+2일 → `요청 보내기`.
기대: 토스트 "작업을 요청했습니다.", 오늘 칸에 `촬영 콘티 전달` 칩, 패널에 카드(태그 A사, 배지 요청됨, 완료 버튼). `read_page`로 확인.
추가로 제목을 비우고 보내면 `제목을 입력하세요.`가 뜨는지, 마감일을 시작일보다 앞서게 하면 `마감일은 시작일 이후여야 합니다.`가 뜨는지 확인.

- [ ] **Step 4: 다른 회사 관점 (탭 B) + 실시간**

`tabs_create` 후 초대 링크로 `navigate`. 신원 모달에 `김철수` / `A사` 저장.
기대: 달력에 같은 칩이 보인다. `할 일` 탭 → `A사에 온 요청` 섹션에 1건. 그 행의 `완료` 클릭 → 토스트, 행이 `최근 완료 (30일)`로 이동(펼치면 보임).
탭 A로 돌아가 `read_page`: 칩에 `✓`와 `chip-done` 클래스, 패널 카드 배지 `완료`, 버튼 `완료 취소`. 새로고침 없이 반영되어야 한다.
탭 A에서 `완료 취소` → 탭 B에서 다시 `요청됨`으로 돌아오는지 확인.

- [ ] **Step 5: 수정·삭제·필터·과거 달**

탭 A: 카드 `수정` → 제목 뒤에 ` (수정)` 추가 → 저장 → 두 탭 모두 반영. 회사 필터 칩 `A사` 클릭/해제 동작. `‹`로 3개월 전으로 이동해도 콘솔 에러 0(빈 달). `삭제` → 확인 모달 → 삭제 → 두 탭에서 사라짐.

- [ ] **Step 6: 오류 화면**

`navigate` 로 `http://localhost:8765/#r=aaaaaaaaaaaaaaaaaaaaaaaa` → "존재하지 않는 캘린더 링크입니다" 안내와 만들기 폼. `http://localhost:8765/#r=short` → 일반 시작 화면(키 형식 불일치는 키 없음으로 취급).

- [ ] **Step 7: 모바일**

`resize_window { preset: "mobile" }` 후 초대 링크로 다시 접속. 달력 7열이 가로 스크롤 없이 들어가는지(`document.documentElement.scrollWidth <= window.innerWidth` 를 `javascript_tool`로 확인), 날짜 클릭 시 패널이 하단 시트로 뜨는지, 작업 요청 폼이 화면 안에 들어오는지. 스크린샷 1장. 끝나면 `resize_window { preset: "desktop" }`.

- [ ] **Step 8: 증거 수집**

데스크톱 달력+패널 스크린샷 1장, 할 일 탭 1장, 모바일 1장. `read_console_messages { onlyErrors: true }` → 0건. 테스트로 만든 작업은 전부 삭제해 둔다(캘린더 문서는 남아도 무방).

---

### Task 9: GitHub 저장소 + Pages 배포 + 실제 주소 검증

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

```markdown
# work-calendar

여러 회사가 한 달력에서 작업을 요청하고 "완료"를 누르는 협업 캘린더입니다. 로그인 없이 초대 링크(`#r=키`)만으로 씁니다.

- 호스팅: GitHub Pages · 데이터: Firebase Firestore (무료 플랜)
- 사용: 페이지를 열어 "새 캘린더 만들기" → 초대 링크를 팀에 공유
- 개발: `npm test` (단위), `npm run test:rules` (규칙, 실제 프로젝트), 로컬 미리보기 `python3 -m http.server 8765`
- 설계서: `docs/superpowers/specs/2026-09-14-work-calendar-design.md`
```

- [ ] **Step 2: 브랜치 이름을 main으로 + 커밋**

```bash
git branch -M main
git add README.md
git commit -m "docs: README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 3: 저장소 생성 + 푸시**

Run:
```bash
gh repo create ggmuhk2010-cpu/work-calendar --public --source=. --remote=origin --push \
  --description "여러 회사가 한 달력에서 작업을 요청하고 완료하는 협업 캘린더 (GitHub Pages + Firestore)"
```
Expected: `✓ Created repository ggmuhk2010-cpu/work-calendar on GitHub` 와 푸시 완료. `git remote -v`에 origin.

- [ ] **Step 4: Pages 활성화 (main 브랜치 루트)**

Run:
```bash
gh api -X POST repos/ggmuhk2010-cpu/work-calendar/pages --input - <<'JSON'
{"build_type":"legacy","source":{"branch":"main","path":"/"}}
JSON
```
Expected: JSON 응답에 `"html_url": "https://ggmuhk2010-cpu.github.io/work-calendar/"`. 이미 활성화되어 409가 나오면 `gh api repos/ggmuhk2010-cpu/work-calendar/pages` 로 상태만 확인.

- [ ] **Step 5: 배포 완료 대기**

포그라운드 `sleep`은 막혀 있으므로 백그라운드로 돌린다(`run_in_background: true`):
```bash
for i in $(seq 1 36); do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://ggmuhk2010-cpu.github.io/work-calendar/)
  echo "$(date +%T) $code"
  [ "$code" = "200" ] && exit 0
  sleep 10
done
echo "TIMEOUT"; exit 1
```
Expected: 몇 분 안에 `200`. `TIMEOUT`이면 `gh api repos/ggmuhk2010-cpu/work-calendar/pages/builds/latest` 로 빌드 상태·오류를 본다.

- [ ] **Step 6: 실제 주소에서 검증**

`preview_start { url: "https://ggmuhk2010-cpu.github.io/work-calendar/" }`. Task 8의 Step 2~4를 축약해 반복: 캘린더 만들기 → 초대 링크 → 두 번째 탭에서 접속 → 작업 요청 → 완료가 첫 탭에 실시간 반영. 콘솔 에러 0. 스크린샷 1장. 테스트 작업 삭제.
확인 포인트: Pages 하위 경로(`/work-calendar/`)에서 `src/main.js`, `styles.css`, `firebase-config.js` 가 상대 경로로 정상 로드되는지(`read_network_requests`에서 404 없음).

- [ ] **Step 7: 사용자 보고**

보고에 넣을 것: 주소 `https://ggmuhk2010-cpu.github.io/work-calendar/`, 사용 순서(열기 → 새 캘린더 만들기 → 초대 링크 복사 → 팀 공유 → 각자 이름·회사 입력), 무료 한도, 링크가 곧 열쇠라는 주의, 스크린샷.

---

## Self-Review

- **Spec coverage:** 3-1 시작 화면(T4 landing, T5 handleCreate), 3-2 상단 바(T4 topbar), 3-3 달력·칩·필터·패널(T4 month/panel, T5), 3-4 폼·검증·요청자 자동(T2 validate, T4 modals), 3-5 할 일 탭 3섹션·마감 지남(T1 groupForList, T4 list), 3-6 오프라인·연결 실패·없는 링크·토스트(T5, T4 toast/landing), 4장 데이터 모델(T3 store), 5장 규칙(T3, T6 배포, T7 테스트), 6장 구독 창 60일 + 과거 달 1회 조회(T3, T5 ensureArchive), 7장 구조(T1에서 스펙 갱신), 8장 배포·사용자 1단계(T6, T9), 9장 검증(T1·T2 단위, T7 규칙, T8 로컬, T9 실제 주소).
- **Placeholder scan:** 없음. 콘솔 폴백 안내문, 3배 상한 대응, 409 처리까지 명시.
- **Type consistency:** `renderList(..., showDone)`, `taskCardHtml(task, today)`, `companyFilterHtml(companies, filter)`, `openIdentityForm({identity, onSave, onCancel})`, `confirmDialog(msg): Promise<boolean>`, `subscribeTasks(key, fromDate, onChange, onError)`, `validateRoomName → {ok, error, value}`, Task 객체의 `doneAtMs` 이름이 T1 테스트·T3 normalize·T4 list에서 동일.
- 알려진 v1 한계(스펙 범위 내): 과거 달 1회 조회 결과는 그 세션에서 다른 사람이 삭제해도 새로고침 전까지 남는다. 60일 넘게 이어지는 작업은 실시간 창에서 빠질 수 있다.

## 실행 중 계획과 달라진 점 (리뷰 결과 반영)

- Task 4: 할 일 행의 완료 버튼에 `btn-complete`(그린) 추가, 모바일 `.row` 격자 4열, 시작 화면 `maxlength`를 `LIMITS.roomName`으로 단일화, `.topbar-left` 규칙 추가. 사용자 요청으로 `viewport-fit=cover`, safe-area inset, 터치 타깃 36px, 태블릿(801~1100px)·와이드(≥1400px) 브레이크포인트 추가.
- Task 5: 실시간 창(60일) 밖 문서에 쓴 뒤 `store.getTask`로 다시 읽어 갱신(`refreshArchived`), `ensureArchive`를 `next`·`boot`에서도 호출, 캘린더 생성 직후에는 신원 모달을 띄우지 않음(`boot({ skipIdentityPrompt })`), `boot` 재진입 가드(세대 카운터), 필터 정리는 `render()` 밖(`pruneFilter`)으로 이동, 상단 바에 `+ 작업 요청` 버튼 추가, 모달을 겹쳐 열면 이전 모달을 정리(`modals.js currentClose`).
- Task 6: 프로젝트는 CLI `projects:create`가 403(Firebase 약관 미동의)으로 실패해 사용자가 콘솔에서 생성(`work-calendar-dz7gy6-e2d5f`). CLI가 만든 빈 GCP 프로젝트 `work-calendar-dz7gy6`는 Firebase 없이 남아 있음. `firestore:databases:create`는 API 활성화 전파 대기(약 75초) 후 성공.
- Task 7: 규칙 테스트에 `rooms` 컬렉션 나열 거부 확인 추가(5개 테스트).
