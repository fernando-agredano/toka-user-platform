import { Global, Module } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { VECTOR_STORE } from '../../application/ports/vector-store.port';
import { KnowledgeState } from '../../application/services/knowledge-state';
import { AI_CONFIG, type AiConfig } from '../config/ai-config';
import { QdrantVectorStore } from '../vector/qdrant-vector.store';

/** Global so the health check, which lives in its own module, can see the vector store and the indexing state. */
@Global()
@Module({
  providers: [
    KnowledgeState,
    {
      provide: VECTOR_STORE,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) =>
        new QdrantVectorStore(new QdrantClient({ url: config.qdrantUrl }), config.qdrantCollection),
    },
  ],
  exports: [KnowledgeState, VECTOR_STORE],
})
export class KnowledgeModule {}
