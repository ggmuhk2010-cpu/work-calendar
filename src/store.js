import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { generateKey } from './key.js';

let db = null;

export function initStore(config) {
  db = getFirestore(initializeApp(config));
  return db;
}

const roomRef = (key) => doc(db, 'rooms', key);
const tasksRef = (key) => collection(db, 'rooms', key, 'tasks');

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
    title: d.title,
    memo: d.memo ?? '',
    start: d.start,
    end: d.end,
    toCompany: d.toCompany,
    assignee: d.assignee ?? '',
    fromName: d.fromName,
    fromCompany: d.fromCompany,
    status: d.status,
    doneBy: d.doneBy ?? '',
    doneAtMs: d.doneAt ? d.doneAt.toMillis() : null,
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

export async function addTask(key, value, identity) {
  const ref = await addDoc(tasksRef(key), {
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
    toCompany: value.toCompany,
    assignee: value.assignee,
    fromName: identity.name,
    fromCompany: identity.company,
    status: 'open',
    doneAt: null,
    doneBy: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: identity.name,
  });
  return ref.id;
}

export async function updateTask(key, id, value, identity) {
  await updateDoc(doc(tasksRef(key), id), {
    title: value.title,
    memo: value.memo,
    start: value.start,
    end: value.end,
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

export async function deleteTask(key, id) {
  await deleteDoc(doc(tasksRef(key), id));
}
