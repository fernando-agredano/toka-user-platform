import { ToolExecutionError } from '../../src/domain/errors/tool-execution-error';
import { ToolRunner } from '../../src/application/services/tool-runner';
import { type ToolDefinition, WRITE } from '../../src/application/tools/tool-definition';
import { makeCaller } from './support/fakes';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(execute: ToolDefinition['execute'] = async () => ({ data: { ok: true } })) {
  const rateLimiter = { consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };
  const auditor = { record: jest.fn().mockResolvedValue(undefined) };
  const logger = { warn: jest.fn(), error: jest.fn() };
  let now = 1000;
  const clock = { now: () => (now += 25) };
  const tool: ToolDefinition = {
    name: 'demo_tool',
    title: 'Demo',
    description: 'Demo',
    inputSchema: {},
    annotations: WRITE,
    permissions: ['users:write'],
    execute: jest.fn(execute),
  };
  return { runner: new ToolRunner({ rateLimiter, auditor, clock, logger }), rateLimiter, auditor, logger, tool };
}

describe('ToolRunner', () => {
  it('runs the tool and records a successful invocation without secrets', async () => {
    const { runner, auditor, tool } = setup();
    const result = await runner.run(tool, { email: 'ana@toka.local', password: 'Secret123!' }, makeCaller());
    await flush();
    expect(result).toEqual({ isError: false, body: { ok: true } });
    expect(auditor.record).toHaveBeenCalledWith({
      tool: 'demo_tool',
      arguments: { email: 'a***@toka.local', password: '[REDACTED]' },
      outcome: 'success',
      durationMs: 25,
      userId: makeCaller().userId,
      transport: 'http',
      ip: '10.0.0.1',
    });
  });

  it('rejects callers without the permission and never executes the tool', async () => {
    const { runner, auditor, tool } = setup();
    const result = await runner.run(tool, {}, makeCaller({ permissions: ['users:read'] }));
    await flush();
    expect(result).toEqual({ isError: true, body: { error: { kind: 'forbidden', message: 'Missing permission: users:write.' } } });
    expect(tool.execute).not.toHaveBeenCalled();
    expect(auditor.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'denied', errorKind: 'forbidden' }));
  });

  it('rejects with the retry delay when the rate limit is exhausted', async () => {
    const { runner, rateLimiter, auditor, tool } = setup();
    rateLimiter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const result = await runner.run(tool, {}, makeCaller());
    await flush();
    expect(result.isError).toBe(true);
    expect(result.body).toEqual({ error: { kind: 'rate_limited', message: 'Rate limit reached. Retry in 12s.' } });
    expect(tool.execute).not.toHaveBeenCalled();
    expect(auditor.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'rate_limited' }));
  });

  it('turns known errors into MCP errors with their kind', async () => {
    const { runner, auditor, tool } = setup(async () => {
      throw new ToolExecutionError('conflict', 'Cannot remove the last ADMIN');
    });
    const result = await runner.run(tool, {}, makeCaller());
    await flush();
    expect(result.body).toEqual({ error: { kind: 'conflict', message: 'Cannot remove the last ADMIN' } });
    expect(auditor.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error', errorKind: 'conflict' }));
  });

  it('hides unexpected failures behind a generic message and logs the detail', async () => {
    const { runner, logger, tool } = setup(async () => {
      throw new Error('ECONNRESET at /srv/secret/path.ts:42');
    });
    const result = await runner.run(tool, {}, makeCaller());
    expect(JSON.stringify(result.body)).not.toContain('ECONNRESET');
    expect(result.body).toEqual({ error: { kind: 'internal', message: 'Unexpected internal error.' } });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ tool: 'demo_tool' }), expect.any(String));
  });

  it('records previews as non-errors', async () => {
    const { runner, auditor, tool } = setup(async () => ({ data: { preview: true }, preview: true }));
    const result = await runner.run(tool, {}, makeCaller());
    await flush();
    expect(result.isError).toBe(false);
    expect(auditor.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'preview' }));
  });

  it('keeps working when the limiter or the auditor fail', async () => {
    const { runner, rateLimiter, auditor, logger, tool } = setup();
    rateLimiter.consume.mockRejectedValue(new Error('redis down'));
    auditor.record.mockRejectedValue(new Error('broker down'));
    const result = await runner.run(tool, {}, makeCaller());
    await flush();
    expect(result.isError).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
