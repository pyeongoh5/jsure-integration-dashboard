import { z } from 'zod';

/**
 * 베이스 URL은 항상 `${base}/경로` 로 이어 붙이므로 끝 슬래시를 제거한다.
 * 남겨두면 LP 링크가 `https://example.com//c/slug` 가 되는데, 그 URL은 이미 게시된
 * 포스트에 박혀 되돌릴 수 없다. 설정 실수를 여기서 흡수한다.
 */
const baseUrl = (fallback: string) =>
  z
    .string()
    .url()
    .default(fallback)
    .transform((value) => value.replace(/\/+$/, ''));

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8080),
  API_BASE_URL: baseUrl('http://localhost:8080'),
  WEB_BASE_URL: baseUrl('http://localhost:3100'),
  /**
   * CORS 허용 origin 목록 (쉼표 구분). 대시보드 @jsure/api 와 같은 이름·형식을 쓴다 —
   * 한 Railway 프로젝트에 두 서비스가 나란히 있어서 이름이 다르면 설정 실수가 난다.
   * WEB_BASE_URL(응모자 웹)은 항상 허용되므로 여기엔 어드민 UI origin 만 넣으면 된다.
   */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** 응모자 세션 쿠키 서명 키 (J-WIN 자체) */
  SESSION_SECRET: z.string().min(16),
  /**
   * 어드민 인증용 (D-10). 대시보드 @jsure/api 의 JWT_SECRET 과 반드시 같은 값이어야 한다.
   * 값이 다르면 어드민 API가 전부 401이 된다.
   */
  JWT_SECRET: z.string().min(16),
  TOKEN_ENCRYPTION_KEY: z.string().length(64, 'openssl rand -hex 32 로 생성한 64자 hex'),
  X_CLIENT_ID: z.string().min(1),
  X_CLIENT_SECRET: z.string().min(1),
  /**
   * 캐러셀 카드 게시용 Ads API 자격증명 (자사 광고 계정, OAuth 1.0a — 브랜드 연동의
   * OAuth 2.0 과 다른 인증 축이다). 전부 선택값 — 미설정이면 카드 소재 게시 시점에
   * 명시적 에러로 실패해 lastError 로 드러난다 (docs/jwin/CAROUSEL_CARD.md).
   */
  ADS_ACCOUNT_ID: z.string().optional(),
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_SECRET: z.string().optional(),
  SCHEDULER_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function config(): Config {
  if (!cached) {
    cached = schema.parse(process.env);
  }
  return cached;
}
