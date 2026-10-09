import type { TokenCounter } from '../../domain/services/chunker';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  /** Embeds texts into L2-normalised vectors (cosine similarity is then a dot product). */
  embed(texts: string[]): Promise<number[][]>;
  /** Counts tokens the way the embedding model does, which decides where its input is truncated. */
  tokenCounter(): Promise<TokenCounter>;
}
