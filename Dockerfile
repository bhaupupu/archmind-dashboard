# syntax=docker/dockerfile:1

# Phase 1: Base build stage
FROM node:24-alpine AS base
WORKDIR /app
# Install npm (Node.js already has it, so just verifying)
RUN npm i -g npm@latest

# Phase 2: Dependencies
FROM base AS deps
COPY package.json package-lock.yaml* package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY services/temporal-workers/package.json ./services/temporal-workers/
COPY services/indexer-spike/package.json ./services/indexer-spike/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
COPY packages/agent-core/package.json ./packages/agent-core/
COPY packages/scm-github/package.json ./packages/scm-github/
COPY packages/scm-gitlab/package.json ./packages/scm-gitlab/
RUN npm ci

# Phase 3: Builder
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/services/temporal-workers/node_modules ./services/temporal-workers/node_modules
COPY --from=deps /app/services/indexer-spike/node_modules ./services/indexer-spike/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/agent-core/node_modules ./packages/agent-core/node_modules
COPY --from=deps /app/packages/scm-github/node_modules ./packages/scm-github/node_modules
COPY --from=deps /app/packages/scm-gitlab/node_modules ./packages/scm-gitlab/node_modules

# Build the monorepo
RUN npm run build

# Phase 4: Runner (API)
FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3001
CMD ["node", "apps/api/src/server.ts"]

# Phase 5: Runner (Temporal Workers)
FROM base AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app ./
CMD ["node", "services/temporal-workers/src/worker.ts"]
