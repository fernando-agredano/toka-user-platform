import { DEFAULT_AGENT_SETTINGS } from '../../../src/application/ports/agent-settings';
import { Retriever, buildSearchQuery, selectContext } from '../../../src/application/services/retriever';
import type { KnowledgeChunk } from '../../../src/domain/services/chunker';
import { FakeEmbedding, FakeVectorStore, InMemoryCache, testSettings } from '../support/fakes';

const rag = DEFAULT_AGENT_SETTINGS.rag;

const chunk = (docId: string, section: string, index: number, text = `${section} part ${index}.`): KnowledgeChunk => ({
  id: `${docId}-${index}`,
  docId,
  docTitle: docId,
  section,
  chunkIndex: index,
  text,
  embedText: text,
  contentHash: 'h',
  docVersion: '1',
});

describe('buildSearchQuery', () => {
  it('uses the message alone when it is long enough', () => {
    expect(buildSearchQuery('¿cuánto dura el bloqueo de la cuenta?', [{ role: 'user', text: 'otra' }])).toBe(
      '¿cuánto dura el bloqueo de la cuenta?',
    );
  });

  it('prepends the previous user question to a short follow-up', () => {
    const history = [
      { role: 'user' as const, text: 'política de contraseñas' },
      { role: 'assistant' as const, text: 'respuesta' },
    ];
    expect(buildSearchQuery('¿y para MANAGER?', history)).toBe('política de contraseñas ¿y para MANAGER?');
  });

  it('keeps a short message as is when there is no history', () => {
    expect(buildSearchQuery('hola', [])).toBe('hola');
  });
});

describe('selectContext', () => {
  it('keeps the best candidates up to topK', () => {
    const candidates = [0.5, 0.9, 0.7, 0.6, 0.4].map((score, index) => ({ chunk: chunk(`d${index}`, 'S', 0), score }));
    expect(selectContext(candidates, rag, 3).map(({ score }) => score)).toEqual([0.9, 0.7, 0.6]);
  });

  it('limits how many chunks of one section reach the prompt', () => {
    const candidates = [0, 2, 4, 6].map((index) => ({ chunk: chunk('d', 'Same', index), score: 0.9 - index / 100 }));
    expect(selectContext(candidates, rag)).toHaveLength(rag.maxPerSection);
  });

  it('merges consecutive chunks of a section and drops their overlap', () => {
    const first = chunk('d', 'S', 0, 'Uno dos tres. Cuatro cinco seis.');
    const second = chunk('d', 'S', 1, 'Cuatro cinco seis. Siete ocho nueve.');
    const [merged, ...rest] = selectContext(
      [
        { chunk: first, score: 0.6 },
        { chunk: second, score: 0.8 },
      ],
      rag,
    );
    expect(rest).toEqual([]);
    expect(merged.score).toBe(0.8);
    expect(merged.chunk.text.replace(/\s+/g, ' ')).toBe('Uno dos tres. Cuatro cinco seis. Siete ocho nueve.');
  });

  it('does not merge chunks from different sections or non-adjacent positions', () => {
    const selected = selectContext(
      [
        { chunk: chunk('d', 'A', 0), score: 0.9 },
        { chunk: chunk('d', 'B', 1), score: 0.8 },
        { chunk: chunk('d', 'B', 5), score: 0.7 },
      ],
      rag,
    );
    expect(selected).toHaveLength(3);
  });

  it('stops adding context once the token budget is spent, but always keeps one chunk', () => {
    const long = Array.from({ length: 300 }, () => 'palabra').join(' ');
    const candidates = [0.9, 0.8, 0.7].map((score, index) => ({ chunk: chunk(`d${index}`, 'S', 0, long), score }));
    expect(selectContext(candidates, { ...rag, maxContextTokens: 1000 })).toHaveLength(2);
    expect(selectContext(candidates, { ...rag, maxContextTokens: 10 })).toHaveLength(1);
  });
});

describe('Retriever', () => {
  async function build() {
    const embedding = new FakeEmbedding();
    const store = new FakeVectorStore();
    const cache = new InMemoryCache();
    const [vector] = await embedding.embed(['bloqueo de cuenta por intentos fallidos']);
    await store.upsert([{ ...chunk('d', 'Lockout', 0, 'bloqueo de cuenta por intentos fallidos'), vector }]);
    return { embedding, store, cache, retriever: new Retriever(embedding, store, cache, testSettings().rag) };
  }

  it('returns relevant chunks with their scores and stage timings', async () => {
    const { retriever } = await build();
    const result = await retriever.retrieve('intentos fallidos bloqueo cuenta');
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].score).toBeGreaterThan(0.25);
    expect(result.embedMs).toBeGreaterThanOrEqual(0);
  });

  it('embeds a repeated query only once', async () => {
    const { retriever, embedding } = await build();
    await retriever.retrieve('Intentos fallidos, bloqueo de cuenta');
    const afterFirst = embedding.embedCalls;
    await retriever.retrieve('intentos fallidos bloqueo de cuenta');
    expect(embedding.embedCalls).toBe(afterFirst);
  });

  it('still retrieves when the embedding cache is down', async () => {
    const { retriever, cache } = await build();
    cache.failing = true;
    expect((await retriever.retrieve('intentos fallidos bloqueo cuenta')).chunks).toHaveLength(1);
  });

  it('returns nothing for an unrelated query', async () => {
    const { retriever } = await build();
    expect((await retriever.retrieve('receta de paella valenciana')).chunks).toEqual([]);
  });
});
