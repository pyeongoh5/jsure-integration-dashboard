# J-WIN API — 기존 apps/api/Dockerfile 패턴을 따름
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
