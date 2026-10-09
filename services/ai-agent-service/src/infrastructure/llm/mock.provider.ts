import {
  type LlmMessage,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type ToolCall,
} from '../../application/ports/llm-provider.port';
import { contentStems, normalizeText } from '../../domain/services/text';

interface ContextBlock {
  label: string;
  text: string;
}

const QUESTION = /<pregunta>\n([\s\S]*?)\n<\/pregunta>/;
const CONTEXT_BLOCK = /^\[(S\d+)\] .*\n([\s\S]*?)(?=^\[S\d+\] |$(?![\s\S]))/gm;
const TOOL_RESULT = /<resultado_herramienta(?: label="(D\d+)")? tool="([^"]+)"( status="error")?>([\s\S]*?)<\/resultado_herramienta>/;

const NO_INFORMATION =
  'No tengo información sobre eso en la documentación de la plataforma. Te recomiendo contactar a soporte.';

const permissionDenied = (permission: string): string =>
  `No puedo darte esa información: requiere el permiso ${permission} y tu sesión no lo tiene. Si lo necesitas, pide a tu responsable que solicite el rol adecuado a un administrador.`;

function parseContext(turn: string): ContextBlock[] {
  const inner = /<contexto_recuperado>\n([\s\S]*?)\n<\/contexto_recuperado>/.exec(turn)?.[1] ?? '';
  return [...inner.matchAll(CONTEXT_BLOCK)].map((match) => ({ label: match[1], text: match[2].trim() }));
}

const QUOTE_WORD_BUDGET = 70;
const FALLBACK_WORD_BUDGET = 35;
const SECONDARY_MIN_OVERLAP = 1;

interface ScoredSentence {
  text: string;
  /** Question stems found in the sentence, each weighted by how rare it is across the retrieved blocks. */
  overlap: number;
}

interface ScoredBlock {
  label: string;
  sentences: ScoredSentence[];
}

const topOverlap = (block: ScoredBlock): number => Math.max(0, ...block.sentences.map((sentence) => sentence.overlap));

function scoreBlocks(question: string, blocks: ContextBlock[]): ScoredBlock[] {
  const questionStems = [...new Set(contentStems(question))];
  // A stem that appears in every block ("permisos", "roles") says little; one found in a single block ("MANAGER") says a lot.
  const weight = new Map(
    questionStems.map((stem) => [stem, 1 / Math.max(1, blocks.filter((block) => contentStems(block.text).includes(stem)).length)]),
  );
  return blocks.map((block) => {
    const sentences = block.text
      .split('\n')
      .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').replace(/\|/g, ' ').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim())
      .filter((line) => line && !/^[\s:-]*$/.test(line))
      .flatMap((line) => line.split(/(?<=[.!?])\s+/));
    return {
      label: block.label,
      sentences: sentences.map((text) => {
        const stems = new Set(contentStems(text));
        return { text, overlap: questionStems.reduce((sum, stem) => sum + (stems.has(stem) ? (weight.get(stem) ?? 0) : 0), 0) };
      }),
    };
  });
}

function quote(block: ScoredBlock, wordBudget: number): { text: string; words: number } {
  const picked: string[] = [];
  let words = 0;
  for (const { text } of block.sentences) {
    const length = text.split(/\s+/).length;
    if (picked.length > 0 && words + length > wordBudget) break;
    picked.push(text);
    words += length;
  }
  return { text: picked.join(' '), words };
}

/** Reads every retrieved block like a model would: quotes the most relevant one, and a sentence of another if it adds something. */
function answerFromContext(question: string, blocks: ContextBlock[]): string {
  const scored = scoreBlocks(question, blocks);
  const best = scored.reduce((winner, block) => (topOverlap(block) > topOverlap(winner) ? block : winner));
  const primary = quote(best, topOverlap(best) === 0 ? FALLBACK_WORD_BUDGET : QUOTE_WORD_BUDGET);
  const parts = [`${primary.text} [${best.label}]`];

  const secondary = scored
    .filter((block) => block !== best)
    .map((block) => ({ block, sentence: [...block.sentences].sort((a, b) => b.overlap - a.overlap)[0] }))
    .filter(({ sentence }) => sentence && sentence.overlap >= SECONDARY_MIN_OVERLAP)
    .sort((a, b) => b.sentence.overlap - a.sentence.overlap)[0];
  if (secondary && primary.words < QUOTE_WORD_BUDGET) parts.push(`${secondary.sentence.text} [${secondary.block.label}]`);
  return parts.join('\n');
}

function auditRange(question: string, today: string): Record<string, unknown> {
  return /\bhoy\b/.test(question) ? { from: `${today}T00:00:00.000Z` } : {};
}

