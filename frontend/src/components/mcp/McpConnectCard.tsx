import { CodeBlock } from '@/components/ui/CodeBlock';
import { Icon } from '@/components/ui/Icon';
import { Panel } from '@/components/ui/Panel';
import type { ReactNode } from 'react';

const Step = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => (
  <li className="flex gap-4">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
      {number}
    </span>
    <div className="min-w-0 flex-1 space-y-3">
      <h3 className="pt-0.5 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  </li>
);

const CAPABILITIES = [
  { count: 7, label: 'de lectura' },
  { count: 2, label: 'de escritura' },
  { count: 2, label: 'destructivas' },
];

export const McpConnectCard = () => {
  const serverUrl = `${window.location.origin}/mcp`;
  const addCommand = `claude mcp add --transport http toka ${serverUrl} \\\n  --header "Authorization: Bearer <token>"`;

  return (
    <Panel title="Conectar un asistente" subtitle="Claude Code, Claude Desktop o Cursor">
      <ol className="space-y-6">
        <Step number={1} title="Copia la URL del servidor">
          <CodeBlock title="URL del servidor" code={serverUrl} />
        </Step>
        <Step number={2} title="Regístralo en tu asistente">
          <CodeBlock title="Comando para Claude Code" code={addCommand} />
          <p className="text-xs text-ink-soft">
            El token de acceso dura 15 minutos. Desde el repositorio,{' '}
            <code className="font-mono">npm run review:mcp</code> lo registra con renovación automática.
          </p>
        </Step>
        <Step number={3} title="Qué puede hacer">
          <ul className="grid grid-cols-3 gap-2">
            {CAPABILITIES.map(({ count, label }) => (
              <li key={label} className="rounded-lg border border-line p-3 text-center">
                <p className="text-2xl font-bold leading-none text-ink">{count}</p>
                <p className="mt-1.5 text-[11px] text-ink-soft">{label}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">Las destructivas piden confirmación antes de cambiar nada.</p>
        </Step>
      </ol>
      <div className="mt-6 flex gap-3 rounded-lg bg-primary-soft p-4">
        <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-ink">
          El servidor no tiene identidad propia: reenvía tu sesión, así que cada herramienta respeta tus
          permisos.
        </p>
      </div>
    </Panel>
  );
};
