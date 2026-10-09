import type { HTMLAttributes } from 'react';

export const Card = ({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-md bg-card p-6 shadow-sm ${className}`} {...rest} />
);
