// OAuth2 PKCE로 테스트용 access/refresh 토큰을 발급받는 로컬 스크립트.
// 사용법: X_CLIENT_ID=... X_CLIENT_SECRET=... npx tsx spikes/get-tokens.ts
// 출력된 URL을 브라우저에서 열고 승인하면 토큰이 콘솔에 출력된다.
import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';

import { requireEnv } from './env';

const CLIENT_ID = requireEnv('X_CLIENT_ID');
const CLIENT_SECRET = requireEnv('X_CLIENT_SECRET');
const REDIRECT = 'http://localhost:8787/callback';
// 승인 화면이 거부되면 SCOPES를 줄여 원인(앱 권한 부족)을 가려낼 수 있다.
// 예: SCOPES='tweet.read users.read follows.read offline.access' npx tsx spikes/get-tokens.ts
// media.write는 v2 미디어 업로드(/2/media/upload/*)에 필수 — 없으면 initialize가 403
const SCOPES =
  process.env.SCOPES ??
  'tweet.read tweet.write users.read follows.read dm.write media.write offline.access';

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(8).toString('base64url');

const authUrl =
  `https://x.com/i/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPES)}` +
  `&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

console.log('\n브라우저에서 열기:\n\n' + authUrl + '\n');

createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost:8787');
  const code = url.searchParams.get('code');
  if (url.pathname !== '/callback' || !code) {
    res.end('waiting...');
    return;
  }
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
      client_id: CLIENT_ID,
    }),
  });
  const tokens = await tokenRes.json();
  console.log('\n=== TOKENS ===\n', JSON.stringify(tokens, null, 2));
  res.end('done — check terminal');
  process.exit(0);
}).listen(8787);
