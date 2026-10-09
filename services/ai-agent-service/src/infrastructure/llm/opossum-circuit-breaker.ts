import CircuitBreaker from 'opossum';
import {
  type CircuitBreaker as CircuitBreakerPort,
  type CircuitBreakerFactory,
  CircuitOpenError,
  CircuitTimeoutError,
} from '../../application/ports/circuit-breaker.port';

export interface BreakerOptions {
  timeoutMs: number;
  resetTimeoutMs: number;
  errorThresholdPercentage: number;
  volumeThreshold: number;
}

export const DEFAULT_BREAKER_OPTIONS: BreakerOptions = {
  timeoutMs: 15_000,
  resetTimeoutMs: 30_000,
  errorThresholdPercentage: 50,
  volumeThreshold: 5,
};

export class OpossumCircuitBreakerFactory implements CircuitBreakerFactory {
  constructor(private readonly options: BreakerOptions = DEFAULT_BREAKER_OPTIONS) {}

  create(name: string, isIgnorable: (error: unknown) => boolean): CircuitBreakerPort {
    const breaker = new CircuitBreaker((task: () => Promise<unknown>) => task(), {
      name,
      timeout: this.options.timeoutMs,
      resetTimeout: this.options.resetTimeoutMs,
      errorThresholdPercentage: this.options.errorThresholdPercentage,
      volumeThreshold: this.options.volumeThreshold,
      errorFilter: isIgnorable,
    });
    return {
      async execute<T>(task: () => Promise<T>): Promise<T> {
        try {
          return (await breaker.fire(task)) as T;
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === 'EOPENBREAKER') throw new CircuitOpenError(name);
          if (code === 'ETIMEDOUT') throw new CircuitTimeoutError(name);
          throw error;
        }
      },
    };
  }
}
