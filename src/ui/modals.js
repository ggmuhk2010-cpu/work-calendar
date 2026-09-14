import { esc } from './dom.js';
import { validateTask, validateIdentity, LIMITS } from '../validate.js';
import { toast } from './toast.js';

let currentClose = null;

export function openModal(html, { onClose, className } = {}) {
  if (currentClose) currentClose();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${className ?? ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (currentClose === close) currentClose = null;
    document.removeEventListener('keydown', onKey);
    if (root.firstElementChild === backdrop) root.innerHTML = '';
    onClose?.();
  };
  currentClose = close;
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
      <p class="muted">${isEdit ? '수정자' : '작성자'}: ${esc(identity.name)} · ${esc(identity.company)}${isEdit ? '' : ' · 첨부는 저장 후 상세 화면에서 추가합니다.'}</p>
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
