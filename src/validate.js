import { isDateStr } from './calendar.js';

export const LIMITS = { title: 120, company: 40, person: 40, memo: 2000, roomName: 60 };

function trimStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function checkLen(v, max, label, required) {
  if (required && !v) return `${label}을(를) 입력하세요.`;
  if (v.length > max) return `${label}은(는) ${max}자 이하로 입력하세요.`;
  return null;
}

export function validateTask(input = {}) {
  const v = {
    title: trimStr(input.title),
    toCompany: trimStr(input.toCompany),
    assignee: trimStr(input.assignee),
    start: trimStr(input.start),
    end: trimStr(input.end),
    memo: trimStr(input.memo),
  };
  const errors = {};
  const put = (field, msg) => { if (msg) errors[field] = msg; };
  put('title', checkLen(v.title, LIMITS.title, '제목', true));
  put('toCompany', checkLen(v.toCompany, LIMITS.company, '담당 회사', true));
  put('assignee', checkLen(v.assignee, LIMITS.person, '담당자', false));
  put('memo', checkLen(v.memo, LIMITS.memo, '메모', false));
  if (!isDateStr(v.start)) errors.start = '시작일을 선택하세요.';
  if (!v.end) v.end = v.start;
  if (!errors.start) {
    if (!isDateStr(v.end)) errors.end = '마감일 형식이 올바르지 않습니다.';
    else if (v.end < v.start) errors.end = '마감일은 시작일 이후여야 합니다.';
  }
  return { ok: Object.keys(errors).length === 0, errors, value: v };
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
