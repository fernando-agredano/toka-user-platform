import type { ChatResponse } from '@/@types/api';
import { Badge } from '../ui/Badge';

const qualityTone = (score: number) => (score >= 0.8 ? 'success' : score >= 0.5 ? 'warning' : 'danger');

const MetricItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-ink-soft">{label}</dt>
    <dd className="text-sm font-semibold text-ink">{value}</dd>
  </div>
);

/** Answer text plus everything the agent reports about how it got there: sources, tools, metrics, quality. */
export const AssistantMessage = ({ response }: { response: ChatResponse }) => {
  const { answer, sources, toolsUsed, metrics, quality } = response;

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-wrap text-sm text-ink">{answer}</p>

      {sources.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Fuentes</h3>
          <ul className="space-y-1">
            {sources.map((source, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: sources have no stable id in the contract
              <li key={index} className="rounded-sm bg-page p-2 text-xs text-ink-soft">
                <span className="font-medium text-ink">
                  {source.title ?? source.source ?? `Fuente ${index + 1}`}
                </span>
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

      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-5">
        <MetricItem label="Latencia" value={`${metrics.latencyMs} ms`} />
        <MetricItem label="Tokens (in/out)" value={`${metrics.inputTokens}/${metrics.outputTokens}`} />
        <MetricItem label="Costo" value={`$${metrics.costUsd.toFixed(6)}`} />
        <MetricItem label="Caché" value={metrics.cached ? 'Sí' : 'No'} />
        <div>
          <dt className="text-xs text-ink-soft">Calidad</dt>
          <dd>
            <Badge tone={qualityTone(quality.score)}>{Math.round(quality.score * 100)}%</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
};
