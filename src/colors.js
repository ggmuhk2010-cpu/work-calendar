// 회사 이름 → 파스텔 배경 + 진한 글자색. 저장하지 않고 이름 해시로 매번 계산한다.
export const PALETTE = [
  { bg: 'rgba(0, 122, 255, 0.14)', fg: '#0060D0' },   // Blue
  { bg: 'rgba(52, 199, 89, 0.16)', fg: '#1F8F3E' },   // Green
  { bg: 'rgba(255, 149, 0, 0.16)', fg: '#B86A00' },   // Orange
  { bg: 'rgba(175, 82, 222, 0.14)', fg: '#8A3BB5' },  // Purple
  { bg: 'rgba(255, 45, 85, 0.14)', fg: '#C8213F' },   // Pink
  { bg: 'rgba(48, 176, 199, 0.16)', fg: '#1E8A9E' },  // Teal
  { bg: 'rgba(88, 86, 214, 0.14)', fg: '#4341A8' },   // Indigo
  { bg: 'rgba(255, 204, 0, 0.22)', fg: '#8A6D00' },   // Yellow
];

function hashString(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h;
}

export function companyColor(name) {
  return PALETTE[hashString(String(name ?? '').trim()) % PALETTE.length];
}
