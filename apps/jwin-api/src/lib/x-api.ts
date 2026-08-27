import { randomBytes, createHash } from 'crypto';
import { config } from '../config';

/**
 * X API v2 클라이언트 (종량제 pay-per-use 앱 기준)
 *
 * 비용 메모 (2026-04 개편 기준, G0 스파이크로 실측 확인할 것):
 *  - 포스트 작성: $0.015 / URL 포함 시 $0.20
 *  - 유저 읽기: $0.010, 포스트 읽기: $0.005
 *  - owned read(인증 유저 자신의 데이터): $0.001/리소스
 *  - DM 발송: $0.015
 *
 * 검증은 반드시 "유저 본인의 토큰"으로 수행한다 (owned read 단가 + 유저별 레이트리밋).
 */

const AUTH_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const API = 'https://api.x.com/2';

export const BRAND_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'dm.write',
  'media.write', // /media/upload/* 필수 — 없으면 소재 첨부 게시가 403
  'offline.access',
].join(' ');

export const USER_SCOPES = [
  'tweet.read', // 본인 타임라인(리트윗) 조회
  'users.read', // connection_status 포함 유저 조회
  'follows.read',
  'offline.access',
].join(' ');

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}

export class XApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `X API error ${status}`);
  }
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
  get isRateLimited() {
    return this.status === 429;
  }
}

// ── OAuth2 (Authorization Code + PKCE) ───────────────

export function generatePkce() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizeUrl(opts: {
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
}): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: config().X_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: opts.scopes,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const basic = Buffer.from(`${config().X_CLIENT_ID}:${config().X_CLIENT_SECRET}`).toString(
    'base64',
  );
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!res.ok || !json.access_token) throw new XApiError(res.status, json, 'token exchange failed');
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? '',
    expiresAt: new Date(Date.now() + (json.expires_in ?? 7200) * 1000),
    scopes: json.scope ?? '',
  };
}

export function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: config().X_CLIENT_ID,
    }),
  );
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config().X_CLIENT_ID,
    }),
  );
}

// ── 인증된 요청 ──────────────────────────────────────

async function xFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new XApiError(res.status, json);
  return json;
}

// ── 엔드포인트 래퍼 ──────────────────────────────────

/** 토큰 소유자 본인 정보 */
export function getMe(accessToken: string) {
  return xFetch<{ data: { id: string; username: string; name: string } }>(
    accessToken,
    '/users/me?user.fields=profile_image_url',
  );
}

