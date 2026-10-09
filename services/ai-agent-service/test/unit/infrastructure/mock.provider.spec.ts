import type { LlmMessage, LlmRequest, ToolDeclaration } from '../../../src/application/ports/llm-provider.port';
import { MockProvider } from '../../../src/infrastructure/llm/mock.provider';

const tool = (name: string): ToolDeclaration => ({ name, description: name, parameters: { type: 'object' } });
const ALL_TOOLS = ['search_users', 'get_user_roles', 'get_audit_summary', 'search_knowledge_base'].map(tool);

const turn = (question: string, context = '(sin documentos relevantes)') =>
  `<contexto_recuperado>\n${context}\n</contexto_recuperado>\n\n<pregunta>\n${question}\n</pregunta>`;

const request = (question: string, options: { context?: string; tools?: ToolDeclaration[]; after?: LlmMessage[]; forbidTools?: boolean } = {}): LlmRequest => ({
  systemPrompt: 'Fecha actual (UTC): 2026-10-09',
  messages: [{ role: 'user', text: turn(question, options.context) }, ...(options.after ?? [])],
  tools: options.tools ?? ALL_TOOLS,
  forbidTools: options.forbidTools ?? false,
  maxOutputTokens: 600,
  temperature: 0.2,
  topP: 0.9,
  thinkingBudget: 0,
});

const toolResult = (tool: string, payload: unknown, label = 'D1', error = false): LlmMessage => ({
  role: 'tool',
  callId: 'c',
  name: tool,
  content: `<resultado_herramienta ${error ? '' : `label="${label}" `}tool="${tool}"${error ? ' status="error"' : ''}>${JSON.stringify(payload)}</resultado_herramienta>`,
});

const generate = (req: LlmRequest) => new MockProvider().generate(req);

