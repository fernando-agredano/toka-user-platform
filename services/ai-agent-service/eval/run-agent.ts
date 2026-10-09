/**
 * End-to-end evaluation of the running stack through the gateway: logs in as three personas, asks the
 * cases of agent-cases.json with real HTTP and checks tools, citations, permissions and quality.
 *
 *   docker compose up -d --build
 *   npm run eval:agent -w services/ai-agent-service                # writes eval/agent-report.md
 *   npm run eval:agent -w services/ai-agent-service -- --examples  # also writes docs/05-ejemplos.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ChatOutput } from '../src/application/dtos/chat.dtos';

type Persona = 'user' | 'manager' | 'admin';

interface Expectations {
  toolsUsed?: string[];
  includes?: string[];
  includesAny?: string[];
  excludes?: string[];
  sourceDoc?: string;
  cached?: boolean;
  minQuality?: number;
}

interface AgentCase {
  id: string;
  category: 'policy' | 'data' | 'permission' | 'injection';
  persona: Persona;
  example?: 'rag' | 'users' | 'audit';
  question: string;
  expect: Expectations;
}

interface Session {
  token: string;
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface Outcome {
  testCase: AgentCase;
  status: number;
  response?: ChatOutput;
  problem?: { detail?: string };
  failures: string[];
}

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const ROOT = resolve(__dirname, '..');
const EVAL_PASSWORD = 'Evaluate123!';
const RATE_LIMIT_PER_MINUTE = Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? 5);
const MIN_QUALITY = 0.5;

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function call<T>(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token && { authorization: `Bearer ${options.token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, json: (text ? JSON.parse(text) : undefined) as T };
}

async function login(email: string, password: string): Promise<Session> {
  const { status, json } = await call<{ accessToken: string; user: { id: string; roles: string[]; permissions: string[] } }>(
    'POST',
    '/api/auth/login',
    { body: { email, password } },
  );
  if (status !== 200) throw new Error(`Login failed for ${email}: HTTP ${status}`);
  return { token: json.accessToken, userId: json.user.id, email, roles: json.user.roles, permissions: json.user.permissions };
}

/** The USER role is assigned asynchronously after registration, so wait until the permissions show up. */
async function loginWhen(email: string, password: string, ready: (session: Session) => boolean): Promise<Session> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const session = await login(email, password);
    if (ready(session)) return session;
    await sleep(1000);
  }
  throw new Error(`${email} never received the expected permissions`);
}

async function ensureUser(email: string, firstName: string): Promise<void> {
  const { status } = await call('POST', '/api/auth/register', {
    body: { email, password: EVAL_PASSWORD, firstName, lastName: 'Eval' },
  });
  if (status !== 201 && status !== 409) throw new Error(`Could not register ${email}: HTTP ${status}`);
}

async function setUpPersonas(): Promise<Record<Persona, Session>> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@toka.local';
  const admin = await login(adminEmail, process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!');

  await ensureUser('eval-user@toka.local', 'Usuario');
  await ensureUser('eval-manager@toka.local', 'Gerente');
  const user = await loginWhen('eval-user@toka.local', EVAL_PASSWORD, (session) => session.permissions.includes('ai:use'));
  const managerBase = await loginWhen('eval-manager@toka.local', EVAL_PASSWORD, (session) => session.permissions.includes('ai:use'));

  if (!managerBase.roles.includes('MANAGER')) {
    const roles = await call<Array<{ id: string; name: string }>>('GET', '/api/roles', { token: admin.token });
    const managerRole = roles.json.find((role) => role.name === 'MANAGER');
    if (!managerRole) throw new Error('MANAGER role not found');
    await call('POST', `/api/roles/users/${managerBase.userId}/assign`, { token: admin.token, body: { roleId: managerRole.id } });
  }
  const manager = await loginWhen('eval-manager@toka.local', EVAL_PASSWORD, (session) => session.roles.includes('MANAGER'));
  return { user, manager, admin };
}

/** Keeps each persona under the per-user rate limit by waiting until its oldest request leaves the window. */
function createPacer() {
  const history: number[] = [];
  return async () => {
    const now = Date.now();
    while (history.length > 0 && now - history[0] >= 60_000) history.shift();
    if (history.length >= RATE_LIMIT_PER_MINUTE) await sleep(history[0] + 61_000 - now);
    history.push(Date.now());
  };
}

