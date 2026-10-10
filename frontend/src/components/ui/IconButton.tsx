import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: IconName;
  /** Accessible name (there is no visible label or tooltip). */
  label: string;
}

export const IconButton = ({ icon, label, className = '', ...rest }: IconButtonProps) => (
  <button
    type="button"
    aria-label={label}
    className={`flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${className}`}
    {...rest}
  >
    <Icon name={icon} className="h-[1.15rem] w-[1.15rem]" />
  </button>
);
