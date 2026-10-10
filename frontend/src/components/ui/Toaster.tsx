import { TOAST_TITLES, type Toast, selectToasts, toastDismissed } from '@/api/toast-slice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';

// Keep in sync with the `toast-progress` duration in tailwind.config.ts.
const AUTO_DISMISS_MS = 5000;

interface ToastTone {
  icon: IconName;
  badge: string;
  bar: string;
}

const TONES: Record<Toast['kind'], ToastTone> = {
  success: { icon: 'check', badge: 'bg-success-soft text-success', bar: 'bg-success' },
  error: { icon: 'alert', badge: 'bg-danger-soft text-danger', bar: 'bg-danger' },
  info: { icon: 'info', badge: 'bg-info-soft text-info', bar: 'bg-info' },
  warning: { icon: 'alert', badge: 'bg-warning-soft text-warning', bar: 'bg-warning' },
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const dispatch = useAppDispatch();
  const tone = TONES[toast.kind];

  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="relative animate-toast-in overflow-hidden rounded-lg border border-line bg-card shadow-lg motion-reduce:animate-none"
    >
      <div className="flex items-start gap-3 p-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
          <Icon name={tone.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-ink">{toast.title ?? TOAST_TITLES[toast.kind]}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{toast.message}</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar notificación"
          className="rounded-sm p-1 text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink"
          onClick={() => dispatch(toastDismissed(toast.id))}
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <div
        aria-hidden="true"
        className={`h-1 origin-left animate-toast-progress motion-reduce:animate-none ${tone.bar}`}
      />
    </div>
  );
};

export const Toaster = () => {
  const toasts = useAppSelector(selectToasts);
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
