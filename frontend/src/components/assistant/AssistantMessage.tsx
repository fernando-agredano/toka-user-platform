import type { ChatResponse } from '@/@types/api';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';

const qualityTone = (score: number) => (score >= 0.8 ? 'success' : score >= 0.5 ? 'warning' : 'danger');

const MetricItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-[11px] text-ink-muted">{label}</dt>
    <dd className="text-xs font-semibold text-ink">{value}</dd>
  </div>
);

/** Answer text plus what the agent reports about how it got there: sources, tools, metrics, quality. */
export const AssistantMessage = ({ response }: { response: ChatResponse }) => {
  const { answer, sources, toolsUsed, metrics, quality } = response;

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{answer}</p>

      {sources.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Fuentes
          </h3>
          <ul className="space-y-1.5">
            {sources.map((source, index) => (
              <li key={source.id} className="rounded-md bg-page p-2.5 text-xs text-ink-soft">
                <span className="font-medium text-ink">
                  [{source.id}] {source.title ?? source.source ?? `Fuente ${index + 1}`}
                </span>
                {source.section && ` › ${source.section}`}
                {source.score !== undefined && ` · relevancia ${source.score.toFixed(2)}`}
                {source.snippet && <p className="mt-1">{source.snippet}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {toolsUsed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-soft">Herramientas:</span>
          {toolsUsed.map((tool) => (
            <Badge key={tool} tone="info">
              {tool}
            </Badge>
          ))}
        </div>
      )}

      <details className="group border-t border-line pt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink-soft hover:text-primary">
          Detalles técnicos
          <Icon name="chevronDown" className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <MetricItem label="Modelo" value={metrics.provider ?? '—'} />
          <MetricItem label="Latencia" value={`${metrics.latencyMs} ms`} />
          <MetricItem label="Tokens (in/out)" value={`${metrics.inputTokens}/${metrics.outputTokens}`} />
          <MetricItem label="Costo" value={`$${metrics.costUsd.toFixed(6)}`} />
          <MetricItem label="Caché" value={metrics.cached ? 'Sí' : 'No'} />
          <div>
            <dt className="text-[11px] text-ink-muted">Calidad</dt>
            <dd>
              <Badge tone={qualityTone(quality.score)}>{Math.round(quality.score * 100)}%</Badge>
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
};
