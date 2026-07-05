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

# Runtime: plain Node with no package manager. The standalone server runs on
# `node server.js` alone — npm/pnpm/corepack are build-time tools and only add
# CVEs (e.g. npm's bundled undici) to the runtime for zero benefit, so they are
# removed rather than kept "current". Not derived from `base` so corepack is
# never installed here in the first place.
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3050
ENV NEXT_TELEMETRY_DISABLED=1

# Patch OS packages (picks up busybox CVE-2025-60876 when a fix lands) and strip
# the package managers the base image ships — nothing at runtime invokes them.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3050

CMD ["node", "server.js"]
