import { GetAuditStatsUseCase } from '../../../src/application/use-cases/get-audit-stats.use-case';
import { RecordAuditEventUseCase } from '../../../src/application/use-cases/record-audit-event.use-case';
import { SearchAuditUseCase } from '../../../src/application/use-cases/search-audit.use-case';
import { InvalidDateRangeError } from '../../../src/domain/errors/domain-error';
import { buildEvent } from '../support/events';
import { InMemoryAuditRepository } from '../support/in-memory-audit.repository';

describe('audit use cases', () => {
  let repository: InMemoryAuditRepository;
  let record: RecordAuditEventUseCase;
  let search: SearchAuditUseCase;
  let stats: GetAuditStatsUseCase;

  beforeEach(() => {
    repository = new InMemoryAuditRepository();
    record = new RecordAuditEventUseCase(repository);
    search = new SearchAuditUseCase(repository);
    stats = new GetAuditStatsUseCase(repository);
  });

  it('records an event once and reports duplicates', async () => {
    const event = buildEvent();
    expect(await record.execute(event)).toBe(true);
    expect(await record.execute(event)).toBe(false);
    expect(repository.entries.size).toBe(1);
  });

  it('filters by type, actor and date range with pagination', async () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    await record.execute(buildEvent({ type: 'auth.login.failed', occurredAt: '2026-01-02T00:00:00Z', actor: { userId: actorId } }));
    await record.execute(buildEvent({ type: 'auth.login.failed', occurredAt: '2026-01-03T00:00:00Z' }));
    await record.execute(buildEvent({ type: 'user.created', occurredAt: '2026-02-01T00:00:00Z' }));

    const byType = await search.execute({ page: 1, limit: 10, type: 'auth.login.failed' });
    expect(byType.total).toBe(2);
    expect(byType.items[0].occurredAt).toBe('2026-01-03T00:00:00.000Z');

    const byActor = await search.execute({ page: 1, limit: 10, actorId });
    expect(byActor.items).toHaveLength(1);

    const january = await search.execute({ page: 1, limit: 1, from: '2026-01-01', to: '2026-01-31' });
    expect(january).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(january.items).toHaveLength(1);
  });

  it('computes stats including failed logins and lockouts', async () => {
    await record.execute(buildEvent({ type: 'auth.login.failed' }));
    await record.execute(buildEvent({ type: 'auth.login.failed' }));
    await record.execute(buildEvent({ type: 'auth.login.locked' }));
    await record.execute(buildEvent({ type: 'user.created' }));

    const result = await stats.execute({});
    expect(result).toMatchObject({ total: 4, failedLogins: 2, lockedAccounts: 1, from: null, to: null });
    expect(result.byType).toContainEqual({ type: 'user.created', count: 1 });
  });

  it('rejects an inverted date range', async () => {
    await expect(stats.execute({ from: '2026-02-01', to: '2026-01-01' })).rejects.toBeInstanceOf(InvalidDateRangeError);
  });
});
