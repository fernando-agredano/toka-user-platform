import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolRunner } from '../../src/application/services/tool-runner';
import { createReadTools } from '../../src/application/tools/read-tools';
import { createWriteTools } from '../../src/application/tools/write-tools';
import { GetMeUseCase } from '../../src/application/use-cases/get-me.use-case';
import { ReadDocUseCase } from '../../src/application/use-cases/read-doc.use-case';
import { type McpRuntime, createMcpServer } from '../../src/presentation/mcp-server-factory';
import { USER_ID, fakeDocs, makeCaller, makeGateways } from './support/fakes';

async function connect(callerOverrides = {}) {
  const gateways = makeGateways();
  const auditor = { record: jest.fn().mockResolvedValue(undefined) };
  const runtime: McpRuntime = {
    tools: [...createReadTools(gateways), ...createWriteTools(gateways)],
    runner: new ToolRunner({
      rateLimiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
      auditor,
      clock: { now: Date.now },
      logger: { warn: jest.fn(), error: jest.fn() },
    }),
    getMe: new GetMeUseCase(gateways.users),
    readDoc: new ReadDocUseCase(fakeDocs({ 'faq-soporte': '# FAQ\nBody', '01-politica': '# Política\nX' })),
    now: () => new Date('2026-10-09T12:00:00.000Z'),
  };
  const server = createMcpServer(runtime, makeCaller(callerOverrides));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, gateways, auditor };
}

const textOf = (result: unknown): string => (result as { content: Array<{ text: string }> }).content[0].text;

describe('MCP server over the protocol', () => {
  it('lists the tools with their JSON schema and annotations', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'activate_user', 'ask_knowledge_base', 'assign_role', 'deactivate_user', 'get_audit_events',
      'get_audit_stats', 'get_user', 'get_user_roles', 'list_roles', 'revoke_role', 'search_users',
    ]);
    const deactivate = tools.find((tool) => tool.name === 'deactivate_user')!;
    expect(deactivate.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    expect(deactivate.inputSchema.properties).toHaveProperty('confirm');
  });

  it('answers deactivate_user without confirm with a preview and no side effects', async () => {
    const { client, gateways, auditor } = await connect();
    const result = await client.callTool({ name: 'deactivate_user', arguments: { userId: USER_ID } });
    expect(result.isError).toBe(false);
    expect(JSON.parse(textOf(result))).toMatchObject({ preview: true, requiresConfirmation: true });
    expect(gateways.users.setActive).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(auditor.record).toHaveBeenCalledWith(expect.objectContaining({ tool: 'deactivate_user', outcome: 'preview' }));
  });

  it('executes it with confirm: true', async () => {
    const { client, gateways } = await connect();
    const result = await client.callTool({ name: 'deactivate_user', arguments: { userId: USER_ID, confirm: true } });
    expect(JSON.parse(textOf(result))).toMatchObject({ deactivated: true });
    expect(gateways.users.setActive).toHaveBeenCalledTimes(1);
  });

  it('rejects a caller without permission as an MCP error result', async () => {
    const { client, gateways } = await connect({ permissions: ['users:read'], roles: ['USER'] });
    const result = await client.callTool({ name: 'deactivate_user', arguments: { userId: USER_ID, confirm: true } });
    expect(result.isError).toBe(true);
    expect(JSON.parse(textOf(result))).toEqual({ error: { kind: 'forbidden', message: 'Missing permission: users:write.' } });
    expect(gateways.users.setActive).not.toHaveBeenCalled();
  });

  it('serves resources: documents and the current user', async () => {
    const { client } = await connect();
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toEqual(['toka://me', 'toka://docs/faq-soporte', 'toka://docs/01-politica']);
    const doc = await client.readResource({ uri: 'toka://docs/faq-soporte' });
    expect(doc.contents[0]).toMatchObject({ mimeType: 'text/markdown', text: '# FAQ\nBody' });
    const me = await client.readResource({ uri: 'toka://me' });
    expect(JSON.parse((me.contents[0] as { text: string }).text)).toMatchObject({ email: 'admin@toka.local', roles: ['ADMIN'] });
  });

  it('serves both prompts', async () => {
    const { client } = await connect();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual(['access-audit', 'security-review']);
    const review = await client.getPrompt({ name: 'security-review', arguments: { hours: '6' } });
    expect(JSON.stringify(review.messages)).toContain('last 6 hours');
    const defaultReview = await client.getPrompt({ name: 'security-review', arguments: {} });
    expect(JSON.stringify(defaultReview.messages)).toContain('last 24 hours');
    expect(JSON.stringify((await client.getPrompt({ name: 'access-audit' })).messages)).toContain('privileged');
  });
});
