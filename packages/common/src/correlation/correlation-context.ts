import { AsyncLocalStorage } from 'node:async_hooks';

export const CORRELATION_HEADER = 'x-correlation-id';

export interface CorrelationContext {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export const getCorrelationId = (): string | undefined => correlationStorage.getStore()?.correlationId;

export const runWithCorrelationId = <T>(correlationId: string, fn: () => T): T =>
  correlationStorage.run({ correlationId }, fn);
