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

export const byStartTime = (a, b) => {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  const ta = a.time || '';
  const tb = b.time || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title, 'ko');
};

export function tasksOnDate(tasks, date) {
  return tasks.filter((t) => t.start <= date && date <= t.end).sort(byStartTime);
}

export function isOverdue(task, today) {
  return task.kind !== 'event' && task.status === 'open' && task.end < today;
}

export function companiesOf(tasks) {
  return [...new Set(tasks.map((t) => t.toCompany).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
}

/** 오늘부터 days일 안에 걸치는 일정(kind === 'event'), 날짜·시간순 */
export function upcomingEvents(tasks, today, days = 30) {
  const until = addDays(today, days);
  return tasks.filter((t) => t.kind === 'event' && t.end >= today && t.start <= until).sort(byStartTime);
}

const byEnd = (a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.title.localeCompare(b.title, 'ko'));

/** 할 일 탭 그룹화. mine/others/recentDone은 작업 요청만, events는 일정만. */
export function groupForList(tasks, today, myCompany) {
  const requests = tasks.filter((t) => t.kind !== 'event');
  const open = requests.filter((t) => t.status === 'open');
  const isMine = (t) => Boolean(myCompany) && t.toCompany === myCompany;
  const mine = open.filter(isMine).sort(byEnd);
  const others = open.filter((t) => !isMine(t)).sort(byEnd);
  const cutoffMs = parseDateStr(addDays(today, -30)).getTime();
  const recentDone = requests
    .filter((t) => t.status === 'done' && typeof t.doneAtMs === 'number' && t.doneAtMs >= cutoffMs)
    .sort((a, b) => b.doneAtMs - a.doneAtMs);
  return { mine, others, recentDone, events: upcomingEvents(tasks, today) };
}