function check(testCase: AgentCase, status: number, response?: ChatOutput): string[] {
  const { expect } = testCase;
  const failures: string[] = [];
  if (status !== 200 || !response) return [`HTTP ${status}`];

  const answer = response.answer;
  if (expect.toolsUsed && JSON.stringify([...response.toolsUsed].sort()) !== JSON.stringify([...expect.toolsUsed].sort())) {
    failures.push(`tools: expected [${expect.toolsUsed}] got [${response.toolsUsed}]`);
  }
  for (const text of expect.includes ?? []) if (!answer.includes(text)) failures.push(`missing "${text}"`);
  if (expect.includesAny && !expect.includesAny.some((text) => answer.includes(text))) {
    failures.push(`none of [${expect.includesAny.join(' | ')}] present`);
  }
  for (const text of expect.excludes ?? []) if (answer.includes(text)) failures.push(`must not contain "${text}"`);
  if (expect.sourceDoc && !response.sources.some((source) => source.source === expect.sourceDoc)) {
    failures.push(`source ${expect.sourceDoc} not cited`);
  }
  if (expect.cached !== undefined && response.metrics.cached !== expect.cached) failures.push(`cached: expected ${expect.cached}`);
  if (response.quality.score < (expect.minQuality ?? MIN_QUALITY)) failures.push(`quality ${response.quality.score}`);
  return failures;
}

async function ask(testCase: AgentCase, session: Session, pace: () => Promise<void>): Promise<Outcome> {
  await pace();
  let result = await call<ChatOutput & { detail?: string }>('POST', '/api/ai/chat', { token: session.token, body: { message: testCase.question } });
  if (result.status === 429) {
    await sleep((Number(result.headers.get('retry-after')) || 12) * 1000 + 1000);
    result = await call('POST', '/api/ai/chat', { token: session.token, body: { message: testCase.question } });
  }
  const response = result.status === 200 ? result.json : undefined;
  return {
    testCase,
    status: result.status,
    response,
    problem: response ? undefined : { detail: (result.json as { detail?: string } | undefined)?.detail },
    failures: check(testCase, result.status, response),
  };
}

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};

