# J-WIN API — 기존 apps/api/Dockerfile 패턴을 따름
#
# Railway 설정은 이 리포가 아니라 서비스 UI 에 있다. Config-as-Code 가 폐기되면서
# 2026-08-28 이후 만든 서비스는 railway.json 을 쓸 수 없다(경로를 넣어도 저장되지 않는다).
#   Build  → Dockerfile Path : apps/jwin-api/Dockerfile
#   Build  → Root Directory  : 비움 (이 Dockerfile 은 레포 루트를 빌드 컨텍스트로 쓴다)
#   Deploy → Start Command   : 비움 (아래 CMD 가 마이그레이션까지 수행한다)
#   Deploy → Healthcheck     : /health   Replicas : 1
# 전체 값은 docs/jwin/DEPLOY.md §5-1 참조.
FROM node:20-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/jwin-api ./apps/jwin-api
RUN pnpm install --frozen-lockfile
RUN find . -name "*.tsbuildinfo" -delete && find packages -type d -name "dist" -exec rm -rf {} +
RUN pnpm turbo build --filter=@jsure/jwin-api
RUN pnpm --filter @jsure/jwin-db exec prisma generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/jwin-api/dist ./apps/jwin-api/dist
COPY --from=builder /app/apps/jwin-api/node_modules ./apps/jwin-api/node_modules
COPY --from=builder /app/apps/jwin-api/package.json ./apps/jwin-api/package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

WORKDIR /app/apps/jwin-api
EXPOSE 8080
CMD ["sh", "-c", "pnpm --filter @jsure/jwin-db exec prisma migrate deploy && node dist/index.js"]
