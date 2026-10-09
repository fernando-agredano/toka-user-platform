import { hasPermission } from '../dtos/session-user';
import type { Clock } from '../ports/clock.port';
import { type AuditGateway, ToolGatewayError } from '../ports/service-gateways.port';
import type { AgentTool } from './agent-tool';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 90;
const MAX_EVENT_TYPES = 12;

export function createGetAuditSummaryTool(audit: AuditGateway, clock: Clock): AgentTool {
  return {
    declaration: {
      name: 'get_audit_summary',
      description:
        'Resumen agregado del registro de auditoría en un rango de fechas: total de eventos, conteo por tipo de evento, inicios de sesión fallidos y cuentas bloqueadas. No devuelve eventos individuales.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            format: 'date-time',
            description: 'Inicio del rango en ISO-8601 UTC. Por defecto, 7 días antes de "to".',
          },
          to: { type: 'string', format: 'date-time', description: 'Fin del rango en ISO-8601 UTC. Por defecto, ahora.' },
        },
      },
    },
    isAvailableFor: (user) => hasPermission(user, 'audit:read'),
    async execute(args, context) {
      const to = args.to ? new Date(args.to as string) : clock.now();
      let from = args.from ? new Date(args.from as string) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
      if (from > to) throw new ToolGatewayError('bad_request', '"from" must not be after "to"');

      const earliest = new Date(to.getTime() - MAX_RANGE_DAYS * DAY_MS);
      let truncated = false;
      if (from < earliest) {
        from = earliest;
        truncated = true;
      }

      const stats = await audit.stats({ from: from.toISOString(), to: to.toISOString() }, context.authorization);
      const types = [...stats.byType].sort((a, b) => b.count - a.count);
      truncated ||= types.length > MAX_EVENT_TYPES;
      const byType = Object.fromEntries(types.slice(0, MAX_EVENT_TYPES).map(({ type, count }) => [type, count]));
      const breakdown = Object.entries(byType).map(([type, count]) => `${type}: ${count}`);

      return {
        kind: 'data',
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          total: stats.total,
          byType,
          failedLogins: stats.failedLogins,
          lockedAccounts: stats.lockedAccounts,
          truncated,
        },
        evidence: {
          title: 'Resumen de auditoría (get_audit_summary)',
          source: 'audit-service',
          snippet: `${stats.total} eventos entre ${from.toISOString().slice(0, 10)} y ${to.toISOString().slice(0, 10)}`,
          text: `Resumen de auditoría entre ${from.toISOString()} y ${to.toISOString()}: ${stats.total} eventos en total, ${stats.failedLogins} inicios de sesión fallidos, ${stats.lockedAccounts} cuentas bloqueadas. Eventos por tipo: ${breakdown.join(', ') || 'ninguno'}`,
        },
      };
    },
  };
}
