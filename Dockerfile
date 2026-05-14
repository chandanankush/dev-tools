# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g corepack && corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Upgrade Alpine packages (picks up busybox CVE-2025-60876 when a fix lands)
# and npm (fixes ip-address CVE-2026-42338 via npm 11.14.1+)
RUN apk upgrade --no-cache && npm install -g npm@latest

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
