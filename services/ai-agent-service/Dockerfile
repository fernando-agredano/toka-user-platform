# Build context is the repository root (see docker-compose.yml).
# Debian instead of Alpine: onnxruntime-node (local embeddings) ships glibc-only native binaries.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm ci
RUN npm run build -w packages/common -w services/ai-agent-service
# Bake the embedding model into the image so the first start needs no internet access.
ENV HF_CACHE_DIR=/app/.cache
RUN node -e "const { pipeline, env } = require('@huggingface/transformers'); env.cacheDir = process.env.HF_CACHE_DIR; pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { dtype: 'q8' }).then(() => console.log('embedding model cached'))"
RUN npm prune --omit=dev
# npm nests a dependency here when its version conflicts with the hoisted one (e.g. undici); the directory must exist for the COPY below.
RUN mkdir -p services/ai-agent-service/node_modules

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3005 \
    HF_CACHE_DIR=/app/.cache
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/ai-agent-service/node_modules ./services/ai-agent-service/node_modules
COPY --from=build --chown=node:node /app/.cache ./.cache
COPY --from=build --chown=node:node /app/packages/common/package.json ./packages/common/package.json
COPY --from=build --chown=node:node /app/packages/common/dist ./packages/common/dist
COPY --from=build --chown=node:node /app/services/ai-agent-service/package.json ./services/ai-agent-service/package.json
COPY --from=build --chown=node:node /app/services/ai-agent-service/dist ./services/ai-agent-service/dist
COPY --from=build --chown=node:node /app/services/ai-agent-service/config ./services/ai-agent-service/config
COPY --from=build --chown=node:node /app/services/ai-agent-service/knowledge ./services/ai-agent-service/knowledge
USER node
WORKDIR /app/services/ai-agent-service
EXPOSE 3005
# Debian slim has no wget/curl; node is already there.
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3005/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
