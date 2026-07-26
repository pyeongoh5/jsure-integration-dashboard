import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8080),
  API_BASE_URL: z.string().url().default('http://localhost:8080'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3100'),
  /** 어드민 UI(@jsure/admin-web) origin — CORS 허용 대상 */
  ADMIN_WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
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
