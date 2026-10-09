import type { RawDocument } from '../../domain/services/chunker';

export const KNOWLEDGE_SOURCE = Symbol('KNOWLEDGE_SOURCE');

export interface KnowledgeSource {
  load(): Promise<RawDocument[]>;
}
