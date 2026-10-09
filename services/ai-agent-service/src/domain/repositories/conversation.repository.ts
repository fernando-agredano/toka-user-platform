import type { Conversation } from '../entities/conversation';

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');

export interface ConversationRepository {
  find(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