function planToolCalls(question: string, request: LlmRequest, today: string): ToolCall[] | string {
  const offered = new Set(request.tools.map((tool) => tool.name));
  // Audit data questions are about what happened in a period; "how long are audit logs kept" or "how many
  // attempts before lockout" are policy questions, so a topic keyword alone is not enough.
  const asksAudit =
    /(auditoria|inicios? de sesion|logins?|intentos fallidos|bloqueadas?|eventos)/.test(question) &&
    /(hubo|resumen|estadistic|\bhoy\b|\bayer\b|esta semana|este mes|ultim[oa]s?|registrad)/.test(question);
  const asksUsers =
    /\busuarios?\b/.test(question) && /(lista|listar|muestra|cuant|busca|dame|hay|inactiv|activ|\bver\b)/.test(question);
  const asksOwnRoles = /(mis roles|mi rol|que roles tengo|cuales son mis roles)/.test(question);

  const calls: ToolCall[] = [];
  if (asksAudit) {
    if (!offered.has('get_audit_summary')) return permissionDenied('audit:read');
    calls.push({ id: 'mock-audit', name: 'get_audit_summary', args: auditRange(question, today) });
  }
  if (asksUsers) {
    if (!offered.has('search_users')) return permissionDenied('users:read');
    const status = /inactiv/.test(question) ? 'INACTIVE' : /\bactiv/.test(question) ? 'ACTIVE' : undefined;
    calls.push({ id: 'mock-users', name: 'search_users', args: { limit: 10, ...(status && { status }) } });
  }
  if (asksOwnRoles && offered.has('get_user_roles')) calls.push({ id: 'mock-roles', name: 'get_user_roles', args: {} });
  return calls;
}

interface UserRow {
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface ToolPayload {
  error?: string;
  items?: UserRow[];
  total?: number;
  truncated?: boolean;
  from?: string;
  to?: string;
  byType?: Record<string, number>;
  failedLogins?: number;
  lockedAccounts?: number;
  roles?: Array<{ name: string; permissions: string[] }>;
}

function summarizeToolResult(content: string): string[] {
  const match = TOOL_RESULT.exec(content);
  if (!match) return [];
  const [, label, tool, isError, payload] = match;
  const data = JSON.parse(payload) as ToolPayload;
  const cite = label ? ` [${label}]` : '';

  if (isError) {
    if (data.error === 'FORBIDDEN') return ['No tienes acceso a ese dato con tu sesión actual.'];
    if (data.error === 'UNAVAILABLE') return ['No pude consultar ese dato ahora; intenta de nuevo en un momento.'];
    return ['No pude completar la consulta con los datos solicitados.'];
  }
  if (tool === 'search_users') {
    const people = (data.items ?? []).map(
      (user) => `- ${user.firstName} ${user.lastName} (${user.email}) con estado ${user.status}${cite}`,
    );
    const extra = data.truncated ? ' La lista está truncada: afina la búsqueda para ver el resto.' : '';
    return [`Encontré ${data.total} usuarios en total.${cite}${extra}`, ...people];
  }
  if (tool === 'get_audit_summary') {
    const types = Object.entries(data.byType ?? {})
      .slice(0, 5)
      .map(([type, count]) => `${type} (${count})`);
    return [
      `Entre ${String(data.from).slice(0, 10)} y ${String(data.to).slice(0, 10)} hubo ${data.total} eventos de auditoría, con ${data.failedLogins} inicios de sesión fallidos y ${data.lockedAccounts} cuentas bloqueadas${cite}.`,
      ...(types.length > 0 ? [`Los tipos más frecuentes son: ${types.join(', ')}${cite}.`] : []),
    ];
  }
  if (tool === 'get_user_roles') {
    const roles = (data.roles ?? []).map((role) => `${role.name} (permisos: ${role.permissions.join(', ') || 'ninguno'})`);
    return [`Los roles de este usuario son: ${roles.join('; ') || 'ninguno'}${cite}.`];
  }
  return [];
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Deterministic stand-in for a real model: it plans tool calls from keywords and answers by quoting retrieved
 * text. It lets the whole pipeline (RAG, tools, citations, quality checks) run with no API key and in tests.
 */
export class MockProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock';
  readonly rateLimited = false;

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const lastUserIndex = request.messages.map((message) => message.role).lastIndexOf('user');
    const turn = (request.messages[lastUserIndex] as Extract<LlmMessage, { role: 'user' }> | undefined)?.text ?? '';
    const question = QUESTION.exec(turn)?.[1] ?? turn;
    const toolMessages = request.messages
      .slice(lastUserIndex + 1)
      .filter((message): message is Extract<LlmMessage, { role: 'tool' }> => message.role === 'tool');
    const today = /Fecha actual \(UTC\): (\d{4}-\d{2}-\d{2})/.exec(request.systemPrompt)?.[1] ?? '1970-01-01';

    let text = '';
    let toolCalls: ToolCall[] = [];

    if (toolMessages.length > 0) {
      text = toolMessages.flatMap((message) => summarizeToolResult(message.content)).join('\n');
    } else {
      const plan = request.forbidTools ? [] : planToolCalls(normalizeText(question), request, today);
      if (typeof plan === 'string') text = plan;
      else toolCalls = plan;
      if (toolCalls.length === 0 && !text) {
        const blocks = parseContext(turn);
        text = blocks.length > 0 ? answerFromContext(question, blocks) : NO_INFORMATION;
      }
    }

    const promptChars =
      request.systemPrompt.length +
      request.messages.reduce((sum, message) => sum + JSON.stringify(message).length, 0);
    return {
      text,
      toolCalls,
      usage: {
        input: Math.ceil(promptChars / 4),
        output: estimateTokens(text),
        thoughts: 0,
        cachedInput: 0,
        estimated: true,
      },
    };
  }
}
