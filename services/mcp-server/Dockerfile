# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
RUN npm run build -w packages/common -w services/mcp-server
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3006
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=build --chown=node:node /app/services/mcp-server/package.json ./services/mcp-server/package.json
COPY --from=build --chown=node:node /app/services/mcp-server/dist ./services/mcp-server/dist
# The same documents the assistant is grounded on are exposed as toka://docs/* resources.
COPY --from=build --chown=node:node /app/services/ai-agent-service/knowledge ./services/mcp-server/knowledge
USER node
WORKDIR /app/services/mcp-server
EXPOSE 3006
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3006/health || exit 1
CMD ["node", "dist/main.js"]
