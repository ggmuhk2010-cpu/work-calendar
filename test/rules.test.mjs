// 실제 Firebase 프로젝트에 붙어 firestore.rules의 허용/거부를 확인한다. 실행: npm run test:rules
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, limit, collectionGroup,
  serverTimestamp, terminate, writeBatch, increment,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config.js';
import { generateKey } from '../src/key.js';

const db = getFirestore(initializeApp(firebaseConfig));
const key = generateKey();
const who = { name: '테스트', company: '테스트사' };
const tasksCol = () => collection(db, 'rooms', key, 'tasks');
const base = () => ({
  kind: 'request', title: '규칙 테스트', memo: '', start: '2026-09-14', end: '2026-09-14', time: '',
  toCompany: 'A사', assignee: '', fromName: who.name, fromCompany: who.company,
  status: 'open', doneAt: null, doneBy: '', attachmentCount: 0, commentCount: 0,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: who.name,
});
const touch = () => ({ updatedAt: serverTimestamp(), updatedBy: who.name });
const denied = (p) => assert.rejects(p, (e) => /permission-denied|PERMISSION_DENIED/i.test(`${e.code} ${e.message}`));
const created = [];

after(async () => {
  for (const ref of created) await deleteDoc(ref).catch(() => {});
  await terminate(db);
});

test('room: create allowed with a valid key; short key, extra field, empty name, delete denied', async () => {
  await setDoc(doc(db, 'rooms', key), { name: '규칙 테스트', createdAt: serverTimestamp() });
  assert.equal((await getDoc(doc(db, 'rooms', key))).data().name, '규칙 테스트');
  await denied(setDoc(doc(db, 'rooms', 'shortkey'), { name: 'x', createdAt: serverTimestamp() }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: 'x', createdAt: serverTimestamp(), extra: 1 }));
  await denied(setDoc(doc(db, 'rooms', generateKey()), { name: '', createdAt: serverTimestamp() }));
  await denied(deleteDoc(doc(db, 'rooms', key)));
});

test('task: request/event create, 120-char title, time, complete/reopen allowed', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  const ref2 = await addDoc(tasksCol(), { ...base(), title: '가'.repeat(120), time: '09:30' });
  created.push(ref2);
  const ev = await addDoc(tasksCol(), { ...base(), kind: 'event', toCompany: '', time: '14:00', memo: '가'.repeat(5000) });
  created.push(ev);
  await updateDoc(ref, { status: 'done', doneAt: serverTimestamp(), doneBy: who.name, ...touch() });
  assert.equal((await getDoc(ref)).data().status, 'done');
  await updateDoc(ref, { status: 'open', doneAt: null, doneBy: '', ...touch() });
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
  await denied(addDoc(tasksCol(), { ...base(), status: 'done' }));
  await denied(addDoc(tasksCol(), { ...base(), kind: 'note' }));
  await denied(addDoc(tasksCol(), { ...base(), toCompany: '' }));
  await denied(addDoc(tasksCol(), { ...base(), time: '25:00' }));
  await denied(addDoc(tasksCol(), { ...base(), memo: '가'.repeat(5001) }));
  await denied(addDoc(tasksCol(), { ...base(), attachmentCount: 11 }));
  await denied(addDoc(collection(db, 'rooms', 'shortkey', 'tasks'), base()));
});

test('task: update cannot change createdAt; reading a random room is allowed but empty', async () => {
  const ref = await addDoc(tasksCol(), base());
  created.push(ref);
  await denied(updateDoc(ref, { createdAt: new Date(), ...touch() }));
  const other = await getDoc(doc(db, 'rooms', generateKey()));
  assert.equal(other.exists(), false);
});

test('secrecy: listing the rooms collection is denied (room IDs are the secret keys)', async () => {
  await denied(getDocs(collection(db, 'rooms')));
  await denied(getDocs(query(collection(db, 'rooms'), limit(5))));
});

