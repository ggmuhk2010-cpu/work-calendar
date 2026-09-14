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