describe('MockProvider', () => {
  const lockout =
    '[S1] Política > Bloqueo\nTras 5 intentos fallidos la cuenta se bloquea. Es temporal.\n[S2] FAQ > Otro\nTexto sin relación alguna.';

  it('quotes the sentences of the best chunk that overlap the question and cites it', async () => {
    const { text, toolCalls } = await generate(request('¿cuántos intentos fallidos hasta el bloqueo?', { context: lockout }));
    expect(toolCalls).toEqual([]);
    expect(text).toBe('Tras 5 intentos fallidos la cuenta se bloquea. Es temporal. [S1]');
    expect(text).not.toContain('[S2]');
  });

  it('quotes a lower-ranked block when it holds the answer, citing that block', async () => {
    const context = '[S1] Guía > Usuarios\nPuedes buscar usuarios por nombre.\n[S2] Guía > Retención\nLos registros de auditoría se conservan 365 días.';
    const { text } = await generate(request('¿Cuánto tiempo se conservan los registros de auditoría?', { context }));
    expect(text).toBe('Los registros de auditoría se conservan 365 días. [S2]');
  });

  it('quotes the whole relevant block, not just the sentences that repeat the question', async () => {
    const context = '[S1] Política > Requisitos\nToda contraseña debe cumplir, a la vez:\n- Entre 8 y 128 caracteres.\n- Al menos una mayúscula.';
    const { text } = await generate(request('¿Qué requisitos debe cumplir mi contraseña?', { context }));
    expect(text).toContain('Entre 8 y 128 caracteres.');
    expect(text).toContain('mayúscula');
  });

  it('adds a sentence from a second block when it also matches the question', async () => {
    const context = '[S1] A > B\nEl bloqueo de la cuenta dura quince minutos.\n[S2] C > D\nLa cuenta se bloquea tras cinco intentos fallidos.';
    const { text } = await generate(request('¿Cuántos intentos fallidos bloquean la cuenta y cuánto dura el bloqueo?', { context }));
    expect(text).toContain('[S1]');
    expect(text).toContain('[S2]');
  });

  it('does not treat a policy question that mentions audit as a data request', async () => {
    const { toolCalls, text } = await generate(request('¿Cuánto tiempo se conservan los registros de auditoría?', { tools: [] }));
    expect(toolCalls).toEqual([]);
    expect(text).not.toContain('audit:read');
  });

  it('admits it has no information when no context was retrieved', async () => {
    expect((await generate(request('algo que no existe'))).text).toMatch(/No tengo información/);
  });

  it('plans a user search with the status mentioned in the question', async () => {
    const inactive = await generate(request('muestra los usuarios inactivos'));
    const active = await generate(request('lista los usuarios activos'));
    expect(inactive.toolCalls[0]).toMatchObject({ name: 'search_users', args: { status: 'INACTIVE', limit: 10 } });
    expect(active.toolCalls[0].args).toMatchObject({ status: 'ACTIVE' });
  });

  it('plans an audit summary and narrows it to today when asked', async () => {
    const { toolCalls } = await generate(request('¿Cuántos inicios de sesión fallidos hubo hoy?'));
    expect(toolCalls[0]).toMatchObject({ name: 'get_audit_summary', args: { from: '2026-10-09T00:00:00.000Z' } });
  });

  it('does not mistake a lockout policy question for an audit question', async () => {
    const { toolCalls } = await generate(request('¿cuántos intentos fallidos antes de que me bloqueen?'));
    expect(toolCalls).toEqual([]);
  });

  it('plans a lookup of the caller’s own roles', async () => {
    expect((await generate(request('¿cuáles son mis roles?'))).toolCalls[0]).toMatchObject({ name: 'get_user_roles', args: {} });
  });

  it('refuses with the missing permission when the tool is not offered', async () => {
    const withoutData = ALL_TOOLS.filter((candidate) => candidate.name === 'get_user_roles');
    expect((await generate(request('lista los usuarios', { tools: withoutData }))).text).toContain('users:read');
    expect((await generate(request('resumen de auditoría', { tools: withoutData }))).text).toContain('audit:read');
  });

  it('does not plan tools on the forced final round', async () => {
    const { toolCalls, text } = await generate(request('lista los usuarios', { forbidTools: true }));
    expect(toolCalls).toEqual([]);
    expect(text).toMatch(/No tengo información/);
  });

  describe('summarising tool results', () => {
    it('lists users and flags a truncated list', async () => {
      const payload = {
        items: [{ firstName: 'Ana', lastName: 'Paz', email: 'ana@toka.local', status: 'ACTIVE' }],
        total: 25,
        truncated: true,
      };
      const { text } = await generate(request('usuarios', { after: [toolResult('search_users', payload)] }));
      expect(text).toContain('Encontré 25 usuarios en total.');
      expect(text).toContain('- Ana Paz (ana@toka.local) con estado ACTIVE [D1]');
      expect(text).toContain('truncada');
    });

    it('describes an audit summary with its most frequent types', async () => {
      const payload = { from: '2026-10-02T00:00:00Z', to: '2026-10-09T00:00:00Z', total: 9, byType: { a: 5, b: 4 }, failedLogins: 2, lockedAccounts: 0 };
      const { text } = await generate(request('auditoría', { after: [toolResult('get_audit_summary', payload)] }));
      expect(text).toContain('Entre 2026-10-02 y 2026-10-09 hubo 9 eventos');
      expect(text).toContain('a (5), b (4)');
    });

    it('describes roles, including a user without any', async () => {
      const withRoles = await generate(request('roles', { after: [toolResult('get_user_roles', { roles: [{ name: 'USER', permissions: ['ai:use'] }] })] }));
      const none = await generate(request('roles', { after: [toolResult('get_user_roles', { roles: [] })] }));
      expect(withRoles.text).toContain('USER (permisos: ai:use)');
      expect(none.text).toContain('ninguno');
    });

    it.each([
      ['FORBIDDEN', /No tienes acceso/],
      ['UNAVAILABLE', /No pude consultar/],
      ['NOT_FOUND', /No pude completar/],
    ])('reports a %s tool error without inventing data', async (error, expected) => {
      const { text } = await generate(request('x', { after: [toolResult('search_users', { error }, 'D1', true)] }));
      expect(text).toMatch(expected);
    });

    it('ignores results it cannot parse', async () => {
      const garbage: LlmMessage = { role: 'tool', callId: 'c', name: 'x', content: 'not a wrapped result' };
      expect((await generate(request('x', { after: [garbage] }))).text).toBe('');
    });
  });

  it('reports estimated token usage', async () => {
    const { usage } = await generate(request('hola'));
    expect(usage.estimated).toBe(true);
    expect(usage.input).toBeGreaterThan(0);
  });
});
