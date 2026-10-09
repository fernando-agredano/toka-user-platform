import type { KnowledgeSource } from '../../../src/application/ports/knowledge-source.port';
import { KnowledgeState } from '../../../src/application/services/knowledge-state';
import { IngestKnowledgeUseCase, computeKbVersion } from '../../../src/application/use-cases/ingest-knowledge.use-case';
import type { RawDocument } from '../../../src/domain/services/chunker';
import { FakeEmbedding, FakeVectorStore } from '../support/fakes';

const doc = (docId: string, body: string): RawDocument => ({
  docId,
  title: docId,
  version: '1',
  content: `# ${docId}\n\n## Section\n${body}`,
  contentHash: `hash-${docId}-${body}`,
});

class MutableSource implements KnowledgeSource {
  documents: RawDocument[] = [];
  async load(): Promise<RawDocument[]> {
    return this.documents;
  }
}

function build() {
  const source = new MutableSource();
  const embedding = new FakeEmbedding();
  const store = new FakeVectorStore();
  const state = new KnowledgeState();
  return { source, embedding, store, state, ingest: new IngestKnowledgeUseCase(source, embedding, store, state) };
}

describe('IngestKnowledgeUseCase', () => {
  it('indexes every document into an empty collection and marks the knowledge base ready', async () => {
    const { source, store, state, ingest, embedding } = build();
    source.documents = [doc('a.md', 'alpha text'), doc('b.md', 'beta text')];

    const summary = await ingest.execute();

    expect(summary).toMatchObject({ documents: 2, chunks: 2, reindexed: ['a.md', 'b.md'], skipped: [], removed: [] });
    expect(store.dimensions).toBe(embedding.dimensions);
    expect(store.points.size).toBe(2);
    expect(state.status).toBe('ready');
    expect(state.kbVersion).toBe(summary.kbVersion);
  });

  it('skips unchanged documents and does not embed them again', async () => {
    const { source, ingest, embedding } = build();
    source.documents = [doc('a.md', 'alpha text')];
    await ingest.execute();
    const callsAfterFirst = embedding.embedCalls;

    const summary = await ingest.execute();

    expect(summary).toMatchObject({ reindexed: [], skipped: ['a.md'] });
    expect(embedding.embedCalls).toBe(callsAfterFirst);
  });

  it('re-embeds only the document that changed and changes the version', async () => {
    const { source, store, ingest } = build();
    source.documents = [doc('a.md', 'alpha text'), doc('b.md', 'beta text')];
    const first = await ingest.execute();

    source.documents = [doc('a.md', 'alpha text'), doc('b.md', 'beta text edited')];
    const second = await ingest.execute();

    expect(second).toMatchObject({ reindexed: ['b.md'], skipped: ['a.md'] });
    expect(second.kbVersion).not.toBe(first.kbVersion);
    expect([...store.points.values()].some((point) => point.text.includes('edited'))).toBe(true);
  });

  it('drops stale chunks of a document that got shorter', async () => {
    const { source, store, ingest } = build();
    source.documents = [{ ...doc('a.md', 'one'), content: '## One\nfirst part\n\n## Two\nsecond part', contentHash: 'v1' }];
    await ingest.execute();
    expect(store.points.size).toBe(2);

    source.documents = [{ ...doc('a.md', 'one'), content: '## One\nfirst part', contentHash: 'v2' }];
    await ingest.execute();
    expect(store.points.size).toBe(1);
  });

  it('removes documents that no longer exist in the source', async () => {
    const { source, store, ingest } = build();
    source.documents = [doc('a.md', 'alpha'), doc('b.md', 'beta')];
    await ingest.execute();

    source.documents = [doc('a.md', 'alpha')];
    const summary = await ingest.execute();

    expect(summary.removed).toEqual(['b.md']);
    expect([...store.points.values()].every((point) => point.docId === 'a.md')).toBe(true);
  });

  it('re-embeds a document whose index is incomplete even if its hash matches', async () => {
    const { source, store, ingest } = build();
    source.documents = [{ ...doc('a.md', 'x'), content: '## One\nfirst\n\n## Two\nsecond', contentHash: 'same' }];
    await ingest.execute();
    const [firstId] = [...store.points.keys()];
    store.points.delete(firstId);

    const summary = await ingest.execute();

    expect(summary.reindexed).toEqual(['a.md']);
    expect(store.points.size).toBe(2);
  });

  it('re-embeds everything when forced', async () => {
    const { source, ingest } = build();
    source.documents = [doc('a.md', 'alpha')];
    await ingest.execute();
    expect((await ingest.execute({ force: true })).reindexed).toEqual(['a.md']);
  });

  it('shares one run between concurrent callers', async () => {
    const { source, ingest, embedding } = build();
    source.documents = [doc('a.md', 'alpha')];
    const [first, second] = await Promise.all([ingest.execute(), ingest.execute()]);
    expect(first).toBe(second);
    expect(embedding.embedCalls).toBe(1);
  });

  it('marks the state failed and allows a later retry when indexing breaks', async () => {
    const { source, ingest, embedding, state } = build();
    source.documents = [doc('a.md', 'alpha')];
    embedding.failing = true;
    await expect(ingest.execute()).rejects.toThrow('embedding model unavailable');
    expect(state.status).toBe('failed');

    embedding.failing = false;
    await ingest.execute();
    expect(state.status).toBe('ready');
  });

  it('gives the same version regardless of document order', () => {
    const a = doc('a.md', 'alpha');
    const b = doc('b.md', 'beta');
    expect(computeKbVersion([a, b])).toBe(computeKbVersion([b, a]));
  });
});
