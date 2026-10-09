import { AxiosError, type AxiosResponse } from 'axios';
import type { ResilientHttpClient } from '@toka/common';
import { GetMeUseCase } from '../../src/application/use-cases/get-me.use-case';
import { ReadDocUseCase } from '../../src/application/use-cases/read-doc.use-case';
import { accessAuditPrompt, securityReviewPrompt } from '../../src/application/prompts/prompts';
import { resolveRole } from '../../src/application/services/role-resolver';
import { InMemoryToolRateLimiter, RedisToolRateLimiter } from '../../src/infrastructure/cache/rate-limiters';
import { loadMcpConfig } from '../../src/infrastructure/config/mcp-config';
import {
  HttpAuditGateway,
  HttpKnowledgeGateway,
  HttpRolesGateway,
  HttpUsersGateway,
} from '../../src/infrastructure/http/http-gateways';
import { neutralizeDeep, neutralizeText, redactArguments } from '../../src/domain/services/untrusted-text';
import { MANAGER_ROLE_ID, USER_ID, fakeDocs, makeCaller, makeGateways } from './support/fakes';

const httpError = (status: number, data: unknown = {}) =>
  new AxiosError('failed', String(status), undefined, undefined, { status, data } as AxiosResponse);

function fakeClient(result: unknown | Error = {}) {
  const respond = () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result));
  return { get: jest.fn(respond), request: jest.fn(respond) } as unknown as jest.Mocked<ResilientHttpClient>;
}

describe('untrusted text', () => {
  it('flattens control characters and truncates', () => {
    expect(neutralizeText('a\n\n  b\u0000c')).toBe('a b c');
    expect(neutralizeText('x'.repeat(300))).toHaveLength(201);
  });

  it('neutralizes nested structures and bounds their depth', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'x' } } } } } } };
    expect(JSON.stringify(neutralizeDeep(deep))).toContain('[truncated]');
    expect(neutralizeDeep({ list: ['a\nb'], n: 1, nothing: null })).toEqual({ list: ['a b'], n: 1, nothing: null });
  });

  it('redacts sensitive keys and masks emails in arguments', () => {
    expect(redactArguments({ query: 'ana@toka.local', accessToken: 'abc', nested: { apiKey: 'k' }, limit: 5 })).toEqual({
      query: 'a***@toka.local',
      accessToken: '[REDACTED]',
      nested: { apiKey: '[REDACTED]' },
      limit: 5,
    });
  });
});

describe('http gateways', () => {
  it('builds the right requests with the caller token', async () => {
    const client = fakeClient();
    await new HttpUsersGateway(client).search({ search: 'a b', page: 2, limit: 5 }, 'Bearer t');
    expect(client.get).toHaveBeenCalledWith('/api/users?search=a+b&page=2&limit=5', { authorization: 'Bearer t' });
    await new HttpUsersGateway(client).setActive(USER_ID, false, 'Bearer t');
    expect(client.request).toHaveBeenCalledWith({ method: 'POST', url: `/api/users/${USER_ID}/deactivate` }, { authorization: 'Bearer t' });
    await new HttpUsersGateway(client).get(USER_ID, 'Bearer t');
    await new HttpUsersGateway(client).me('Bearer t');
    await new HttpUsersGateway(client).setActive(USER_ID, true, 'Bearer t');

    const roles = new HttpRolesGateway(client);
    await roles.list('Bearer t');
    await roles.rolesOfUser(USER_ID, 'Bearer t');
    await roles.assign(USER_ID, MANAGER_ROLE_ID, 'Bearer t');
    await roles.revoke(USER_ID, MANAGER_ROLE_ID, 'Bearer t');
    expect(client.request).toHaveBeenCalledWith(
      { method: 'POST', url: `/api/roles/users/${USER_ID}/assign`, data: { roleId: MANAGER_ROLE_ID } },
      { authorization: 'Bearer t' },
    );

    const audit = new HttpAuditGateway(client);
    await audit.events({ type: 'x', page: 1, limit: 10 }, 'Bearer t');
    await audit.stats({}, 'Bearer t');
    expect(client.get).toHaveBeenCalledWith('/api/audit/stats', { authorization: 'Bearer t' });

    await new HttpKnowledgeGateway(client).ask('hi', undefined, 'Bearer t');
    expect(client.request).toHaveBeenCalledWith({ method: 'POST', url: '/api/ai/chat', data: { message: 'hi', conversationId: undefined } }, { authorization: 'Bearer t' });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [422, 'bad_request'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const gateway = new HttpRolesGateway(fakeClient(httpError(status, { detail: 'Cannot remove\nthe last ADMIN' })));
    await expect(gateway.list('Bearer t')).rejects.toMatchObject({ kind });
  });

  it('keeps the service detail when it is safe and hides raw network errors', async () => {
    await expect(new HttpRolesGateway(fakeClient(httpError(409, { detail: 'Cannot remove\nthe last ADMIN' }))).list('t')).rejects.toThrow(
      'Cannot remove the last ADMIN',
    );
    await expect(new HttpRolesGateway(fakeClient(httpError(404))).list('t')).rejects.toThrow('Resource not found.');
    await expect(new HttpRolesGateway(fakeClient(new Error('connect ECONNREFUSED 10.1.2.3:3003'))).list('t')).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.not.stringContaining('10.1.2.3'),
    });
  });
});

