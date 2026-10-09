import { HealthCheckError } from '@nestjs/terminus';
import { createPingIndicator } from '../src/health/health.module';

describe('createPingIndicator', () => {
  it('reports up when the probe succeeds', async () => {
    const indicator = createPingIndicator('postgres', async () => 'PONG');
    await expect(indicator()).resolves.toEqual({ postgres: { status: 'up' } });
  });

  it('throws a HealthCheckError with the probe message when it fails', async () => {
    const indicator = createPingIndicator('redis', async () => {
      throw new Error('ECONNREFUSED');
    });

    const error = await Promise.resolve(indicator()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HealthCheckError);
    expect((error as HealthCheckError).causes).toEqual({ redis: { status: 'down', message: 'ECONNREFUSED' } });
  });

  it('falls back to a generic message for non-Error failures', async () => {
    const indicator = createPingIndicator('rabbitmq', () => Promise.reject('nope'));

    const error = (await Promise.resolve(indicator()).catch((caught: unknown) => caught)) as HealthCheckError;

    expect(error.causes).toEqual({ rabbitmq: { status: 'down', message: 'unreachable' } });
  });
});
