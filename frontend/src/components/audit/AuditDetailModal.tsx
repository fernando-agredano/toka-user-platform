import type { AuditEntry } from '@/@types/api';
import { CopyButton } from '@/components/ui/CopyButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { eventLabel, toneOf } from '@/utils/audit-events';
import { formatDateTime } from '@/utils/format';
import type { ReactNode } from 'react';

const TONE_STYLES: Record<ReturnType<typeof toneOf>, { icon: IconName; badge: string }> = {
  success: { icon: 'check', badge: 'bg-success-soft text-success' },
  danger: { icon: 'alert', badge: 'bg-danger-soft text-danger' },
  warning: { icon: 'alert', badge: 'bg-warning-soft text-warning' },
  info: { icon: 'info', badge: 'bg-info-soft text-info' },
  neutral: { icon: 'info', badge: 'bg-primary-soft text-primary' },
};

const Tile = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0 rounded-lg border border-line p-4">
    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
    <dd className="mt-1.5 break-all text-sm font-medium text-ink">{children}</dd>
  </div>
);

const IdRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-3 py-3">
    <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
    <dd className="min-w-0 flex-1 break-all font-mono text-xs text-ink">{value}</dd>
    <CopyButton text={value} what={label} />
  </div>
);

const formatValue = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

export const AuditDetailModal = ({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) => {
  const tone = TONE_STYLES[toneOf(entry.type)];
  const dataRows = Object.entries(entry.data);

  return (
    <Modal title="Detalle del evento" size="lg" onClose={onClose}>
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl bg-page p-5">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
          <Icon name={tone.icon} className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight text-ink">{eventLabel(entry.type)}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-soft">{entry.type}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Ocurrió</p>
          <p className="text-sm font-semibold text-ink">{formatDateTime(entry.occurredAt)}</p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Tile label="Origen">{entry.source}</Tile>
        <Tile label="Actor">
          <span className="font-mono text-xs">{entry.actor.userId ?? 'Sistema'}</span>
        </Tile>
        <Tile label="Dirección IP">{entry.actor.ip ?? '—'}</Tile>
      </dl>

      <dl className="mt-4 divide-y divide-line rounded-lg border border-line px-4">
        <IdRow label="ID de correlación" value={entry.correlationId} />
        <IdRow label="ID del evento" value={entry.eventId} />
      </dl>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Datos del evento
          </h3>
          {dataRows.length > 0 && <CopyButton text={JSON.stringify(entry.data, null, 2)} what="JSON" />}
        </div>
        {dataRows.length > 0 ? (
          <dl className="max-h-52 divide-y divide-line overflow-y-auto rounded-lg border border-line px-4">
            {dataRows.map(([key, value]) => (
              <div key={key} className="flex gap-3 py-2.5">
                <dt className="w-28 shrink-0 font-mono text-xs text-ink-soft">{key}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-xs text-ink">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-ink-soft">
            Este evento no incluye datos adicionales.
          </p>
        )}
      </div>
    </Modal>
  );
};
