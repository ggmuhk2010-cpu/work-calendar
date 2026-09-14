import { isDateStr } from './calendar.js';

export const LIMITS = {
  title: 120, company: 40, person: 40, memo: 5000, roomName: 60,
  attachmentName: 200, url: 2000, fileStored: 716800, fileOriginal: 20971520, attachmentsPerTask: 10,
  comment: 2000,
};
export const KINDS = ['request', 'event'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function trimStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function checkLen(v, max, label, required) {
  if (required && !v) return `${label}을(를) 입력하세요.`;
  if (v.length > max) return `${label}은(는) ${max}자 이하로 입력하세요.`;
  return null;
}

export function validateTask(input = {}) {
  const kind = KINDS.includes(input.kind) ? input.kind : 'request';
  const v = {
    kind,
    title: trimStr(input.title),
    toCompany: trimStr(input.toCompany),
    assignee: trimStr(input.assignee),
    start: trimStr(input.start),
    end: trimStr(input.end),
    time: trimStr(input.time),
    memo: trimStr(input.memo),
  };
  const errors = {};
  const put = (field, msg) => { if (msg) errors[field] = msg; };
  put('title', checkLen(v.title, LIMITS.title, '제목', true));
  put('toCompany', checkLen(v.toCompany, LIMITS.company, kind === 'request' ? '담당 회사' : '관련 회사', kind === 'request'));
  put('assignee', checkLen(v.assignee, LIMITS.person, '담당자', false));
  put('memo', checkLen(v.memo, LIMITS.memo, '본문', false));
  if (!isDateStr(v.start)) errors.start = '시작일을 선택하세요.';
  if (!v.end) v.end = v.start;
  if (!errors.start) {
    if (!isDateStr(v.end)) errors.end = '마감일 형식이 올바르지 않습니다.';
    else if (v.end < v.start) errors.end = '마감일은 시작일 이후여야 합니다.';
  }
  if (v.time && !TIME_RE.test(v.time)) errors.time = '시간은 HH:MM 형식으로 입력하세요.';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateLink(input = {}) {
  const v = { name: trimStr(input.name), url: trimStr(input.url).replace(/^https?:\/\//i, (s) => s.toLowerCase()) };
  const errors = {};
  if (!/^https?:\/\/\S+$/i.test(v.url)) errors.url = 'http:// 또는 https://로 시작하는 주소를 입력하세요.';
  else if (v.url.length > LIMITS.url) errors.url = `주소는 ${LIMITS.url}자 이하여야 합니다.`;
  if (v.name.length > LIMITS.attachmentName) errors.name = `제목은 ${LIMITS.attachmentName}자 이하로 입력하세요.`;
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateComment(text) {
  const value = trimStr(text);
  if (!value) return { ok: false, error: '댓글을 입력하세요.', value };
  if (value.length > LIMITS.comment) return { ok: false, error: `댓글은 ${LIMITS.comment}자 이하로 입력하세요.`, value };
  return { ok: true, error: null, value };
}

export function validateIdentity(input = {}) {
  const v = { name: trimStr(input.name), company: trimStr(input.company) };
  const errors = {};
  const put = (field, msg) => { if (msg) errors[field] = msg; };
  put('name', checkLen(v.name, LIMITS.person, '이름', true));
  put('company', checkLen(v.company, LIMITS.company, '회사', true));
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateRoomName(input) {
  const value = trimStr(input);
  const error = checkLen(value, LIMITS.roomName, '캘린더 이름', true);
  return { ok: error === null, error, value };
}
