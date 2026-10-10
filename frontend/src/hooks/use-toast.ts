import { type ToastKind, toastPushed } from '@/api/toast-slice';
import { useMemo } from 'react';
import { useAppDispatch } from './redux';

type Notify = (message: string, title?: string) => void;

/** Dynamic notifications. API failures are toasted automatically by the store's error listener. */
export const useToast = (): Record<ToastKind, Notify> => {
  const dispatch = useAppDispatch();
  return useMemo(() => {
    const notifier =
      (kind: ToastKind): Notify =>
      (message, title) => {
        dispatch(toastPushed(kind, message, title));
      };
    return {
      success: notifier('success'),
      error: notifier('error'),
      info: notifier('info'),
      warning: notifier('warning'),
    };
  }, [dispatch]);
};
