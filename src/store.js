import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch, increment,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { generateKey } from './key.js';

let db = null;

export function initStore(config) {
  db = getFirestore(initializeApp(config));
  return db;
}

const roomRef = (key) => doc(db, 'rooms', key);
const tasksRef = (key) => collection(db, 'rooms', key, 'tasks');
const attRef = (key, taskId) => collection(db, 'rooms', key, 'tasks', taskId, 'attachments');
const blobRef = (key, taskId, attId) => doc(db, 'rooms', key, 'tasks', taskId, 'attachments', attId, 'blob', 'data');
const commentsRef = (key, taskId) => collection(db, 'rooms', key, 'tasks', taskId, 'comments');

export async function createRoom(name) {
  const key = generateKey();
  await setDoc(roomRef(key), { name, createdAt: serverTimestamp() });
  return key;
}

export async function getRoom(key) {
  const snap = await getDoc(roomRef(key));
  return snap.exists() ? { name: snap.data().name } : null;
}

// 서버 시각이 아직 안 온 로컬 쓰기(pending)는 추정치를 쓴다. 안 그러면 updatedAt이 null로 온다.
function normalize(snap) {
  const d = snap.data({ serverTimestamps: 'estimate' });
  return {
    id: snap.id,
    kind: d.kind ?? 'request',
    title: d.title,
    memo: d.memo ?? '',
    start: d.start,
    end: d.end,
    time: d.time ?? '',
    toCompany: d.toCompany ?? '',
    assignee: d.assignee ?? '',
    fromName: d.fromName,
    fromCompany: d.fromCompany,
    status: d.status,
    doneBy: d.doneBy ?? '',
    doneAtMs: d.doneAt ? d.doneAt.toMillis() : null,
    attachmentCount: d.attachmentCount ?? 0,
    commentCount: d.commentCount ?? 0,
    updatedAtMs: d.updatedAt ? d.updatedAt.toMillis() : null,
    updatedBy: d.updatedBy ?? '',
  };
}

export function subscribeTasks(key, fromDate, onChange, onError) {
  const q = query(tasksRef(key), where('start', '>=', fromDate), orderBy('start'));
  return onSnapshot(q, (qs) => onChange(qs.docs.map(normalize)), onError);
}

export async function fetchTasksInRange(key, from, to) {
  const q = query(tasksRef(key), where('start', '>=', from), where('start', '<=', to), orderBy('start'));
  const qs = await getDocs(q);
  return qs.docs.map(normalize);
}

export async function getTask(key, id) {
  const snap = await getDoc(doc(tasksRef(key), id));
  return snap.exists() ? normalize(snap) : null;
}

export async function addTask(key, value, identity) {
  const ref = await addDoc(tasksRef(key), {
    kind: value.kind,
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
    time: value.time,
    toCompany: value.toCompany,
    assignee: value.assignee,
    fromName: identity.name,
    fromCompany: identity.company,
    status: 'open',
    doneAt: null,
    doneBy: '',
    attachmentCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: identity.name,
  });
  return ref.id;
}

export async function updateTask(key, id, value, identity) {
  await updateDoc(doc(tasksRef(key), id), {
    kind: value.kind,
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
    time: value.time,
    toCompany: value.toCompany,
    assignee: value.assignee,
    updatedAt: serverTimestamp(),
    updatedBy: identity.name,
  });
}

export async function setDone(key, id, done, identity) {
  const patch = done
    ? { status: 'done', doneAt: serverTimestamp(), doneBy: identity.name }
    : { status: 'open', doneAt: null, doneBy: '' };
  await updateDoc(doc(tasksRef(key), id), { ...patch, updatedAt: serverTimestamp(), updatedBy: identity.name });
}

/** 항목과 그 첨부(메타·내용)·댓글을 지운다. Firestore는 하위 컬렉션을 자동으로 지우지 않는다. 배치 500 한도 때문에 400개씩 나눠 커밋한다. */
export async function deleteTask(key, id) {
  const [atts, comments] = await Promise.all([getDocs(attRef(key, id)), getDocs(commentsRef(key, id))]);
  const refs = [];
  for (const a of atts.docs) {
    refs.push(a.ref);
    if (a.data().kind === 'file') refs.push(blobRef(key, id, a.id));
  }
  for (const c of comments.docs) refs.push(c.ref);
  refs.push(doc(tasksRef(key), id)); // 항목 문서는 마지막에: 중간에 실패해도 고아 항목이 남지 않는다
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
}

