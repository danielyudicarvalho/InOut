# Step 1: Dependencies and static web export
FROM node:22-alpine AS builder
WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV CI=1

# Copy workspace packages and mobile package manifests
COPY packages/ ./packages/
COPY mobile/package.json mobile/package-lock.json* mobile/.npmrc* ./mobile/

WORKDIR /app/mobile
RUN npm ci

# Copy mobile source
COPY mobile/ ./

ARG EXPO_PUBLIC_AUTH_ISSUER=http://localhost:8080
ARG EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
ENV EXPO_PUBLIC_AUTH_ISSUER=$EXPO_PUBLIC_AUTH_ISSUER
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL

RUN npx expo export -p web --dev

# Step 2: Production web runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g serve && mkdir -p /var/log/inout && chown -R node:node /var/log/inout

COPY --from=builder /app/mobile/dist ./dist

USER node

EXPOSE 8081

ENTRYPOINT ["/bin/sh", "-c", "serve -s dist -l 8081 2>&1 | tee -a /var/log/inout/mobile.log"]
