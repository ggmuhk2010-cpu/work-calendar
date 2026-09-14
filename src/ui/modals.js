import { esc } from './dom.js';
import { validateTask, validateIdentity, validateLink, LIMITS } from '../validate.js';
import { prepareFile } from '../files.js';
import { hostOf, formatBytes } from '../links.js';
import { toast } from './toast.js';

const stack = []; // 열린 모달의 close 함수, 마지막이 맨 위

export function openModal(html, { onClose, className } = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${className ?? ''}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(backdrop);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && stack[stack.length - 1] === close) close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  stack.push(close);
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

/** 폼에서 고른 첨부 대기 행: { uid, kind: 'file', prepared } | { uid, kind: 'link', name, url } */
function pendingRowHtml(p) {
  const isLink = p.kind === 'link';
  const name = isLink ? (p.name || p.url) : p.prepared.name;
  const meta = isLink ? hostOf(p.url) : formatBytes(p.prepared.size);
  return `<li class="form-att-row" data-pending-row="${esc(p.uid)}">
    <span class="att-icon">${isLink ? '\u{1F517}' : '\u{1F4CE}'}</span>
    <span class="att-main"><span class="att-name">${esc(name)}</span><span class="att-meta">${esc(meta)}</span></span>
    <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-pending-remove="${esc(p.uid)}">제거</button>
  </li>`;
}

