import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Conversation } from '../../domain/entities/conversation';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository';
import type { ConversationDocument } from './conversation.model';
import { CONVERSATION_MODEL } from './mongo.module';

@Injectable()
export class MongoConversationRepository implements ConversationRepository {
  constructor(@Inject(CONVERSATION_MODEL) private readonly model: Model<ConversationDocument>) {}

  async find(id: string): Promise<Conversation | null> {
    const document = await this.model.findById(id).lean();
    return document ? Conversation.restore({ id: document._id, userId: document.userId, messages: document.messages }) : null;
  }

  async save(conversation: Conversation): Promise<void> {
    const { id, userId, messages } = conversation.toProps();
    await this.model.replaceOne({ _id: id }, { _id: id, userId, messages, updatedAt: new Date() }, { upsert: true });
  }
}
