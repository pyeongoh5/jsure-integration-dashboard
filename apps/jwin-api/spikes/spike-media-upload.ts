// 스파이크 5: 미디어 업로드 (v2 chunked upload) + 미디어 첨부 포스트 게시
// 사용법: BRAND_TOKEN=... MEDIA_URL=https://.../test.png npx tsx spikes/spike-media-upload.ts
// POST_TEXT를 주면 업로드한 미디어를 첨부해 실제 게시까지 수행 ($0.20 과금 주의)
const token = process.env.BRAND_TOKEN!;
const mediaUrl = process.env.MEDIA_URL!;
const postText = process.env.POST_TEXT;

const API = 'https://api.x.com/2';
const CHUNK_BYTES = 4 * 1024 * 1024;

async function main() {
  // 소재 다운로드
  const source = await fetch(mediaUrl);
  const contentType = source.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = Buffer.from(await source.arrayBuffer());
  console.log('media:', contentType, bytes.byteLength, 'bytes');

  // initialize
  const initializeRes = await fetch(`${API}/media/upload/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: contentType,
      total_bytes: bytes.byteLength,
      media_category: contentType.startsWith('video/') ? 'tweet_video' : 'tweet_image',
    }),
  });
  const initialized = (await initializeRes.json()) as { data?: { id: string } };
  console.log('initialize:', initializeRes.status, JSON.stringify(initialized));
  const mediaId = initialized.data?.id;
  if (!mediaId) return;

  // append (4MB 청크)
  for (let offset = 0, segmentIndex = 0; offset < bytes.byteLength; offset += CHUNK_BYTES, segmentIndex++) {
    const form = new FormData();
    form.set('segment_index', String(segmentIndex));
    form.set('media', new Blob([Uint8Array.from(bytes.subarray(offset, offset + CHUNK_BYTES))]));
    const appendRes = await fetch(`${API}/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    console.log(`append[${segmentIndex}]:`, appendRes.status);
  }

  // finalize
  const finalizeRes = await fetch(`${API}/media/upload/${mediaId}/finalize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('finalize:', finalizeRes.status, JSON.stringify(await finalizeRes.json(), null, 2));

  // 첨부 게시 (선택)
  if (postText) {
    const postRes = await fetch(`${API}/tweets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: postText, media: { media_ids: [mediaId] } }),
    });
    console.log('post:', postRes.status, JSON.stringify(await postRes.json(), null, 2));
  }

  console.log('\n판정: 업로드 자체 무과금 여부 + 첨부 포스트가 정상 게시되는지 콘솔에서 확인');
}
main();
