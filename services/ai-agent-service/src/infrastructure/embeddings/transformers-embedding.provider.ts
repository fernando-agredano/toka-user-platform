import { Logger } from '@nestjs/common';
import type { EmbeddingProvider } from '../../application/ports/embedding.port';
import { estimateWordpieces } from '../../domain/services/text';
import type { TokenCounter } from '../../domain/services/chunker';

interface Extractor {
  (texts: string[], options: { pooling: 'mean'; normalize: true }): Promise<{ tolist(): number[][] }>;
  tokenizer: { encode(text: string): number[] };
}

interface TransformersModule {
  pipeline(task: 'feature-extraction', model: string, options?: { dtype?: string }): Promise<Extractor>;
  env: { cacheDir: string };
}

/**
 * Runs the embedding model locally (cost $0). The model downloads on first use into `cacheDir`, so the
 * pipeline is created lazily and shared: the service starts listening before the model is loaded.
 */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(TransformersEmbeddingProvider.name);
  private extractor?: Promise<Extractor>;

  constructor(
    readonly model: string,
    readonly dimensions: number,
    private readonly cacheDir: string,
    /** Weight precision ("fp32", "q8"...). Quantised weights are ~4x smaller at a small cost in accuracy. */
    private readonly dtype?: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const extractor = await this.load();
    const vectors = (await extractor(texts, { pooling: 'mean', normalize: true })).tolist();
    if (vectors.some((vector) => vector.length !== this.dimensions)) {
      throw new Error(`Model ${this.model} returned vectors that do not have ${this.dimensions} dimensions`);
    }
    return vectors;
  }

  async tokenCounter(): Promise<TokenCounter> {
    const { tokenizer } = await this.load();
    return (text) => {
      try {
        return tokenizer.encode(text).length;
      } catch {
        return estimateWordpieces(text);
      }
    };
  }

  private load(): Promise<Extractor> {
    this.extractor ??= this.createPipeline().catch((error) => {
      this.extractor = undefined; // allow a retry after a failed download
      throw error;
    });
    return this.extractor;
  }

  private async createPipeline(): Promise<Extractor> {
    const startedAt = performance.now();
    const transformers = (await import('@huggingface/transformers')) as unknown as TransformersModule;
    transformers.env.cacheDir = this.cacheDir;
    const extractor = await transformers.pipeline('feature-extraction', this.model, this.dtype ? { dtype: this.dtype } : undefined);
    this.logger.log(`Embedding model ${this.model}${this.dtype ? ` (${this.dtype})` : ''} ready in ${Math.round(performance.now() - startedAt)}ms`);
    return extractor;
  }
}
