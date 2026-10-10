import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  forwardRef,
  useId,
} from 'react';

const CONTROL_CLASSES =
  'w-full rounded-sm border px-4 py-3 text-base text-ink transition-colors placeholder:text-ink-muted focus:outline-none focus:ring-2 disabled:opacity-60';

const STATE_CLASSES = {
  invalid: 'border-danger bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] focus:ring-danger',
  valid: 'border-success bg-card pr-11 focus:ring-success',
  idle: 'border-line-strong bg-card focus:ring-primary',
};

const controlState = (error?: string, valid?: boolean) => (error ? 'invalid' : valid ? 'valid' : 'idle');

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-success"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

const FieldShell = ({ id, label, error, hint, children }: FieldShellProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      {label}
    </label>
    {children}
    {/* The slot is always reserved (two lines when there is a hint) so errors never shift the layout. */}
    <div className={hint ? 'min-h-8' : 'min-h-5'}>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-soft">{hint}</p>
      )}
    </div>
  </div>
);

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** Shows the success state (green border and check mark) once the value has been accepted. */
  valid?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, hint, valid, className = '', ...rest }, ref) => {
    const id = useId();
    const state = controlState(error, valid);
    return (
      <FieldShell id={id} label={label} error={error} hint={hint}>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${CONTROL_CLASSES} ${STATE_CLASSES[state]} ${className}`}
            {...rest}
          />
          {state === 'valid' && <CheckIcon />}
        </div>
      </FieldShell>
    );
  },
);
TextField.displayName = 'TextField';

export const SelectField = forwardRef<
  HTMLSelectElement,
  Omit<FieldProps, 'valid'> & SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, hint, className = '', children, ...rest }, ref) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        className={`${CONTROL_CLASSES} ${STATE_CLASSES[error ? 'invalid' : 'idle']} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});
SelectField.displayName = 'SelectField';
