import { Connection, type Model, Schema } from 'mongoose';
import type { ConversationMessage } from '../../domain/entities/conversation';

export interface ConversationDocument {
  _id: string;
  userId: string;
  messages: ConversationMessage[];
  updatedAt: Date;
}

export function createConversationModel(connection: Connection, ttlSeconds: number): Model<ConversationDocument> {
  const schema = new Schema<ConversationDocument>(
    {
      _id: { type: String, required: true },
      userId: { type: String, required: true, index: true },
      messages: [{ _id: false, role: { type: String, enum: ['user', 'assistant'] }, text: String }],
      updatedAt: { type: Date, required: true },
    },
    { collection: 'conversations', versionKey: false },
  );
  schema.index({ updatedAt: 1 }, { expireAfterSeconds: ttlSeconds });
  return connection.model<ConversationDocument>('Conversation', schema);
}
