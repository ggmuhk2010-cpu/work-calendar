import { firebaseConfig } from '../firebase-config.js';
import {
  initStore, createRoom, getRoom, subscribeTasks, fetchTasksInRange, getTask, addTask, updateTask, setDone, deleteTask,
  listAttachments, getAttachmentData, addFileAttachment, addLinkAttachment, deleteAttachment,
  subscribeComments, addComment, deleteComment,
} from './store.js';
import { openDetailSheet } from './ui/sheet.js';
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
function liveFrom() { return addDays(todayStr(), -LIVE_WINDOW_DAYS); }
function isLive(id) { return state.liveTasks.some((t) => t.id === id); }
function pruneFilter() {
  if (!state.filter) return;
  const companies = companiesOf(allTasks());
  for (const c of state.filter) if (!companies.includes(c)) state.filter.delete(c);
  if (state.filter.size === 0) state.filter = null;
}
// 실시간 창 밖(60일 이전) 문서는 스냅샷이 오지 않으므로 쓰기 뒤 직접 다시 읽는다. 실패해도 쓰기는 이미 성공했으므로 안내만 한다.
async function refreshArchived(id) {
  const gen = bootGen;
  const key = state.key;
  try {
    const t = await getTask(key, id);
    if (gen !== bootGen || state.key !== key) return;
    if (t && t.start < liveFrom()) state.archiveTasks.set(id, t);
    else state.archiveTasks.delete(id); // 삭제됐거나 실시간 창으로 들어온 문서는 리스너가 맡는다
    pruneFilter();
    render();
  } catch (err) {
    console.error(err);
    if (gen === bootGen && state.key === key) toast('화면을 갱신하지 못했습니다. 새로고침하세요.', 'error');
  }
}

// ---------- 렌더 ----------
function render() {
  const today = todayStr();
  const companies = companiesOf(allTasks());
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
  const from = liveFrom();
  unsubscribe = subscribeTasks(
    state.key, from,
    (rows) => { state.liveTasks = rows; state.storeError = false; pruneFilter(); render(); },
    (err) => { console.error(err); state.storeError = true; render(); },
  );
}

