import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
    </div>
    {actions}
  </div>
);
