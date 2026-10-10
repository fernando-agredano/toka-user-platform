import type { InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const SearchInput = ({ label, className = '', ...rest }: SearchInputProps) => (
  <div className={`relative ${className}`}>
    <Icon
      name="search"
      className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
    />
    <input
      type="search"
      aria-label={label}
      className="w-full rounded-sm border border-line-strong bg-card py-2.5 pl-11 pr-4 text-sm text-ink transition-colors placeholder:text-ink-muted hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      {...rest}
    />
  </div>
);
