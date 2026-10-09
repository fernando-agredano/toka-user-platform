import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  forwardRef,
  useId,
} from 'react';

const CONTROL_CLASSES =
  'w-full rounded-sm border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

const FieldShell = ({ id, label, error, hint, children }: FieldShellProps) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      {label}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="text-xs text-danger">
        {error}
      </p>
    ) : (
      hint && <p className="text-xs text-ink-soft">{hint}</p>
    )}
  </div>
);

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, hint, className = '', ...rest }, ref) => {
    const id = useId();
    return (
      <FieldShell id={id} label={label} error={error} hint={hint}>
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${CONTROL_CLASSES} ${error ? 'border-danger' : 'border-line'} ${className}`}
          {...rest}
        />
      </FieldShell>
    );
  },
);
TextField.displayName = 'TextField';

export const SelectField = forwardRef<
  HTMLSelectElement,
  FieldProps & SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, hint, className = '', children, ...rest }, ref) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        className={`${CONTROL_CLASSES} ${error ? 'border-danger' : 'border-line'} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});
SelectField.displayName = 'SelectField';
