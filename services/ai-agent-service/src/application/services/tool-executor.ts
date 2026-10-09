import { Logger } from '@nestjs/common';
import type { SessionUser } from '../dtos/session-user';
import type { ToolCall, ToolDeclaration } from '../ports/llm-provider.port';
import { type GatewayErrorKind, ToolGatewayError } from '../ports/service-gateways.port';
import { formatChunkBlock } from '../prompts/user-turn';
import type { AgentTool, ToolContext } from '../tools/agent-tool';
import type { EvidenceLedger } from './evidence-ledger';
import { validateArgs } from './validate-args';

/** About 800 tokens of Spanish/JSON per tool result. */
const MAX_RESULT_CHARS = 3200;

export interface ToolExecution {
  name: string;
  content: string;
  ok: boolean;
  durationMs: number;
}

const ERROR_CODES: Record<GatewayErrorKind, string> = {
  forbidden: 'FORBIDDEN',
  not_found: 'NOT_FOUND',
  bad_request: 'INVALID_ARGUMENTS',
  unavailable: 'UNAVAILABLE',
};

// "<" is escaped so tool data can never close the wrapper tag and pass itself off as instructions.
const escapeForWrapper = (json: string): string => json.replace(/</g, '\\u003c');

function fitToBudget(data: Record<string, unknown>): string {
  let json = JSON.stringify(data);
  if (json.length <= MAX_RESULT_CHARS) return json;
  const items = Array.isArray(data.items) ? [...data.items] : null;
  if (items) {
    while (items.length > 1 && json.length > MAX_RESULT_CHARS) {
      items.pop();
      json = JSON.stringify({ ...data, items, truncated: true });
    }
    if (json.length <= MAX_RESULT_CHARS) return json;
  }
  return JSON.stringify({ truncated: true, partial: json.slice(0, MAX_RESULT_CHARS - 40) });
}

export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly byName: Map<string, AgentTool>;

  constructor(tools: AgentTool[]) {
    this.byName = new Map(tools.map((tool) => [tool.declaration.name, tool]));
  }

  declarationsFor(user: SessionUser): ToolDeclaration[] {
    return [...this.byName.values()].filter((tool) => tool.isAvailableFor(user)).map((tool) => tool.declaration);
  }

  async execute(call: ToolCall, context: ToolContext, ledger: EvidenceLedger): Promise<ToolExecution> {
    const startedAt = performance.now();
    const finish = (content: string, ok: boolean): ToolExecution => ({
      name: call.name,
      content,
      ok,
      durationMs: Math.round(performance.now() - startedAt),
    });
    const failure = (code: string, detail?: string): ToolExecution =>
      finish(
        `<resultado_herramienta tool="${call.name}" status="error">${escapeForWrapper(JSON.stringify({ error: code, ...(detail && { detail }) }))}</resultado_herramienta>`,
        false,
      );

    const tool = this.byName.get(call.name);
    if (!tool) return failure('UNKNOWN_TOOL');
    if (!tool.isAvailableFor(context.user)) return failure('FORBIDDEN');

    const validated = validateArgs(tool.declaration.parameters, call.args ?? {});
    if (!validated.ok) return failure('INVALID_ARGUMENTS', validated.error);

    try {
      const result = await tool.execute(validated.value, context);
      if (result.kind === 'chunks') {
        const blocks = ledger.addChunks(result.chunks).map(formatChunkBlock).join('\n');
        return finish(
          `<resultado_herramienta tool="${call.name}">\n${blocks || '(sin resultados)'}\n</resultado_herramienta>`,
          true,
        );
      }
      const label = ledger.addData(result.evidence);
      return finish(
        `<resultado_herramienta label="${label}" tool="${call.name}">${escapeForWrapper(fitToBudget(result.data))}</resultado_herramienta>`,
        true,
      );
    } catch (error) {
      if (error instanceof ToolGatewayError) return failure(ERROR_CODES[error.kind]);
      this.logger.warn(`Tool ${call.name} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`);
      return failure('UNAVAILABLE');
    }
  }
}