/** 브랜드 계정으로 캠페인 포스트 게시. URL 포함이므로 $0.20/건. 미디어 첨부 가능 (F-2.3). */
export function createPost(brandAccessToken: string, text: string, mediaIds?: string[]) {
  const body: { text: string; media?: { media_ids: string[] } } = { text };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }
  return xFetch<{ data: { id: string; text: string } }>(brandAccessToken, '/tweets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── 미디어 업로드 (F-2.3) ────────────────────────────
// X API v2 chunked upload: initialize → append → finalize (→ 동영상은 status 폴링).
// 업로드 자체는 무과금, 포스트 과금($0.20)에 포함. 정확한 동작은 G0 스파이크로 실측.

const MEDIA_CHUNK_BYTES = 4 * 1024 * 1024; // 4MB

function mediaCategoryOf(contentType: string): 'tweet_image' | 'tweet_gif' | 'tweet_video' {
  if (contentType === 'image/gif') return 'tweet_gif';
  if (contentType.startsWith('video/')) return 'tweet_video';
  return 'tweet_image';
}

interface MediaProcessingInfo {
  state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
  check_after_secs?: number;
}

interface MediaUploadResponse {
  data?: { id: string; processing_info?: MediaProcessingInfo };
}

/**
 * PostTemplate.mediaUrl의 이미지/동영상을 내려받아 브랜드 토큰으로 X에 업로드하고
 * media_id를 반환한다. createPost의 mediaIds로 전달해 첨부.
 */
export async function uploadMediaFromUrl(
  brandAccessToken: string,
  mediaUrl: string,
): Promise<string> {
  const source = await fetch(mediaUrl);
  if (!source.ok) throw new XApiError(source.status, null, `media fetch failed: ${mediaUrl}`);
  const contentType = source.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = Buffer.from(await source.arrayBuffer());

  // initialize
  const initialized = await xFetch<MediaUploadResponse>(brandAccessToken, '/media/upload/initialize', {
    method: 'POST',
    body: JSON.stringify({
      media_type: contentType,
      total_bytes: bytes.byteLength,
      media_category: mediaCategoryOf(contentType),
    }),
  });
  const mediaId = initialized.data?.id;
  if (!mediaId) throw new XApiError(500, initialized, 'media initialize failed');

  // append (4MB 청크, multipart — Content-Type은 fetch가 boundary와 함께 설정)
  for (let offset = 0, segmentIndex = 0; offset < bytes.byteLength; offset += MEDIA_CHUNK_BYTES, segmentIndex++) {
    const chunk = bytes.subarray(offset, offset + MEDIA_CHUNK_BYTES);
    const form = new FormData();
    form.set('segment_index', String(segmentIndex));
    form.set('media', new Blob([Uint8Array.from(chunk)]));
    const appendRes = await fetch(`${API}/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${brandAccessToken}` },
      body: form,
    });
    if (!appendRes.ok) {
      throw new XApiError(appendRes.status, await appendRes.json().catch(() => null), 'media append failed');
    }
  }

  // finalize (+ 동영상 처리 대기)
  const finalized = await xFetch<MediaUploadResponse>(
    brandAccessToken,
    `/media/upload/${mediaId}/finalize`,
    { method: 'POST' },
  );
  let processing = finalized.data?.processing_info;
  while (processing && (processing.state === 'pending' || processing.state === 'in_progress')) {
    await new Promise((resolve) => setTimeout(resolve, (processing?.check_after_secs ?? 2) * 1000));
    const status = await xFetch<MediaUploadResponse>(
      brandAccessToken,
      `/media/upload?media_id=${mediaId}&command=STATUS`,
    );
    processing = status.data?.processing_info;
  }
  if (processing?.state === 'failed') {
    throw new XApiError(500, processing, 'media processing failed');
  }
  return mediaId;
}

/**
 * 팔로우 검증: 유저 토큰으로 브랜드 계정을 조회하면 connection_status에
 * 인증 유저 기준의 관계("following" 등)가 담긴다. 호출 1회로 판정.
 * (G0 스파이크 1번 항목 — pay-per-use에서 필드 제공 여부 실측)
 */
export async function checkFollows(
  userAccessToken: string,
  brandXUserId: string,
): Promise<boolean> {
  const res = await xFetch<{ data?: { connection_status?: string[] } }>(
    userAccessToken,
    `/users/${brandXUserId}?user.fields=connection_status`,
  );
  return res.data?.connection_status?.includes('following') ?? false;
}

/**
 * 리포스트 검증: 유저 본인의 최근 포스트(owned read)에서
 * 대상 포스트를 참조하는 retweeted 항목을 찾는다.
 * 당일 리포스트만 인정(D-1)이므로 최근 N건이면 충분.
 */
export async function checkReposted(
  userAccessToken: string,
  userXId: string,
  targetPostId: string,
  maxPages = 2,
): Promise<boolean> {
  let paginationToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      max_results: '100',
      'tweet.fields': 'referenced_tweets,created_at',
    });
    if (paginationToken) params.set('pagination_token', paginationToken);
    const res = await xFetch<{
      data?: { id: string; referenced_tweets?: { type: string; id: string }[] }[];
      meta?: { next_token?: string };
    }>(userAccessToken, `/users/${userXId}/tweets?${params.toString()}`);
    const found = res.data?.some((t) =>
      t.referenced_tweets?.some((r) => r.type === 'retweeted' && r.id === targetPostId),
    );
    if (found) return true;
    paginationToken = res.meta?.next_token;
    if (!paginationToken) return false;
  }
  return false;
}

/** 기프트코드 DM 발송 (브랜드 계정 → 당첨 유저). $0.015/건 (G0 스파이크 2번 항목) */
export function sendDm(brandAccessToken: string, recipientXUserId: string, text: string) {
  return xFetch<{ data?: { dm_conversation_id: string; dm_event_id: string } }>(
    brandAccessToken,
    `/dm_conversations/with/${recipientXUserId}/messages`,
    { method: 'POST', body: JSON.stringify({ text }) },
  );
}
