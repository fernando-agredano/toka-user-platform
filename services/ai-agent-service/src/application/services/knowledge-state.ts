import { Injectable } from '@nestjs/common';

export type KnowledgeStatus = 'pending' | 'indexing' | 'ready' | 'failed';

/** Shared view of the knowledge base: its content version (part of the cache key) and whether indexing finished. */
@Injectable()
export class KnowledgeState {
  kbVersion = 'unindexed';
  status: KnowledgeStatus = 'pending';
}
