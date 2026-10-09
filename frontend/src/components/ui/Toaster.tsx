import { type Toast, selectToasts, toastDismissed } from '@/api/toast-slice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useEffect } from 'react';

const AUTO_DISMISS_MS = 5000;

const TONE_CLASSES: Record<Toast['kind'], string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-md border-l-4 bg-card p-4 text-sm text-ink shadow-lg ${TONE_CLASSES[toast.kind]}`}
    >
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        aria-label="Cerrar notificación"
        className="text-ink-muted hover:text-ink"
        onClick={() => dispatch(toastDismissed(toast.id))}
      >
        ✕
      </button>
    </div>
  );
};

export const Toaster = () => {
  const toasts = useAppSelector(selectToasts);
  return (
    <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
