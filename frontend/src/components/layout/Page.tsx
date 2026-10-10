import type { ReactNode } from 'react';
import { NotificationBell } from './NotificationBell';

interface PageProps {
  title: string;
  subtitle?: string;
  /** Makes the content fill the visible height (no outer scroll) instead of growing with its content. */
  fill?: boolean;
  children: ReactNode;
}

/** Fixed header (same height as the sidebar logo row, with the notification bell) above the content area. */
export const Page = ({ title, subtitle, fill = false, children }: PageProps) => (
  <div className="flex h-full min-h-0 flex-col">
    <header className="relative z-20 flex h-[4.5rem] shrink-0 items-center justify-between gap-4 border-b border-line bg-card px-6 md:px-10">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-soft">{subtitle}</p>}
      </div>
      <NotificationBell />
    </header>
    <div
      className={`min-h-0 flex-1 overscroll-none p-6 md:p-10 ${
        fill ? 'flex flex-col overflow-y-auto md:pb-10' : 'overflow-y-auto pb-24 md:pb-24'
      }`}
    >
      {children}
    </div>
  </div>
);
