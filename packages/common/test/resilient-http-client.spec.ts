import { AxiosError, AxiosHeaders } from 'axios';
import { ResilientHttpClient } from '../src/http/resilient-http-client';
import { runWithCorrelationId } from '../src/correlation/correlation-context';

const httpError = (status: number) =>
  new AxiosError('failed', 'ERR', undefined, undefined, {
    status,
    data: {},
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const buildClient = (request: jest.Mock, options: { retries?: number } = {}) => {
  const client = new ResilientHttpClient({
    name: 'test',
    baseURL: 'http://localhost',
    retryBaseDelayMs: 1,
    ...options,
  });
  (client as unknown as { axios: { request: jest.Mock } }).axios.request = request;
  return client;
};

describe('ResilientHttpClient', () => {
  const clients: ResilientHttpClient[] = [];
  const create = (request: jest.Mock, options?: { retries?: number }) => {
    const client = buildClient(request, options);
    clients.push(client);
    return client;
  };
  afterEach(() => clients.splice(0).forEach((client) => client.shutdown()));

  it('retries idempotent GETs on server errors and returns the eventual body', async () => {
    const request = jest.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce({ data: { ok: true } });
    await expect(create(request).get('/x')).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never retries non-idempotent requests', async () => {
    const request = jest.fn().mockRejectedValue(httpError(503));
    await expect(create(request).request({ method: 'POST', url: '/x' })).rejects.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry client errors', async () => {
    const request = jest.fn().mockRejectedValue(httpError(404));
    await expect(create(request).get('/x')).rejects.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('forwards correlation id and Authorization', async () => {
    const request = jest.fn().mockResolvedValue({ data: {} });
    await runWithCorrelationId('corr-9', () => create(request).get('/x', { authorization: 'Bearer t' }));
    expect(request.mock.calls[0][0].headers).toMatchObject({
      'x-correlation-id': 'corr-9',
      Authorization: 'Bearer t',
    });
  });

  it('opens the circuit after repeated failures and stops calling the dependency', async () => {
    const request = jest.fn().mockRejectedValue(httpError(500));
    const client = create(request, { retries: 0 });
    for (let call = 0; call < 8; call++) await client.get('/x').catch(() => undefined);

    const callsBefore = request.mock.calls.length;
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'EOPENBREAKER' });
    expect(request.mock.calls.length).toBe(callsBefore);
  });
});