async function ensureArchive(month) {
  const { first, last } = monthRange(month);
  if (last >= liveFrom()) return; // 실시간 창이 덮는 달
  const tag = `${month.year}-${month.month}`;
  if (state.loadedArchiveMonths.has(tag)) return;
  state.loadedArchiveMonths.add(tag);
  const gen = bootGen;
  const key = state.key;
  try {
    const rows = await fetchTasksInRange(key, addDays(first, -LIVE_WINDOW_DAYS), last);
    if (gen !== bootGen || state.key !== key) return;
    for (const t of rows) state.archiveTasks.set(t.id, t);
    pruneFilter();
    render();
  } catch (err) {
    console.error(err);
    if (gen === bootGen && state.key === key) {
      state.loadedArchiveMonths.delete(tag);
      toast('이전 달 작업을 불러오지 못했습니다.', 'error');
    }
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

// 실시간 창 밖 문서는 첨부 수 변경이 스냅샷으로 오지 않으므로 직접 갱신한다.
async function afterAttachmentChange(taskId) {
  if (!isLive(taskId)) await refreshArchived(taskId);
}

// 폼에서 고른 첨부를 저장 직후 하나씩 올린다. 일부가 실패해도 항목 저장은 이미 끝났으므로 안내만 한다.
async function uploadPending(taskId, pending, identity) {
  if (!pending?.length) return;
  let failed = 0;
  for (const p of pending) {
    try {
      if (p.kind === 'file') await addFileAttachment(state.key, taskId, p.prepared, identity);
      else await addLinkAttachment(state.key, taskId, { name: p.name, url: p.url }, identity);
    } catch (err) { console.error(err); failed += 1; }
  }
  if (failed) toast(`첨부 ${pending.length}개 중 ${failed}개를 저장하지 못했습니다.`, 'error');
  await afterAttachmentChange(taskId);
}

function openTask(id) {
  const task = findTask(id);
  if (!task) { toast('항목을 찾을 수 없습니다. 새로고침하세요.', 'error'); return; }
  openDetailSheet({
    task,
    identity: state.identity,
    today: todayStr(),
    handlers: {
      onComplete: (t) => handleAction('complete', t.id),
      onReopen: (t) => handleAction('reopen', t.id),
      onEdit: (t) => handleAction('edit', t.id),
      onDelete: (t) => handleAction('delete', t.id),
      onOpenDate: (t) => {
        state.view = 'calendar';
        state.month = monthOf(t.start);
        state.selectedDate = t.start;
        render();
        ensureArchive(state.month);
      },
      loadAttachments: (t) => listAttachments(state.key, t.id),
      loadData: async (t, att) => {
        const data = await getAttachmentData(state.key, t.id, att.id);
        if (data === null) throw new Error('첨부 내용이 없습니다.');
        return data;
      },
      onAddFile: async (t, prepared) => { await addFileAttachment(state.key, t.id, prepared, state.identity); await afterAttachmentChange(t.id); },
      onAddLink: async (t, link) => { await addLinkAttachment(state.key, t.id, link, state.identity); await afterAttachmentChange(t.id); },
      onDeleteAttachment: async (t, att) => { await deleteAttachment(state.key, t.id, att, state.identity); await afterAttachmentChange(t.id); },
      // 댓글 쓰기는 항목 문서의 commentCount도 바꾸므로 첨부와 같은 갱신 경로를 쓴다.
      subscribeComments: (t, onChange, onError) => subscribeComments(state.key, t.id, onChange, onError),
      onAddComment: async (t, text) => { await addComment(state.key, t.id, text, state.identity); await afterAttachmentChange(t.id); },
      onDeleteComment: async (t, commentId) => { await deleteComment(state.key, t.id, commentId, state.identity); await afterAttachmentChange(t.id); },
      requireIdentity,
    },
  });
}

async function handleAction(action, taskId) {
  const today = todayStr();
  switch (action) {
    case 'prev': state.month = addMonths(state.month, -1); state.selectedDate = null; render(); ensureArchive(state.month); break;
    case 'next': state.month = addMonths(state.month, 1); state.selectedDate = null; render(); ensureArchive(state.month); break;
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
        onSubmit: async (v, pending) => {
          const newId = await addTask(state.key, v, id);
          toast(v.kind === 'event' ? '일정을 추가했습니다.' : '작업을 요청했습니다.');
          await uploadPending(newId, pending, id);
          if (v.start < liveFrom()) await refreshArchived(newId);
        },
      });
      break;
    }
    case 'edit': {
      const task = findTask(taskId);
      if (!task) break;
      const id = await requireIdentity();
      if (!id) break;
      openTaskForm({
        task, date: task.start, identity: id, companies: companiesOf(allTasks()), existingCount: task.attachmentCount ?? 0,
        onSubmit: async (v, pending) => {
          await updateTask(state.key, task.id, v, id);
          toast('저장했습니다.');
          await uploadPending(task.id, pending, id);
          if (!isLive(task.id) || v.start < liveFrom()) await refreshArchived(task.id);
        },
      });
      break;
    }
    case 'complete':
    case 'reopen': {
      const id = await requireIdentity();
      if (!id) break;
      try {
        await setDone(state.key, taskId, action === 'complete', id);
        if (!isLive(taskId)) await refreshArchived(taskId);
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
        pruneFilter();
        render();
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
  const openTaskBtn = e.target.closest('[data-open-task]');
  if (openTaskBtn) { openTask(openTaskBtn.dataset.openTask); return; }
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    handleAction(actionBtn.dataset.action, actionBtn.dataset.task)
      .catch((err) => { console.error(err); toast('오류가 발생했습니다. 잠시 후 다시 시도하세요.', 'error'); });
    return;
  }
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
    await boot({ skipIdentityPrompt: true });
    openInviteModal({ link: inviteLink() });
  } catch (err) {
    console.error(err);
    errEl.textContent = '캘린더를 만들지 못했습니다. 잠시 후 다시 시도하세요.';
  }
}

function resetRoomState() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  Object.assign(state, {
    key: null, room: null, view: 'calendar', month: monthOf(todayStr()), selectedDate: null,
    filter: null, liveTasks: [], storeError: false,
  });
  state.archiveTasks.clear();
  state.loadedArchiveMonths.clear();
}

let bootGen = 0;
async function boot({ skipIdentityPrompt = false } = {}) {
  const gen = ++bootGen;
  resetRoomState();
  const key = keyFromHash(location.hash);
  if (!key) { renderLanding(app, { missing: false, onCreate: handleCreate }); return; }
  let room;
  try { room = await getRoom(key); }
  catch (err) {
    if (gen !== bootGen) return;
    console.error(err);
    app.innerHTML = '<div class="error-banner" style="margin:16px">저장소에 연결할 수 없습니다. 잠시 후 새로고침하세요.</div>';
    return;
  }
  if (gen !== bootGen) return; // 기다리는 사이 주소가 또 바뀜
  if (!room) { renderLanding(app, { missing: true, onCreate: handleCreate }); return; }
  state.key = key;
  state.room = room;
  render();
  startLive();
  if (!state.identity && !skipIdentityPrompt) {
    openIdentityForm({ identity: null, onSave: (v) => { state.identity = saveIdentity(v); render(); } });
  }
}

window.addEventListener('hashchange', () => boot());
window.addEventListener('online', () => { state.online = true; if (state.room) render(); });
window.addEventListener('offline', () => { state.online = false; if (state.room) render(); });

initStore(firebaseConfig);
boot();
