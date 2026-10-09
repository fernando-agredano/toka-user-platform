import { join } from 'node:path';
import { loadAgentSettings, loadAiConfig, loadPricing } from '../../../src/infrastructure/config/ai-config';
import { FsKnowledgeSource } from '../../../src/infrastructure/knowledge/fs-knowledge.source';
import { GeminiProvider } from '../../../src/infrastructure/llm/gemini.provider';
import { createLlmChain } from '../../../src/infrastructure/llm/create-llm-chain';
import { MockProvider } from '../../../src/infrastructure/llm/mock.provider';
import { OllamaProvider } from '../../../src/infrastructure/llm/ollama.provider';

const requiredEnv = {
  MONGO_URI: 'mongodb://mongo:27017/ai',
  QDRANT_URL: 'http://qdrant:6333',
  USER_SERVICE_URL: 'http://user-service:3002',
  ROLE_SERVICE_URL: 'http://role-service:3003',
  AUDIT_SERVICE_URL: 'http://audit-service:3004',
};

describe('loadAiConfig', () => {
  it('applies the documented defaults', () => {
    const config = loadAiConfig(requiredEnv);
    expect(config).toMatchObject({
      port: 3005,
      qdrantCollection: 'knowledge_base',
      userRateLimitPerMinute: 5,
      llm: { provider: 'gemini', fallback: 'none', geminiModel: 'gemini-2.5-flash-lite', rpmLimit: 8 },
      embedding: { model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', dimensions: 384, dtype: 'q8' },
    });
    expect(config.knowledgeDir.endsWith('/knowledge')).toBe(true);
  });

  it('reads overrides from the environment', () => {
    const config = loadAiConfig({ ...requiredEnv, LLM_PROVIDER: 'OLLAMA', LLM_FALLBACK_PROVIDER: 'mock', LLM_RPM_LIMIT: '15', AI_RATE_LIMIT_PER_MINUTE: '9' });
    expect(config.llm).toMatchObject({ provider: 'ollama', fallback: 'mock', rpmLimit: 15 });
    expect(config.userRateLimitPerMinute).toBe(9);
  });

  it('rejects an unknown provider and missing required variables', () => {
    expect(() => loadAiConfig({ ...requiredEnv, LLM_PROVIDER: 'openai' })).toThrow('LLM_PROVIDER must be one of');
    expect(() => loadAiConfig({})).toThrow('Missing required environment variable');
  });
});

describe('loadAgentSettings', () => {
  it('uses the defaults and honours overrides', () => {
    expect(loadAgentSettings({}).rag).toMatchObject({ minScore: 0.35, topK: 4 });
    expect(loadAgentSettings({ RAG_MIN_SCORE: '0.6', RAG_TOP_K: '3', AI_DEADLINE_MS: '10000' })).toMatchObject({
      deadlineMs: 10_000,
      rag: { minScore: 0.6, topK: 3 },
    });
  });

  it('rejects a non-numeric score', () => {
    expect(() => loadAgentSettings({ RAG_MIN_SCORE: 'high' })).toThrow('RAG_MIN_SCORE must be a number');
  });
});

describe('loadPricing', () => {
  it('reads the bundled table', () => {
    expect(loadPricing({})['gemini-2.5-flash-lite']).toEqual({ input: 0.1, cachedInput: 0.025, output: 0.4 });
  });

  it('lets LLM_PRICING_JSON override it without a rebuild', () => {
    const override = JSON.stringify({ models: { custom: { input: 1, cachedInput: 0.5, output: 2 } } });
    expect(loadPricing({ LLM_PRICING_JSON: override })).toEqual({ custom: { input: 1, cachedInput: 0.5, output: 2 } });
  });

  it('rejects a table without models', () => {
    expect(() => loadPricing({ LLM_PRICING_JSON: '{}' })).toThrow('"models"');
  });
});

describe('createLlmChain', () => {
  const llm = (overrides: Partial<ReturnType<typeof loadAiConfig>['llm']> = {}) => ({ ...loadAiConfig(requiredEnv).llm, ...overrides });

  it('starts with the mock provider when there is no Gemini key', () => {
    const chain = createLlmChain(llm());
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBeInstanceOf(MockProvider);
  });

  it('uses Gemini when a key is present', () => {
    expect(createLlmChain(llm({ geminiApiKey: 'key' }))[0]).toBeInstanceOf(GeminiProvider);
  });

  it('appends the configured fallback and drops duplicates', () => {
    const chain = createLlmChain(llm({ geminiApiKey: 'key', fallback: 'ollama' }));
    expect(chain.map((provider) => provider.name)).toEqual(['gemini', 'ollama']);
    expect(chain[1]).toBeInstanceOf(OllamaProvider);
    expect(createLlmChain(llm({ provider: 'mock', fallback: 'mock' }))).toHaveLength(1);
    expect(createLlmChain(llm({ geminiApiKey: '', fallback: 'mock' }))).toHaveLength(1);
  });
});

describe('FsKnowledgeSource', () => {
  const source = new FsKnowledgeSource(join(__dirname, '../../../knowledge'));

  it('loads the four knowledge documents with title, version and a content hash', async () => {
    const documents = await source.load();
    expect(documents.map((doc) => doc.docId)).toEqual([
      '01-politica-roles-permisos.md',
      '02-politica-contrasenas-seguridad.md',
      '03-guia-uso-sistema.md',
      '04-faq-soporte.md',
    ]);
    expect(documents[0]).toMatchObject({ title: 'Política de roles y permisos', version: '1.3' });
    expect(documents.every((doc) => /^[0-9a-f]{64}$/.test(doc.contentHash))).toBe(true);
  });

  it('gives the same hash for the same content', async () => {
    const [first] = await source.load();
    const [again] = await source.load();
    expect(first.contentHash).toBe(again.contentHash);
  });
});
