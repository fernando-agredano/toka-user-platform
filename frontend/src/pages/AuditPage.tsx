import type { AuditEntry, AuditFilters } from '@/@types/api';
import { useGetAuditStatsQuery, useSearchAuditQuery } from '@/api/audit.api';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { TextField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { useDebounce } from '@/hooks/use-debounce';
import { dayBoundaryToIso, formatDateTime, shortId } from '@/utils/format';
import { type ChangeEvent, useState } from 'react';

const PAGE_SIZE = 15;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FilterInputs {
  type: string;
  actorId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterInputs = { type: '', actorId: '', from: '', to: '' };

const toneOf = (type: string): BadgeTone => {
  if (type.includes('failed') || type.includes('locked') || type.includes('deactivated')) return 'danger';
  if (type.includes('succeeded') || type.includes('created') || type.includes('registered')) return 'success';
  return 'info';
};

const columns: Column<AuditEntry>[] = [
  {
    header: 'Fecha',
    cell: (entry) => <span className="whitespace-nowrap">{formatDateTime(entry.occurredAt)}</span>,
  },
  { header: 'Evento', cell: (entry) => <Badge tone={toneOf(entry.type)}>{entry.type}</Badge> },
  { header: 'Origen', cell: (entry) => <span className="text-ink-soft">{entry.source}</span> },
  {
    header: 'Actor',
    cell: (entry) => (
      <span className="font-mono text-xs text-ink-soft" title={entry.actor.userId ?? undefined}>
        {entry.actor.userId ? shortId(entry.actor.userId) : '—'}
        {entry.actor.ip && ` · ${entry.actor.ip}`}
      </span>
    ),
  },
  {
    header: 'Detalle',
    cell: (entry) => (
      <details>
        <summary className="cursor-pointer text-xs text-primary">Ver datos</summary>
        <pre className="mt-2 max-w-xs overflow-x-auto rounded-sm bg-page p-2 text-xs">
          {JSON.stringify({ correlationId: entry.correlationId, ...entry.data }, null, 2)}
        </pre>
      </details>
    ),
  },
];

export const AuditPage = () => {
  const [inputs, setInputs] = useState<FilterInputs>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const debounced = useDebounce(inputs);

  const actorIdIsInvalid = inputs.actorId !== '' && !UUID_PATTERN.test(inputs.actorId);
  const filters: AuditFilters = {
    type: debounced.type || undefined,
    actorId: UUID_PATTERN.test(debounced.actorId) ? debounced.actorId : undefined,
    from: debounced.from ? dayBoundaryToIso(debounced.from, 'start') : undefined,
    to: debounced.to ? dayBoundaryToIso(debounced.to, 'end') : undefined,
  };

  const entries = useSearchAuditQuery({ ...filters, page, limit: PAGE_SIZE });
  const stats = useGetAuditStatsQuery({ from: filters.from, to: filters.to });

  const setFilter = (key: keyof FilterInputs) => (event: ChangeEvent<HTMLInputElement>) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const maxTypeCount = Math.max(1, ...(stats.data?.byType.map((item) => item.count) ?? []));

  return (
    <>
      <PageHeader title="Auditoría" description="Registro de eventos de todos los servicios." />

      <div className="mb-6 grid gap-6 sm:grid-cols-3">
        <StatCard label="Eventos totales" value={stats.data?.total} isLoading={stats.isLoading} />
        <StatCard
          label="Inicios de sesión fallidos"
          value={stats.data?.failedLogins}
          isLoading={stats.isLoading}
        />
        <StatCard label="Cuentas bloqueadas" value={stats.data?.lockedAccounts} isLoading={stats.isLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TextField
              label="Tipo de evento"
              placeholder="user.created"
              list="audit-event-types"
              value={inputs.type}
              onChange={setFilter('type')}
            />
            <datalist id="audit-event-types">
              {stats.data?.byType.map((item) => (
                <option key={item.type} value={item.type} />
              ))}
            </datalist>
            <TextField
              label="ID del actor"
              placeholder="UUID"
              value={inputs.actorId}
              error={actorIdIsInvalid ? 'Debe ser un UUID válido' : undefined}
              onChange={setFilter('actorId')}
            />
            <TextField label="Desde" type="date" value={inputs.from} onChange={setFilter('from')} />
            <TextField label="Hasta" type="date" value={inputs.to} onChange={setFilter('to')} />
          </div>
          <DataTable
            columns={columns}
            rows={entries.data?.items}
            rowKey={(entry) => entry.eventId}
            isLoading={entries.isLoading}
            isError={entries.isError}
            onRetry={entries.refetch}
            emptyMessage="No hay eventos para los filtros seleccionados."
          />
          {entries.data && (
            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={entries.data.total}
              onPageChange={setPage}
              disabled={entries.isFetching}
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Eventos por tipo</h2>
          {stats.isLoading && <Skeleton className="h-40 w-full" />}
          {stats.isError && <p className="text-sm text-ink-soft">No se pudieron cargar las estadísticas.</p>}
          {stats.data?.byType.length === 0 && (
            <p className="text-sm text-ink-soft">Sin eventos en el rango.</p>
          )}
          <ul className="space-y-3">
            {stats.data?.byType.map(({ type, count }) => (
              <li key={type}>
                <div className="flex justify-between text-sm">
                  <span className="truncate text-ink">{type}</span>
                  <span className="font-semibold text-ink">{count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-primary-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxTypeCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
};
