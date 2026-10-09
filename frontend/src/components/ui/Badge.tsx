import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  danger: { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  warning: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  info: { pill: 'bg-info-soft text-info', dot: 'bg-info' },
  neutral: { pill: 'bg-primary-soft text-primary', dot: 'bg-primary' },
};

interface BadgeProps {
  tone?: BadgeTone;
  withDot?: boolean;
  children: ReactNode;
}

export const Badge = ({ tone = 'neutral', withDot = false, children }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone].pill}`}
  >
    {withDot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASSES[tone].dot}`} />}
    {children}
  </span>
);
