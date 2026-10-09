export const CIRCUIT_BREAKER_FACTORY = Symbol('CIRCUIT_BREAKER_FACTORY');

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is open`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitTimeoutError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" timed out`);
    this.name = 'CircuitTimeoutError';
  }
}

export interface CircuitBreaker {
  execute<T>(task: () => Promise<T>): Promise<T>;
}

export interface CircuitBreakerFactory {
  /** `isIgnorable` marks errors that blame the caller (bad request), so they never open the circuit. */
  create(name: string, isIgnorable: (error: unknown) => boolean): CircuitBreaker;
}
