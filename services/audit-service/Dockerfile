# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
RUN npm run build -w packages/common -w services/audit-service
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3004
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=build --chown=node:node /app/services/audit-service/package.json ./services/audit-service/package.json
COPY --from=build --chown=node:node /app/services/audit-service/dist ./services/audit-service/dist
USER node
WORKDIR /app/services/audit-service
EXPOSE 3004
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3004/health || exit 1
CMD ["node", "dist/main.js"]