test('attachments and comments: valid writes allowed; bad url, oversize, bad encoding, update, bad counts, empty/oversize comment, extra field denied; batch delete works', async () => {
  const taskRef = await addDoc(tasksCol(), base());
  created.push(taskRef);
  const atts = collection(db, 'rooms', key, 'tasks', taskRef.id, 'attachments');
  const meta = () => ({ name: '촬영구성안', uploadedBy: who.name, createdAt: serverTimestamp() });

  const b1 = writeBatch(db);
  const linkRef = doc(atts);
  b1.set(linkRef, { kind: 'link', url: 'https://youtu.be/dQw4w9WgXcQ', ...meta() });
  b1.update(taskRef, { attachmentCount: increment(1), ...touch() });
  await b1.commit();
  assert.equal((await getDoc(taskRef)).data().attachmentCount, 1);

  const b2 = writeBatch(db);
  const fileRef = doc(atts);
  b2.set(fileRef, { kind: 'file', type: 'text/html', size: 1234, storedSize: 300, encoding: 'gzip', ...meta() });
  b2.set(doc(atts, fileRef.id, 'blob', 'data'), { data: 'QUJD'.repeat(75) });
  b2.update(taskRef, { attachmentCount: increment(1), ...touch() });
  await b2.commit();
  assert.equal((await getDocs(atts)).size, 2);
  assert.equal((await getDoc(doc(atts, fileRef.id, 'blob', 'data'))).data().data.length, 300);

  await denied(setDoc(doc(atts), { kind: 'link', url: 'javascript:alert(1)', ...meta() }));
  await denied(setDoc(doc(atts), { kind: 'file', type: 'text/html', size: 1, storedSize: 716801, encoding: 'gzip', ...meta() }));
  await denied(setDoc(doc(atts), { kind: 'file', type: 'text/html', size: 1, storedSize: 1, encoding: 'zip', ...meta() }));
  await denied(setDoc(doc(atts), { kind: 'file', type: 'text/html', size: 1, storedSize: 1, encoding: 'gzip', data: 'x', ...meta() }));
  await denied(setDoc(doc(atts, 'nofile', 'blob', 'data'), { data: 'x'.repeat(960001) }));
  await denied(setDoc(doc(atts, 'nofile', 'blob', 'other'), { data: 'x' }));
  await denied(updateDoc(linkRef, { name: '바꿈' }));
  await denied(updateDoc(taskRef, { attachmentCount: 11, ...touch() }));
  await denied(setDoc(doc(atts, 'nofile', 'blob', 'data'), { data: '' }));
  await denied(getDocs(collectionGroup(db, 'attachments')));
  await denied(getDocs(collectionGroup(db, 'blob')));
  // 카운터 상한은 increment 경로에서도 걸려야 한다: 10에서 +1
  await updateDoc(taskRef, { attachmentCount: 10, ...touch() });
  const bx = writeBatch(db);
  bx.set(doc(atts), { kind: 'link', url: 'https://example.com/x', ...meta() });
  bx.update(taskRef, { attachmentCount: increment(1), ...touch() });
  await denied(bx.commit());
  await updateDoc(taskRef, { attachmentCount: 2, ...touch() });

  const b3 = writeBatch(db);
  b3.delete(doc(atts, fileRef.id, 'blob', 'data'));
  b3.delete(fileRef);
  b3.delete(linkRef);
  b3.update(taskRef, { attachmentCount: increment(-2), ...touch() });
  await b3.commit();
  assert.equal((await getDocs(atts)).size, 0);
  assert.equal((await getDoc(taskRef)).data().attachmentCount, 0);

  // 댓글: 같은 항목에 이어서 확인한다(테스트용 room을 더 만들지 않으려고).
  const cmts = collection(db, 'rooms', key, 'tasks', taskRef.id, 'comments');
  const author = () => ({ authorName: who.name, authorCompany: who.company, createdAt: serverTimestamp() });

  const c1 = writeBatch(db);
  const commentRef = doc(cmts);
  c1.set(commentRef, { text: '확인했습니다.', ...author() });
  c1.update(taskRef, { commentCount: increment(1), ...touch() });
  await c1.commit();
  assert.equal((await getDocs(cmts)).size, 1);
  assert.equal((await getDoc(taskRef)).data().commentCount, 1);
  assert.equal((await getDoc(commentRef)).data().text, '확인했습니다.');

  await denied(setDoc(doc(cmts), { text: '', ...author() }));
  await denied(setDoc(doc(cmts), { text: '가'.repeat(2001), ...author() }));
  await denied(setDoc(doc(cmts), { text: '정상', hacked: true, ...author() }));
  await denied(setDoc(doc(cmts), { text: '정상', authorName: '', authorCompany: who.company, createdAt: serverTimestamp() }));
  await denied(setDoc(doc(cmts), { text: '정상', ...author(), createdAt: new Date() }));
  await denied(updateDoc(commentRef, { text: '바꿈' }));
  await denied(updateDoc(taskRef, { commentCount: -1, ...touch() }));

  const c2 = writeBatch(db);
  c2.delete(commentRef);
  c2.update(taskRef, { commentCount: increment(-1), ...touch() });
  await c2.commit();
  assert.equal((await getDocs(cmts)).size, 0);
  assert.equal((await getDoc(taskRef)).data().commentCount, 0);
});