// ---------- 첨부 ----------
function normalizeAttachment(snap) {
  const d = snap.data({ serverTimestamps: 'estimate' });
  return {
    id: snap.id,
    kind: d.kind,
    name: d.name,
    type: d.type ?? '',
    size: d.size ?? 0,
    storedSize: d.storedSize ?? 0,
    encoding: d.encoding ?? 'none',
    url: d.url ?? '',
    uploadedBy: d.uploadedBy ?? '',
    createdAtMs: d.createdAt ? d.createdAt.toMillis() : null,
  };
}

export async function listAttachments(key, taskId) {
  const qs = await getDocs(query(attRef(key, taskId), orderBy('createdAt')));
  return qs.docs.map(normalizeAttachment);
}

export async function getAttachmentData(key, taskId, attId) {
  const snap = await getDoc(blobRef(key, taskId, attId));
  return snap.exists() ? snap.data().data : null;
}

function touchTask(batch, key, taskId, delta, identity) {
  batch.update(doc(tasksRef(key), taskId), {
    attachmentCount: increment(delta), updatedAt: serverTimestamp(), updatedBy: identity.name,
  });
}

/** file: { name, type, size, storedSize, encoding, data } — data는 base64 문자열 */
export async function addFileAttachment(key, taskId, file, identity) {
  const batch = writeBatch(db);
  const ref = doc(attRef(key, taskId));
  batch.set(ref, {
    kind: 'file', name: file.name, type: file.type, size: file.size, storedSize: file.storedSize,
    encoding: file.encoding, uploadedBy: identity.name, createdAt: serverTimestamp(),
  });
  batch.set(blobRef(key, taskId, ref.id), { data: file.data });
  touchTask(batch, key, taskId, 1, identity);
  await batch.commit();
  return ref.id;
}

/** link: { name, url } */
export async function addLinkAttachment(key, taskId, link, identity) {
  const batch = writeBatch(db);
  const ref = doc(attRef(key, taskId));
  batch.set(ref, { kind: 'link', name: link.name, url: link.url, uploadedBy: identity.name, createdAt: serverTimestamp() });
  touchTask(batch, key, taskId, 1, identity);
  await batch.commit();
  return ref.id;
}

export async function deleteAttachment(key, taskId, att, identity) {
  const batch = writeBatch(db);
  batch.delete(doc(attRef(key, taskId), att.id));
  if (att.kind === 'file') batch.delete(blobRef(key, taskId, att.id));
  touchTask(batch, key, taskId, -1, identity);
  await batch.commit();
}

// ---------- 댓글 ----------
export function subscribeComments(key, taskId, onChange, onError) {
  const q = query(commentsRef(key, taskId), orderBy('createdAt'));
  return onSnapshot(q, (qs) => onChange(qs.docs.map((s) => {
    const d = s.data({ serverTimestamps: 'estimate' });
    return { id: s.id, text: d.text, authorName: d.authorName, authorCompany: d.authorCompany, createdAtMs: d.createdAt ? d.createdAt.toMillis() : null };
  })), onError);
}

export async function addComment(key, taskId, text, identity) {
  const batch = writeBatch(db);
  batch.set(doc(commentsRef(key, taskId)), {
    text, authorName: identity.name, authorCompany: identity.company, createdAt: serverTimestamp(),
  });
  batch.update(doc(tasksRef(key), taskId), { commentCount: increment(1), updatedAt: serverTimestamp(), updatedBy: identity.name });
  await batch.commit();
}

export async function deleteComment(key, taskId, commentId, identity) {
  const batch = writeBatch(db);
  batch.delete(doc(commentsRef(key, taskId), commentId));
  batch.update(doc(tasksRef(key), taskId), { commentCount: increment(-1), updatedAt: serverTimestamp(), updatedBy: identity.name });
  await batch.commit();
}
