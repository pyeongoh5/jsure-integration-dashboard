// 스파이크 9: 캐러셀 카드 생성 + 오가닉 트윗 렌더 확인 (CAROUSEL_CARD.md §3 미확정 2건)
//
// 확인하려는 것
//  1) multi-destination — DETAILS 컴포넌트를 슬라이드 수만큼 넣어 슬라이드별 URL 이 되는가.
//     안 되면(400) 단일 DETAILS 로 폴백해 카드 생성 자체는 확정한다.
//  2) card_uri 를 오가닉(비프로모션) 트윗에 붙였을 때 카드가 렌더되는가.
//     게시까지는 API 로 확인되지만 렌더 여부는 브라우저로 눈 확인이 필요하다.
//
// 흐름: 단색 PNG 2장 생성 → v1.1 media/upload → ads media_library 등록
//       → POST accounts/:id/cards → POST /2/tweets { card_uri }
//
// 사용법:
//   cd apps/jwin-api
//   npx tsx spikes/spike-ads-carousel.ts        (.env 의 X_API_KEY 등 4개 사용)
//   ADS_ACCOUNT_ID=... URL1=... URL2=... 로 오버라이드 가능
import { deflateSync } from 'zlib';
import { requireEnv } from './env';
import { oauth1Header, type OAuth1Credentials } from './oauth1';

const credentials: OAuth1Credentials = {
  apiKey: requireEnv('X_API_KEY'),
  apiSecret: requireEnv('X_API_SECRET'),
  accessToken: requireEnv('X_ACCESS_TOKEN'),
  accessSecret: requireEnv('X_ACCESS_SECRET'),
};

const ADS_ACCOUNT_ID = process.env.ADS_ACCOUNT_ID ?? '18ce55xapqv';
const URL1 = process.env.URL1 ?? 'https://jsure-instance.com/campaigns';
const URL2 = process.env.URL2 ?? 'https://jsure-instance.com/';
const ADS_BASE = `https://ads-api.x.com/12/accounts/${ADS_ACCOUNT_ID}`;

// ---- 단색 PNG 생성 (800x418, 의존성 없이) ----

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function makeSolidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: truecolor
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- API 호출 ----

async function uploadImage(png: Buffer, label: string): Promise<string> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json?media_category=TWEET_IMAGE';
  const form = new FormData();
  form.append('media', new Blob([new Uint8Array(png)], { type: 'image/png' }), `${label}.png`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauth1Header(credentials, 'POST', url) },
    body: form,
  });
  const json = (await res.json()) as { media_key?: string };
  console.log(`upload ${label}:`, res.status, JSON.stringify(json));
  if (!json.media_key) {
    throw new Error('media_key 없음 — media_category 지정 여부 확인');
  }
  return json.media_key;
}

async function addToMediaLibrary(mediaKey: string): Promise<void> {
  const url = `${ADS_BASE}/media_library?media_key=${mediaKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauth1Header(credentials, 'POST', url) },
  });
  console.log(`media_library ${mediaKey}:`, res.status, await res.text());
}

interface CardComponent {
  type: string;
  media_keys?: string[];
  title?: string;
  destination?: { type: string; url: string };
}

async function createCard(
  name: string,
  components: CardComponent[],
): Promise<{ status: number; cardUri?: string; body: string }> {
  const url = `${ADS_BASE}/cards`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: oauth1Header(credentials, 'POST', url),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, components }),
  });
  const body = await res.text();
  let cardUri: string | undefined;
  try {
    cardUri = (JSON.parse(body) as { data?: { card_uri?: string } }).data?.card_uri;
  } catch {
    // 본문이 JSON 이 아니면 status 로만 판정한다
  }
  return { status: res.status, cardUri, body };
}

async function postOrganicTweet(cardUri: string): Promise<void> {
  // 실측(2026-09-15): "card://<id>" 그대로 보내면 400 "card URI invalid".
  // 숫자 id 만 보내야 201 이 난다.
  const cardId = cardUri.replace(/^card:\/\//, '');
  const url = 'https://api.x.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: oauth1Header(credentials, 'POST', url),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: `[J-WIN spike] 캐러셀 오가닉 렌더 확인 ${new Date().toISOString()}`,
      card_uri: cardId,
    }),
  });
  const body = await res.text();
  console.log('tweet:', res.status, body);
  try {
    const tweetId = (JSON.parse(body) as { data?: { id?: string } }).data?.id;
    if (tweetId) {
      console.log(`\n게시물: https://x.com/i/status/${tweetId}`);
      console.log('→ 브라우저로 열어 캐러셀이 렌더되는지, 슬라이드별 링크가 맞는지 눈으로 확인 후 삭제할 것');
    }
  } catch {
    // 실패 응답은 위 로그로 충분하다
  }
}

async function main() {
  const mediaKey1 = await uploadImage(makeSolidPng(800, 418, [30, 100, 220]), 'slide-blue');
  const mediaKey2 = await uploadImage(makeSolidPng(800, 418, [220, 80, 30]), 'slide-orange');
  await addToMediaLibrary(mediaKey1);
  await addToMediaLibrary(mediaKey2);

  console.log('\n--- 시도 A: DETAILS 를 슬라이드 수만큼 (multi-destination) ---');
  const multi = await createCard('jwin-spike-carousel-multi', [
    { type: 'SWIPEABLE_MEDIA', media_keys: [mediaKey1, mediaKey2] },
    { type: 'DETAILS', title: '슬라이드 1', destination: { type: 'WEBSITE', url: URL1 } },
    { type: 'DETAILS', title: '슬라이드 2', destination: { type: 'WEBSITE', url: URL2 } },
  ]);
  console.log('cards(multi):', multi.status, multi.body);

  let cardUri = multi.cardUri;
  if (!cardUri) {
    console.log('\n--- 시도 B: 단일 DETAILS (전 슬라이드 공통 목적지) ---');
    const single = await createCard('jwin-spike-carousel-single', [
      { type: 'SWIPEABLE_MEDIA', media_keys: [mediaKey1, mediaKey2] },
      { type: 'DETAILS', title: 'J-WIN 캠페인', destination: { type: 'WEBSITE', url: URL1 } },
    ]);
    console.log('cards(single):', single.status, single.body);
    cardUri = single.cardUri;
  }

  if (!cardUri) {
    console.log('\n카드 생성 실패 — approval_status REJECTED 가 카드 생성까지 막는지 응답 코드로 판정할 것');
    process.exit(1);
  }

  console.log(`\ncard_uri: ${cardUri}`);
  console.log('\n--- 오가닉 트윗에 card_uri 첨부 ---');
  await postOrganicTweet(cardUri);
}

void main();
