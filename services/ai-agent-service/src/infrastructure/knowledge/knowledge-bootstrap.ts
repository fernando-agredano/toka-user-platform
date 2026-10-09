import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { IngestKnowledgeUseCase } from '../../application/use-cases/ingest-knowledge.use-case';

const RETRY_DELAY_MS = 15_000;
const MAX_ATTEMPTS = 5;

/**
 * Indexes the knowledge base in the background: an empty collection is filled, an existing one is
 * synchronised (only changed documents are embedded). The HTTP server is already accepting requests
 * meanwhile, and chat degrades to tools-only answers until retrieval is ready.
 */
@Injectable()
export class KnowledgeBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeBootstrap.name);

  constructor(private readonly ingest: IngestKnowledgeUseCase) {}

  onApplicationBootstrap(): void {
    void this.run(1);
  }

  private async run(attempt: number): Promise<void> {
    try {
      await this.ingest.execute();
    } catch (error) {
      this.logger.error(`Knowledge indexing failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${(error as Error).message}`);
      if (attempt < MAX_ATTEMPTS) setTimeout(() => void this.run(attempt + 1), RETRY_DELAY_MS).unref();
    }
  }
}
