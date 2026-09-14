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
