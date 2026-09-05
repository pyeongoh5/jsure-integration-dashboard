import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { config } from './config';
import { oauthRoutes } from './routes/oauth';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import { startScheduler } from './services/scheduler';

/** 응모자 웹은 항상 허용하고, 그 밖은 CORS_ORIGIN 목록(쉼표 구분)에서 읽는다. */
function corsOrigins(): string[] {
  const configured = config()
    .CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([config().WEB_BASE_URL, ...configured])];
}

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cookie);
  await app.register(cors, {
    // 응모자 웹(쿠키 세션) + 어드민 웹(Bearer 토큰, D-10)
    origin: corsOrigins(),
    credentials: true,
  });
  // 코드 CSV 업로드용 text/plain 파서
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) =>
    done(null, body),
  );

  await app.register(publicRoutes);
  await app.register(oauthRoutes);
  await app.register(adminRoutes);

  startScheduler();

  await app.listen({ port: config().PORT, host: '0.0.0.0' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
