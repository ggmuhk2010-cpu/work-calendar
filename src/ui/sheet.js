import { esc } from './dom.js';
import { openModal, confirmDialog } from './modals.js';
import { toast } from './toast.js';
import { LIMITS, validateLink } from '../validate.js';
import { youtubeId, hostOf, formatBytes } from '../links.js';
import { prepareFile, decodeAttachment } from '../files.js';
import { companyColor } from '../colors.js';
import { isOverdue } from '../calendar.js';

const SAVE_FAIL = '저장하지 못했습니다. 잠시 후 다시 시도하세요.';

function kindBadge(task) {
  if (task.kind === 'event') return '<span class="badge badge-event">일정</span>';
  return task.status === 'done' ? '<span class="badge badge-done">완료</span>' : '<span class="badge badge-open">요청됨</span>';
}

function headerHtml(task, today) {
  const c = task.toCompany ? companyColor(task.toCompany) : null;
  const period = (task.start === task.end ? task.start : `${task.start} ~ ${task.end}`) + (task.time ? ` ${task.time}` : '');
  const overdue = isOverdue(task, today);
  return `
    <div class="sheet-head">
      <div class="card-head">
        ${c ? `<span class="tag" style="--chip-bg:${c.bg};--chip-fg:${c.fg}">${esc(task.toCompany)}</span>` : '<span class="tag tag-none">회사 없음</span>'}
        ${kindBadge(task)}
      </div>
      <h2 class="sheet-title ${task.status === 'done' ? 'done' : ''}">${esc(task.title)}</h2>
      <dl class="card-meta">
        ${task.assignee ? `<div><dt>담당자</dt><dd>${esc(task.assignee)}</dd></div>` : ''}
        <div><dt>${task.kind === 'event' ? '작성' : '요청'}</dt><dd>${esc(task.fromName)} · ${esc(task.fromCompany)}</dd></div>
        <div><dt>일시</dt><dd class="${overdue ? 'overdue' : ''}">${esc(period)}${overdue ? ' (마감 지남)' : ''}</dd></div>
        ${task.status === 'done' && task.doneBy ? `<div><dt>완료</dt><dd>${esc(task.doneBy)}</dd></div>` : ''}
      </dl>
    </div>
    ${task.memo ? `<section class="sheet-body">${esc(task.memo)}</section>` : '<p class="hint">본문이 없습니다. 수정에서 추가할 수 있습니다.</p>'}`;
}

function attachmentRowHtml(att) {
  const isLink = att.kind === 'link';
  const yt = isLink ? youtubeId(att.url) : null;
  const isImage = !isLink && att.type.startsWith('image/');
  const isHtml = !isLink && att.type === 'text/html';
  const icon = isLink ? (yt ? '▶️' : '🔗') : isImage ? '🖼️' : isHtml ? '📄' : '📎';
  const meta = isLink ? esc(hostOf(att.url)) : `${formatBytes(att.size)}`;
  const actions = isLink
    ? (yt ? `<button class="btn btn-sm" data-att-action="play" data-att="${esc(att.id)}">재생</button>` : '')
      + `<a class="btn btn-sm" href="${esc(att.url)}" target="_blank" rel="noopener noreferrer">열기</a>`
    : (isImage ? `<button class="btn btn-sm" data-att-action="preview" data-att="${esc(att.id)}">보기</button>` : '')
      + (isHtml ? `<button class="btn btn-sm btn-primary" data-att-action="view-html" data-att="${esc(att.id)}">열기</button>` : '')
      + `<button class="btn btn-sm" data-att-action="download" data-att="${esc(att.id)}">다운로드</button>`;
  return `<li class="att-row" data-att-row="${esc(att.id)}">
    <span class="att-icon">${icon}</span>
    <span class="att-main"><span class="att-name">${esc(att.name || (isLink ? att.url : '파일'))}</span><span class="att-meta">${meta} · ${esc(att.uploadedBy)}</span></span>
    <span class="att-actions">${actions}<button class="btn btn-sm btn-ghost btn-danger-text" data-att-action="delete" data-att="${esc(att.id)}">삭제</button></span>
    <div class="att-extra" hidden></div>
  </li>`;
}

