export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConversationProps {
  id: string;
  userId: string;
  messages: ConversationMessage[];
}

const MAX_MESSAGES = 6;
const MAX_CHARS = 600;

const truncate = (text: string): string => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text);

/** Keeps only the last three exchanges, each message trimmed, so the history cost per request is bounded. */
export class Conversation {
  private constructor(private props: ConversationProps) {}

  static start(id: string, userId: string): Conversation {
    return new Conversation({ id, userId, messages: [] });
  }

  static restore(props: ConversationProps): Conversation {
    return new Conversation({ ...props, messages: [...props.messages] });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get history(): ConversationMessage[] {
    return [...this.props.messages];
  }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }

  recordTurn(question: string, answer: string): void {
    const messages = [
      ...this.props.messages,
      { role: 'user' as const, text: truncate(question) },
      { role: 'assistant' as const, text: truncate(answer) },
    ];
    this.props = { ...this.props, messages: messages.slice(-MAX_MESSAGES) };
  }

  toProps(): ConversationProps {
    return { ...this.props, messages: [...this.props.messages] };
  }
}
