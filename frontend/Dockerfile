FROM node:22-alpine AS deps
WORKDIR /app

# Ensure Node resolves IPv4 first to avoid IPv6 lookup timeouts on Docker networks
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy identity package and frontend package manifests
COPY packages/identity/ ./packages/identity/
COPY frontend/package.json frontend/package-lock.json* frontend/.npmrc* ./frontend/

WORKDIR /app/frontend
RUN npm ci

# Step 2: Build the Next.js application
FROM node:22-alpine AS builder
WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"

COPY --from=deps /app/packages ./packages
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY packages/ ./packages/
COPY frontend/ ./frontend/

WORKDIR /app/frontend

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production

RUN npm run build

# Step 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app/frontend

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER root
RUN mkdir -p /var/log/inout && chown -R node:node /var/log/inout

COPY --from=builder --chown=node:node /app/packages /app/packages
COPY --from=builder --chown=node:node /app/frontend/public ./public
COPY --from=builder --chown=node:node /app/frontend/.next ./.next
COPY --from=builder --chown=node:node /app/frontend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/frontend/package.json ./package.json

USER node

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "-c", "npm start 2>&1 | tee -a /var/log/inout/web.log"]
