// 실제 Firebase 프로젝트에 붙어 firestore.rules의 허용/거부를 확인한다. 실행: npm run test:rules
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, limit,
  serverTimestamp, terminate,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config.js';
import { generateKey } from '../src/key.js';

const db = getFirestore(initializeApp(firebaseConfig));
const key = generateKey();
const who = { name: '테스트', company: '테스트사' };
const tasksCol = () => collection(db, 'rooms', key, 'tasks');
const base = () => ({
  title: '규칙 테스트', memo: '', start: '2026-09-14', end: '2026-09-14', toCompany: 'A사', assignee: '',
  fromName: who.name, fromCompany: who.company, status: 'open', doneAt: null, doneBy: '',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: who.name,
});
const denied = (p) => assert.rejects(p, (e) => /permission-denied|PERMISSION_DENIED/i.test(`${e.code} ${e.message}`));
const created = [];

after(async () => {
  for (const ref of created) await deleteDoc(ref).catch(() => {});
  await terminate(db);
});

test('room: create allowed with a valid key; short key, extra field, delete denied', async () => {
  await setDoc(doc(db, 'rooms', key), { name: '규칙 테스트', createdAt: serverTimestamp() });
  assert.equal((await getDoc(doc(db, 'rooms', key))).data().name, '규칙 테스트');
  await denied(setDoc(doc(db, 'rooms', 'shortkey'), { name: 'x', createdAt: serverTimestamp() }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: 'x', createdAt: serverTimestamp(), extra: 1 }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: '', createdAt: serverTimestamp() }));
  await denied(deleteDoc(doc(db, 'rooms', key)));
});

test('task: valid create, 120-char Korean title, complete, reopen all allowed', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  const ref2 = await addDoc(tasksCol(), { ...base(), title: '가'.repeat(120) });
  created.push(ref2);
  await updateDoc(ref, { status: 'done', doneAt: serverTimestamp(), doneBy: who.name, updatedAt: serverTimestamp(), updatedBy: who.name });
  assert.equal((await getDoc(ref)).data().status, 'done');
  await updateDoc(ref, { status: 'open', doneAt: null, doneBy: '', updatedAt: serverTimestamp(), updatedBy: who.name });
  assert.equal((await getDoc(ref)).data().status, 'open');
});

test('task: invalid documents denied', async () => {
  await denied(addDoc(tasksCol(), { ...base(), title: '가'.repeat(121) }));
  await denied(addDoc(tasksCol(), { ...base(), title: '' }));
  await denied(addDoc(tasksCol(), { ...base(), status: 'wip' }));
  await denied(addDoc(tasksCol(), { ...base(), end: '2026-09-13' }));
  await denied(addDoc(tasksCol(), { ...base(), start: '2026/09/14' }));
  await denied(addDoc(tasksCol(), { ...base(), updatedAt: new Date() }));
  await denied(addDoc(tasksCol(), { ...base(), hacked: true }));
  await denied(addDoc(tasksCol(), { ...base(), status: 'done' })); // done인데 doneAt null
  await denied(addDoc(collection(db, 'rooms', 'shortkey', 'tasks'), base()));
});

test('task: update cannot change createdAt; reading a random room is allowed but empty', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  await denied(updateDoc(ref, { createdAt: new Date(), updatedAt: serverTimestamp() }));
  const other = await getDoc(doc(db, 'rooms', generateKey()));
  assert.equal(other.exists(), false);
});

test('secrecy: listing the rooms collection is denied (room IDs are the secret keys)', async () => {
  await denied(getDocs(collection(db, 'rooms')));
  await denied(getDocs(query(collection(db, 'rooms'), limit(5))));
});
