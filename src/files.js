// 파일 내용을 gzip 압축 + base64로 만들어 Firestore 문서(1 MiB 한도) 하나에 넣는다. 브라우저·Node 18+ 공통 API만 쓴다.
export function bytesToBase64(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function gzipBase64(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const gz = new Uint8Array(await new Response(stream).arrayBuffer());
  return { data: bytesToBase64(gz), storedSize: gz.length };
}

export async function gunzipBase64(data) {
  const stream = new Blob([base64ToBytes(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const EXT_TYPES = { html: 'text/html', htm: 'text/html', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown' };

export function guessType(name, type) {
  if (type) return type;
  const ext = String(name).toLowerCase().split('.').pop();
  return EXT_TYPES[ext] ?? 'application/octet-stream';
}

const MAX_ORIGINAL = 20971520; // 20MB
const MAX_STORED = 716800;     // 700KB — Firestore 문서 1 MiB 한도 안에서 base64 여유

/** File → Firestore에 넣을 첨부 페이로드. 한도 초과면 한국어 안내문으로 throw. */
export async function prepareFile(file) {
  if (file.size > MAX_ORIGINAL) throw new Error('20MB 이하 파일만 올릴 수 있습니다. 큰 파일은 링크로 첨부하세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { data, storedSize } = await gzipBase64(bytes);
  if (storedSize > MAX_STORED) throw new Error('압축 후 700KB를 넘는 파일입니다. 사진은 줄여서 올리거나, 큰 파일은 링크로 첨부하세요.');
  return { name: file.name, type: guessType(file.name, file.type), size: bytes.length, storedSize, encoding: 'gzip', data };
}

export async function decodeAttachment(att, base64) {
  return att.encoding === 'gzip' ? gunzipBase64(base64) : base64ToBytes(base64);
}
