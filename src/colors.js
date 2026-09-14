// 회사 이름 → 파스텔 배경 + 진한 글자색. 저장하지 않고 이름 해시로 매번 계산한다.
export const PALETTE = [
  { bg: '#E3F2FD', fg: '#0D47A1' },
  { bg: '#E8F5E9', fg: '#1B5E20' },
  { bg: '#FFF3E0', fg: '#E65100' },
  { bg: '#F3E5F5', fg: '#4A148C' },
  { bg: '#FCE4EC', fg: '#880E4F' },
  { bg: '#E0F7FA', fg: '#006064' },
  { bg: '#FFFDE7', fg: '#F57F17' },
  { bg: '#EFEBE9', fg: '#3E2723' },
];

function hashString(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h;
}

export function companyColor(name) {
  return PALETTE[hashString(String(name ?? '').trim()) % PALETTE.length];
}
