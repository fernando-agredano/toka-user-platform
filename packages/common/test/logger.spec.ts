import { runWithCorrelationId } from '../src/correlation/correlation-context';
import { createLoggerOptions, REDACTED_PATHS } from '../src/logger/logger';

describe('createLoggerOptions', () => {
  it('tags every line with the service name and level label', () => {
    const options = createLoggerOptions('auth-service', 'debug');

    expect(options.level).toBe('debug');
    expect(options.base).toEqual({ service: 'auth-service' });
    expect((options.formatters as { level: (label: string) => unknown }).level('info')).toEqual({ level: 'info' });
  });

  it('redacts secrets in logged payloads', () => {
    const options = createLoggerOptions('auth-service');

    expect(options.redact).toEqual({ paths: REDACTED_PATHS, censor: '[REDACTED]' });
    expect(REDACTED_PATHS).toEqual(expect.arrayContaining(['password', '*.refreshToken', 'req.headers.authorization']));
  });

  it('injects the current correlationId, or null outside a request', () => {
    const { mixin } = createLoggerOptions('auth-service');
    const mix = mixin as () => Record<string, unknown>;

    expect(mix()).toEqual({ correlationId: null });
    runWithCorrelationId('corr-42', () => {
      expect(mix()).toEqual({ correlationId: 'corr-42' });
    });
  });
});
