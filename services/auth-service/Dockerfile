# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
RUN npm run build -w packages/common -w services/auth-service
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl && mkdir /keys && chown node:node /keys
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    JWT_KEYS_DIR=/keys \
    PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=build --chown=node:node /app/services/auth-service/package.json ./services/auth-service/package.json
COPY --from=build --chown=node:node /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=build --chown=node:node /app/services/auth-service/prisma ./services/auth-service/prisma
COPY --from=build --chown=node:node /app/services/auth-service/generated ./services/auth-service/generated
USER node
WORKDIR /app/services/auth-service
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy && node dist/main.js"]
