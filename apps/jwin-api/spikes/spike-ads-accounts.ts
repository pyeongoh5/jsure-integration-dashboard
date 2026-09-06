// 스파이크 8: Ads API 접근 확인 (GET https://ads-api.x.com/12/accounts)
//
// 앱이 이미 "Ads 프로젝트"에 연결돼 있어도, 실제로 Ads API 호출이 되는지는 이 호출로만 확정된다.
//  - 200 + 계정 목록  → 접근 가능. 응답의 id 가 accounts/:account_id 에 쓸 값이다.
//  - 403 UNAUTHORIZED_CLIENT_APPLICATION → 앱에 Ads API 액세스가 아직 없다(별도 신청 필요).
//  - 401 → OAuth 1.0a 자격증명 문제(키·토큰 불일치, 토큰 재발급 필요).
//
// Ads API 는 OAuth 2.0 Bearer 가 아니라 **OAuth 1.0a 서명**을 요구한다.
// console.x.com 앱의 [Keys and tokens] 에서 4개를 발급받아 넣는다:
//   X_API_KEY / X_API_SECRET            (Consumer Keys)
//   X_ACCESS_TOKEN / X_ACCESS_SECRET    (Access Token and Secret — 앱 소유 계정 기준)
//
// 사용법:
//   cd apps/jwin-api
//   X_API_KEY=... X_API_SECRET=... X_ACCESS_TOKEN=... X_ACCESS_SECRET=... \
//     npx tsx spikes/spike-ads-accounts.ts
import { createHmac, randomBytes } from 'crypto';
import { requireEnv } from './env';

const API_KEY = requireEnv('X_API_KEY');
const API_SECRET = requireEnv('X_API_SECRET');
const ACCESS_TOKEN = requireEnv('X_ACCESS_TOKEN');
const ACCESS_SECRET = requireEnv('X_ACCESS_SECRET');

const URL_TO_CALL = process.env.ADS_URL ?? 'https://ads-api.x.com/12/accounts';

/** RFC 5849 percent-encoding — encodeURIComponent 가 남기는 !*'() 까지 인코딩한다. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function authorizationHeader(method: string, url: string): { header: string; baseString: string } {
  const parsed = new URL(url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  // 서명 대상은 oauth_* 와 쿼리 파라미터를 합쳐 키 기준으로 정렬한 것.
  const signatureParams: Record<string, string> = { ...oauthParams };
  parsed.searchParams.forEach((value, key) => {
    signatureParams[key] = value;
  });
  const paramString = Object.keys(signatureParams)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(signatureParams[key] as string)}`)
    .join('&');

  // 서명 base string 의 URL 은 쿼리를 제외한 부분만 쓴다.
  const baseUrl = `${parsed.origin}${parsed.pathname}`;
  const baseString = [
    method.toUpperCase(),
    encodeRfc3986(baseUrl),
    encodeRfc3986(paramString),
  ].join('&');

  const signingKey = `${encodeRfc3986(API_SECRET)}&${encodeRfc3986(ACCESS_SECRET)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  const header =
    'OAuth ' +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeRfc3986(key)}="${encodeRfc3986(value)}"`)
      .join(', ');

  return { header, baseString };
}

async function main() {
  const { header, baseString } = authorizationHeader('GET', URL_TO_CALL);
  const res = await fetch(URL_TO_CALL, { headers: { Authorization: header } });
  const text = await res.text();

  console.log('GET', URL_TO_CALL);
  console.log('status:', res.status);
  console.log(text);

  if (res.status === 401) {
    console.log('\n[디버그] 서명 base string:\n' + baseString);
    console.log('401 은 보통 자격증명 문제다 — 키 4개가 같은 앱 것인지, 토큰이 승인 이후 재발급된 것인지 확인한다.');
  }
  if (res.status === 403) {
    console.log('\n403 이면 앱에 Ads API 액세스가 없다 → https://docs.x.com/forms/ads-api-access 신청.');
  }
  if (res.ok) {
    console.log('\n접근 가능. 응답의 data[].id 가 accounts/:account_id 로 쓸 광고 계정 ID 다.');
  }
}

void main();