function renderReport(outcomes: Outcome[]): string {
  const answered = outcomes.flatMap((outcome) => (outcome.response ? [outcome.response] : []));
  const fresh = answered.filter((response) => !response.metrics.cached);
  const providers = [...new Set(answered.map((response) => `${response.metrics.provider}/${response.metrics.model}`))];
  const categories = [...new Set(outcomes.map((outcome) => outcome.testCase.category))];
  const sum = (pick: (response: ChatOutput) => number) => answered.reduce((total, response) => total + pick(response), 0);
  const passed = outcomes.filter((outcome) => outcome.failures.length === 0).length;

  return [
    '# Evaluación del agente (extremo a extremo)',
    '',
    `- Fecha: ${new Date().toISOString()}`,
    `- Proveedor(es): ${providers.join(', ') || 'ninguno'}`,
    `- Casos: ${outcomes.length}, aprobados: ${passed} (${Math.round((passed / outcomes.length) * 100)} %)`,
    '',
    '## Por categoría',
    '',
    '| Categoría | Aprobados | Total |',
    '|---|---|---|',
    ...categories.map((category) => {
      const group = outcomes.filter((outcome) => outcome.testCase.category === category);
      return `| ${category} | ${group.filter((outcome) => outcome.failures.length === 0).length} | ${group.length} |`;
    }),
    '',
    '## Latencia, tokens, costo y calidad',
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Latencia p50 / p95 (sin caché) | ${percentile(fresh.map((response) => response.metrics.latencyMs), 0.5)} ms / ${percentile(fresh.map((response) => response.metrics.latencyMs), 0.95)} ms |`,
    `| Tokens de entrada / salida | ${sum((response) => response.metrics.inputTokens)} / ${sum((response) => response.metrics.outputTokens)} |`,
    `| Costo total | $${sum((response) => response.metrics.costUsd).toFixed(6)} |`,
    `| Respuestas desde caché | ${answered.length - fresh.length} de ${answered.length} |`,
    `| Calidad media | ${(sum((response) => response.quality.score) / Math.max(1, answered.length)).toFixed(2)} |`,
    '',
    '## Detalle',
    '',
    '| Caso | Categoría | Resultado | Tools | Calidad | Latencia |',
    '|---|---|---|---|---|---|',
    ...outcomes.map(({ testCase, response, failures, status }) =>
      `| ${testCase.id} | ${testCase.category} | ${failures.length === 0 ? 'OK' : `FALLA: ${failures.join('; ')}`} | ${response ? response.toolsUsed.join(', ') || '—' : `HTTP ${status}`} | ${response?.quality.score ?? '—'} | ${response ? `${response.metrics.latencyMs} ms` : '—'} |`,
    ),
    '',
  ].join('\n');
}

function renderExamples(outcomes: Outcome[], sessions: Record<Persona, Session>, audit: unknown, metrics: unknown): string {
  const picked = (['rag', 'users', 'audit'] as const).flatMap((kind) => outcomes.filter((outcome) => outcome.testCase.example === kind));
  const providers = [...new Set(picked.flatMap((outcome) => (outcome.response ? [outcome.response.metrics.provider] : [])))];
  const usedMock = providers.includes('mock');
  const titles = { rag: 'Pregunta de RAG', users: 'Herramienta de usuarios (search_users)', audit: 'Herramienta de auditoría (get_audit_summary)' };

  const sections = picked.map((outcome, index) => {
    const kind = outcome.testCase.example as keyof typeof titles;
    const session = sessions[outcome.testCase.persona];
    const body = outcome.response ? JSON.stringify(outcome.response, null, 2) : JSON.stringify(outcome.problem, null, 2);
    return [
      `## ${index + 1}. ${titles[kind]}`,
      '',
      `- **Usuario:** \`${session.email}\` — roles ${session.roles.join(', ')}; permisos ${session.permissions.join(', ')}`,
      `- **Pregunta:** ${outcome.testCase.question}`,
      `- **Verificación automática:** ${outcome.failures.length === 0 ? 'cumple lo esperado' : `NO cumple: ${outcome.failures.join('; ')}`}`,
      '',
      '```bash',
      `curl -s -X POST ${BASE_URL}/api/ai/chat \\`,
      `  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\`,
      `  -d '${JSON.stringify({ message: outcome.testCase.question })}'`,
      '```',
      '',
      'Respuesta del servicio, sin editar:',
      '',
      '```json',
      body,
      '```',
      '',
    ].join('\n');
  });

  return [
    '# Ejemplos reales del agente IA (Ejercicio 5)',
    '',
    `Generado el ${new Date().toISOString()} por \`npm run eval:agent -w services/ai-agent-service -- --examples\` contra el stack de Docker Compose, a través del gateway (\`${BASE_URL}\`).`,
    '',
    `**Proveedor LLM que generó estas respuestas: \`${providers.join(', ') || 'ninguno'}\`.**`,
    '',
    ...(usedMock
      ? [
          '> **Aviso.** No había `GEMINI_API_KEY` configurada, así que el servicio arrancó con `MockProvider` (como exige el contrato). Es determinista: decide las llamadas a herramientas por palabras clave y redacta citando literalmente los fragmentos recuperados. Lo que estos ejemplos **sí** prueban es todo lo demás, que es real: embeddings locales, búsqueda en Qdrant, JWT del usuario propagado a user/role/audit-service, permisos, citas, métricas, score de calidad, caché y el evento `ai.query.completed`. Lo que **no** prueban es la calidad de redacción de Gemini. Para regenerar con Gemini: `GEMINI_API_KEY=... docker compose up -d ai-agent-service` y repetir el comando de arriba.',
          '',
        ]
      : []),
    ...sections,
    '## Evidencia en el resto del sistema',
    '',
    '### El evento `ai.query.completed` llegó a audit-service',
    '',
    'Consulta: `GET /api/audit?type=ai.query.completed&limit=1` como ADMIN. El evento lleva solo métricas, nunca el texto de la pregunta ni de la respuesta.',
    '',
    '```json',
    JSON.stringify(audit, null, 2),
    '```',
    '',
    '### Métricas agregadas',
    '',
    'Consulta: `GET /api/ai/metrics` como ADMIN (permiso `audit:read`). Incluye todas las consultas registradas, también las de corridas anteriores.',
    '',
    '```json',
    JSON.stringify(metrics, null, 2),
    '```',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const wantsExamples = process.argv.includes('--examples');
  const cases = JSON.parse(readFileSync(join(__dirname, 'agent-cases.json'), 'utf8')) as AgentCase[];
  console.log(`Setting up personas against ${BASE_URL}...`);
  const sessions = await setUpPersonas();

  console.log(`Running ${cases.length} cases (paced to ${RATE_LIMIT_PER_MINUTE} questions/min per user)...`);
  const byPersona = (persona: Persona) => cases.filter((testCase) => testCase.persona === persona);
  const runPersona = async (persona: Persona): Promise<Outcome[]> => {
    const pace = createPacer();
    const outcomes: Outcome[] = [];
    for (const testCase of byPersona(persona)) {
      const outcome = await ask(testCase, sessions[persona], pace);
      console.log(`  [${outcome.failures.length === 0 ? 'OK  ' : 'FAIL'}] ${testCase.id}${outcome.failures.length ? ` — ${outcome.failures.join('; ')}` : ''}`);
      outcomes.push(outcome);
    }
    return outcomes;
  };
  const results = (await Promise.all((['user', 'manager', 'admin'] as const).map(runPersona))).flat();
  const outcomes = cases.flatMap((testCase) => results.filter((outcome) => outcome.testCase.id === testCase.id));

  writeFileSync(join(__dirname, 'agent-report.md'), renderReport(outcomes));
  console.log('Report written to eval/agent-report.md');

  if (wantsExamples) {
    // Give the broker a moment to deliver ai.query.completed to audit-service.
    await sleep(3000);
    const audit = await call('GET', '/api/audit?type=ai.query.completed&limit=1', { token: sessions.admin.token });
    const metrics = await call('GET', '/api/ai/metrics', { token: sessions.admin.token });
    writeFileSync(join(ROOT, '../../docs/05-ejemplos.md'), renderExamples(outcomes, sessions, audit.json, metrics.json));
    console.log('Examples written to docs/05-ejemplos.md');
  }

  if (outcomes.some((outcome) => outcome.failures.length > 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
