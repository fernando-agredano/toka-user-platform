import type { AuditEntry, AuditFilters } from '@/@types/api';
import { useGetAuditStatsQuery, useSearchAuditQuery } from '@/api/audit.api';
import { AuditDetailModal } from '@/components/audit/AuditDetailModal';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { TableCard } from '@/components/ui/TableCard';
import { useDebounce } from '@/hooks/use-debounce';
import { eventLabel, toneOf } from '@/utils/audit-events';
import { dayBoundaryToIso, formatDateTime, shortId } from '@/utils/format';
import { type ChangeEvent, useState } from 'react';

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FilterInputs {
  type: string;
  actorId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterInputs = { type: '', actorId: '', from: '', to: '' };

export const AuditPage = () => {
  const [inputs, setInputs] = useState<FilterInputs>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const debounced = useDebounce(inputs);

  const actorIdIsInvalid = inputs.actorId !== '' && !UUID_PATTERN.test(inputs.actorId);
  const hasActiveFilters = Object.values(inputs).some(Boolean);
  const filters: AuditFilters = {
    type: debounced.type || undefined,
    actorId: UUID_PATTERN.test(debounced.actorId) ? debounced.actorId : undefined,
    from: debounced.from ? dayBoundaryToIso(debounced.from, 'start') : undefined,
    to: debounced.to ? dayBoundaryToIso(debounced.to, 'end') : undefined,
  };

  const entries = useSearchAuditQuery({ ...filters, page, limit: PAGE_SIZE });
  const stats = useGetAuditStatsQuery({ from: filters.from, to: filters.to });

  const setFilter = (key: keyof FilterInputs) => (value: string) => {
    setInputs((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const typeOptions = [
    { value: '', label: 'Todos los eventos' },
    ...(stats.data?.byType ?? []).map(({ type }) => ({ value: type, label: eventLabel(type) })),
  ];

  const columns: Column<AuditEntry>[] = [
    {
      header: 'Fecha',
      cell: (entry) => (
        <span className="whitespace-nowrap text-ink-soft">{formatDateTime(entry.occurredAt)}</span>
      ),
    },
    {
      header: 'Evento',
      cell: (entry) => (
        <span className="whitespace-nowrap" title={entry.type}>
          <Badge tone={toneOf(entry.type)}>{eventLabel(entry.type)}</Badge>
        </span>
      ),
    },
    {
      header: 'Origen',
      cell: (entry) => <span className="whitespace-nowrap text-ink-soft">{entry.source}</span>,
    },
    {
      header: 'Actor',
      cell: (entry) => (
        <span
          className="whitespace-nowrap font-mono text-xs text-ink-soft"
          title={entry.actor.userId ?? undefined}
        >
          {entry.actor.userId ? shortId(entry.actor.userId) : '—'}
        </span>
      ),
    },
    {
      header: 'Detalle',
      className: 'text-right',
      cell: (entry) => (
        <div className="flex justify-end">
          <IconButton icon="eye" label="Ver detalle del evento" onClick={() => setSelectedEntry(entry)} />
        </div>
      ),
    },
  ];

  return (
    <Page title="Auditoría" subtitle="Registro de eventos de todos los servicios" fill>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="grid shrink-0 gap-5 sm:grid-cols-3">
          <StatCard
            label="Eventos totales"
            value={stats.data?.total}
            isLoading={stats.isLoading}
            icon="audit"
          />
          <StatCard
            label="Inicios de sesión fallidos"
            value={stats.data?.failedLogins}
            isLoading={stats.isLoading}
            icon="alert"
          />
          <StatCard
            label="Cuentas bloqueadas"
            value={stats.data?.lockedAccounts}
            isLoading={stats.isLoading}
            icon="lock"
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1fr_22rem]">
          <TableCard className="min-h-[26rem] xl:min-h-0">
            <DataTable
              className="min-h-0 flex-1"
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
          </TableCard>

          <aside className="flex min-h-0 flex-col gap-6 xl:overflow-y-auto">
            <Panel
              title="Filtros"
              subtitle="Acota los eventos de la tabla"
              action={
                hasActiveFilters && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => {
                      setInputs(EMPTY_FILTERS);
                      setPage(1);
                    }}
                  >
                    Limpiar
                  </button>
                )
              }
            >
              <div className="space-y-4">
                <Select
                  label="Tipo de evento"
                  value={inputs.type}
                  onChange={setFilter('type')}
                  options={typeOptions}
                />
                <DatePicker label="Desde" value={inputs.from} onChange={setFilter('from')} />
                <DatePicker label="Hasta" value={inputs.to} onChange={setFilter('to')} />
                <TextField
                  label="ID del actor"
                  placeholder="UUID"
                  value={inputs.actorId}
                  error={actorIdIsInvalid ? 'Debe ser un UUID válido' : undefined}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFilter('actorId')(event.target.value)
                  }
                />
              </div>
            </Panel>
          </aside>
        </div>
      </div>
      {selectedEntry && <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </Page>
  );
};
