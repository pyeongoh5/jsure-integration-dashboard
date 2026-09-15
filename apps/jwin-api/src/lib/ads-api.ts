import { createHash, createHmac, randomBytes } from 'crypto';
import { config } from '../config';
import { XApiError } from './x-api';

/**
 * X Ads API — 캐러셀 카드 생성 (docs/jwin/CAROUSEL_CARD.md).
 *
 * 2026-09-15 실측으로 확정된 것:
 *  - 카드는 SWIPEABLE_MEDIA(2~6장) + DETAILS 1개 조합만 통과한다.
 *    DETAILS 를 여러 개 넣으면 400 INVALID_CARD_COMPONENTS_COMBINATION —
 *    슬라이드별 목적지는 API 로 불가, 전 슬라이드 공통 목적지다.
 *  - POST /2/tweets 의 card_uri 는 "card://" 접두사를 뗀 숫자 id 여야 한다.
 *  - 미디어는 v1.1 media/upload → media_library 등록을 거쳐야 media_key 를 카드에 쓸 수 있다.
 *
 * 인증은 자사 광고 계정의 OAuth 1.0a 서명 — 브랜드 연동(OAuth 2.0 PKCE)과 다른 축이다.
 */

const ADS_API = 'https://ads-api.x.com/12';
const UPLOAD_API = 'https://upload.twitter.com/1.1/media/upload.json';

interface AdsCredentials {
  accountId: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function adsCredentials(): AdsCredentials {
  const { ADS_ACCOUNT_ID, X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = config();
  if (!ADS_ACCOUNT_ID || !X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error(
      '캐러셀 카드 게시에 필요한 Ads API 자격증명이 없습니다 (ADS_ACCOUNT_ID, X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)',
    );
  }
  return {
    accountId: ADS_ACCOUNT_ID,
    apiKey: X_API_KEY,
    apiSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  };
}

/** RFC 5849 percent-encoding — encodeURIComponent 가 남기는 !*'() 까지 인코딩한다. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * OAuth 1.0a Authorization 헤더.
 * 서명 대상은 oauth_* + URL 쿼리 파라미터뿐이다 — multipart·JSON 바디는 서명에서
 * 제외되므로, 서명돼야 하는 값은 쿼리 스트링에 싣는다.
 */
export function oauth1Header(credentials: Omit<AdsCredentials, 'accountId'>, method: string, url: string): string {
  const parsed = new URL(url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  };

  const signatureParams: Record<string, string> = { ...oauthParams };
  parsed.searchParams.forEach((value, key) => {
    signatureParams[key] = value;
  });
  const paramString = Object.keys(signatureParams)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(signatureParams[key] as string)}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeRfc3986(`${parsed.origin}${parsed.pathname}`),
    encodeRfc3986(paramString),
  ].join('&');

  const signingKey = `${encodeRfc3986(credentials.apiSecret)}&${encodeRfc3986(credentials.accessSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  return (
    'OAuth ' +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeRfc3986(key)}="${encodeRfc3986(value)}"`)
      .join(', ')
  );
}

/**
 * 카드 구성의 지문. PostTemplate.cardFingerprint 와 비교해 슬라이드·헤드라인·목적지가
 * 그대로면 만들어 둔 카드를 재사용한다 (매일 게시마다 재생성 방지).
 */
export function carouselFingerprint(input: {
  mediaUrls: string[];
  title: string;
  destinationUrl: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify([input.mediaUrls, input.title, input.destinationUrl]))
    .digest('hex');
}

/** R2 공개 URL 의 이미지를 광고 계정 미디어 라이브러리에 올리고 media_key 를 반환. */
async function uploadToMediaLibrary(credentials: AdsCredentials, imageUrl: string): Promise<string> {
  const source = await fetch(imageUrl);
  if (!source.ok) {
    throw new XApiError(source.status, null, `card media fetch failed: ${imageUrl}`);
  }
  const bytes = await source.arrayBuffer();
  const contentType = source.headers.get('content-type') ?? 'image/png';

  const uploadUrl = `${UPLOAD_API}?media_category=TWEET_IMAGE`;
  const form = new FormData();
  form.append('media', new Blob([new Uint8Array(bytes)], { type: contentType }));
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: oauth1Header(credentials, 'POST', uploadUrl) },
    body: form,
  });
  const uploadedBody = (await uploaded.json().catch(() => null)) as { media_key?: string } | null;
  if (!uploaded.ok || !uploadedBody?.media_key) {
    throw new XApiError(uploaded.status, uploadedBody, 'card media upload failed');
  }

  const libraryUrl = `${ADS_API}/accounts/${credentials.accountId}/media_library?media_key=${uploadedBody.media_key}`;
  const registered = await fetch(libraryUrl, {
    method: 'POST',
    headers: { Authorization: oauth1Header(credentials, 'POST', libraryUrl) },
  });
  if (!registered.ok) {
    throw new XApiError(
      registered.status,
      await registered.json().catch(() => null),
      'media_library register failed',
    );
  }
  return uploadedBody.media_key;
}

/**
 * 캐러셀 카드를 만들고 트윗에 붙일 카드 id(숫자)를 반환한다.
 * 호출 전 mediaUrls 가 2~6장인지 확인할 것 — 1장은 카드가 성립하지 않는다.
 */
export async function buildCarouselCard(input: {
  name: string;
  mediaUrls: string[];
  title: string;
  destinationUrl: string;
}): Promise<string> {
  const credentials = adsCredentials();

  const mediaKeys: string[] = [];
  for (const mediaUrl of input.mediaUrls) {
    mediaKeys.push(await uploadToMediaLibrary(credentials, mediaUrl));
  }

  const cardsUrl = `${ADS_API}/accounts/${credentials.accountId}/cards`;
  const created = await fetch(cardsUrl, {
    method: 'POST',
    headers: {
      Authorization: oauth1Header(credentials, 'POST', cardsUrl),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      components: [
        { type: 'SWIPEABLE_MEDIA', media_keys: mediaKeys },
        {
          type: 'DETAILS',
          title: input.title,
          destination: { type: 'WEBSITE', url: input.destinationUrl },
        },
      ],
    }),
  });
  const createdBody = (await created.json().catch(() => null)) as {
    data?: { card_uri?: string };
  } | null;
  const cardUri = createdBody?.data?.card_uri;
  if (!created.ok || !cardUri) {
    throw new XApiError(created.status, createdBody, 'carousel card create failed');
  }
  // POST /2/tweets 는 "card://" 접두사가 붙어 있으면 400 을 낸다 (2026-09-15 실측)
  return cardUri.replace(/^card:\/\//, '');
}
