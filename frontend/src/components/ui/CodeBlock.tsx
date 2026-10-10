import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  title: string;
  code: string;
}

export const CodeBlock = ({ title, code }: CodeBlockProps) => (
  <div className="overflow-hidden rounded-lg border border-line bg-page">
    <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</span>
      <CopyButton text={code} what={title} />
    </div>
    <pre className="whitespace-pre-wrap break-words p-3.5 font-mono text-xs leading-relaxed text-ink">
      {code}
    </pre>
  </div>
);
