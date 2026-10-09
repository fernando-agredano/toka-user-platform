import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  IndexedChunk,
  IndexedDocument,
  ScoredChunk,
  VectorStore,
} from '../../application/ports/vector-store.port';
import type { KnowledgeChunk } from '../../domain/services/chunker';

interface ChunkPayload {
  docId: string;
  docTitle: string;
  section: string;
  chunkIndex: number;
  text: string;
  contentHash: string;
  docVersion: string;
  ingestedAt: string;
}

const SCROLL_PAGE = 256;

export class QdrantVectorStore implements VectorStore {
  constructor(
    private readonly client: QdrantClient,
    private readonly collection: string,
  ) {}

  async ensureCollection(dimensions: number): Promise<void> {
    const { collections } = await this.client.getCollections();
    if (collections.some(({ name }) => name === this.collection)) {
      const info = await this.client.getCollection(this.collection);
      const vectors = info.config.params.vectors;
      const size = vectors && 'size' in vectors ? vectors.size : undefined;
      if (size === dimensions) return;
      // A different embedding model produced the stored vectors; they are incomparable, so index from scratch.
      await this.client.deleteCollection(this.collection);
    }
    await this.client.createCollection(this.collection, { vectors: { size: dimensions, distance: 'Cosine' } });
    await this.client.createPayloadIndex(this.collection, { field_name: 'docId', field_schema: 'keyword', wait: true });
  }

  async count(): Promise<number> {
    return (await this.client.count(this.collection, { exact: true })).count;
  }

  async listDocuments(): Promise<Map<string, IndexedDocument>> {
    const documents = new Map<string, IndexedDocument>();
    let offset: string | number | undefined;
    do {
      const page = await this.client.scroll(this.collection, {
        limit: SCROLL_PAGE,
        offset,
        with_payload: ['docId', 'contentHash'],
        with_vector: false,
      });
      for (const point of page.points) {
        const { docId, contentHash } = point.payload as unknown as Pick<ChunkPayload, 'docId' | 'contentHash'>;
        const current = documents.get(docId);
        documents.set(docId, { contentHash, chunkCount: (current?.chunkCount ?? 0) + 1 });
      }
      offset = (page.next_page_offset as string | number | null | undefined) ?? undefined;
    } while (offset !== undefined);
    return documents;
  }

  async upsert(chunks: IndexedChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const ingestedAt = new Date().toISOString();
    await this.client.upsert(this.collection, {
      wait: true,
      points: chunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: {
          docId: chunk.docId,
          docTitle: chunk.docTitle,
          section: chunk.section,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          contentHash: chunk.contentHash,
          docVersion: chunk.docVersion,
          ingestedAt,
        } satisfies ChunkPayload,
      })),
    });
  }

  async deleteStale(docId: string, keepIds: string[]): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: { must: [{ key: 'docId', match: { value: docId } }], must_not: [{ has_id: keepIds }] },
    });
  }

  async deleteDocument(docId: string): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: { must: [{ key: 'docId', match: { value: docId } }] },
    });
  }

  async search(vector: number[], limit: number, minScore: number): Promise<ScoredChunk[]> {
    const { points } = await this.client.query(this.collection, {
      query: vector,
      limit,
      score_threshold: minScore,
      with_payload: true,
    });
    return points.map((hit) => {
      const payload = hit.payload as unknown as ChunkPayload;
      const chunk: KnowledgeChunk = {
        id: String(hit.id),
        docId: payload.docId,
        docTitle: payload.docTitle,
        section: payload.section,
        chunkIndex: payload.chunkIndex,
        text: payload.text,
        embedText: `${payload.docTitle} > ${payload.section}\n${payload.text}`,
        contentHash: payload.contentHash,
        docVersion: payload.docVersion,
      };
      return { chunk, score: hit.score };
    });
  }

  async isHealthy(): Promise<boolean> {
    await this.client.getCollections();
    return true;
  }
}
