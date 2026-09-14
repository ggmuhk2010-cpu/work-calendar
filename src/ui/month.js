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
  const c = task.toCompany ? companyColor(task.toCompany) : { bg: 'rgba(120, 120, 128, 0.12)', fg: '#3A3A3C' };
  const cont = task.start !== date ? '<span class="chip-cont">↔</span>' : '';
  const done = task.kind !== 'event' && task.status === 'done';
  const time = task.time ? `<span class="chip-time">${esc(task.time)}</span>` : '';
  return `<button class="chip ${task.kind === 'event' ? 'chip-event' : ''} ${done ? 'chip-done' : ''}" data-task="${esc(task.id)}" data-date="${esc(date)}"
    style="--chip-bg:${c.bg};--chip-fg:${c.fg}" title="${esc(task.title)}${task.toCompany ? ' · ' + esc(task.toCompany) : ''}">${cont}${done ? '✓ ' : ''}${time}${esc(task.title)}</button>`;
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
