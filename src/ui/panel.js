import { esc } from './dom.js';
import { formatDayTitle, tasksOnDate, isOverdue } from '../calendar.js';
import { companyColor } from '../colors.js';

export function taskCardHtml(task, today) {
  const c = task.toCompany ? companyColor(task.toCompany) : null;
  const isEvent = task.kind === 'event';
  const done = !isEvent && task.status === 'done';
  const overdue = isOverdue(task, today);
  const period = (task.start === task.end ? task.start : `${task.start} ~ ${task.end}`) + (task.time ? ` ${task.time}` : '');
  const badge = isEvent ? '<span class="badge badge-event">일정</span>'
    : `<span class="badge ${done ? 'badge-done' : 'badge-open'}">${done ? '완료' : '요청됨'}</span>`;
  return `<article class="card ${done ? 'card-done' : ''}" data-task-card="${esc(task.id)}">
    <div class="card-head">
      ${c ? `<span class="tag" style="--chip-bg:${c.bg};--chip-fg:${c.fg}">${esc(task.toCompany)}</span>` : '<span class="tag tag-none">회사 없음</span>'}
      ${badge}
    </div>
    <button class="card-title" data-open-task="${esc(task.id)}">${esc(task.title)}${task.attachmentCount > 0 ? ` <span class="att-count">📎${task.attachmentCount}</span>` : ''}${task.commentCount > 0 ? ` <span class="comment-count">💬${task.commentCount}</span>` : ''}</button>
    <dl class="card-meta">
      ${task.assignee ? `<div><dt>담당자</dt><dd>${esc(task.assignee)}</dd></div>` : ''}
      <div><dt>${isEvent ? '작성' : '요청'}</dt><dd>${esc(task.fromName)} · ${esc(task.fromCompany)}</dd></div>
      <div><dt>일시</dt><dd class="${overdue ? 'overdue' : ''}">${esc(period)}${overdue ? ' (마감 지남)' : ''}</dd></div>
      ${done && task.doneBy ? `<div><dt>완료</dt><dd>${esc(task.doneBy)}</dd></div>` : ''}
    </dl>
    ${task.memo ? `<p class="card-memo">${esc(task.memo.length > 160 ? task.memo.slice(0, 160) + '…' : task.memo)}</p>` : ''}
    <div class="card-actions">
      ${isEvent ? '' : (done
        ? `<button class="btn" data-action="reopen" data-task="${esc(task.id)}">완료 취소</button>`
        : `<button class="btn btn-primary btn-complete" data-action="complete" data-task="${esc(task.id)}">완료</button>`)}
      <button class="btn btn-ghost" data-open-task="${esc(task.id)}">자세히</button>
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
          <button class="btn btn-primary" data-action="add-task">+ 추가</button>
          <button class="btn btn-ghost" data-action="close-panel" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="panel-body">
        ${dayTasks.length ? dayTasks.map((t) => taskCardHtml(t, today)).join('') : '<p class="empty">이 날에는 작업이 없습니다.</p>'}
      </div>
    </aside>`;
}
