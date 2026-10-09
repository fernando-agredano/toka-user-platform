import type { KnowledgeChunk } from '../../domain/services/chunker';

export const VECTOR_STORE = Symbol('VECTOR_STORE');

export interface IndexedChunk extends KnowledgeChunk {
  vector: number[];
}

export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
}

export interface IndexedDocument {
  contentHash: string;
  chunkCount: number;
}

export interface VectorStore {
  /** Creates the collection, or recreates it when its vector size no longer matches the embedding model. */
  ensureCollection(dimensions: number): Promise<void>;
  count(): Promise<number>;
  listDocuments(): Promise<Map<string, IndexedDocument>>;
  upsert(chunks: IndexedChunk[]): Promise<void>;
  /** Removes the points of a document that are not in `keepIds` (chunks that no longer exist). */
  deleteStale(docId: string, keepIds: string[]): Promise<void>;
  deleteDocument(docId: string): Promise<void>;
  search(vector: number[], limit: number, minScore: number): Promise<ScoredChunk[]>;
  isHealthy(): Promise<boolean>;
}