function downloadBytes(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function openHtmlViewer({ name, html }) {
  const { el } = openModal(`
    <div class="viewer-head"><h2>${esc(name)}</h2><div><button class="btn btn-sm" id="viewer-newtab">새 창에서 열기</button><button class="btn btn-sm" data-close>닫기</button></div></div>
    <iframe class="viewer-frame" sandbox="allow-scripts allow-popups allow-forms" title="${esc(name)}"></iframe>`, { className: 'modal-viewer' });
  el.querySelector('.viewer-frame').srcdoc = html;
  el.querySelector('#viewer-newtab').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

export function openDetailSheet({ task, identity, today, handlers }) {
  const isEvent = task.kind === 'event';
  const { el, close } = openModal(`
    <div class="grabber" aria-hidden="true"></div>
    ${headerHtml(task, today)}
    <section class="sheet-atts">
      <div class="sheet-atts-head">
        <h3>첨부 <span class="count" data-att-count>${task.attachmentCount}</span><span class="muted">/ ${LIMITS.attachmentsPerTask}</span></h3>
        <div class="sheet-atts-actions">
          <button class="btn btn-sm" id="att-add-file">파일 추가</button>
          <button class="btn btn-sm" id="att-add-link">링크 추가</button>
          <input type="file" id="att-file-input" hidden>
        </div>
      </div>
      <form id="att-link-form" class="att-link-form" hidden novalidate>
        <input name="url" placeholder="https:// 주소 (유튜브·구글 드라이브·노션 등)" autocomplete="off">
        <input name="name" placeholder="제목 (선택)" maxlength="${LIMITS.attachmentName}" autocomplete="off">
        <p class="field-error" data-error-for="url"></p>
        <div class="modal-actions"><button type="button" class="btn btn-sm" id="att-link-cancel">취소</button><button type="submit" class="btn btn-sm btn-primary">추가</button></div>
      </form>
      <ul class="att-list"><li class="hint">첨부 불러오는 중…</li></ul>
      <p class="hint">파일은 압축 후 700KB까지(HTML·문서류는 원본 수 MB 가능, 사진은 작게). 큰 파일은 링크로 붙이세요.</p>
    </section>
    <div class="modal-actions sheet-actions">
      <button class="btn btn-ghost" data-action-sheet="open-date">달력에서 보기</button>
      <button class="btn btn-ghost btn-danger-text" data-action-sheet="delete">삭제</button>
      <button class="btn" data-action-sheet="edit">수정</button>
      ${isEvent ? '' : (task.status === 'done'
        ? '<button class="btn" data-action-sheet="reopen">완료 취소</button>'
        : '<button class="btn btn-primary btn-complete" data-action-sheet="complete">완료</button>')}
      <button class="btn" data-close>닫기</button>
    </div>`, { className: 'modal-wide modal-sheet' });

  const list = el.querySelector('.att-list');
  const countEl = el.querySelector('[data-att-count]');
  let attachments = [];
  const dataCache = new Map();

  async function reload() {
    try {
      attachments = await handlers.loadAttachments(task);
      countEl.textContent = String(attachments.length);
      list.innerHTML = attachments.length ? attachments.map(attachmentRowHtml).join('') : '<li class="hint">첨부가 없습니다.</li>';
    } catch (err) {
      console.error(err);
      list.innerHTML = '<li class="hint">첨부를 불러오지 못했습니다.</li>';
    }
  }
  async function bytesOf(att) {
    if (!dataCache.has(att.id)) dataCache.set(att.id, await decodeAttachment(att, await handlers.loadData(task, att)));
    return dataCache.get(att.id);
  }
  function findAtt(id) { return attachments.find((a) => a.id === id) ?? null; }

  el.addEventListener('click', async (e) => {
    const sheetBtn = e.target.closest('[data-action-sheet]');
    if (sheetBtn) {
      const action = sheetBtn.dataset.actionSheet;
      close();
      if (action === 'complete') await handlers.onComplete(task);
      else if (action === 'reopen') await handlers.onReopen(task);
      else if (action === 'edit') await handlers.onEdit(task);
      else if (action === 'delete') await handlers.onDelete(task);
      else if (action === 'open-date') await handlers.onOpenDate(task);
      return;
    }
    const attBtn = e.target.closest('[data-att-action]');
    if (!attBtn) return;
    const att = findAtt(attBtn.dataset.att);
    if (!att) return;
    const row = attBtn.closest('[data-att-row]');
    const extra = row.querySelector('.att-extra');
    try {
      switch (attBtn.dataset.attAction) {
        case 'play': {
          const id = youtubeId(att.url);
          extra.hidden = !extra.hidden;
          extra.innerHTML = extra.hidden ? '' : `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(att.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
          break;
        }
        case 'preview': {
          if (!extra.hidden) { extra.hidden = true; extra.innerHTML = ''; break; }
          attBtn.disabled = true;
          const bytes = await bytesOf(att);
          const url = URL.createObjectURL(new Blob([bytes], { type: att.type }));
          extra.innerHTML = `<img class="att-image" src="${url}" alt="${esc(att.name)}">`;
          extra.hidden = false;
          attBtn.disabled = false;
          break;
        }
        case 'view-html': {
          attBtn.disabled = true;
          const bytes = await bytesOf(att);
          attBtn.disabled = false;
          openHtmlViewer({ name: att.name, html: new TextDecoder().decode(bytes) });
          break;
        }
        case 'download': {
          attBtn.disabled = true;
          downloadBytes(await bytesOf(att), att.name, att.type);
          attBtn.disabled = false;
          break;
        }
        case 'delete': {
          if (!(await handlers.requireIdentity())) break;
          if (!(await confirmDialog(`"${att.name || att.url}" 첨부를 삭제할까요?`))) break;
          await handlers.onDeleteAttachment(task, att);
          dataCache.delete(att.id);
          toast('첨부를 삭제했습니다.');
          await reload();
          break;
        }
        default: break;
      }
    } catch (err) {
      console.error(err);
      attBtn.disabled = false;
      toast(err?.message?.includes('KB') || err?.message?.includes('MB') ? err.message : '첨부를 처리하지 못했습니다.', 'error');
    }
  });

  const fileInput = el.querySelector('#att-file-input');
  el.querySelector('#att-add-file').addEventListener('click', async () => {
    if (attachments.length >= LIMITS.attachmentsPerTask) { toast(`첨부는 ${LIMITS.attachmentsPerTask}개까지입니다.`, 'error'); return; }
    if (!(await handlers.requireIdentity())) return;
    fileInput.value = '';
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const btn = el.querySelector('#att-add-file');
    btn.disabled = true;
    try {
      const prepared = await prepareFile(file);
      await handlers.onAddFile(task, prepared);
      toast('파일을 첨부했습니다.');
      await reload();
    } catch (err) {
      console.error(err);
      toast(err?.message?.includes('KB') || err?.message?.includes('MB') ? err.message : SAVE_FAIL, 'error');
    } finally { btn.disabled = false; }
  });

  const linkForm = el.querySelector('#att-link-form');
  el.querySelector('#att-add-link').addEventListener('click', async () => {
    if (attachments.length >= LIMITS.attachmentsPerTask) { toast(`첨부는 ${LIMITS.attachmentsPerTask}개까지입니다.`, 'error'); return; }
    if (!(await handlers.requireIdentity())) return;
    linkForm.hidden = false;
    linkForm.elements.url.focus();
  });
  el.querySelector('#att-link-cancel').addEventListener('click', () => { linkForm.hidden = true; linkForm.reset(); });
  linkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = validateLink({ url: linkForm.elements.url.value, name: linkForm.elements.name.value });
    linkForm.querySelector('[data-error-for="url"]').textContent = r.errors.url || r.errors.name || '';
    if (!r.ok) return;
    const btn = linkForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await handlers.onAddLink(task, { url: r.value.url, name: r.value.name || hostOf(r.value.url) });
      linkForm.hidden = true; linkForm.reset();
      toast('링크를 첨부했습니다.');
      await reload();
    } catch (err) { console.error(err); toast(SAVE_FAIL, 'error'); }
    finally { btn.disabled = false; }
  });

  reload();
  return { close };
}