export function openTaskForm({ task, date, identity, companies, existingCount = 0, onSubmit }) {
  const isEdit = Boolean(task);
  const v = task ?? { kind: 'request', title: '', toCompany: '', assignee: '', start: date, end: date, time: '', memo: '' };
  const { el, close } = openModal(`
    <h2>${isEdit ? '수정' : '추가'}</h2>
    <form id="task-form" novalidate>
      <div class="kind-toggle" role="radiogroup" aria-label="종류">
        <label class="kind-option"><input type="radio" name="kind" value="request" ${v.kind !== 'event' ? 'checked' : ''}><span>작업 요청</span></label>
        <label class="kind-option"><input type="radio" name="kind" value="event" ${v.kind === 'event' ? 'checked' : ''}><span>일정</span></label>
      </div>
      <label>제목 <span class="req">*</span><input name="title" maxlength="${LIMITS.title}" value="${esc(v.title)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="title"></p>
      <label><span data-company-label>${v.kind === 'event' ? '관련 회사' : '담당 회사 <span class="req">*</span>'}</span><input name="toCompany" list="company-list" maxlength="${LIMITS.company}" value="${esc(v.toCompany)}" autocomplete="off"></label>
      <datalist id="company-list">${companies.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <p class="field-error" data-error-for="toCompany"></p>
      <label>담당자<input name="assignee" maxlength="${LIMITS.person}" value="${esc(v.assignee)}" autocomplete="off"></label>
      <p class="field-error" data-error-for="assignee"></p>
      <div class="row3">
        <div><label>시작일 <span class="req">*</span><input type="date" name="start" value="${esc(v.start)}"></label><p class="field-error" data-error-for="start"></p></div>
        <div><label>마감일<input type="date" name="end" value="${esc(v.end)}"></label><p class="field-error" data-error-for="end"></p></div>
        <div><label>시간<input type="time" name="time" value="${esc(v.time)}"></label><p class="field-error" data-error-for="time"></p></div>
      </div>
      <label>본문<textarea name="memo" rows="6" maxlength="${LIMITS.memo}" placeholder="자세한 내용, 준비물, 참고 사항…">${esc(v.memo)}</textarea></label>
      <p class="field-error" data-error-for="memo"></p>
      <div class="form-atts">
        <div class="form-atts-head">
          <h3>첨부 <span class="count" data-form-att-count>${existingCount}</span><span class="muted">/ ${LIMITS.attachmentsPerTask}</span></h3>
          <div class="form-atts-actions">
            <button type="button" class="btn btn-sm" id="form-add-file">파일 추가</button>
            <button type="button" class="btn btn-sm" id="form-add-link">링크 추가</button>
            <input type="file" id="form-file-input" multiple hidden>
          </div>
        </div>
        <div class="form-link-row" hidden>
          <input id="form-link-url" placeholder="https:// 주소 (유튜브·구글 드라이브·노션 등)" autocomplete="off">
          <input id="form-link-name" placeholder="제목 (선택)" maxlength="${LIMITS.attachmentName}" autocomplete="off">
          <div class="form-link-actions">
            <button type="button" class="btn btn-sm" id="form-link-cancel">취소</button>
            <button type="button" class="btn btn-sm btn-primary" id="form-link-add">추가</button>
          </div>
        </div>
        <p class="field-error" data-error-for="link"></p>
        <ul class="form-att-list"></ul>
        <p class="hint">${existingCount > 0 ? `이미 붙인 첨부 ${existingCount}개는 상세 화면에서 관리합니다. ` : ''}파일은 압축 후 700KB까지. 큰 파일은 링크로 붙이세요.</p>
      </div>
      <p class="muted">${isEdit ? '수정자' : '작성자'}: ${esc(identity.name)} · ${esc(identity.company)}</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '추가'}</button>
      </div>
    </form>`, { className: 'modal-wide' });
  const form = el.querySelector('form');
  const companyLabel = form.querySelector('[data-company-label]');
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'kind') return;
    companyLabel.innerHTML = e.target.value === 'event' ? '관련 회사' : '담당 회사 <span class="req">*</span>';
  });

  // ---- 첨부 대기 목록: 저장할 때 한꺼번에 올린다 ----
  const pending = [];
  let uid = 0;
  const attList = el.querySelector('.form-att-list');
  const countEl = el.querySelector('[data-form-att-count]');
  const addFileBtn = el.querySelector('#form-add-file');
  const addLinkBtn = el.querySelector('#form-add-link');
  const fileInput = el.querySelector('#form-file-input');
  const linkRow = el.querySelector('.form-link-row');
  const linkUrl = el.querySelector('#form-link-url');
  const linkName = el.querySelector('#form-link-name');
  const linkError = el.querySelector('[data-error-for="link"]');
  const linkAddBtn = el.querySelector('#form-link-add');
  const submitBtn = form.querySelector('button[type=submit]');

  function renderPending() {
    attList.innerHTML = pending.map(pendingRowHtml).join('');
    countEl.textContent = String(existingCount + pending.length);
  }
  function hasRoom() {
    if (existingCount + pending.length < LIMITS.attachmentsPerTask) return true;
    toast(`첨부는 ${LIMITS.attachmentsPerTask}개까지입니다.`, 'error');
    return false;
  }
  function closeLinkRow() {
    linkRow.hidden = true;
    linkUrl.value = '';
    linkName.value = '';
    linkError.textContent = '';
  }
  function addLink() {
    if (!hasRoom()) return;
    const r = validateLink({ url: linkUrl.value, name: linkName.value });
    linkError.textContent = r.errors.url || r.errors.name || '';
    if (!r.ok) return;
    pending.push({ uid: ++uid, kind: 'link', name: r.value.name || hostOf(r.value.url), url: r.value.url });
    renderPending();
    closeLinkRow();
  }

  addFileBtn.addEventListener('click', () => {
    if (!hasRoom()) return;
    fileInput.value = '';
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    if (!files.length) return;
    addFileBtn.disabled = true;
    addFileBtn.textContent = '압축 중…';
    submitBtn.disabled = true;
    for (const file of files) {
      if (!hasRoom()) break;
      try {
        pending.push({ uid: ++uid, kind: 'file', prepared: await prepareFile(file) });
        renderPending();
      } catch (err) {
        console.error(err);
        toast(err?.message?.includes('KB') || err?.message?.includes('MB') ? err.message : '파일을 첨부하지 못했습니다.', 'error');
      }
    }
    addFileBtn.textContent = '파일 추가';
    addFileBtn.disabled = false;
    submitBtn.disabled = false;
  });
  addLinkBtn.addEventListener('click', () => {
    if (!hasRoom()) return;
    linkRow.hidden = false;
    linkUrl.focus();
  });
  el.querySelector('#form-link-cancel').addEventListener('click', closeLinkRow);
  linkAddBtn.addEventListener('click', addLink);
  // 폼 안이라 엔터를 그냥 두면 항목이 저장돼 버린다.
  linkRow.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
  attList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pending-remove]');
    if (!btn) return;
    const i = pending.findIndex((p) => String(p.uid) === btn.dataset.pendingRemove);
    if (i >= 0) { pending.splice(i, 1); renderPending(); }
  });

  form.elements.title.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const r = validateTask({
      kind: f.kind.value, title: f.title.value, toCompany: f.toCompany.value, assignee: f.assignee.value,
      start: f.start.value, end: f.end.value, time: f.time.value, memo: f.memo.value,
    });
    showErrors(form, r.errors);
    if (!r.ok) return;
    const label = submitBtn.textContent;
    const lockBtns = [submitBtn, addFileBtn, addLinkBtn, linkAddBtn, ...attList.querySelectorAll('[data-pending-remove]')];
    submitBtn.textContent = '저장 중…';
    lockBtns.forEach((b) => { b.disabled = true; });
    try {
      await onSubmit(r.value, pending.slice());
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했습니다. 잠시 후 다시 시도하세요.', 'error');
      submitBtn.textContent = label;
      lockBtns.forEach((b) => { b.disabled = false; });
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
