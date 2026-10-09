import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ToolRunner } from '../../src/application/services/tool-runner';
import { createReadTools } from '../../src/application/tools/read-tools';
import { GetMeUseCase } from '../../src/application/use-cases/get-me.use-case';
import { ReadDocUseCase } from '../../src/application/use-cases/read-doc.use-case';
import { createHttpApp } from '../../src/presentation/http/http-app';
import { fakeDocs, makeCaller, makeGateways } from './support/fakes';

async function startServer() {
  const gateways = makeGateways();
  const app = createHttpApp({
    runtime: {
      tools: createReadTools(gateways),
      runner: new ToolRunner({
        rateLimiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
        auditor: { record: async () => undefined },
        clock: { now: Date.now },
        logger: { warn: jest.fn(), error: jest.fn() },
      }),
      getMe: new GetMeUseCase(gateways.users),
      readDoc: new ReadDocUseCase(fakeDocs()),
      now: () => new Date(),
    },
    authenticate: async (header) => {
      if (header !== 'Bearer good') throw new Error('bad token');
      return makeCaller();
    },
    allowedOrigins: ['http://localhost:8080'],
    isHealthy: async () => true,
    logger: { warn: jest.fn(), error: jest.fn() },
  });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, gateways, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

const post = (url: string, headers: Record<string, string> = {}) =>
  fetch(`${url}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

describe('Streamable HTTP endpoint', () => {
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(() => server.close());

  it('answers 401 with a challenge when the token is missing or invalid', async () => {
    const response = await post(server.url, { authorization: 'Bearer forged' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(/^Bearer/);
    expect((await post(server.url)).status).toBe(401);
  });

  it('refuses browser origins that are not allowed', async () => {
    const response = await post(server.url, { authorization: 'Bearer good', origin: 'https://evil.example' });
    expect(response.status).toBe(403);
  });

  it('does not support sessions: GET and DELETE answer 405', async () => {
    expect((await fetch(`${server.url}/mcp`)).status).toBe(405);
    expect((await fetch(`${server.url}/mcp`, { method: 'DELETE' })).status).toBe(405);
  });

  it('reports health without authentication', async () => {
    const response = await fetch(`${server.url}/health`);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('serves a real SDK client end to end with the caller token', async () => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`), { requestInit: { headers: { authorization: 'Bearer good' } } }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('search_users');
    await client.callTool({ name: 'search_users', arguments: { query: 'ana' } });
    expect(server.gateways.users.search).toHaveBeenCalledWith(expect.objectContaining({ search: 'ana' }), 'Bearer admin-token');
    await client.close();
  });
});