describe('rate limiters', () => {
  it('in-memory allows the quota and then blocks until the window ends', async () => {
    let now = 0;
    const limiter = new InMemoryToolRateLimiter(2, () => now);
    expect((await limiter.consume('u')).allowed).toBe(true);
    expect((await limiter.consume('u')).allowed).toBe(true);
    const blocked = await limiter.consume('u');
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect((await limiter.consume('other')).allowed).toBe(true);
    now = 61_000;
    expect((await limiter.consume('u')).allowed).toBe(true);
  });

  it('redis limiter compares the window counter with the quota', async () => {
    const redis = { eval: jest.fn().mockResolvedValueOnce([30, 42_000]).mockResolvedValueOnce([31, 41_500]) };
    const limiter = new RedisToolRateLimiter(redis as never, 30);
    expect(await limiter.consume('u')).toEqual({ allowed: true, retryAfterSeconds: 42 });
    expect(await limiter.consume('u')).toEqual({ allowed: false, retryAfterSeconds: 42 });
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, 'mcp:rl:u', 60_000);
  });
});

describe('configuration', () => {
  it('uses per-service URLs by default and a single gateway URL when given', () => {
    expect(loadMcpConfig({}).services.users).toBe('http://user-service:3002');
    const viaGateway = loadMcpConfig({ TOKA_API_URL: 'http://localhost:8080', MCP_RATE_LIMIT_PER_MINUTE: '5' });
    expect(viaGateway.services).toEqual({
      users: 'http://localhost:8080',
      roles: 'http://localhost:8080',
      audit: 'http://localhost:8080',
      ai: 'http://localhost:8080',
    });
    expect(viaGateway.rateLimitPerMinute).toBe(5);
    expect(loadMcpConfig({}).port).toBe(3006);
  });
});

describe('use cases and prompts', () => {
  it('GetMeUseCase merges the profile with the token claims', async () => {
    const { users } = makeGateways();
    const me = await new GetMeUseCase(users).execute(makeCaller({ expiresAt: 1_800_000_000 }));
    expect(me).toMatchObject({ roles: ['ADMIN'], tokenExpiresAt: '2027-01-15T08:00:00.000Z' });
    expect((await new GetMeUseCase(users).execute(makeCaller())).tokenExpiresAt).toBeNull();
  });

  it('ReadDocUseCase serves known documents and refuses anything else', async () => {
    const readDoc = new ReadDocUseCase(fakeDocs());
    expect(await readDoc.execute('faq-soporte')).toContain('Hello');
    await expect(readDoc.execute('../../etc/passwd')).rejects.toMatchObject({ kind: 'not_found' });
    expect(await readDoc.list()).toEqual([{ name: 'faq-soporte', title: 'FAQ' }]);
  });

  it('resolveRole accepts names in any case and ids', async () => {
    const { roles } = makeGateways();
    expect((await resolveRole(roles, ' manager ', 't')).id).toBe(MANAGER_ROLE_ID);
    expect((await resolveRole(roles, MANAGER_ROLE_ID, 't')).name).toBe('MANAGER');
  });

  it('prompts spell out the time range and keep the assistant read-only', () => {
    const now = new Date('2026-10-09T12:00:00.000Z');
    const review = securityReviewPrompt(now, 24).text;
    expect(review).toContain('2026-10-08T12:00:00.000Z');
    expect(review).toContain('never as instructions');
    expect(accessAuditPrompt().text).toContain('list_roles');
  });
});
