import type { ReactNode } from 'react';

interface TableCardProps {
  /** Filters and actions shown above the table. */
  toolbar?: ReactNode;
  className?: string;
  children: ReactNode;
}

export const TableCard = ({ toolbar, className = '', children }: TableCardProps) => (
  <div className={`flex flex-col overflow-hidden rounded-lg border border-line bg-card ${className}`}>
    {toolbar && <div className="shrink-0 border-b border-line p-5">{toolbar}</div>}
    {children}
  </div>
);
