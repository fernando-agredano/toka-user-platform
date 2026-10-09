export type DomainErrorKind = 'validation' | 'not_found' | 'too_many_requests' | 'unavailable';

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly kind: DomainErrorKind,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidMessageError extends DomainError {
  constructor() {
    super('Message must contain readable text', 'AI_INVALID_MESSAGE', 'validation');
  }
}

export class ConversationNotFoundError extends DomainError {
  constructor() {
    super('Conversation not found', 'AI_CONVERSATION_NOT_FOUND', 'not_found');
  }
}

export class RateLimitedError extends DomainError {
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many questions. Try again in ${retryAfterSeconds}s`, 'AI_RATE_LIMITED', 'too_many_requests');
  }
}

export class LlmUnavailableError extends DomainError {
  constructor(readonly retryAfterSeconds = 30) {
    super('The language model is temporarily unavailable. Try again shortly', 'AI_LLM_UNAVAILABLE', 'unavailable');
  }
}

export class InvalidDateRangeError extends DomainError {
  constructor() {
    super('"from" must be earlier than or equal to "to"', 'INVALID_DATE_RANGE', 'validation');
  }
}
