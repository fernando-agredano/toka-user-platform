# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
RUN npm run build -w packages/common -w services/role-service
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3003 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=build --chown=node:node /app/services/role-service/package.json ./services/role-service/package.json
COPY --from=build --chown=node:node /app/services/role-service/dist ./services/role-service/dist
COPY --from=build --chown=node:node /app/services/role-service/prisma ./services/role-service/prisma
COPY --from=build --chown=node:node /app/services/role-service/generated ./services/role-service/generated
USER node
WORKDIR /app/services/role-service
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy && node dist/main.js"]
