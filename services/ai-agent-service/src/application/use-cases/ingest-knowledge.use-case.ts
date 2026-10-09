import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type RawDocument, chunkDocument } from '../../domain/services/chunker';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../ports/embedding.port';
import { KNOWLEDGE_SOURCE, type KnowledgeSource } from '../ports/knowledge-source.port';
import { VECTOR_STORE, type VectorStore } from '../ports/vector-store.port';
import { KnowledgeState } from '../services/knowledge-state';

export interface IngestSummary {
  documents: number;
  chunks: number;
  reindexed: string[];
  skipped: string[];
  removed: string[];
  kbVersion: string;
  durationMs: number;
}

const EMBED_BATCH_SIZE = 16;

/** Changing any document changes the version, which invalidates every cached answer without a flush. */
export const computeKbVersion = (documents: RawDocument[]): string =>
  createHash('sha256')
    .update(
      documents
        .map((doc) => `${doc.docId}:${doc.contentHash}`)
        .sort()
        .join('|'),
    )
    .digest('hex')
    .slice(0, 12);

@Injectable()
export class IngestKnowledgeUseCase {
  private readonly logger = new Logger(IngestKnowledgeUseCase.name);
  private running?: Promise<IngestSummary>;

  constructor(
    @Inject(KNOWLEDGE_SOURCE) private readonly source: KnowledgeSource,
    @Inject(EMBEDDING_PROVIDER) private readonly embedding: EmbeddingProvider,
    @Inject(VECTOR_STORE) private readonly store: VectorStore,
    private readonly state: KnowledgeState,
  ) {}

  /** Incremental by default: only documents whose hash or chunk count changed are embedded again. Concurrent calls share one run. */
  execute(options: { force?: boolean } = {}): Promise<IngestSummary> {
    this.running ??= this.run(options.force ?? false).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(force: boolean): Promise<IngestSummary> {
    const startedAt = performance.now();
    this.state.status = 'indexing';
    try {
      const documents = await this.source.load();
      this.state.kbVersion = computeKbVersion(documents);
      await this.store.ensureCollection(this.embedding.dimensions);

      const countTokens = await this.embedding.tokenCounter();
      const indexed = await this.store.listDocuments();
      const summary: IngestSummary = {
        documents: documents.length,
        chunks: 0,
        reindexed: [],
        skipped: [],
        removed: [],
        kbVersion: this.state.kbVersion,
        durationMs: 0,
      };

      for (const doc of documents) {
        const chunks = chunkDocument(doc, countTokens);
        summary.chunks += chunks.length;
        const existing = indexed.get(doc.docId);
        // The chunk count also catches a previous run that crashed halfway through this document.
        if (!force && existing?.contentHash === doc.contentHash && existing.chunkCount === chunks.length) {
          summary.skipped.push(doc.docId);
          continue;
        }
        const vectors = await this.embedAll(chunks.map((chunk) => chunk.embedText));
        await this.store.upsert(chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] })));
        await this.store.deleteStale(
          doc.docId,
          chunks.map((chunk) => chunk.id),
        );
        summary.reindexed.push(doc.docId);
      }

      const currentIds = new Set(documents.map((doc) => doc.docId));
      for (const docId of indexed.keys()) {
        if (currentIds.has(docId)) continue;
        await this.store.deleteDocument(docId);
        summary.removed.push(docId);
      }

      summary.durationMs = Math.round(performance.now() - startedAt);
      this.state.status = 'ready';
      this.logger.log(
        `Knowledge base ready: ${summary.chunks} chunks, ${summary.reindexed.length} reindexed, ${summary.skipped.length} unchanged, ${summary.removed.length} removed`,
      );
      return summary;
    } catch (error) {
      this.state.status = 'failed';
      throw error;
    }
  }

  private async embedAll(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      vectors.push(...(await this.embedding.embed(texts.slice(start, start + EMBED_BATCH_SIZE))));
    }
    return vectors;
  }
}
