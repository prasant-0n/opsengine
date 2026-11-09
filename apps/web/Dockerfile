FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Stage 1: Dependencies installation
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY services/identity-service/package.json ./services/identity-service/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Stage 2: Build the standalone application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api-contracts/node_modules ./packages/api-contracts/node_modules
COPY --from=deps /app/services/identity-service/node_modules ./services/identity-service/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Generate Prisma Client
RUN cd services/identity-service && npx prisma generate

# Build Next.js in production standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter @opsengine/web build

# Stage 3: Minimal Production Runner
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g prisma@5.22.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --create-home nextjs

# Copy prisma schema and migrations for runtime migration deployment
COPY --from=builder /app/services/identity-service/prisma ./prisma

# Copy Next.js standalone build and static assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Create startup script for migrations and application launch
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'if [ -n "$DATABASE_URL" ]; then' >> /app/entrypoint.sh && \
    echo '  echo "==> Running database migrations..."' >> /app/entrypoint.sh && \
    echo '  prisma migrate deploy --schema=./prisma/schema.prisma || true' >> /app/entrypoint.sh && \
    echo 'fi' >> /app/entrypoint.sh && \
    echo 'echo "==> Starting OpsEngine Next.js Server on port 3000..."' >> /app/entrypoint.sh && \
    echo 'exec node apps/web/server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
