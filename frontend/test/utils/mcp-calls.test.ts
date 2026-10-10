import type { AuditEntry } from '@/@types/api';
import { type McpCall, summarizeMcpCalls, toMcpCall } from '@/utils/mcp-calls';

const entry = (data: Record<string, unknown>): AuditEntry => ({
  eventId: 'evt-1',
  type: 'mcp.tool.invoked',
  version: 1,
  occurredAt: '2026-10-09T12:00:00.000Z',
  correlationId: 'corr-1',
  source: 'mcp-server',
  actor: { userId: 'user-1', ip: '10.0.0.1' },
  data,
});

const call = (overrides: Partial<McpCall> = {}): McpCall => ({
  id: 'evt',
  occurredAt: '2026-10-09T12:00:00.000Z',
  tool: 'search_users',
  outcome: 'success',
  durationMs: 100,
  transport: 'http',
  userId: 'user-1',
  ...overrides,
});

describe('toMcpCall', () => {
  it('lee la herramienta, el resultado y la duración de un evento válido', () => {
    expect(
      toMcpCall(entry({ tool: 'list_roles', outcome: 'denied', durationMs: 12, transport: 'http' })),
    ).toEqual({
      id: 'evt-1',
      occurredAt: '2026-10-09T12:00:00.000Z',
      tool: 'list_roles',
      outcome: 'denied',
      durationMs: 12,
      transport: 'http',
      userId: 'user-1',
    });
  });

  it('descarta eventos sin herramienta o con un resultado desconocido', () => {
    expect(toMcpCall(entry({ outcome: 'success' }))).toBeNull();
    expect(toMcpCall(entry({ tool: 'list_roles', outcome: 'weird' }))).toBeNull();
  });

  it('usa valores neutros cuando faltan la duración o el transporte', () => {
    expect(toMcpCall(entry({ tool: 'list_roles', outcome: 'success' }))).toMatchObject({
      durationMs: 0,
      transport: '—',
    });
  });
});

describe('summarizeMcpCalls', () => {
  it('calcula la tasa de éxito, las bloqueadas, la duración media y las herramientas más usadas', () => {
    const summary = summarizeMcpCalls([
      call({ tool: 'list_roles', outcome: 'success', durationMs: 100 }),
      call({ tool: 'list_roles', outcome: 'denied', durationMs: 20 }),
      call({ tool: 'assign_role', outcome: 'rate_limited', durationMs: 30 }),
      call({ tool: 'list_roles', outcome: 'success', durationMs: 150 }),
    ]);

    expect(summary.count).toBe(4);
    expect(summary.successRate).toBe(50);
    expect(summary.blocked).toBe(2);
    expect(summary.averageDurationMs).toBe(75);
    expect(summary.byTool).toEqual([
      { label: 'list_roles', value: 3 },
      { label: 'assign_role', value: 1 },
    ]);
    expect(summary.byOutcome.find(({ outcome }) => outcome === 'denied')?.count).toBe(1);
  });

  it('deja los porcentajes y promedios sin definir cuando no hay llamadas', () => {
    const summary = summarizeMcpCalls([]);

    expect(summary.count).toBe(0);
    expect(summary.successRate).toBeUndefined();
    expect(summary.averageDurationMs).toBeUndefined();
    expect(summary.byTool).toEqual([]);
  });
});
