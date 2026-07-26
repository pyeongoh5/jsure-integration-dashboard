import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8080),
  API_BASE_URL: z.string().url().default('http://localhost:8080'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(16),
  TOKEN_ENCRYPTION_KEY: z.string().length(64, 'openssl rand -hex 32 로 생성한 64자 hex'),
  X_CLIENT_ID: z.string().min(1),
  X_CLIENT_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1),
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
