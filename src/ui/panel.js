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
