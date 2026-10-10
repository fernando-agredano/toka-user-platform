import type { ReactNode } from 'react';

type Side = 'right' | 'top';

const SIDE_CLASSES: Record<Side, string> = {
  right: 'left-full top-1/2 ml-3 -translate-y-1/2',
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
};

interface TooltipProps {
  label: string;
  side?: Side;
  /** Hides the bubble, e.g. when the control already shows its own label. */
  disabled?: boolean;
  children: ReactNode;
}

/** Help bubble shown on hover and keyboard focus (desktop only). */
export const Tooltip = ({ label, side = 'right', disabled = false, children }: TooltipProps) => (
  <span className="group relative flex">
    {children}
    {!disabled && (
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-sm bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:block ${SIDE_CLASSES[side]}`}
      >
        {label}
      </span>
    )}
  </span>
);
