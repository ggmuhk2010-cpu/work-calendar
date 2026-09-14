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
      : `<button class="btn btn-sm btn-primary btn-complete" data-action="complete" data-task="${esc(task.id)}">완료</button>`}
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
