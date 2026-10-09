export const AI_EVENT_PUBLISHER = Symbol('AI_EVENT_PUBLISHER');

export interface QueryCompletedEvent {
  userId: string;
  ip: string | null;
  /** Metrics only: never the question or the answer. */
  data: Record<string, unknown>;
}

export interface AiEventPublisher {
  queryCompleted(event: QueryCompletedEvent): Promise<void>;
}
