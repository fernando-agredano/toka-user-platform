/**
 * End-to-end check against a running stack (`docker compose up -d`): drives the MCP server through the gateway with the
 * SDK's own client, as any assistant would. Writes the raw outputs to docs/06-mcp-salidas.json for the documentation.
 *
 *   npm run verify -w services/mcp-server
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.TOKA_API_URL ?? 'http://localhost:8080';
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@toka.local', password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

const login = async (email: string, password: string) =>
  (await api<{ accessToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).accessToken;

async function connect(token: string): Promise<Client> {
  const client = new Client({ name: 'toka-verify', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }),
  );
  return client;
}

const parse = (result: unknown) => {
  const { content, isError } = result as { content: Array<{ text: string }>; isError?: boolean };
  return { isError: Boolean(isError), body: JSON.parse(content[0].text) as Record<string, unknown> };
};

const readText = async (client: Client, uri: string): Promise<string> =>
  ((await client.readResource({ uri })).contents[0] as { text: string }).text;

async function main(): Promise<void> {
  const output: Record<string, unknown> = {};
  const record = (step: string, value: unknown) => {
    output[step] = value;
    console.log(`\n### ${step}\n${JSON.stringify(value, null, 2).slice(0, 1800)}`);
  };

  // 0. Unauthenticated and forged requests must be rejected before reaching any tool.
  const anonymous = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  record('0. request without token', { status: anonymous.status, wwwAuthenticate: anonymous.headers.get('www-authenticate'), body: await anonymous.json() });

  const adminToken = await login(ADMIN.email, ADMIN.password);
  const admin = await connect(adminToken);

  // 1. Tools
  const { tools } = await admin.listTools();
  record('1. tools/list', tools.map(({ name, annotations }) => ({ name, annotations })));

  // 2. Read tool
  record('2. search_users', parse(await admin.callTool({ name: 'search_users', arguments: { query: 'admin', limit: 3 } })));

  // A fresh target user so the demo never touches real accounts.
  const stamp = Date.now();
  const target = { email: `mcp.demo.${stamp}@toka.local`, password: 'Demo12345!x' };
  const { userId } = await api<{ userId: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...target, firstName: 'Mcp', lastName: 'Demo' }),
  });
  await sleep(3000); // profile and USER role are created asynchronously from auth.user.registered

  // 3. Destructive tool without confirmation: preview only
  record('3. deactivate_user without confirm', parse(await admin.callTool({ name: 'deactivate_user', arguments: { userId } })));
  record('3b. user is still ACTIVE', parse(await admin.callTool({ name: 'get_user', arguments: { userId } })));

  // 4. Confirmed destructive call, then the inverse
  record('4. deactivate_user confirm:true', parse(await admin.callTool({ name: 'deactivate_user', arguments: { userId, confirm: true } })));
  record('4b. activate_user', parse(await admin.callTool({ name: 'activate_user', arguments: { userId } })));

  // 5. Role tools: preview, assign by name, revoke
  record('5. revoke_role preview', parse(await admin.callTool({ name: 'revoke_role', arguments: { userId, role: 'USER' } })));
  record('5b. assign_role MANAGER', parse(await admin.callTool({ name: 'assign_role', arguments: { userId, role: 'MANAGER' } })));
  record('5c. get_user_roles', parse(await admin.callTool({ name: 'get_user_roles', arguments: { userId } })));
  record('5d. revoke_role confirm:true', parse(await admin.callTool({ name: 'revoke_role', arguments: { userId, role: 'MANAGER', confirm: true } })));
  record('5e. last admin cannot be revoked', parse(await admin.callTool({
    name: 'revoke_role',
    arguments: { userId: '00000000-0000-4000-8000-000000000001', role: 'ADMIN', confirm: true },
  })));

  // 6. Audit and knowledge base
  record('6. get_audit_stats', parse(await admin.callTool({ name: 'get_audit_stats', arguments: {} })));
  record('6b. ask_knowledge_base', parse(await admin.callTool({ name: 'ask_knowledge_base', arguments: { question: '¿Cuántos intentos fallidos bloquean una cuenta?' } })));

  // 7. Resources and prompts
  record('7. resources/list', (await admin.listResources()).resources);
  record('7b. toka://me', JSON.parse(await readText(admin, 'toka://me')));
  const doc = await readText(admin, 'toka://docs/02-politica-contrasenas-seguridad');
  record('7c. toka://docs/02-politica-contrasenas-seguridad', `${doc.slice(0, 300)}…`);
  record('7d. prompts/list', (await admin.listPrompts()).prompts.map(({ name, description }) => ({ name, description })));
  const prompt = await admin.getPrompt({ name: 'security-review', arguments: { hours: '24' } });
  record('7e. prompts/get security-review', (prompt.messages[0].content as { text: string }).text.slice(0, 500));

  // 8. A user without privileges: the AI can do no more than they can
  const userToken = await login(target.email, target.password);
  const limited = await connect(userToken);
  record('8. USER calls deactivate_user', parse(await limited.callTool({ name: 'deactivate_user', arguments: { userId, confirm: true } })));
  record('8b. USER calls search_users', parse(await limited.callTool({ name: 'search_users', arguments: {} })));

  // 9. Rate limit: 30 calls/min per user (two were used above)
  let limitedAt = 0;
  for (let call = 1; call <= 35 && !limitedAt; call++) {
    const result = parse(await limited.callTool({ name: 'list_roles', arguments: {} }));
    if ((result.body.error as { kind?: string } | undefined)?.kind === 'rate_limited') {
      limitedAt = call + 2;
      record('9. rate limit reached', { callNumberInMinute: limitedAt, ...result });
    }
  }
  if (!limitedAt) throw new Error('rate limit was never reached');

  // 10. Governance: the invocations are in the audit trail
  await sleep(2000);
  const audit = await api<{ total: number; items: unknown[] }>('/api/audit?type=mcp.tool.invoked&limit=100', { token: adminToken });
  const items = audit.items as Array<{ data: { tool: string; outcome: string } }>;
  record('10. GET /api/audit?type=mcp.tool.invoked', {
    total: audit.total,
    outcomes: items.reduce<Record<string, number>>((acc, { data }) => ({ ...acc, [data.outcome]: (acc[data.outcome] ?? 0) + 1 }), {}),
    sample: audit.items.slice(0, 3),
    deactivatePreview: audit.items.find((item) => {
      const { data } = item as { data: { tool: string; outcome: string } };
      return data.tool === 'deactivate_user' && data.outcome === 'preview';
    }),
  });

  await Promise.all([admin.close(), limited.close()]);
  writeFileSync(join(__dirname, '..', '..', '..', 'docs', '06-mcp-salidas.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log('\nOutputs saved to docs/06-mcp-salidas.json');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
